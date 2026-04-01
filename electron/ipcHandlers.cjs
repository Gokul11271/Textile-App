const { ipcMain, BrowserWindow, shell, app } = require('electron');
const { dbRun, dbAll, dbGet, dbExec } = require('./database.cjs');
const fs = require('fs');
const path = require('path');

function setupIpcHandlers() {
  const getBillHtml = (bill, items, type = 'big') => {
    // Standardize field names for robustness between DB (snake_case) and Frontend (camelCase)
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
              
              /* Professional Header */
              .header-section { display: flex; border-bottom: 2pt solid #000; background: #fff; }
              .brand-area { flex: 1.8; padding: 15px; border-right: 1.2pt solid #000; }
              .brand-area h1 { margin: 0; font-size: 22pt; font-weight: 900; color: #000; letter-spacing: -0.5px; }
              .brand-area p { margin: 3px 0; font-size: 9pt; font-weight: 600; color: #444; text-transform: uppercase; }
              
              .meta-area { flex: 1; padding: 15px; display: flex; flex-direction: column; justify-content: space-between; }
              .invoice-title { font-size: 14pt; font-weight: 900; display: flex; justify-content: space-between; border-bottom: 1pt solid #000; padding-bottom: 5px; margin-bottom: 10px; }
              .meta-row { display: flex; justify-content: space-between; font-size: 9pt; margin-bottom: 4px; font-weight: 700; }
              
              /* Bank & Details Bar */
              .info-bar { display: flex; border-bottom: 1.2pt solid #000; background: #f9f9f9; font-size: 8.5pt; font-weight: 800; }
              .info-item { padding: 6px 15px; border-right: 1pt solid #000; }
              .info-item:last-child { border-right: none; }
              
              /* Party Details */
              .party-section { padding: 12px 15px; border-bottom: 1.2pt solid #000; }
              .section-label { font-size: 7pt; font-weight: 900; color: #666; text-transform: uppercase; margin-bottom: 4px; }
              .party-name { font-size: 13pt; font-weight: 800; margin-bottom: 2px; }
              .party-address { font-size: 9.5pt; font-weight: 500; color: #333; max-width: 80%; }
              .party-gst { margin-top: 5px; font-weight: 800; font-size: 9pt; }
              
              /* Table Styling */
              table { width: 100%; border-collapse: collapse; table-layout: fixed; }
              th { background: #000; color: #fff; font-size: 8.5pt; padding: 8px 10px; text-align: left; border: 0.5pt solid #000; }
              td { padding: 8px 10px; border: 0.5pt solid #000; font-size: 10pt; font-weight: 600; }
              .text-right { text-align: right; }
              .text-center { text-align: center; }
              
              /* Calculation Area */
              .calc-grid { display: flex; border-bottom: 1.2pt solid #000; }
              .calc-notes { flex: 1.5; padding: 10px; border-right: 1.2pt solid #000; font-size: 8pt; color: #666; font-style: italic; }
              .calc-table { flex: 1; }
              .calc-row { display: flex; border-bottom: 0.5pt solid #000; }
              .calc-row:last-child { border-bottom: none; }
              .calc-label { flex: 1.5; padding: 6px 10px; font-size: 8.5pt; font-weight: 800; text-transform: uppercase; border-right: 0.5pt solid #000; background: #fdfdfd; }
              .calc-value { flex: 1; padding: 6px 10px; font-size: 9.5pt; font-weight: 800; text-align: right; }
              
              /* Tax Breakdown Row (Local) */
              .tax-split { display: flex; font-size: 8pt; border-bottom: 0.5pt solid #000; }
              .tax-split-col { flex: 1; border-right: 0.5pt solid #000; padding: 4px 10px; }
              
              /* Grande Total */
              .total-strip { display: flex; justify-content: space-between; align-items: center; padding: 12px 20px; background: #000; color: #fff; }
              .total-label { font-size: 10pt; font-weight: 900; letter-spacing: 2px; }
              .total-amount { font-size: 20pt; font-weight: 900; }
              
              /* Footer Area */
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
                  <h1>DHANALAKSHMI TEXTILES</h1>
                  <p>4/2C PUDUVALASU, K.G VALASU(PO), CHENNIMALAI(VIA)</p>
                  <p>ERODE DIST, TAMIL NADU - 638051</p>
                  <p style="color:#000; margin-top:8px;">GSTIN: 33AXHPA9951A1ZU</p>
                </div>
                <div class="meta-area">
                  <div class="invoice-title">
                    <span>#${b.billNumber.replace(/^[^\d]*/, '')}</span>
                    <span style="font-size: 9pt; opacity: 0.6;">INVOICE</span>
                  </div>
                  <div class="meta-row"><span>DATE</span> <span>${b.date}</span></div>
                  <div class="meta-row"><span>AGENT</span> <span>${b.agentId ? 'COMMISSION' : 'DIRECT'}</span></div>
                  <div class="meta-row"><span>CONTACT</span> <span>+91 98427 64988</span></div>
                </div>
              </div>
              
              <div class="info-bar">
                <div class="info-item" style="flex: 1;">BANK: PUNJAB NATIONAL BANK</div>
                <div class="info-item" style="flex: 1.2;">A/C: 5893002100002556</div>
                <div class="info-item" style="flex: 0.8;">IFSC: PUNB0589300</div>
              </div>
              
              <div class="party-section">
                <div class="section-label">Bill To</div>
                <div class="party-name">${b.partyName}</div>
                <div class="party-address">${b.partyAddress}</div>
                ${b.partyGst ? `<div class="party-gst">GSTIN/ID: ${b.partyGst}</div>` : ''}
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
                  1. Goods once sold will not be taken back.<br/>
                  2. All disputes subject to Erode jurisdiction.
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
                <div class="total-label">NET PAYABLE AMOUNT</div>
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
                  <div class="sig-title">For DHANALAKSHMI TEXTILES</div>
                  <div style="border-top: 1pt dashed #ccc; padding-top: 5px; font-size: 8pt; font-weight: 900;">AUTHORISED SIGNATORY</div>
                </div>
              </div>
            </div>
          </body>
        </html>
      `;
    } else {
      // Transport Copy - Same layout as big bill but without Agent, Bank details, and Discount
      const transportSubtotal = subtotal; // No discount applied for transport copy
      const transportNetAmount = transportSubtotal; // Skip discount
      const transportTaxAmt = (transportNetAmount * (taxRate || 0)) / 100;
      const transportTotal = transportNetAmount + transportTaxAmt;
      const transportSplitTaxAmount = (transportTaxAmt / 2).toFixed(2);

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
              
              /* Professional Header */
              .header-section { display: flex; border-bottom: 2pt solid #000; background: #fff; }
              .brand-area { flex: 1.8; padding: 15px; border-right: 1.2pt solid #000; }
              .brand-area h1 { margin: 0; font-size: 22pt; font-weight: 900; color: #000; letter-spacing: -0.5px; }
              .brand-area p { margin: 3px 0; font-size: 9pt; font-weight: 600; color: #444; text-transform: uppercase; }
              
              .meta-area { flex: 1; padding: 15px; display: flex; flex-direction: column; justify-content: space-between; }
              .invoice-title { font-size: 14pt; font-weight: 900; display: flex; justify-content: space-between; border-bottom: 1pt solid #000; padding-bottom: 5px; margin-bottom: 10px; }
              .meta-row { display: flex; justify-content: space-between; font-size: 9pt; margin-bottom: 4px; font-weight: 700; }
              
              /* Party Details */
              .party-section { padding: 12px 15px; border-bottom: 1.2pt solid #000; }
              .section-label { font-size: 7pt; font-weight: 900; color: #666; text-transform: uppercase; margin-bottom: 4px; }
              .party-name { font-size: 13pt; font-weight: 800; margin-bottom: 2px; }
              .party-address { font-size: 9.5pt; font-weight: 500; color: #333; max-width: 80%; }
              .party-gst { margin-top: 5px; font-weight: 800; font-size: 9pt; }
              
              /* Table Styling */
              table { width: 100%; border-collapse: collapse; table-layout: fixed; }
              th { background: #000; color: #fff; font-size: 8.5pt; padding: 8px 10px; text-align: left; border: 0.5pt solid #000; }
              td { padding: 8px 10px; border: 0.5pt solid #000; font-size: 10pt; font-weight: 600; }
              .text-right { text-align: right; }
              .text-center { text-align: center; }
              
              /* Calculation Area */
              .calc-grid { display: flex; border-bottom: 1.2pt solid #000; }
              .calc-notes { flex: 1.5; padding: 10px; border-right: 1.2pt solid #000; font-size: 8pt; color: #666; font-style: italic; }
              .calc-table { flex: 1; }
              .calc-row { display: flex; border-bottom: 0.5pt solid #000; }
              .calc-row:last-child { border-bottom: none; }
              .calc-label { flex: 1.5; padding: 6px 10px; font-size: 8.5pt; font-weight: 800; text-transform: uppercase; border-right: 0.5pt solid #000; background: #fdfdfd; }
              .calc-value { flex: 1; padding: 6px 10px; font-size: 9.5pt; font-weight: 800; text-align: right; }
              
              /* Grande Total */
              .total-strip { display: flex; justify-content: space-between; align-items: center; padding: 12px 20px; background: #000; color: #fff; }
              .total-label { font-size: 10pt; font-weight: 900; letter-spacing: 2px; }
              .total-amount { font-size: 20pt; font-weight: 900; }
              
              /* Footer Area */
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
              <div style="background: #000; color: #fff; padding: 3px 15px; font-size: 7pt; font-weight: 900; text-transform: uppercase; letter-spacing: 1px;">Transport Copy - For Transporter</div>
              
              <div class="header-section">
                <div class="brand-area">
                  <h1>DHANALAKSHMI TEXTILES</h1>
                  <p>4/2C PUDUVALASU, K.G VALASU(PO), CHENNIMALAI(VIA)</p>
                  <p>ERODE DIST, TAMIL NADU - 638051</p>
                  <p style="color:#000; margin-top:8px;">GSTIN: 33AXHPA9951A1ZU</p>
                </div>
                <div class="meta-area">
                  <div class="invoice-title">
                    <span>#${b.billNumber.replace(/^[^\d]*/, '')}</span>
                    <span style="font-size: 9pt; opacity: 0.6;">TRANSPORT</span>
                  </div>
                  <div class="meta-row"><span>DATE</span> <span>${b.date}</span></div>
                  <div class="meta-row"><span>CONTACT</span> <span>+91 98427 64988</span></div>
                </div>
              </div>
              
              <div class="party-section">
                <div class="section-label">Bill To</div>
                <div class="party-name">${b.partyName}</div>
                <div class="party-address">${b.partyAddress}</div>
                ${b.partyGst ? `<div class="party-gst">GSTIN/ID: ${b.partyGst}</div>` : ''}
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
                  1. Goods once sold will not be taken back.<br/>
                  2. All disputes subject to Erode jurisdiction.
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
                <div class="total-label">NET PAYABLE AMOUNT</div>
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
                        return bales.concat(Array(8).fill('')).slice(0, 8).map(b => `<div class="bale-item">${b}</div>`).join('');
                      })()}
                    </div>
                  </div>
                </div>
                <div class="signature-area">
                  <div class="sig-title">For DHANALAKSHMI TEXTILES</div>
                  <div style="border-top: 1pt dashed #ccc; padding-top: 5px; font-size: 8pt; font-weight: 900;">AUTHORISED SIGNATORY</div>
                </div>
              </div>
            </div>
          </body>
        </html>
      `;
    }
  };

  // Helper to sanitize strings for use in filenames
  const sanitizeForFilename = (str) => {
    if (!str) return '';
    return str.replace(/[\\/:*?"<>|]/g, '').replace(/\s+/g, ' ').trim();
  };

  // Build PDF filename: billNumber_date_agentName_partyName_lorry
  // If agent name doesn't exist, skip that part
  const buildPdfFilename = async (bill, type = 'big') => {
    const billNo = sanitizeForFilename(bill.billNumber || bill.bill_number || '');
    const date = sanitizeForFilename(bill.date || '');
    const partyName = sanitizeForFilename(bill.partyName || bill.party_name || '');
    const lorry = sanitizeForFilename(bill.lorryOffice || bill.lorry_office || '');

    // Look up agent name from DB if agentId exists
    let agentName = '';
    const agentId = bill.agentId || bill.agent_id;
    if (agentId) {
      const agent = await dbGet('SELECT name FROM agents WHERE id = ?', [agentId]);
      if (agent && agent.name) {
        agentName = sanitizeForFilename(agent.name);
      }
    }

    // Build parts: billNumber_date_agentName_partyName_lorry
    const parts = [billNo, date];
    if (agentName) parts.push(agentName);
    parts.push(partyName);
    if (lorry) parts.push(lorry);

    const prefix = type === 'big' ? 'Bill' : 'Transport';
    const baseName = parts.filter(p => p).join('_');
    return `${prefix}_${baseName}.pdf`;
  };

  const generateBillPdf = async (bill, items, type = 'big') => {
    const win = new BrowserWindow({ show: false });
    const htmlContent = getBillHtml(bill, items, type);

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
    win.close();
    return pdfPath;
  };

  ipcMain.handle('generate-pdf', async (event, bill, items, type = 'big') => {
    return await generateBillPdf(bill, items, type);
  });

  ipcMain.handle('print-bill', async (event, bill, items, type = 'big') => {
    const win = new BrowserWindow({ show: false });
    const htmlContent = getBillHtml(bill, items, type);

    await win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(htmlContent)}`);
    
    // Direct print
    return new Promise((resolve) => {
      win.webContents.print({ silent: false, printBackground: true, deviceName: '' }, (success, failureReason) => {
        win.close();
        if (!success) resolve({ success: false, error: failureReason });
        else resolve({ success: true });
      });
    });
  });

  ipcMain.handle('update-lr-numbers', async (event, startNo, endNo, startLrNo) => {
    const bills = await dbAll(`
      SELECT id, bill_number FROM bills
      WHERE bill_number >= ? AND bill_number <= ?
      ORDER BY bill_number ASC
    `, [startNo, endNo]);

    if (!bills || bills.length === 0) return { success: false, message: 'No bills found in this range' };

    let currentLrMatch = startLrNo.match(/^(\D*)(\d+)(\D*)$/);
    let currentLrNum = currentLrMatch ? parseInt(currentLrMatch[2], 10) : parseInt(startLrNo, 10);
    const prefix = currentLrMatch ? currentLrMatch[1] : '';
    const suffix = currentLrMatch ? currentLrMatch[3] : '';

    await dbRun('BEGIN TRANSACTION');
    try {
      for (const bill of bills) {
        let newLr = startLrNo;
        if (!isNaN(currentLrNum)) {
          newLr = `${prefix}${currentLrNum}${suffix}`;
          currentLrNum++;
        }
        await dbRun('UPDATE bills SET lr_number = ? WHERE id = ?', [newLr, bill.id]);
      }
      await dbRun('COMMIT');
      return { success: true, count: bills.length };
    } catch (err) {
      await dbRun('ROLLBACK');
      console.error('Failed to update LR numbers:', err);
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('print-bill-range', async (event, startNo, endNo, type = 'big') => {
    const bills = await dbAll(`
      SELECT b.*, p.short_name as party_short_name, c.name as party_name, p.address as party_address, p.gst_number as party_gst_number 
      FROM bills b 
      LEFT JOIN parties p ON b.party_id = p.id 
      LEFT JOIN customers c ON p.customer_id = c.id
      WHERE b.bill_number >= ? AND b.bill_number <= ?
      ORDER BY b.bill_number ASC
    `, [startNo, endNo]);

    const results = [];
    for (const bill of bills) {
      const items = await dbAll('SELECT * FROM bill_items WHERE bill_id = ?', [bill.id]);
      const pdfPath = await generateBillPdf(bill, items, type);
      results.push({ billNumber: bill.bill_number, success: !!pdfPath });
    }
    return results;
  });

  ipcMain.handle('get-bill-preview', async (event, bill, items, type = 'big') => {
    return getBillHtml(bill, items, type);
  });

  // Customers
  ipcMain.handle('get-customers', async () => {
    return await dbAll('SELECT * FROM customers ORDER BY name ASC');
  });

  ipcMain.handle('save-customer', async (event, customer) => {
    return await dbRun(
      'INSERT OR REPLACE INTO customers (id, name) VALUES (?, ?)',
      [customer.id || null, customer.name]
    );
  });

  // Parties (Locations)
  ipcMain.handle('get-parties', async () => {
    return await dbAll(`
      SELECT p.*, c.name as name 
      FROM parties p 
      JOIN customers c ON p.customer_id = c.id 
      ORDER BY p.short_name ASC
    `);
  });

  ipcMain.handle('save-party', async (event, party) => {
    return await dbRun(
      'INSERT OR REPLACE INTO parties (id, customer_id, short_name, address, gst_number, phone, email, city, state, aadhar_number, pan_number, opening_balance) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [party.id || null, party.customer_id, party.short_name, party.address, party.gst_number, party.phone, party.email, party.city, party.state, party.aadhar_number, party.pan_number, party.opening_balance]
    );
  });

  // Agents
  ipcMain.handle('get-agents', async () => {
    return await dbAll('SELECT * FROM agents ORDER BY name ASC');
  });

  ipcMain.handle('save-bill', async (event, bill, items) => {
    try {
      await dbRun('BEGIN TRANSACTION');

      // Filter out completely empty items (no product name, no quantity, no rate)
      const validItems = items.filter(item => 
        (item.productName && item.productName.trim()) || Number(item.quantity) > 0 || Number(item.rate) > 0
      );

      // Check if bill already exists
      const existing = await dbGet('SELECT id FROM bills WHERE bill_number = ?', [bill.billNumber]);
      let billId;

      if (existing) {
        // Update existing bill
        await dbRun(`
          UPDATE bills SET
            date = ?, agent_id = ?, party_id = ?,
            discount_percent = ?, discount_amount = ?,
            tax_rate = ?, tax_amount = ?, is_inter_state = ?,
            lr_number = ?, lorry_office = ?,
            is_bale_enabled = ?, bale_numbers = ?, total_amount = ?
          WHERE bill_number = ?
        `, [
          bill.date,
          bill.agentId || null,
          bill.partyId || null,
          bill.discountPercent || 0,
          bill.discountAmount || 0,
          bill.taxRate || 5,
          bill.taxAmount || 0,
          bill.isInterState ? 1 : 0,
          bill.lrNumber || '',
          bill.lorryOffice || '',
          bill.isBaleEnabled ? 1 : 0,
          JSON.stringify(bill.baleNumbers || []),
          bill.totalAmount || 0,
          bill.billNumber
        ]);
        billId = existing.id;

        // Delete old items before re-inserting
        await dbRun('DELETE FROM bill_items WHERE bill_id = ?', [billId]);
      } else {
        // Insert new bill
        const billResult = await dbRun(`
          INSERT INTO bills (
            bill_number, date, agent_id, party_id, 
            discount_percent, discount_amount, 
            tax_rate, tax_amount, is_inter_state,
            lr_number, lorry_office, 
            is_bale_enabled, bale_numbers, total_amount
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          bill.billNumber,
          bill.date,
          bill.agentId || null,
          bill.partyId || null,
          bill.discountPercent || 0,
          bill.discountAmount || 0,
          bill.taxRate || 5,
          bill.taxAmount || 0,
          bill.isInterState ? 1 : 0,
          bill.lrNumber || '',
          bill.lorryOffice || '',
          bill.isBaleEnabled ? 1 : 0,
          JSON.stringify(bill.baleNumbers || []),
          bill.totalAmount || 0
        ]);
        billId = billResult.lastID;
      }
      
      // Insert items
      for (const item of validItems) {
        await dbRun(`
          INSERT INTO bill_items (bill_id, size, product_name, quantity, rate, amount, bale_number)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `, [billId, item.size || '', item.productName || '', Number(item.quantity) || 0, Number(item.rate) || 0, Number(item.amount) || 0, item.baleNumber || '']);
      }
      
      await dbRun('COMMIT');
      return billId;
    } catch (error) {
      await dbRun('ROLLBACK');
      throw error;
    }
  });

  ipcMain.handle('get-last-bill-number', async () => {
    const row = await dbGet('SELECT bill_number FROM bills ORDER BY id DESC LIMIT 1');
    return row ? row.bill_number : null;
  });

  ipcMain.handle('get-bill-by-number', async (event, billNumber) => {
    const bill = await dbGet(`
      SELECT b.*, p.short_name as party_short_name, c.name as party_name, p.address as party_address, p.gst_number as party_gst_number 
      FROM bills b 
      LEFT JOIN parties p ON b.party_id = p.id 
      LEFT JOIN customers c ON p.customer_id = c.id
      WHERE b.bill_number = ?
    `, [billNumber]);
    
    if (!bill) return null;
    const items = await dbAll('SELECT * FROM bill_items WHERE bill_id = ?', [bill.id]);
    return { ...bill, items };
  });

  // Stats
  ipcMain.handle('get-dashboard-stats', async () => {
    const totalBillsRow = await dbGet('SELECT COUNT(*) as count FROM bills');
    const lastBill = await dbGet('SELECT bill_number FROM bills ORDER BY id DESC LIMIT 1');
    const totalBalesRow = await dbGet('SELECT COUNT(*) as count FROM bill_items WHERE bale_number IS NOT NULL AND bale_number != ""');
    
    return {
      totalBills: totalBillsRow ? totalBillsRow.count : 0,
      lastBillNo: lastBill ? lastBill.bill_number : 'N/A',
      totalBales: totalBalesRow ? totalBalesRow.count : 0
    };
  });

  ipcMain.handle('get-recent-bills', async () => {
    return await dbAll(`
      SELECT b.*, p.short_name as party_short_name, c.name as party_name 
      FROM bills b 
      LEFT JOIN parties p ON b.party_id = p.id 
      LEFT JOIN customers c ON p.customer_id = c.id
      ORDER BY b.id DESC LIMIT 5
    `);
  });

  ipcMain.handle('get-sales-report', async (event, startDate, endDate) => {
    // Note: This assumes date is stored in a way that respects lexicographical or YYYY-MM-DD order,
    // or we might need to handle parsing if it's DD-MM-YYYY.
    // For now, we'll fetch all and filter/sort in JS if needed, but SQL is better.
    // If date format is DD-MM-YYYY, we'll fetch all and filter in JS for reliability.
    const bills = await dbAll(`
      SELECT b.*, p.short_name as party_short_name, c.name as party_name, p.gst_number as party_gst_number 
      FROM bills b 
      LEFT JOIN parties p ON b.party_id = p.id 
      LEFT JOIN customers c ON p.customer_id = c.id
    `);

    // Helper to parse DD-MM-YYYY, DD-MMM-YYYY, or YYYY-MM-DD into Date object
    const parseDate = (dateStr) => {
      if (!dateStr) return new Date(0);
      
      // Handle YYYY-MM-DD (from <input type="date">)
      if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
        return new Date(dateStr);
      }

      // Handle DD-MM-YYYY or DD-MMM-YYYY
      const parts = dateStr.split('-');
      if (parts.length !== 3) return new Date(dateStr);
      
      const months = {
        'JAN': 0, 'FEB': 1, 'MAR': 2, 'APR': 3, 'MAY': 4, 'JUN': 5,
        'JUL': 6, 'AUG': 7, 'SEP': 8, 'OCT': 9, 'NOV': 10, 'DEC': 11
      };

      if (parts[0].length === 4) {
        // Assume YYYY-MM-DD if it hit this for some reason
        return new Date(dateStr);
      } else {
        // Assume DD-MM-YYYY or DD-MMM-YYYY
        const day = parseInt(parts[0]);
        const monthStr = parts[1].toUpperCase();
        const year = parseInt(parts[2]);
        const month = months[monthStr] !== undefined ? months[monthStr] : (parseInt(monthStr) - 1);
        return new Date(year, month, day);
      }
    };

    if (!startDate || !endDate) {
      return bills.sort((a, b) => parseDate(b.date) - parseDate(a.date));
    }

    const start = parseDate(startDate);
    const end = parseDate(endDate);
    end.setHours(23, 59, 59, 999);

    const filtered = bills.filter(bill => {
      const billDate = parseDate(bill.date);
      return billDate >= start && billDate <= end;
    });

    return filtered.sort((a, b) => parseDate(b.date) - parseDate(a.date));
  });

  ipcMain.handle('export-to-csv', async (event, data, filename) => {
    const { dialog } = require('electron');
    const { filePath } = await dialog.showSaveDialog({
      defaultPath: path.join(app.getPath('documents'), filename),
      filters: [{ name: 'CSV Files', extensions: ['csv'] }]
    });

    if (filePath) {
      fs.writeFileSync(filePath, data);
      return filePath;
    }
    return null;
  });
}

module.exports = { setupIpcHandlers };
