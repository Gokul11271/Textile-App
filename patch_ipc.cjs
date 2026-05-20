const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, 'electron', 'ipcHandlers.cjs');
let content = fs.readFileSync(file, 'utf8');

const oldSavePayment = `  ipcMain.handle('save-payment', async (event, payment) => {
    const { isValid, data, error } = validatePayload(PaymentSchema, payment);
    if (!isValid) throw new Error(error);

    return await dbRun(
      'INSERT OR REPLACE INTO payments (id, party_id, amount, payment_mode, payment_date, remarks) VALUES (?, ?, ?, ?, ?, ?)',
      [data.id || null, data.party_id, data.amount, data.payment_mode, data.payment_date, data.remarks]
    );
  });`;

const newSavePayment = `  ipcMain.handle('save-payment', async (event, payment) => {
    const { isValid, data, error } = validatePayload(PaymentSchema, payment);
    if (!isValid) throw new Error(error);

    return await dbRun(
      'INSERT OR REPLACE INTO payments (id, party_id, bill_id, amount, payment_mode, payment_type, payment_date, reference_no, remarks, is_deleted) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, COALESCE((SELECT is_deleted FROM payments WHERE id = ?), 0))',
      [data.id || null, data.party_id, data.bill_id || null, data.amount, data.payment_mode, data.payment_type, data.payment_date, data.reference_no || null, data.remarks || null, data.id || null]
    );
  });`;

const oldDeletePayment = `  ipcMain.handle('delete-payment', async (event, paymentId) => {
    try {
      await dbRun('DELETE FROM payments WHERE id = ?', [paymentId]);
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });`;

const newDeletePayment = `  ipcMain.handle('delete-payment', async (event, paymentId) => {
    try {
      await dbRun('UPDATE payments SET is_deleted = 1 WHERE id = ?', [paymentId]);
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });`;

const oldGetPartyStatement = `  ipcMain.handle('get-party-statement', async (event, partyId) => {
    try {
      const party = await dbGet('SELECT * FROM parties WHERE id = ?', [partyId]);
      if (!party) throw new Error('Party not found');

      const bills = await dbAll('SELECT id, bill_number, date as entry_date, total_amount as debit, 0 as credit, "BILL" as type FROM bills WHERE party_id = ?', [partyId]);
      const payments = await dbAll('SELECT id, payment_mode, remarks, payment_date as entry_date, 0 as debit, amount as credit, "PAYMENT" as type FROM payments WHERE party_id = ?', [partyId]);

      let transactions = [...bills, ...payments];
      
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
        transactions
      };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });`;

const newGetPartyStatement = `  ipcMain.handle('get-party-statement', async (event, partyId) => {
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
  });`;

content = content.replace(/\r\n/g, '\n');
content = content.replace(oldSavePayment.replace(/\r\n/g, '\n'), newSavePayment);
content = content.replace(oldDeletePayment.replace(/\r\n/g, '\n'), newDeletePayment);
content = content.replace(oldGetPartyStatement.replace(/\r\n/g, '\n'), newGetPartyStatement);

fs.writeFileSync(file, content, 'utf8');
console.log("ipcHandlers.cjs patched successfully");
