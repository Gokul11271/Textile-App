const { BrowserWindow, app, shell } = require('electron');
const { dbAll, dbGet } = require('../database.cjs');
const { renderTemplate, clearCache } = require('./templateEngine.cjs');
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

  const isBaleEnabled = !!(bill.isBaleEnabled || bill.is_bale_enabled);

  const BALE_TH = isBaleEnabled 
    ? '<th style="width: 60px;" class="text-center">BALE</th>' 
    : '';

  const PARTICULARS_TH = `<th class="text-center">PARTICULARS (HSN 6304)</th>`;

  const MIN_ROWS_BIG       = 12;
  const MIN_ROWS_TRANSPORT = 8;
  const minRows = type === 'big' ? MIN_ROWS_BIG : MIN_ROWS_TRANSPORT;

  const ITEMS_ROWS = items.map(item => `
    <tr>
      <td class="text-center">${item.size || '-'}</td>
      <td class="text-center">${type === 'big' ? (item.productName || item.product_name || '') : '100% COTTON CLOTH'}</td>
      <td class="text-center numeric-cell">${item.quantity}</td>
      <td class="text-center numeric-cell">${Number(item.rate || 0).toFixed(2)}</td>
      ${isBaleEnabled ? `<td class="text-center">${item.baleNumber || item.bale_number || '-'}</td>` : ''}
      <td class="text-center numeric-cell">${Number(item.amount || 0).toFixed(2)}</td>
    </tr>`).join('');

  const EMPTY_ROWS = Array(Math.max(0, minRows - items.length)).fill(0).map(() =>
    `<tr><td></td><td></td><td></td><td></td>${isBaleEnabled ? '<td></td>' : ''}<td></td></tr>`
  ).join('');

  const TOTAL_QTY = items.reduce((s, i) => s + Number(i.quantity || 0), 0);

  const DISCOUNT_ROW = b.discountAmount > 0 ? `
    <div class="calc-row">
      <div class="calc-label">Discount ${discountText}</div>
      <div class="calc-value" style="color: #666;">
        <div class="amount-box">
          <span>- &#8377;</span>
          <span>${b.discountAmount.toFixed(2)}</span>
        </div>
      </div>
    </div>` : '';

  const TAX_ROWS_BIG = isLocal ? `
    <div class="calc-row">
      <div class="calc-label">CGST (${splitTaxRate}%)</div>
      <div class="calc-value">${(b.taxAmount / 2).toFixed(2)}</div>
    </div>
    <div class="calc-row">
      <div class="calc-label">SGST (${splitTaxRate}%)</div>
      <div class="calc-value">${(b.taxAmount / 2).toFixed(2)}</div>
    </div>` : `
    <div class="calc-row">
      <div class="calc-label">IGST (${taxRate}%)</div>
      <div class="calc-value">${b.taxAmount.toFixed(2)}</div>
    </div>`;

  const TAX_ROWS_TRANSPORT = isLocal ? `
    <div class="calc-row">
      <div class="calc-label">CGST (${splitTaxRate}%)</div>
      <div class="calc-value">${transportSplitTaxAmt}</div>
    </div>
    <div class="calc-row">
      <div class="calc-label">SGST (${splitTaxRate}%)</div>
      <div class="calc-value">${transportSplitTaxAmt}</div>
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
    PARTICULARS_TH,
    BALE_TH,
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

const getBillHtml = (bill, items, type = 'big', settings = {}, copiesCount = 2) => {
  const vars = buildTemplateVars(bill, items, type, settings);
  clearCache(); // Force reload template without app restart during dev
  
  if (type === 'transport') {
    const getCopyLabel = (index) => {
      if (index === 0) return 'Transport Copy - Original for Recipient';
      if (index === 1) return 'Transport Copy - Duplicate for Supplier';
      if (index === 2) return 'Transport Copy - Triplicate';
      if (index === 3) return 'Transport Copy - Quadruplicate';
      return `Transport Copy - Copy ${index + 1}`;
    };

    const actualCopiesCount = Math.max(1, copiesCount);
    let sheetsHtml = '';

    for (let i = 0; i < actualCopiesCount; i += 2) {
      const isSingle = (i === actualCopiesCount - 1);
      const modeClass = isSingle ? 'single-mode' : 'double-mode';
      
      const copiesToRender = isSingle ? [getCopyLabel(i)] : [getCopyLabel(i), getCopyLabel(i + 1)];
      
      const copiesHtml = copiesToRender.map(label => {
        return renderTemplate('transport_inner.html', { ...vars, COPY_LABEL: label });
      }).join('');
      
      sheetsHtml += `<div class="sheet ${modeClass}">${copiesHtml}</div>`;
    }

    return renderTemplate('transport.html', { ...vars, SHEETS_HTML: sheetsHtml });
  } else {
    return renderTemplate('big.html', vars);
  }
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

const generateBillPdf = async (bill, items, type = 'big', copiesCount = 2) => {
  return printQueue.addTask(async () => {
    try {
      const win      = getPrintWindow();
      const settings = await getSettingsObj();
      const html     = getBillHtml(bill, items, type, settings, copiesCount);

      await win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);

      const docPath  = app.getPath('documents');
      const fileName = await buildPdfFilename(bill, type);
      const pdfPath  = path.join(docPath, 'Dhanalakshmi_Bills', fileName);
      const dir      = path.dirname(pdfPath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

      const pdfOptions = { marginsType: 1, printBackground: true, pageSize: 'A4' };
      if (type === 'transport') pdfOptions.landscape = true;
      const data = await win.webContents.printToPDF(pdfOptions);
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
      const html     = getBillHtml(bill, items, type, settings, copies);

      await win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);

      const result = await new Promise((resolve) => {
        const printOptions = { silent: true, printBackground: true, deviceName: '', copies };
        if (type === 'transport') {
          printOptions.landscape = true;
          printOptions.copies = 1; // Both copies are rendered on the same page
        }
        win.webContents.print(
          printOptions,
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

const printPartyStatement = async (partyId, startDate, endDate) => {
  return printQueue.addTask(async () => {
    try {
      const win = getPrintWindow();
      const settings = await getSettingsObj();
      
      const party = await dbGet('SELECT * FROM parties WHERE id = ?', [partyId]);
      if (!party) throw new Error('Party not found');
      
      const customer = await dbGet('SELECT name FROM customers WHERE id = ?', [party.customer_id]);
      const partyName = customer ? customer.name : party.short_name;

      const bills = await dbAll('SELECT id, bill_number, date as entry_date, total_amount as debit, 0 as credit, "BILL" as type FROM bills WHERE party_id = ?', [partyId]);
      const payments = await dbAll('SELECT id, payment_mode, remarks, payment_date as entry_date, 0 as debit, amount as credit, "PAYMENT" as type FROM payments WHERE party_id = ?', [partyId]);

      let transactions = [...bills, ...payments];
      transactions.sort((a, b) => {
        const d1 = new Date(a.entry_date).getTime();
        const d2 = new Date(b.entry_date).getTime();
        if (d1 === d2) {
          if (a.type === 'BILL' && b.type === 'PAYMENT') return -1;
          if (a.type === 'PAYMENT' && b.type === 'BILL') return 1;
          return a.id - b.id;
        }
        return d1 - d2;
      });

      let balance = party.opening_balance || 0;
      let totalBilled = 0;
      let totalPaid = 0;
      let htmlRows = '';

      // We calculate running balance from the start
      for (const t of transactions) {
        if (t.type === 'BILL') {
          balance += t.debit;
          totalBilled += t.debit;
        } else {
          balance -= t.credit;
          totalPaid += t.credit;
        }
        
        const dateStr = t.entry_date.split('-').reverse().join('-');
        const particulars = t.type === 'BILL' ? 'Sales Bill' : `Payment Received (${t.payment_mode})<br><span class="remarks">${t.remarks || ''}</span>`;
        const refNo = t.type === 'BILL' ? t.bill_number : `PAY-${t.id}`;
        
        htmlRows += `
        <tr>
          <td class="text-center">${dateStr}</td>
          <td>${particulars}</td>
          <td class="text-center">${refNo}</td>
          <td class="text-right">${t.debit > 0 ? t.debit.toFixed(2) : '-'}</td>
          <td class="text-right">${t.credit > 0 ? t.credit.toFixed(2) : '-'}</td>
          <td class="text-right">${balance.toFixed(2)}</td>
        </tr>`;
      }
      
      const activeCompanyId = settings.activeCompany || 'company1';
      const company = settings[activeCompanyId] || { name: 'COMPANY', address1: '' };
      
      const vars = {
         PARTY_NAME: partyName,
         PARTY_ADDRESS: party.address || '',
         PARTY_GST: party.gst_number || 'N/A',
         COMPANY_NAME: company.name || 'COMPANY',
         COMPANY_ADDRESS: (company.address1 || '') + ' ' + (company.address2 || ''),
         PERIOD: (startDate && endDate) ? `${startDate} to ${endDate}` : 'All Time',
         GENERATED_ON: new Date().toLocaleDateString('en-IN'),
         OPENING_BALANCE: (party.opening_balance || 0).toFixed(2),
         TRANSACTIONS_HTML: htmlRows,
         TOTAL_BILLED: totalBilled.toFixed(2),
         TOTAL_PAID: totalPaid.toFixed(2),
         CLOSING_BALANCE: balance.toFixed(2)
      };

      const html = renderTemplate('statement.html', vars);
      await win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);

      const docPath  = app.getPath('documents');
      const fileName = sanitizeForFilename(`Statement_${partyName}_${Date.now()}.pdf`);
      const pdfPath  = path.join(docPath, 'Dhanalakshmi_Statements', fileName);
      const dir      = path.dirname(pdfPath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

      const data = await win.webContents.printToPDF({ marginsType: 1, printBackground: true, pageSize: 'A4' });
      fs.writeFileSync(pdfPath, data);

      shell.openPath(pdfPath); // Automatically open the PDF for the user
      return { success: true, path: pdfPath };
    } catch(err) {
      logError('printService', `Statement Generation Failed`, { error: err.message });
      return { success: false, error: err.message };
    }
  });
};

const printPaymentReceipt = async (paymentId) => {
  return await printQueue.add(async () => {
    try {
      const payment = await dbGet(`
        SELECT p.*, pt.name as party_name, pt.address as party_address, c.name as customer_name
        FROM payments p
        JOIN parties pt ON p.party_id = pt.id
        LEFT JOIN customers c ON pt.customer_id = c.id
        WHERE p.id = ?
      `, [paymentId]);

      if (!payment) throw new Error('Payment not found');

      // Fetch linked bill if any
      let billDetails = '';
      if (payment.bill_id) {
        const bill = await dbGet('SELECT bill_number FROM bills WHERE id = ?', [payment.bill_id]);
        if (bill) billDetails = `Against Bill #${bill.bill_number}`;
      }

      const settings = await loadSettings();

      const templatePath = path.join(__dirname, '..', 'templates', 'payment_receipt.html');
      if (!fs.existsSync(templatePath)) throw new Error('payment_receipt.html template missing');

      let htmlContent = fs.readFileSync(templatePath, 'utf-8');

      // Replace placeholders
      const data = {
        '{{BUSINESS_NAME}}': settings.businessName || 'Your Business Name',
        '{{BUSINESS_ADDRESS}}': settings.businessAddress || 'Business Address',
        '{{BUSINESS_PHONE}}': settings.businessPhone || 'Phone',
        '{{BUSINESS_EMAIL}}': settings.businessEmail || 'Email',
        '{{RECEIPT_NO}}': `RCPT-${payment.id}`,
        '{{DATE}}': new Date(payment.payment_date).toLocaleDateString('en-IN'),
        '{{PARTY_NAME}}': payment.party_name,
        '{{AMOUNT}}': Number(payment.amount).toFixed(2),
        '{{PAYMENT_MODE}}': payment.payment_mode,
        '{{REFERENCE_NO}}': payment.reference_no || 'N/A',
        '{{BILL_DETAILS}}': billDetails || payment.payment_type.toUpperCase(),
        '{{REMARKS}}': payment.remarks || ''
      };

      for (const [key, value] of Object.entries(data)) {
        htmlContent = htmlContent.replace(new RegExp(key, 'g'), value);
      }

      const win = new BrowserWindow({ show: false, webPreferences: { nodeIntegration: true } });
      await win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(htmlContent)}`);

      const pdfPath = getPdfPath('Payment_Receipt', `${payment.id}_${payment.party_name}`);
      const pdfData = await win.webContents.printToPDF({
        printBackground: true,
        pageSize: 'A5',
        margins: { marginType: 'custom', top: 0.5, bottom: 0.5, left: 0.5, right: 0.5 }
      });

      fs.writeFileSync(pdfPath, pdfData);
      win.close();

      await shell.openPath(pdfPath);
      return { success: true, pdfPath };
    } catch (e) {
      logError('printService', 'Print Payment Receipt Error', { error: e.message });
      return { success: false, error: e.message };
    }
  });
};

module.exports = { getSettingsObj, getBillHtml, generateBillPdf, printBillDirect, printPartyStatement, printPaymentReceipt };
