const { dbRun, dbAll, dbGet } = require('../database.cjs');

/**
 * Save (insert or update) a bill and its line items atomically.
 */
const saveBill = async (bill, items) => {
  try {
    await dbRun('BEGIN TRANSACTION');

    // Filter out completely empty items
    const validItems = items.filter(item =>
      (item.productName && item.productName.trim()) ||
      Number(item.quantity) > 0 ||
      Number(item.rate) > 0
    );

    const existing = await dbGet('SELECT id FROM bills WHERE bill_number = ?', [bill.billNumber]);
    let billId;

    if (existing) {
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
      await dbRun('DELETE FROM bill_items WHERE bill_id = ?', [billId]);
    } else {
      // Phase 4: Atomic counter increment — no race conditions possible
      // Increment and read the new value in a single statement inside our transaction
      await dbRun(
        `UPDATE counters SET value = value + 1 WHERE name = 'bill_number'`
      );
      const counterRow = await dbGet(
        `SELECT value FROM counters WHERE name = 'bill_number'`
      );
      const actualBillNumber = counterRow.value.toString();

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
        actualBillNumber,
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
      bill.billNumber = actualBillNumber;
    }

    for (const item of validItems) {
      await dbRun(`
        INSERT INTO bill_items (bill_id, size, product_name, quantity, rate, amount, bale_number)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `, [
        billId,
        item.size || '',
        item.productName || '',
        Number(item.quantity) || 0,
        Number(item.rate) || 0,
        Number(item.amount) || 0,
        item.baleNumber || ''
      ]);
    }

    await dbRun('COMMIT');
    return { billId, billNumber: bill.billNumber };
  } catch (error) {
    await dbRun('ROLLBACK');
    throw error;
  }
};

/**
 * Get the last (highest) bill number.
 */
const getLastBillNumber = async () => {
  const row = await dbGet('SELECT MAX(CAST(bill_number AS INTEGER)) as max_no FROM bills');
  return row && row.max_no ? row.max_no.toString() : null;
};

/**
 * Fetch a single bill with its items by bill number.
 */
const getBillByNumber = async (billNumber) => {
  const bill = await dbGet(`
    SELECT b.*, p.short_name as party_short_name, c.name as party_name,
           p.address as party_address, p.gst_number as party_gst_number
    FROM bills b
    LEFT JOIN parties p ON b.party_id = p.id
    LEFT JOIN customers c ON p.customer_id = c.id
    WHERE b.bill_number = ?
  `, [billNumber]);

  if (!bill) return null;
  const items = await dbAll('SELECT * FROM bill_items WHERE bill_id = ?', [bill.id]);
  return { ...bill, items };
};

/**
 * Delete a bill and its items safely within a transaction.
 */
const deleteBill = async (billNumber) => {
  try {
    const bill = await dbGet('SELECT id FROM bills WHERE bill_number = ?', [billNumber]);
    if (!bill) return { success: false, error: 'Bill not found' };

    await dbRun('BEGIN TRANSACTION');
    try {
      await dbRun('DELETE FROM bill_items WHERE bill_id = ?', [bill.id]);
      await dbRun('DELETE FROM bills WHERE id = ?', [bill.id]);
      await dbRun('COMMIT');
      return { success: true };
    } catch (e) {
      await dbRun('ROLLBACK');
      return { success: false, error: e.message };
    }
  } catch (e) {
    return { success: false, error: e.message };
  }
};

module.exports = { saveBill, getLastBillNumber, getBillByNumber, deleteBill };
