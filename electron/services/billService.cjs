const { dbRun, dbAll, dbGet, incrementCounter } = require('../database.cjs');
const { info, warn, error: logError } = require('./logService.cjs');
const { validatePayload, BillSchema, BillItemSchema } = require('../ipcContracts.cjs');

/**
 * Save (insert or update) a bill and its line items atomically.
 */
const saveBill = async (bill, items) => {
  try {
    // 1. Validate Bill Data
    const billValidation = validatePayload(BillSchema, bill);
    if (!billValidation.isValid) throw new Error(billValidation.error);
    const validBill = billValidation.data;

    // 2. Validate Items and filter empties
    const validItems = [];
    for (const item of items) {
      if ((item.productName && item.productName.trim()) || Number(item.quantity) > 0 || Number(item.rate) > 0) {
        const itemValidation = validatePayload(BillItemSchema, item);
        if (!itemValidation.isValid) throw new Error(`Item Validation Error: ${itemValidation.error}`);
        validItems.push(itemValidation.data);
      }
    }

    // 3. Authoritative Backend Calculation
    const subtotal = validItems.reduce((sum, item) => sum + (item.quantity * item.rate), 0);
    let discountAmount = validBill.discountAmount || 0;
    if (validBill.discountPercent > 0) {
      discountAmount = (subtotal * validBill.discountPercent) / 100;
    }
    const netAmount = subtotal - discountAmount;
    const taxAmount = (netAmount * (validBill.taxRate || 5)) / 100;
    const totalAmount = netAmount + taxAmount;

    await dbRun('BEGIN TRANSACTION');

    const existing = await dbGet('SELECT id FROM bills WHERE bill_number = ?', [validBill.billNumber]);
    let billId;

    if (existing) {
      await dbRun(`
        UPDATE bills SET
          date = ?, agent_id = ?, party_id = ?,
          discount_percent = ?, discount_amount = ?,
          tax_rate = ?, tax_amount = ?, is_inter_state = ?,
          lr_number = ?, lorry_office = ?,
          is_bale_enabled = ?, bale_numbers = ?, total_amount = ?,
          party_gst = COALESCE(party_gst, ?)
        WHERE bill_number = ?
      `, [
        validBill.date,
        validBill.agentId || null,
        validBill.partyId || null,
        validBill.discountPercent || 0,
        discountAmount,
        validBill.taxRate || 5,
        taxAmount,
        validBill.isInterState ? 1 : 0,
        validBill.lrNumber || '',
        validBill.lorryOffice || '',
        validBill.isBaleEnabled ? 1 : 0,
        JSON.stringify(validBill.baleNumbers || []),
        totalAmount,
        validBill.partyGst || null,  // COALESCE: only set if not already frozen
        validBill.billNumber
      ]);
      billId = existing.id;
      await dbRun('DELETE FROM bill_items WHERE bill_id = ?', [billId]);
    } else {
      // Phase 4: Atomic counter — guaranteed return value via RETURNING or fallback SELECT
      const newValue = await incrementCounter('bill_number');
      const actualBillNumber = newValue.toString();

      const billResult = await dbRun(`
        INSERT INTO bills (
          bill_number, date, agent_id, party_id,
          discount_percent, discount_amount,
          tax_rate, tax_amount, is_inter_state,
          lr_number, lorry_office,
          is_bale_enabled, bale_numbers, total_amount, party_gst
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        actualBillNumber,
        validBill.date,
        validBill.agentId || null,
        validBill.partyId || null,
        validBill.discountPercent || 0,
        discountAmount,
        validBill.taxRate || 5,
        taxAmount,
        validBill.isInterState ? 1 : 0,
        validBill.lrNumber || '',
        validBill.lorryOffice || '',
        validBill.isBaleEnabled ? 1 : 0,
        JSON.stringify(validBill.baleNumbers || []),
        totalAmount,
        validBill.partyGst || null  // 🔒 FROZEN at creation time
      ]);
      billId = billResult.lastID;
      validBill.billNumber = actualBillNumber;
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
    info('billService', `Bill ${existing ? 'Updated' : 'Created'}: ${validBill.billNumber}`, { billId, billNumber: validBill.billNumber });
    return { billId, billNumber: validBill.billNumber };
  } catch (err) {
    await dbRun('ROLLBACK');
    logError('billService', `Save Bill Failed`, { error: err.message });
    throw err;
  }
};

/**
 * Get the last (highest) bill number using the atomic counter.
 * O(1) — reads a single row instead of scanning all bills.
 */
const getLastBillNumber = async () => {
  const row = await dbGet(`SELECT value FROM counters WHERE name = 'bill_number'`);
  return (row && row.value > 0) ? row.value.toString() : null;
};

/**
 * Fetch a single bill with its items by bill number.
 */
const getBillByNumber = async (billNumber) => {
  const bill = await dbGet(`
    SELECT b.*, p.short_name as party_short_name, c.name as party_name,
           p.address as party_address,
           COALESCE(b.party_gst, p.gst_number) as party_gst_number
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
      info('billService', `Bill Deleted: ${billNumber}`, { billNumber });
      return { success: true };
    } catch (e) {
      await dbRun('ROLLBACK');
      logError('billService', `Delete Bill Failed: ${billNumber}`, { error: e.message });
      return { success: false, error: e.message };
    }
  } catch (e) {
    return { success: false, error: e.message };
  }
};

module.exports = { saveBill, getLastBillNumber, getBillByNumber, deleteBill };
