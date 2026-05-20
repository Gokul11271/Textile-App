const { ipcMain, BrowserWindow, shell, app } = require('electron');
const { db, dbRun, dbAll, dbGet, dbExec } = require('./database.cjs');
const fs = require('fs');
const path = require('path');
const { validatePayload, CustomerSchema, PartySchema, SettingsSchema, ProductSchema, PaymentSchema, ipcResponse } = require('./ipcContracts.cjs');

function setupIpcHandlers() {
  const printService = require('./services/printService.cjs');
  const billService  = require('./services/billService.cjs');
  const reportService = require('./services/reportService.cjs');
  const purchaseService = require('./services/purchaseService.cjs');
  const getSettingsObj = printService.getSettingsObj;
  const generateBillPdf = printService.generateBillPdf;
  const getBillHtml = printService.getBillHtml;

  ipcMain.handle('generate-pdf', async (event, bill, items, type = 'big', copiesCount = 2) => {
    return await generateBillPdf(bill, items, type, copiesCount);
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

  ipcMain.handle('print-bill-range', async (event, startNo, endNo, type = 'big', copiesCount = 1) => {
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
      const pdfPath = await generateBillPdf(bill, items, type, copiesCount);
      results.push({ billNumber: bill.bill_number, success: !!pdfPath });
    }
    return results;
  });

  ipcMain.handle('get-bill-preview', async (event, bill, items, type = 'big', copiesCount = 2) => {
    const settings = await getSettingsObj();
    return getBillHtml(bill, items, type, settings, copiesCount);
  });

  // Settings Handlers
  ipcMain.handle('get-settings', async () => {
    return await getSettingsObj();
  });

  ipcMain.handle('save-settings', async (event, newSettings) => {
    const { isValid, data, error } = validatePayload(SettingsSchema, newSettings);
    if (!isValid) return ipcResponse(null, error);

    await dbRun('BEGIN TRANSACTION');
    try {
      for (const [key, value] of Object.entries(data)) {
        const valStr = typeof value === 'object' ? JSON.stringify(value) : (value !== null && value !== undefined ? value.toString() : '');
        await dbRun('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', [key, valStr]);
      }
      await dbRun('COMMIT');
      return ipcResponse(true);
    } catch (e) {
      await dbRun('ROLLBACK');
      return ipcResponse(null, e);
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
        await new Promise((resolve, reject) => {
          db.close((err) => {
            if (err) console.error("Error closing DB during restore:", err);
            resolve(); // Resolve anyway to attempt copy
          });
        });
        
        fs.copyFileSync(filePaths[0], dbPath);
        return { success: true }; 
      } catch (e) {
        return { success: false, error: e.message };
      }
    }
    return { success: false, cancelled: true };
  });

  ipcMain.handle('restart-app', () => {
    app.relaunch();
    app.exit(0);
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
    const { isValid, data, error } = validatePayload(CustomerSchema, customer);
    if (!isValid) {
      // The frontend currently expects an object with lastID for save-customer
      // So we throw to let the IPC rejection happen, or return error format.
      // Parties.jsx does: const result = await window.electron.ipcRenderer.invoke('save-customer', ...)
      // We will throw error so frontend catches it.
      throw new Error(error);
    }
    return await dbRun(
      'INSERT OR REPLACE INTO customers (id, name) VALUES (?, ?)',
      [data.id || null, data.name]
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
    const { isValid, data, error } = validatePayload(PartySchema, party);
    if (!isValid) throw new Error(error);

    // Determine active GST from gst_entries if provided
    const activeEntry = (data.gst_entries || []).find(e => e.is_active);
    const activeGst = activeEntry ? activeEntry.gst_number : (data.gst_number || null);

    await dbRun('BEGIN TRANSACTION');
    try {
      const result = await dbRun(
        'INSERT OR REPLACE INTO parties (id, customer_id, short_name, address, gst_number, phone, email, city, state, aadhar_number, pan_number, opening_balance) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [data.id || null, data.customer_id, data.short_name, data.address, activeGst, data.phone, data.email, data.city, data.state, data.aadhar_number, data.pan_number, data.opening_balance]
      );
      const partyId = data.id || result.lastID;
      
      if (!partyId) throw new Error('Failed to resolve Party ID after save.');

      // Sync gst_entries into party_gst table
      if (data.gst_entries && data.gst_entries.length > 0) {
        // Get existing GSTs to detect what to delete
        const existingGsts = await dbAll('SELECT gst_number FROM party_gst WHERE party_id = ?', [partyId]) || [];
        const existingSet = new Set(existingGsts.map(r => r.gst_number));
        const newSet = new Set(data.gst_entries.map(e => e.gst_number));

        // Deactivate all first, then set active on the chosen one
        await dbRun('UPDATE party_gst SET is_active = 0 WHERE party_id = ?', [partyId]);

        for (const entry of data.gst_entries) {
          if (existingSet.has(entry.gst_number)) {
            // Update is_active
            await dbRun(
              'UPDATE party_gst SET is_active = ? WHERE party_id = ? AND gst_number = ?',
              [entry.is_active ? 1 : 0, partyId, entry.gst_number]
            );
          } else {
            // Insert new
            await dbRun(
              'INSERT OR IGNORE INTO party_gst (party_id, gst_number, is_active) VALUES (?, ?, ?)',
              [partyId, entry.gst_number, entry.is_active ? 1 : 0]
            );
          }
        }

        // Delete GSTs removed by user (only if not used in any bill)
        for (const oldGst of existingSet) {
          if (!newSet.has(oldGst)) {
            const usedInBill = await dbGet(
              'SELECT id FROM bills WHERE party_id = ? AND party_gst = ? LIMIT 1',
              [partyId, oldGst]
            );
            if (!usedInBill) {
              await dbRun('DELETE FROM party_gst WHERE party_id = ? AND gst_number = ?', [partyId, oldGst]);
            }
          }
        }
      } else if (activeGst) {
        // Fallback: no gst_entries provided, just ensure the active GST exists
        await dbRun('UPDATE party_gst SET is_active = 0 WHERE party_id = ?', [partyId]);
        await dbRun(
          'INSERT OR IGNORE INTO party_gst (party_id, gst_number, is_active) VALUES (?, ?, 1)',
          [partyId, activeGst]
        );
        await dbRun(
          'UPDATE party_gst SET is_active = 1 WHERE party_id = ? AND gst_number = ?',
          [partyId, activeGst]
        );
      }

      await dbRun('COMMIT');
      return { lastID: partyId };
    } catch (e) {
      await dbRun('ROLLBACK');
      console.error('Error in save-party IPC handler:', e);
      throw e;
    }
  });

  // Get all GST numbers for a specific party
  ipcMain.handle('get-party-gsts', async (event, partyId) => {
    return await dbAll(
      'SELECT * FROM party_gst WHERE party_id = ? ORDER BY is_active DESC, created_at ASC',
      [partyId]
    );
  });

  // Set a specific GST as active for a party (used from Parties page)
  ipcMain.handle('set-active-gst', async (event, partyId, gstId) => {
    await dbRun('BEGIN TRANSACTION');
    try {
      await dbRun('UPDATE party_gst SET is_active = 0 WHERE party_id = ?', [partyId]);
      const row = await dbGet('SELECT gst_number FROM party_gst WHERE id = ? AND party_id = ?', [gstId, partyId]);
      if (!row) throw new Error('GST not found for this party');
      await dbRun('UPDATE party_gst SET is_active = 1 WHERE id = ?', [gstId]);
      await dbRun('UPDATE parties SET gst_number = ? WHERE id = ?', [row.gst_number, partyId]);
      await dbRun('COMMIT');
      return { success: true, activeGst: row.gst_number };
    } catch (e) {
      await dbRun('ROLLBACK');
      return { success: false, error: e.message };
    }
  });

  // Delete a GST number (blocked if used in a bill)
  ipcMain.handle('delete-party-gst', async (event, partyId, gstId) => {
    const row = await dbGet('SELECT gst_number, is_active FROM party_gst WHERE id = ? AND party_id = ?', [gstId, partyId]);
    if (!row) return { success: false, error: 'GST not found' };
    const usedInBill = await dbGet(
      'SELECT id FROM bills WHERE party_id = ? AND party_gst = ? LIMIT 1',
      [partyId, row.gst_number]
    );
    if (usedInBill) return { success: false, error: `GST "${row.gst_number}" is used in a bill and cannot be deleted.` };
    await dbRun('DELETE FROM party_gst WHERE id = ?', [gstId]);
    // If deleted was active, pick the first remaining as new active
    if (row.is_active) {
      const next = await dbGet('SELECT id, gst_number FROM party_gst WHERE party_id = ? LIMIT 1', [partyId]);
      if (next) {
        await dbRun('UPDATE party_gst SET is_active = 1 WHERE id = ?', [next.id]);
        await dbRun('UPDATE parties SET gst_number = ? WHERE id = ?', [next.gst_number, partyId]);
      } else {
        await dbRun('UPDATE parties SET gst_number = NULL WHERE id = ?', [partyId]);
      }
    }
    return { success: true };
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
    return await require('./database.cjs').getProducts();
  });

  ipcMain.handle('save-product', async (event, product) => {
    const { isValid, data, error } = validatePayload(ProductSchema, product);
    if (!isValid) throw new Error(error);
    return await require('./database.cjs').saveProduct(data);
  });

  ipcMain.handle('delete-product', async (event, id) => {
    return await require('./database.cjs').deleteProduct(id);
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

  // --- Payments and Ledger ---
  ipcMain.handle('save-payment', async (event, payment) => {
    const { isValid, data, error } = validatePayload(PaymentSchema, payment);
    if (!isValid) throw new Error(error);

    return await dbRun(
      'INSERT OR REPLACE INTO payments (id, party_id, bill_id, amount, payment_mode, payment_type, payment_date, reference_no, remarks, is_deleted) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, COALESCE((SELECT is_deleted FROM payments WHERE id = ?), 0))',
      [data.id || null, data.party_id, data.bill_id || null, data.amount, data.payment_mode, data.payment_type, data.payment_date, data.reference_no || null, data.remarks || null, data.id || null]
    );
  });

  ipcMain.handle('delete-payment', async (event, paymentId) => {
    try {
      await dbRun('UPDATE payments SET is_deleted = 1 WHERE id = ?', [paymentId]);
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  
  ipcMain.handle('get-global-statements', async () => {
    try {
      const bills = await dbAll(`
        SELECT b.id, b.bill_number, b.date as entry_date, b.total_amount as debit, b.party_id, p.short_name as party_short_name, c.name as party_name
        FROM bills b
        LEFT JOIN parties p ON b.party_id = p.id
        LEFT JOIN customers c ON p.customer_id = c.id
        ORDER BY b.date DESC, b.id DESC
      `);
      
      const payments = await dbAll(`
        SELECT bill_id, SUM(amount + COALESCE(discount_amount, 0)) as total_paid
        FROM payments 
        WHERE is_deleted = 0 AND bill_id IS NOT NULL
        GROUP BY bill_id
      `);
      
      // Map payment sums to bills
      const paymentMap = {};
      payments.forEach(p => { paymentMap[p.bill_id] = p.total_paid; });
      
      const globalBills = bills.map(b => {
        const paid = paymentMap[b.id] || 0;
        return {
          ...b,
          paid,
          pending: b.debit - paid
        };
      });
      
      return { success: true, globalBills };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('get-party-statement', async (event, partyId) => {
    try {
      const party = await dbGet('SELECT * FROM parties WHERE id = ?', [partyId]);
      if (!party) throw new Error('Party not found');

      const bills = await dbAll('SELECT id, bill_number, date as entry_date, total_amount as debit, 0 as credit, "BILL" as type FROM bills WHERE party_id = ?', [partyId]);
      const payments = await dbAll('SELECT id, bill_id, payment_mode, payment_type, reference_no, remarks, payment_date as entry_date, 0 as debit, amount as credit, "PAYMENT" as type FROM payments WHERE party_id = ? AND is_deleted = 0', [partyId]);

      // Enrich bills with payment tracking
      const enrichedBills = bills.map(b => {
        const linkedPayments = payments.filter(p => p.bill_id === b.id);
        const paid = linkedPayments.reduce((sum, p) => sum + p.credit, 0);
        return {
          ...b,
          paid,
          pending: b.debit - paid,
          linkedPayments
        };
      });

      let transactions = [...enrichedBills, ...payments];
      
      // Sort chronologically (date, then type so bills come before payments on same day maybe?)
      transactions.sort((a, b) => {
        const d1 = new Date(a.entry_date).getTime();
        const d2 = new Date(b.entry_date).getTime();
        if (d1 === d2) {
          // Bill before payment
          if (a.type === 'BILL' && b.type === 'PAYMENT') return -1;
          if (a.type === 'PAYMENT' && b.type === 'BILL') return 1;
          return a.id - b.id; // stable sort
        }
        return d1 - d2;
      });

      return {
        success: true,
        party,
        transactions,
        bills: enrichedBills
      };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('print-payment-receipt', async (event, paymentId) => {
    return await printService.printPaymentReceipt(paymentId);
  });

  ipcMain.handle('print-party-statement', async (event, partyId, startDate, endDate) => {
    return await printService.printPartyStatement(partyId, startDate, endDate);
  });

  // --- Purchase Report Handlers ---
  ipcMain.handle('get-purchases', async (event, startDate, endDate) => {
    return await purchaseService.getPurchases(startDate, endDate);
  });

  ipcMain.handle('save-purchase', async (event, purchase) => {
    return await purchaseService.savePurchase(purchase);
  });

  ipcMain.handle('delete-purchase', async (event, id, deletedBy, reason) => {
    return await purchaseService.softDeletePurchase(id, deletedBy, reason);
  });
}

module.exports = { setupIpcHandlers };
