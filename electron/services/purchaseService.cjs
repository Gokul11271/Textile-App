const { dbRun, dbAll, dbGet } = require('../database.cjs');

/**
 * Validate GSTIN (15 characters alphanumeric, matching standard Indian GSTIN pattern)
 */
function validateGSTIN(gstin) {
  if (!gstin) return true; // Optional field
  const cleanGstin = gstin.trim().toUpperCase();
  if (cleanGstin.length !== 15) return false;
  const gstRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}[0-9A-Z]{1}[0-9A-Z]{1}$/;
  return gstRegex.test(cleanGstin);
}

/**
 * Save or record a purchase invoice.
 * Performs backend tax and subtotal calculations.
 */
const savePurchase = async (purchase) => {
  try {
    const totalAmount = parseFloat(purchase.total_amount);
    const taxRate = parseFloat(purchase.tax_rate) || 0;

    if (isNaN(totalAmount) || totalAmount <= 0) {
      throw new Error('Invalid total invoice value.');
    }

    if (purchase.supplier_gst && !validateGSTIN(purchase.supplier_gst)) {
      throw new Error('Invalid Supplier GSTIN format. Must be a valid 15-character Indian GSTIN.');
    }

    // Backend calculations - single source of truth
    // Subtotal = Value / (1 + Rate / 100)
    const taxableAmount = totalAmount / (1 + taxRate / 100);
    const taxAmount = totalAmount - taxableAmount;

    // Check for duplicate invoice number under the same supplier
    const checkDuplicate = await dbGet(
      'SELECT id FROM purchases WHERE supplier_name = ? AND invoice_number = ? AND is_deleted = 0 AND id != ?',
      [purchase.supplier_name.trim(), purchase.invoice_number.trim().toUpperCase(), purchase.id || 0]
    );

    if (checkDuplicate) {
      throw new Error(`Duplicate purchase invoice: Invoice '${purchase.invoice_number}' already recorded for supplier '${purchase.supplier_name}'.`);
    }

    if (purchase.id) {
      // Edit existing
      await dbRun(`
        UPDATE purchases
        SET invoice_number = ?, date = ?, supplier_name = ?, supplier_gst = ?,
            tax_rate = ?, tax_amount = ?, taxable_amount = ?, total_amount = ?,
            is_inter_state = ?, supplier_state = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `, [
        purchase.invoice_number.trim().toUpperCase(),
        purchase.date,
        purchase.supplier_name.trim(),
        purchase.supplier_gst ? purchase.supplier_gst.trim().toUpperCase() : null,
        taxRate,
        taxAmount,
        taxableAmount,
        totalAmount,
        purchase.is_inter_state ? 1 : 0,
        purchase.supplier_state ? purchase.supplier_state.trim() : null,
        purchase.id
      ]);
      return { success: true, id: purchase.id };
    } else {
      // Insert new
      const result = await dbRun(`
        INSERT INTO purchases (
          invoice_number, date, supplier_name, supplier_gst,
          tax_rate, tax_amount, taxable_amount, total_amount,
          is_inter_state, supplier_state, created_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        purchase.invoice_number.trim().toUpperCase(),
        purchase.date,
        purchase.supplier_name.trim(),
        purchase.supplier_gst ? purchase.supplier_gst.trim().toUpperCase() : null,
        taxRate,
        taxAmount,
        taxableAmount,
        totalAmount,
        purchase.is_inter_state ? 1 : 0,
        purchase.supplier_state ? purchase.supplier_state.trim() : null,
        purchase.created_by || 'Staff'
      ]);
      return { success: true, id: result.lastID };
    }
  } catch (err) {
    console.error('purchaseService save error:', err);
    return { success: false, error: err.message };
  }
};

/**
 * Get all active (not soft-deleted) purchases within optional date range.
 */
const getPurchases = async (startDate, endDate) => {
  try {
    let query = `SELECT * FROM purchases WHERE is_deleted = 0`;
    const params = [];
    if (startDate && endDate) {
      query += ` AND date BETWEEN ? AND ?`;
      params.push(startDate, endDate);
    }
    query += ` ORDER BY date DESC, id DESC`;
    return await dbAll(query, params);
  } catch (err) {
    console.error('purchaseService fetch error:', err);
    throw err;
  }
};

/**
 * Soft delete a purchase invoice.
 */
const softDeletePurchase = async (id, deletedBy = 'Staff', reason = '') => {
  try {
    await dbRun(`
      UPDATE purchases
      SET is_deleted = 1,
          deleted_by = ?,
          delete_reason = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [deletedBy, reason, id]);
    return { success: true };
  } catch (err) {
    console.error('purchaseService delete error:', err);
    return { success: false, error: err.message };
  }
};

module.exports = {
  savePurchase,
  getPurchases,
  softDeletePurchase
};
