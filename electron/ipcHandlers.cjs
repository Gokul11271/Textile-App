const { ipcMain, BrowserWindow, shell, app } = require('electron');
const { dbRun, dbAll, dbGet, dbExec } = require('./database.cjs');
const fs = require('fs');
const path = require('path');

function setupIpcHandlers() {
  const printService = require('./services/printService.cjs');
  const billService  = require('./services/billService.cjs');
  const reportService = require('./services/reportService.cjs');
  const getSettingsObj = printService.getSettingsObj;
  const generateBillPdf = printService.generateBillPdf;
  const getBillHtml = printService.getBillHtml;

  ipcMain.handle('generate-pdf', async (event, bill, items, type = 'big') => {
    return await generateBillPdf(bill, items, type);
  });

  ipcMain.handle('print-bill', async (event, bill, items, type = 'big', copies = 1) => {
    return await printService.printBillDirect(bill, items, type, copies);
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
    const settings = await getSettingsObj();
    return getBillHtml(bill, items, type, settings);
  });

  // Settings Handlers
  ipcMain.handle('get-settings', async () => {
    return await getSettingsObj();
  });

  ipcMain.handle('save-settings', async (event, newSettings) => {
    await dbRun('BEGIN TRANSACTION');
    try {
      for (const [key, value] of Object.entries(newSettings)) {
        const valStr = typeof value === 'object' ? JSON.stringify(value) : (value !== null && value !== undefined ? value.toString() : '');
        await dbRun('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', [key, valStr]);
      }
      await dbRun('COMMIT');
      return { success: true };
    } catch (e) {
      await dbRun('ROLLBACK');
      return { success: false, error: e.message };
    }
  });

  ipcMain.handle('backup-database', async () => {
    const { dialog } = require('electron');
    const dbPath = path.join(app.getPath('userData'), 'database', 'dhanalakshmi.db');
    const { filePath } = await dialog.showSaveDialog({
      title: 'Backup Database',
      defaultPath: `dhanalakshmi_backup_${new Date().toISOString().slice(0,10)}.db`,
      filters: [{ name: 'SQLite Database', extensions: ['db', 'sqlite'] }]
    });
    if (filePath) {
      fs.copyFileSync(dbPath, filePath);
      return { success: true, path: filePath };
    }
    return { success: false, cancelled: true };
  });

  ipcMain.handle('restore-database', async () => {
    const { dialog } = require('electron');
    const dbPath = path.join(app.getPath('userData'), 'database', 'dhanalakshmi.db');
    const { filePaths } = await dialog.showOpenDialog({
      title: 'Restore Database',
      properties: ['openFile'],
      filters: [{ name: 'SQLite Database', extensions: ['db', 'sqlite'] }]
    });
    if (filePaths && filePaths.length > 0) {
      try {
        fs.copyFileSync(filePaths[0], dbPath);
        return { success: true }; 
      } catch (e) {
        return { success: false, error: e.message };
      }
    }
    return { success: false, cancelled: true };
  });

  ipcMain.handle('factory-reset', async (event, password) => {
    if (password !== 'admin123') return { success: false, error: 'Incorrect password' };
    await dbRun('BEGIN TRANSACTION');
    try {
      await dbRun('DELETE FROM bill_items');
      await dbRun('DELETE FROM bills');
      await dbRun('DELETE FROM parties');
      await dbRun('DELETE FROM customers');
      await dbRun('DELETE FROM agents');
      // Intentionally leaving settings intact
      await dbRun('COMMIT');
      return { success: true };
    } catch (e) {
      await dbRun('ROLLBACK');
      return { success: false, error: e.message };
    }
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
    return await billService.saveBill(bill, items);
  });

  ipcMain.handle('get-last-bill-number', async () => {
    return await billService.getLastBillNumber();
  });

  ipcMain.handle('get-products', async () => {
    const rows = await dbAll('SELECT DISTINCT product_name FROM bill_items WHERE product_name IS NOT NULL AND product_name != ""');
    return rows.map(r => r.product_name);
  });

  ipcMain.handle('get-bill-by-number', async (event, billNumber) => {
    return await billService.getBillByNumber(billNumber);
  });

  ipcMain.handle('delete-bill', async (event, billNumber) => {
    try {
      await billService.deleteBill(billNumber);
      return { success: true };
    } catch (err) {
      console.error('Delete failed:', err);
      return { success: false, error: err.message };
    }
  });

  // Stats & Reports — delegated to reportService
  ipcMain.handle('get-dashboard-stats', async () => {
    return await reportService.getDashboardStats();
  });

  ipcMain.handle('get-recent-bills', async () => {
    return await reportService.getRecentBills();
  });

  ipcMain.handle('get-sales-report', async (event, startDate, endDate) => {
    return await reportService.getSalesReport(startDate, endDate);
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
