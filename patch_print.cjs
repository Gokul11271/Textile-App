const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, 'electron', 'services', 'printService.cjs');
let content = fs.readFileSync(file, 'utf8');

const newFn = `
const printPaymentReceipt = async (paymentId) => {
  return await printQueue.add(async () => {
    try {
      const payment = await dbGet(\`
        SELECT p.*, pt.name as party_name, pt.address as party_address, c.name as customer_name
        FROM payments p
        JOIN parties pt ON p.party_id = pt.id
        LEFT JOIN customers c ON pt.customer_id = c.id
        WHERE p.id = ?
      \`, [paymentId]);

      if (!payment) throw new Error('Payment not found');

      // Fetch linked bill if any
      let billDetails = '';
      if (payment.bill_id) {
        const bill = await dbGet('SELECT bill_number FROM bills WHERE id = ?', [payment.bill_id]);
        if (bill) billDetails = \`Against Bill #\${bill.bill_number}\`;
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
        '{{RECEIPT_NO}}': \`RCPT-\${payment.id}\`,
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
      await win.loadURL(\`data:text/html;charset=utf-8,\${encodeURIComponent(htmlContent)}\`);

      const pdfPath = getPdfPath('Payment_Receipt', \`\${payment.id}_\${payment.party_name}\`);
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

module.exports = {
  printBill,
  generatePdf,
  printPartyStatement,
  printPaymentReceipt
};`;

content = content.replace(/module\.exports = {[\s\S]*?};/, newFn.trim());

fs.writeFileSync(file, content, 'utf8');
console.log("printService.cjs patched successfully");
