const { BrowserWindow, app } = require('electron');
const { dbAll, dbGet } = require('../database.cjs');
const fs = require('fs');
const path = require('path');

const numberToWords = (num) => {
  if (!num || num === 0) return 'Zero Only';
  const a = ['','One ','Two ','Three ','Four ', 'Five ','Six ','Seven ','Eight ','Nine ','Ten ','Eleven ','Twelve ','Thirteen ','Fourteen ','Fifteen ','Sixteen ','Seventeen ','Eighteen ','Nineteen '];
  const b = ['', '', 'Twenty','Thirty','Forty','Fifty', 'Sixty','Seventy','Eighty','Ninety'];
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
  } else {
    words = 'Zero ';
  }
  return words.trim() + ' Only';
};

const formatGst = (gst) => {
  if (!gst) return '';
  return gst.toString().replace(/\s+/g, '').replace(/(.{3})/g, '$1 ').trim();
};

const getBillHtml = (bill, items, type = 'big', settings = {}) => {
  const activeCompanyId = settings.activeCompany || 'company1';
  let company = settings[activeCompanyId] || {
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
  const showDiscount = settings.showDiscount !== false;

  const b = {
    billNumber: bill.billNumber || bill.bill_number || '',
    date: bill.date || '',
    partyName: bill.partyName || bill.party_name || '',
    partyAddress: bill.partyAddress || bill.party_address || '',
    partyGst: bill.partyGst || bill.party_gst_number || '',
    taxRate: Number(bill.taxRate || bill.tax_rate || 5),
    taxAmount: Number(bill.taxAmount || bill.tax_amount || 0),
    totalAmount: Number(bill.totalAmount || bill.total_amount || 0),
    discountPercent: Number(bill.discountPercent || bill.discount_percent || 0),
    discountAmount: Number(bill.discountAmount || bill.discount_amount || 0),
    lorryOffice: bill.lorryOffice || bill.lorry_office || '',
    lrNumber: bill.lrNumber || bill.lr_number || '',
    isInterState: bill.isInterState || bill.is_inter_state || false,
    agentId: bill.agentId || bill.agent_id || null,
    baleNumbers: bill.baleNumbers || bill.bale_numbers || '[]'
  };

  const isLocal = !b.isInterState;
  const taxRate = b.taxRate;
  const splitTaxRate = (taxRate / 2).toFixed(1);
  const splitTaxAmount = (b.taxAmount / 2).toFixed(2);
  const subtotal = items.reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const discountText = b.discountPercent > 0 ? `${b.discountPercent}%` : '';

  if (type === 'big') {
    return `
      <html>
        <head>
          <style>
            @page { margin: 8mm; }
            body { 
              font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; 
              margin: 0; padding: 0; color: #1a1a1a; line-height: 1.3;
            }
            .container { border: 1.2pt solid #000; padding: 0; width: 100%; box-sizing: border-box; }
            .header-section { display: flex; border-bottom: 2pt solid #000; background: #fff; }
            .brand-area { flex: 1.8; padding: 15px; border-right: 1.2pt solid #000; }
            .brand-area h1 { margin: 0; font-size: 22pt; font-weight: 900; color: #000; letter-spacing: -0.5px; }
            .brand-area p { margin: 3px 0; font-size: 9pt; font-weight: 600; color: #444; text-transform: uppercase; }
            .meta-area { flex: 1; padding: 15px; display: flex; flex-direction: column; justify-content: space-between; }
            .invoice-title { font-size: 14pt; font-weight: 900; display: flex; justify-content: space-between; border-bottom: 1pt solid #000; padding-bottom: 5px; margin-bottom: 10px; }
            .meta-row { display: flex; justify-content: space-between; font-size: 9pt; margin-bottom: 4px; font-weight: 700; }
            .info-bar { display: flex; border-bottom: 1.2pt solid #000; background: #f9f9f9; font-size: 8.5pt; font-weight: 800; }
            .info-item { padding: 6px 15px; border-right: 1pt solid #000; }
            .info-item:last-child { border-right: none; }
            .party-section { padding: 12px 15px; border-bottom: 1.2pt solid #000; }
            .section-label { font-size: 7pt; font-weight: 900; color: #666; text-transform: uppercase; margin-bottom: 4px; }
            .party-name { font-size: 13pt; font-weight: 800; margin-bottom: 2px; }
            .party-address { font-size: 9.5pt; font-weight: 500; color: #333; max-width: 80%; }
            .party-gst { margin-top: 5px; font-weight: 800; font-size: 9pt; }
            table { width: 100%; border-collapse: collapse; table-layout: fixed; }
            th { background: #000; color: #fff; font-size: 8.5pt; padding: 8px 10px; text-align: left; border: 0.5pt solid #000; }
            td { padding: 8px 10px; border: 0.5pt solid #000; font-size: 10pt; font-weight: 600; }
            .text-right { text-align: right; }
            .text-center { text-align: center; }
            .calc-grid { display: flex; border-bottom: 1.2pt solid #000; }
            .calc-notes { flex: 1.5; padding: 10px; border-right: 1.2pt solid #000; font-size: 8pt; color: #666; font-style: italic; }
            .calc-table { flex: 1; }
            .calc-row { display: flex; border-bottom: 0.5pt solid #000; }
            .calc-row:last-child { border-bottom: none; }
            .calc-label { flex: 1.5; padding: 6px 10px; font-size: 8.5pt; font-weight: 800; text-transform: uppercase; border-right: 0.5pt solid #000; background: #fdfdfd; }
            .calc-value { flex: 1; padding: 6px 10px; font-size: 9.5pt; font-weight: 800; text-align: right; }
            .tax-split { display: flex; font-size: 8pt; border-bottom: 0.5pt solid #000; }
            .tax-split-col { flex: 1; border-right: 0.5pt solid #000; padding: 4px 10px; }
            .total-strip { display: flex; justify-content: space-between; align-items: center; padding: 12px 20px; background: #000; color: #fff; }
            .total-label { font-size: 10pt; font-weight: 900; letter-spacing: 2px; }
            .total-amount { font-size: 20pt; font-weight: 900; }
            .footer-section { display: flex; height: 90px; }
            .shipping-details { flex: 2; padding: 10px; border-right: 1.2pt solid #000; border-top: 1.2pt solid #000; }
            .signature-area { flex: 1; padding: 15px; text-align: center; border-top: 1.2pt solid #000; display: flex; flex-direction: column; justify-content: space-between; }
            .sig-title { font-size: 7.5pt; font-weight: 900; text-transform: uppercase; }
            .bale-grid { display: grid; grid-template-columns: repeat(8, 1fr); gap: 4px; margin-top: 5px; }
            .bale-item { border: 1pt solid #000; text-align: center; font-size: 8pt; font-weight: 900; padding: 2px 0; background: #f9f9f9; }
          </style>
        </head>
        <body>
          <div class="container">
            <div style="background: #000; color: #fff; padding: 3px 15px; font-size: 7pt; font-weight: 900; text-transform: uppercase; letter-spacing: 1px;">Tax Invoice - Original for Recipient</div>
            <div class="header-section">
              <div class="brand-area">
                <h1>${company.name}</h1>
                <p>${company.address1}</p>
                <p>${company.address2}</p>
                <p style="color:#000; margin-top:8px;">GSTIN: ${company.gst}</p>
              </div>
              <div class="meta-area">
                <div class="invoice-title">
                  <span>#${b.billNumber.replace(/^[^\d]*/, '')}${bill.financialYear ? ` (${bill.financialYear})` : ''}</span>
                  <span style="font-size: 9pt; opacity: 0.6;">INVOICE</span>
                </div>
                <div class="meta-row"><span>DATE</span> <span>${b.date}</span></div>
                <div class="meta-row"><span>AGENT</span> <span>${b.agentId ? 'COMMISSION' : 'DIRECT'}</span></div>
                <div class="meta-row"><span>CONTACT</span> <span>${company.phone}</span></div>
              </div>
            </div>
            
            <div class="info-bar">
              <div class="info-item" style="flex: 1;">BANK: ${company.bankName}</div>
              <div class="info-item" style="flex: 1.2;">A/C: ${company.accNo}</div>
              <div class="info-item" style="flex: 0.8;">IFSC: ${company.ifsc}</div>
            </div>
            
            <div class="party-section">
              <div class="section-label">Bill To</div>
              <div class="party-name">${b.partyName}</div>
              <div class="party-address">${b.partyAddress}</div>
              ${b.partyGst ? `<div class="party-gst">GSTIN/ID: ${formatGst(b.partyGst)}</div>` : ''}
            </div>
            
            <table>
              <thead>
                <tr>
                  <th style="width: 15%; border-left: none;">SIZE</th>
                  <th style="width: 45%;">PARTICULARS (HSN 6304)</th>
                  <th style="width: 10%;" class="text-center">QTY</th>
                  <th style="width: 12%;" class="text-center">RATE</th>
                  <th style="width: 18%; border-right: none;" class="text-right">AMOUNT</th>
                </tr>
              </thead>
              <tbody>
                ${items.map(item => `
                  <tr>
                    <td class="text-center" style="border-left: none;">${item.size || '-'}</td>
                    <td>${item.productName}</td>
                    <td class="text-center">${item.quantity}</td>
                    <td class="text-center">${Number(item.rate || 0).toFixed(2)}</td>
                    <td class="text-right" style="border-right: none;">${Number(item.amount || 0).toFixed(2)}</td>
                  </tr>
                `).join('')}
                ${Array(Math.max(0, 12 - items.length)).fill(0).map(() => `
                  <tr style="height: 22px;">
                    <td style="border-left: none;"></td><td></td><td></td><td></td><td style="border-right: none;"></td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
            
            <div class="calc-grid">
              <div class="calc-notes">
                <div class="section-label">Notes / Conditions</div>
                ${company.terms}
              </div>
              <div class="calc-table">
                <div class="calc-row">
                  <div class="calc-label">Total Qty</div>
                  <div class="calc-value">${items.reduce((sum, i) => sum + Number(i.quantity || 0), 0)}</div>
                </div>
                <div class="calc-row">
                  <div class="calc-label">Sub Total</div>
                  <div class="calc-value">₹ ${subtotal.toFixed(2)}</div>
                </div>
                ${b.discountAmount > 0 ? `
                <div class="calc-row">
                  <div class="calc-label">Discount ${discountText}</div>
                  <div class="calc-value text-right" style="color: #666;">- ₹ ${b.discountAmount.toFixed(2)}</div>
                </div>` : ''}
                
                ${isLocal ? `
                <div class="calc-row" style="flex-direction: column;">
                  <div style="display:flex; width:100%; border-bottom: 0.5pt solid #000;">
                    <div class="calc-label" style="border-bottom: none;">CGST (${splitTaxRate}%)</div>
                    <div class="calc-value">${splitTaxAmount}</div>
                  </div>
                  <div style="display:flex; width:100%;">
                    <div class="calc-label" style="border-bottom: none;">SGST (${splitTaxRate}%)</div>
                    <div class="calc-value">${splitTaxAmount}</div>
                  </div>
                </div>
                ` : `
                <div class="calc-row">
                  <div class="calc-label">IGST (${taxRate}%)</div>
                  <div class="calc-value">${b.taxAmount.toFixed(2)}</div>
                </div>
                `}
              </div>
            </div>
            
            <div class="total-strip">
              <div style="display:flex; flex-direction:column; gap:4px;">
                <div class="total-label">NET PAYABLE AMOUNT</div>
                <div style="font-size: 8pt; font-weight: 600; text-transform: capitalize; letter-spacing: 0.5px;">Rupees ${numberToWords(b.totalAmount)}</div>
              </div>
              <div class="total-amount">₹ ${b.totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
            </div>
            
            <div class="footer-section">
              <div class="shipping-details">
                <div class="section-label">Logistics Details</div>
                <div style="display: flex; gap: 20px; font-weight: 800; font-size: 9pt; margin-top: 5px;">
                  <span>LORRY: ${b.lorryOffice || 'Local'}</span>
                  <span>LR NO: ${b.lrNumber || 'N/A'}</span>
                </div>
                <div style="margin-top: 10px;">
                  <div class="section-label" style="font-size: 6pt;">Bale Tracking (Sync)</div>
                  <div class="bale-grid">
                    ${(() => {
                      const bales = Array.isArray(b.baleNumbers) ? b.baleNumbers : JSON.parse(b.baleNumbers || '[]');
                      return bales.concat(Array(8).fill('')).slice(0, 8).map(b => `<div class="bale-item">${b}</div>`).join('');
                    })()}
                  </div>
                </div>
              </div>
              <div class="signature-area">
                <div class="sig-title">For ${company.name}</div>
                <div style="border-top: 1pt dashed #ccc; padding-top: 5px; font-size: 8pt; font-weight: 900;">AUTHORISED SIGNATORY</div>
              </div>
            </div>
          </div>
        </body>
      </html>
    `;
  } else {
    const transportSubtotal = subtotal; 
    const transportNetAmount = transportSubtotal; 
    const transportTaxAmt = (transportNetAmount * (taxRate || 0)) / 100;
    const transportTotal = transportNetAmount + transportTaxAmt;
    const transportSplitTaxAmount = (transportTaxAmt / 2).toFixed(2);

    const copyLabel1 = "Transport Copy 1";
    const copyLabel2 = "Transport Copy 2";

    const renderCopy = (label) => `
      <div class="copy-section">
        <div class="vertical-label">${label}</div>
        <div class="copy-content">
          <div class="header-section">
            <div class="brand-area">
              <h1>${company.name}</h1>
              <p>${company.address1}</p>
              <p>${company.address2}</p>
              <p style="color:#000; margin-top:8px;">GSTIN: ${company.gst}</p>
            </div>
            <div class="meta-area">
              <div class="invoice-title">
                <span>#${b.billNumber.replace(/^[^\d]*/, '')}${bill.financialYear ? ` (${bill.financialYear})` : ''}</span>
                <span style="font-size: 9pt; opacity: 0.6;">TRANSPORT</span>
              </div>
              <div class="meta-row"><span>DATE</span> <span>${b.date}</span></div>
              <div class="meta-row"><span>CONTACT</span> <span>${company.phone}</span></div>
            </div>
          </div>
          
          ${showBankOnTransport ? `
          <div class="info-bar">
            <div class="info-item" style="flex: 1;">BANK: ${company.bankName}</div>
            <div class="info-item" style="flex: 1.2;">A/C: ${company.accNo}</div>
            <div class="info-item" style="flex: 0.8;">IFSC: ${company.ifsc}</div>
          </div>` : ''}
          
          <div class="party-section">
            <div class="section-label">Bill To</div>
            <div class="party-name">${b.partyName}</div>
            <div class="party-address highlighted">${b.partyAddress}</div>
            ${b.partyGst ? `<div class="party-gst"><span class="highlighted">GSTIN/ID: ${formatGst(b.partyGst)}</span></div>` : ''}
          </div>
          
          <table>
            <thead>
              <tr>
                <th style="width: 15%; border-left: none;">SIZE</th>
                <th style="width: 45%;">PARTICULARS (HSN 6304)</th>
                <th style="width: 10%;" class="text-center">QTY</th>
                <th style="width: 12%;" class="text-center">RATE</th>
                <th style="width: 18%; border-right: none;" class="text-right">AMOUNT</th>
              </tr>
            </thead>
            <tbody>
              ${items.map(item => `
                <tr>
                  <td class="text-center" style="border-left: none;">${item.size || '-'}</td>
                  <td>100% COTTON CLOTH</td>
                  <td class="text-center">${item.quantity}</td>
                  <td class="text-center">${Number(item.rate || 0).toFixed(2)}</td>
                  <td class="text-right" style="border-right: none;">${Number(item.amount || 0).toFixed(2)}</td>
                </tr>
              `).join('')}
              ${Array(Math.max(0, 8 - items.length)).fill(0).map(() => `
                <tr style="height: 22px;">
                  <td style="border-left: none;"></td><td></td><td></td><td></td><td style="border-right: none;"></td>
                </tr>
              `).join('')}
            </tbody>
          </table>
          
          <div class="calc-grid">
            <div class="calc-notes">
              <div class="section-label">Notes / Conditions</div>
              ${company.terms}
            </div>
            <div class="calc-table">
              <div class="calc-row">
                <div class="calc-label">Total Qty</div>
                <div class="calc-value">${items.reduce((sum, i) => sum + Number(i.quantity || 0), 0)}</div>
              </div>
              <div class="calc-row">
                <div class="calc-label">Sub Total</div>
                <div class="calc-value">₹ ${transportSubtotal.toFixed(2)}</div>
              </div>
              
              ${isLocal ? `
              <div class="calc-row" style="flex-direction: column;">
                <div style="display:flex; width:100%; border-bottom: 0.5pt solid #000;">
                  <div class="calc-label" style="border-bottom: none;">CGST (${splitTaxRate}%)</div>
                  <div class="calc-value">${transportSplitTaxAmount}</div>
                </div>
                <div style="display:flex; width:100%;">
                  <div class="calc-label" style="border-bottom: none;">SGST (${splitTaxRate}%)</div>
                  <div class="calc-value">${transportSplitTaxAmount}</div>
                </div>
              </div>
              ` : `
              <div class="calc-row">
                <div class="calc-label">IGST (${taxRate}%)</div>
                <div class="calc-value">${transportTaxAmt.toFixed(2)}</div>
              </div>
              `}
            </div>
          </div>
          
          <div class="total-strip">
            <div style="display:flex; flex-direction:column; gap:4px;">
              <div class="total-label">NET PAYABLE AMOUNT</div>
              <div style="font-size: 8pt; font-weight: 600; text-transform: capitalize; letter-spacing: 0.5px;">Rupees ${numberToWords(transportTotal)}</div>
            </div>
            <div class="total-amount">₹ ${transportTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
          </div>
          
          <div class="footer-section">
            <div class="shipping-details">
              <div class="section-label">Logistics Details</div>
              <div style="display: flex; gap: 20px; font-weight: 800; font-size: 9pt; margin-top: 5px;">
                <span>LORRY: ${b.lorryOffice || 'Local'}</span>
                <span>LR NO: ${b.lrNumber || 'N/A'}</span>
              </div>
              <div style="margin-top: 10px;">
                <div class="section-label" style="font-size: 6pt;">Bale Tracking (Sync)</div>
                <div class="bale-grid">
                  ${(() => {
                    const bales = Array.isArray(b.baleNumbers) ? b.baleNumbers : JSON.parse(b.baleNumbers || '[]');
                    return bales.concat(Array(8).fill('')).slice(0, 8).map(b_str => `<div class="bale-item highlighted">${b_str}</div>`).join('');
                  })()}
                </div>
              </div>
            </div>
            <div class="signature-area">
              <div class="sig-title">For ${company.name}</div>
              <div style="border-top: 1pt dashed #ccc; padding-top: 5px; font-size: 8pt; font-weight: 900;">AUTHORISED SIGNATORY</div>
            </div>
          </div>
        </div>
      </div>
    `;

    return `
      <html>
        <head>
          <style>
            @page { size: A4 portrait; margin: 0; }
            @media print {
              html, body { width: 210mm; height: 297mm; margin: 0; padding: 0; background: white; }
            }
            body { 
              font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; 
              margin: 0; padding: 0; color: #1a1a1a; line-height: 1.3;
              background: white; box-sizing: border-box; display: flex; flex-direction: column; width: 210mm; height: 297mm;
            }
            .copy-section { height: 50%; width: 100%; box-sizing: border-box; padding: 6mm; display: flex; position: relative; page-break-inside: avoid; }
            .vertical-label { writing-mode: vertical-rl; transform: rotate(180deg); text-align: center; font-size: 9pt; font-weight: 900; text-transform: uppercase; letter-spacing: 2px; padding: 10px 5px; background: #000; color: #fff; border: 1.2pt solid #000; border-right: none; flex-shrink: 0; }
            .copy-content { flex-grow: 1; border: 1.2pt solid #000; display: flex; flex-direction: column; overflow: hidden; }
            .divider { width: 100%; height: 0; border-top: 2pt dashed #999; margin: 0; position: absolute; top: 50%; left: 0; z-index: 10; }
            .highlighted { background-color: #ffeb3b !important; font-weight: bold !important; -webkit-print-color-adjust: exact !important; color-adjust: exact !important; print-color-adjust: exact !important; }
            .header-section { display: flex; border-bottom: 2pt solid #000; background: #fff; }
            .brand-area { flex: 1.8; padding: 10px 15px; border-right: 1.2pt solid #000; }
            .brand-area h1 { margin: 0; font-size: 18pt; font-weight: 900; color: #000; letter-spacing: -0.5px; }
            .brand-area p { margin: 2px 0; font-size: 8pt; font-weight: 600; color: #444; text-transform: uppercase; }
            .meta-area { flex: 1; padding: 10px 15px; display: flex; flex-direction: column; justify-content: space-between; }
            .invoice-title { font-size: 12pt; font-weight: 900; display: flex; justify-content: space-between; border-bottom: 1pt solid #000; padding-bottom: 5px; margin-bottom: 6px; }
            .meta-row { display: flex; justify-content: space-between; font-size: 8pt; margin-bottom: 3px; font-weight: 700; }
            .info-bar { display: flex; border-bottom: 1.2pt solid #000; background: #f9f9f9; font-size: 7.5pt; font-weight: 800; }
            .info-item { padding: 4px 10px; border-right: 1pt solid #000; }
            .info-item:last-child { border-right: none; }
            .party-section { padding: 8px 15px; border-bottom: 1.2pt solid #000; }
            .section-label { font-size: 7pt; font-weight: 900; color: #666; text-transform: uppercase; margin-bottom: 4px; }
            .party-name { font-size: 11pt; font-weight: 800; margin-bottom: 2px; }
            .party-address { font-size: 8.5pt; font-weight: 500; color: #333; max-width: 80%; display: inline-block; padding: 1px 4px; border-radius: 2px; }
            .party-gst { margin-top: 5px; font-weight: 800; font-size: 8pt; display: inline-block; padding: 1px 4px; border-radius: 2px; }
            table { width: 100%; border-collapse: collapse; table-layout: fixed; }
            th { background: #000; color: #fff; font-size: 8pt; padding: 5px 8px; text-align: left; border: 0.5pt solid #000; }
            td { padding: 5px 8px; border: 0.5pt solid #000; font-size: 9pt; font-weight: 600; }
            .text-right { text-align: right; }
            .text-center { text-align: center; }
            .calc-grid { display: flex; border-bottom: 1.2pt solid #000; flex-grow: 1; }
            .calc-notes { flex: 1.5; padding: 8px; border-right: 1.2pt solid #000; font-size: 7.5pt; color: #666; font-style: italic; }
            .calc-table { flex: 1; }
            .calc-row { display: flex; border-bottom: 0.5pt solid #000; }
            .calc-row:last-child { border-bottom: none; }
            .calc-label { flex: 1.5; padding: 4px 8px; font-size: 7.5pt; font-weight: 800; text-transform: uppercase; border-right: 0.5pt solid #000; background: #fdfdfd; }
            .calc-value { flex: 1; padding: 4px 8px; font-size: 8.5pt; font-weight: 800; text-align: right; }
            .total-strip { display: flex; justify-content: space-between; align-items: center; padding: 8px 15px; background: #000; color: #fff; }
            .total-label { font-size: 9pt; font-weight: 900; letter-spacing: 1px; }
            .total-amount { font-size: 16pt; font-weight: 900; }
            .footer-section { display: flex; height: 75px; }
            .shipping-details { flex: 2; padding: 8px; border-right: 1.2pt solid #000; border-top: 1.2pt solid #000; }
            .signature-area { flex: 1; padding: 10px; text-align: center; border-top: 1.2pt solid #000; display: flex; flex-direction: column; justify-content: space-between; }
            .sig-title { font-size: 7pt; font-weight: 900; text-transform: uppercase; }
            .bale-grid { display: grid; grid-template-columns: repeat(8, 1fr); gap: 3px; margin-top: 4px; }
            .bale-item { border: 1pt solid #000; text-align: center; font-size: 8pt; font-weight: 900; padding: 2px 0; background: #f9f9f9; border-radius: 2px; }
          </style>
        </head>
        <body>
          ${renderCopy(copyLabel1)}
          <div class="divider"></div>
          ${renderCopy(copyLabel2)}
        </body>
      </html>
    `;
  }
};

const sanitizeForFilename = (str) => {
  if (!str) return '';
  return str.replace(/[\\/:*?"<>|]/g, '').replace(/\s+/g, ' ').trim();
};

const buildPdfFilename = async (bill, type = 'big') => {
  const billNo = sanitizeForFilename(bill.billNumber || bill.bill_number || '');
  const date = sanitizeForFilename(bill.date || '');
  const partyName = sanitizeForFilename(bill.partyName || bill.party_name || '');
  const lorry = sanitizeForFilename(bill.lorryOffice || bill.lorry_office || '');

  let agentName = '';
  const agentId = bill.agentId || bill.agent_id;
  if (agentId) {
    const agent = await dbGet('SELECT name FROM agents WHERE id = ?', [agentId]);
    if (agent && agent.name) {
      agentName = sanitizeForFilename(agent.name);
    }
  }

  const parts = [billNo, date];
  if (agentName) parts.push(agentName);
  parts.push(partyName);
  if (lorry) parts.push(lorry);

  const prefix = type === 'big' ? 'Bill' : 'Transport';
  const baseName = parts.filter(p => p).join('_');
  return `${prefix}_${baseName}.pdf`;
};

const getSettingsObj = async () => {
  const rows = await dbAll('SELECT key, value FROM settings');
  const s = {};
  for (const row of rows) {
    try { s[row.key] = JSON.parse(row.value); } catch(e) { s[row.key] = row.value; }
  }
  return s;
};

let printWindow = null;
let isPrinting = false;

const getPrintWindow = () => {
  if (!printWindow || printWindow.isDestroyed()) {
    printWindow = new BrowserWindow({
      show: false,
      webPreferences: {
        sandbox: true
      }
    });
    printWindow.on('closed', () => {
      printWindow = null;
    });
  }
  return printWindow;
};

const waitPrintLock = async () => {
  while (isPrinting) {
    await new Promise(resolve => setTimeout(resolve, 50));
  }
};

const generateBillPdf = async (bill, items, type = 'big') => {
  await waitPrintLock();
  isPrinting = true;
  try {
    const win = getPrintWindow();
    const settings = await getSettingsObj();
    const htmlContent = getBillHtml(bill, items, type, settings);

    await win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(htmlContent)}`);
    
    const docPath = app.getPath('documents');
    const fileName = await buildPdfFilename(bill, type);
    const pdfPath = path.join(docPath, 'Dhanalakshmi_Bills', fileName);
    const dir = path.dirname(pdfPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    const data = await win.webContents.printToPDF({
      marginsType: 1,
      printBackground: true,
      pageSize: 'A4',
    });

    fs.writeFileSync(pdfPath, data);
    return pdfPath;
  } finally {
    isPrinting = false;
  }
};

const printBillDirect = async (bill, items, type = 'big', copies = 1) => {
  await waitPrintLock();
  isPrinting = true;
  try {
    const win = getPrintWindow();
    const settings = await getSettingsObj();
    const htmlContent = getBillHtml(bill, items, type, settings);

    await win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(htmlContent)}`);
    
    return await new Promise((resolve) => {
      win.webContents.print({ silent: true, printBackground: true, deviceName: '', copies: copies }, (success, failureReason) => {
        if (!success) resolve({ success: false, error: failureReason });
        else resolve({ success: true });
      });
    });
  } finally {
    isPrinting = false;
  }
};

module.exports = {
  getSettingsObj,
  getBillHtml,
  generateBillPdf,
  printBillDirect
};
