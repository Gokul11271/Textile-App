const { BrowserWindow, app } = require('electron');
const { dbAll, dbGet } = require('../database.cjs');
const { renderTemplate } = require('./templateEngine.cjs');
const { info, error: logError } = require('./logService.cjs');
const fs = require('fs');
const path = require('path');

// ─── Promise Queue for Serial Execution ───────────────────────────────────────
// Ensures only one print operation happens at a time.
class PromiseQueue {
  constructor() {
    this.queue = Promise.resolve();
  }

  addTask(task) {
    const result = this.queue.then(() => task());
    this.queue = result.catch(() => {}); // Continue queue even if task fails
    return result;
  }
}

const printQueue = new PromiseQueue();

// ─── Utilities ────────────────────────────────────────────────────────────────

const numberToWords = (num) => {
  if (!num || num === 0) return 'Zero Only';
  const a = ['','One ','Two ','Three ','Four ','Five ','Six ','Seven ','Eight ','Nine ','Ten ','Eleven ','Twelve ','Thirteen ','Fourteen ','Fifteen ','Sixteen ','Seventeen ','Eighteen ','Nineteen '];
  const b = ['','','Twenty','Thirty','Forty','Fifty','Sixty','Seventy','Eighty','Ninety'];
  const convertBlock = (n) => {
    let str = '';
    if (n > 99) { str += a[Math.floor(n / 100)] + 'Hundred '; n = n % 100; }
    if (n > 19) { str += b[Math.floor(n / 10)] + ' '; if (n % 10 > 0) str += a[n % 10]; }
    else if (n > 0) { str += a[n]; }
    return str;
  };
  const integerPart = Math.floor(Math.round(num));
  let words = '';
  if (integerPart > 0) {
    if (integerPart >= 10000000) { words += convertBlock(Math.floor(integerPart / 10000000)) + 'Crore '; }
    let rem = integerPart % 10000000;
    if (rem >= 100000) { words += convertBlock(Math.floor(rem / 100000)) + 'Lakh '; }
    rem = rem % 100000;
    if (rem >= 1000) { words += convertBlock(Math.floor(rem / 1000)) + 'Thousand '; }
    rem = rem % 1000;
    if (rem > 0) { words += convertBlock(rem); }
  } else { words = 'Zero '; }
  return words.trim() + ' Only';
};

const formatGst = (gst) => {
  if (!gst) return '';
  return gst.toString().replace(/\s+/g, '').replace(/(.{3})/g, '$1 ').trim();
};

const sanitizeForFilename = (str) => {
  if (!str) return '';
  return str.replace(/[\\/:*?"<>|]/g, '').replace(/\s+/g, ' ').trim();
};

// ─── Settings ─────────────────────────────────────────────────────────────────

const getSettingsObj = async () => {
  const rows = await dbAll('SELECT key, value FROM settings');
  const s = {};
  for (const row of rows) {
    try { s[row.key] = JSON.parse(row.value); } catch(e) { s[row.key] = row.value; }
  }
  return s;
};

// ─── PDF Filename ─────────────────────────────────────────────────────────────

const buildPdfFilename = async (bill, type = 'big') => {
  const billNo   = sanitizeForFilename(bill.billNumber || bill.bill_number || '');
  const date     = sanitizeForFilename(bill.date || '');
  const partyName = sanitizeForFilename(bill.partyName || bill.party_name || '');
  const lorry    = sanitizeForFilename(bill.lorryOffice || bill.lorry_office || '');

  let agentName = '';
  const agentId = bill.agentId || bill.agent_id;
  if (agentId) {
    const agent = await dbGet('SELECT name FROM agents WHERE id = ?', [agentId]);
    if (agent && agent.name) agentName = sanitizeForFilename(agent.name);
  }

  const parts = [billNo, date];
  if (agentName) parts.push(agentName);
  parts.push(partyName);
  if (lorry) parts.push(lorry);

  const prefix = type === 'big' ? 'Bill' : 'Transport';
  const baseName = parts.filter(p => p).join('_');
  return `${prefix}_${baseName}.pdf`;
};

// ─── Template Data Builder ────────────────────────────────────────────────────

const buildTemplateVars = (bill, items, type, settings) => {
  const activeCompanyId = settings.activeCompany || 'company1';
  const company = settings[activeCompanyId] || {
    name: 'DHANALAKSHMI TEXTILES',
    address1: '4/2C PUDUVALASU, K.G VALASU(PO), CHENNIMALAI(VIA)',
    address2: 'ERODE DIST, TAMIL NADU - 638051',
    gst: '33AXHPA9951A1ZU',
    phone: '+91 98427 64988',
    bankName: 'PUNJAB NATIONAL BANK',
    accNo: '5893002100002556',
    ifsc: 'PUNB0589300',
    terms: '1. Goods once sold will not be taken back.<br/>2. All disputes subject to Erode jurisdiction.'
  };

  const showBankOnTransport = settings.showBankOnTransport !== false;

  // Normalize field names (DB snake_case vs frontend camelCase)
  const b = {
    billNumber:      bill.billNumber     || bill.bill_number    || '',
    date:            bill.date           || '',
    partyName:       bill.partyName      || bill.party_name     || '',
    partyAddress:    bill.partyAddress   || bill.party_address  || '',
    partyGst:        bill.partyGst       || bill.party_gst_number || '',
    taxRate:     Number(bill.taxRate     || bill.tax_rate       || 5),
    taxAmount:   Number(bill.taxAmount   || bill.tax_amount     || 0),
    totalAmount: Number(bill.totalAmount || bill.total_amount   || 0),
    discountPercent: Number(bill.discountPercent || bill.discount_percent || 0),
    discountAmount:  Number(bill.discountAmount  || bill.discount_amount  || 0),
    lorryOffice: bill.lorryOffice  || bill.lorry_office || '',
    lrNumber:    bill.lrNumber     || bill.lr_number    || '',
    isInterState: !!(bill.isInterState || bill.is_inter_state),
    agentId:     bill.agentId      || bill.agent_id     || null,
    baleNumbers: bill.baleNumbers  || bill.bale_numbers || '[]',
    financialYear: bill.financialYear || ''
  };

  const isLocal        = !b.isInterState;
  const taxRate        = b.taxRate;
  const splitTaxRate   = (taxRate / 2).toFixed(1);
  const subtotal       = items.reduce((s, i) => s + Number(i.amount || 0), 0);
  const discountText   = b.discountPercent > 0 ? `${b.discountPercent}%` : '';

  // Compute transport totals (no discount applied)
  const transportTaxAmt       = (subtotal * (taxRate || 0)) / 100;
  const transportTotal        = subtotal + transportTaxAmt;
  const transportSplitTaxAmt  = (transportTaxAmt / 2).toFixed(2);

  // ── Shared partial HTML snippets ──────────────────────────────────────────

  const PARTY_GST_ROW = b.partyGst
    ? `<div class="party-gst">GSTIN/ID: ${formatGst(b.partyGst)}</div>`
    : '';

  const PARTY_GST_ROW_HIGHLIGHT = b.partyGst
    ? `<div class="party-gst"><span class="highlighted">GSTIN/ID: ${formatGst(b.partyGst)}</span></div>`
    : '';

  const MIN_ROWS_BIG       = 12;
  const MIN_ROWS_TRANSPORT = 8;
  const minRows = type === 'big' ? MIN_ROWS_BIG : MIN_ROWS_TRANSPORT;

  const ITEMS_ROWS = items.map(item => `
    <tr>
      <td class="text-center" style="border-left: none;">${item.size || '-'}</td>
      <td>${type === 'big' ? (item.productName || '') : '100% COTTON CLOTH'}</td>
      <td class="text-center">${item.quantity}</td>
      <td class="text-center">${Number(item.rate || 0).toFixed(2)}</td>
      <td class="text-right" style="border-right: none;">${Number(item.amount || 0).toFixed(2)}</td>
    </tr>`).join('');

  const EMPTY_ROWS = Array(Math.max(0, minRows - items.length)).fill(0).map(() =>
    `<tr style="height: 22px;"><td style="border-left: none;"></td><td></td><td></td><td></td><td style="border-right: none;"></td></tr>`
  ).join('');

  const TOTAL_QTY = items.reduce((s, i) => s + Number(i.quantity || 0), 0);

  const DISCOUNT_ROW = b.discountAmount > 0 ? `
    <div class="calc-row">
      <div class="calc-label">Discount ${discountText}</div>
      <div class="calc-value" style="color: #666;">- &#8377; ${b.discountAmount.toFixed(2)}</div>
    </div>` : '';

  const TAX_ROWS_BIG = isLocal ? `
    <div class="calc-row" style="flex-direction: column;">
      <div style="display:flex; width:100%; border-bottom: 0.5pt solid #000;">
        <div class="calc-label" style="border-bottom:none;">CGST (${splitTaxRate}%)</div>
        <div class="calc-value">${(b.taxAmount / 2).toFixed(2)}</div>
      </div>
      <div style="display:flex; width:100%;">
        <div class="calc-label" style="border-bottom:none;">SGST (${splitTaxRate}%)</div>
        <div class="calc-value">${(b.taxAmount / 2).toFixed(2)}</div>
      </div>
    </div>` : `
    <div class="calc-row">
      <div class="calc-label">IGST (${taxRate}%)</div>
      <div class="calc-value">${b.taxAmount.toFixed(2)}</div>
    </div>`;

  const TAX_ROWS_TRANSPORT = isLocal ? `
    <div class="calc-row" style="flex-direction: column;">
      <div style="display:flex; width:100%; border-bottom: 0.5pt solid #000;">
        <div class="calc-label" style="border-bottom:none;">CGST (${splitTaxRate}%)</div>
        <div class="calc-value">${transportSplitTaxAmt}</div>
      </div>
      <div style="display:flex; width:100%;">
        <div class="calc-label" style="border-bottom:none;">SGST (${splitTaxRate}%)</div>
        <div class="calc-value">${transportSplitTaxAmt}</div>
      </div>
    </div>` : `
    <div class="calc-row">
      <div class="calc-label">IGST (${taxRate}%)</div>
      <div class="calc-value">${transportTaxAmt.toFixed(2)}</div>
    </div>`;

  const balesArr = Array.isArray(b.baleNumbers)
    ? b.baleNumbers
    : JSON.parse(b.baleNumbers || '[]');

  const BALE_GRID = balesArr.concat(Array(8).fill('')).slice(0, 8)
    .map(bv => `<div class="bale-item">${bv}</div>`).join('');

  const BALE_GRID_TRANSPORT = balesArr.concat(Array(8).fill('')).slice(0, 8)
    .map(bv => `<div class="bale-item highlighted">${bv}</div>`).join('');

  const BANK_BAR = showBankOnTransport ? `
    <div class="info-bar">
      <div class="info-item" style="flex: 1;">BANK: ${company.bankName}</div>
      <div class="info-item" style="flex: 1.2;">A/C: ${company.accNo}</div>
      <div class="info-item" style="flex: 0.8;">IFSC: ${company.ifsc}</div>
    </div>` : '';

  const FINANCIAL_YEAR_LABEL = b.financialYear ? ` (${b.financialYear})` : '';

  // ── Shared tokens ──────────────────────────────────────────────────────────
  return {
    COMPANY_NAME:        company.name,
    COMPANY_ADDRESS1:    company.address1,
    COMPANY_ADDRESS2:    company.address2,
    COMPANY_GST:         company.gst,
    COMPANY_PHONE:       company.phone,
    COMPANY_BANK:        company.bankName,
    COMPANY_ACC:         company.accNo,
    COMPANY_IFSC:        company.ifsc,
    COMPANY_TERMS:       company.terms,
    BILL_NUMBER:         b.billNumber.replace(/^[^\d]*/, ''),
    FINANCIAL_YEAR_LABEL,
    DATE:                b.date,
    AGENT_TYPE:          b.agentId ? 'COMMISSION' : 'DIRECT',
    PARTY_NAME:          b.partyName,
    PARTY_ADDRESS:       b.partyAddress,
    PARTY_GST_ROW:       type === 'big' ? PARTY_GST_ROW : PARTY_GST_ROW_HIGHLIGHT,
    ITEMS_ROWS,
    EMPTY_ROWS,
    TOTAL_QTY,
    SUBTOTAL:            subtotal.toFixed(2),
    DISCOUNT_ROW,
    TAX_ROWS:            type === 'big' ? TAX_ROWS_BIG : TAX_ROWS_TRANSPORT,
    AMOUNT_WORDS:        type === 'big' ? numberToWords(b.totalAmount) : numberToWords(transportTotal),
    TOTAL_AMOUNT:        type === 'big'
      ? b.totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })
      : transportTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 }),
    LORRY:               b.lorryOffice || 'Local',
    LR_NO:               b.lrNumber   || 'N/A',
    BALE_GRID,
    BALE_GRID_TRANSPORT,
    BANK_BAR,
  };
};

// ─── Public: HTML Generator ───────────────────────────────────────────────────

const getBillHtml = (bill, items, type = 'big', settings = {}) => {
  const vars = buildTemplateVars(bill, items, type, settings);
  const templateName = type === 'big' ? 'big.html' : 'transport.html';
  return renderTemplate(templateName, vars);
};

// ─── Print Window (Singleton) ─────────────────────────────────────────────────

let printWindow = null;

const getPrintWindow = () => {
  if (!printWindow || printWindow.isDestroyed()) {
    printWindow = new BrowserWindow({ show: false, webPreferences: { sandbox: true } });
    printWindow.on('closed', () => { printWindow = null; });
  }
  return printWindow;
};

// ─── Public: PDF Generation ───────────────────────────────────────────────────

const generateBillPdf = async (bill, items, type = 'big') => {
  return printQueue.addTask(async () => {
    try {
      const win      = getPrintWindow();
      const settings = await getSettingsObj();
      const html     = getBillHtml(bill, items, type, settings);

      await win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);

      const docPath  = app.getPath('documents');
      const fileName = await buildPdfFilename(bill, type);
      const pdfPath  = path.join(docPath, 'Dhanalakshmi_Bills', fileName);
      const dir      = path.dirname(pdfPath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

      const data = await win.webContents.printToPDF({ marginsType: 1, printBackground: true, pageSize: 'A4' });
      fs.writeFileSync(pdfPath, data);

      info('printService', `PDF Generated: ${fileName}`, { billNumber: bill.billNumber, type });
      return pdfPath;
    } catch (err) {
      logError('printService', `PDF Generation Failed: ${bill.billNumber}`, { error: err.message });
      throw err;
    }
  });
};

// ─── Public: Direct Print ─────────────────────────────────────────────────────

const printBillDirect = async (bill, items, type = 'big', copies = 1) => {
  return printQueue.addTask(async () => {
    try {
      const win      = getPrintWindow();
      const settings = await getSettingsObj();
      const html     = getBillHtml(bill, items, type, settings);

      await win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);

      const result = await new Promise((resolve) => {
        win.webContents.print(
          { silent: true, printBackground: true, deviceName: '', copies },
          (success, failureReason) => {
            if (!success) resolve({ success: false, error: failureReason });
            else resolve({ success: true });
          }
        );
      });

      if (result.success) {
        info('printService', `Printed Successfully: Bill ${bill.billNumber}`, { copies, type });
      } else {
        logError('printService', `Print Failed: Bill ${bill.billNumber}`, { reason: result.error });
      }
      return result;
    } catch (err) {
      logError('printService', `Print Task Exception: ${bill.billNumber}`, { error: err.message });
      throw err;
    }
  });
};

module.exports = { getSettingsObj, getBillHtml, generateBillPdf, printBillDirect };
