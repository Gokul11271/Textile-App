const { dbRun, dbAll, dbGet } = require('../database.cjs');

/**
 * Validate GSTIN (15 characters alphanumeric, matching standard Indian GSTIN pattern)
 */
function validateGSTIN(gstin) {
  if (!gstin) return true; // Optional field
  const cleanGstin = gstin.trim().toUpperCase();
  if (cleanGstin.length !== 15) return false;
  // Permissive validation: must be exactly 15 alphanumeric characters
  const gstRegex = /^[0-9A-Z]{15}$/;
  return gstRegex.test(cleanGstin);
}

/**
 * Save or record a purchase invoice.
 * Performs backend tax and subtotal calculations.
 */
const savePurchase = async (purchase) => {
  try {
    if (purchase.supplier_gst && !validateGSTIN(purchase.supplier_gst)) {
      throw new Error('Invalid Supplier GSTIN format. Must be a valid 15-character Indian GSTIN.');
    }

    if (!purchase.items || purchase.items.length === 0) {
      throw new Error('Purchase must have at least one product/item.');
    }

    // Backend calculations - single source of truth
    let totalAmount = 0;
    let taxAmount = 0;
    let taxableAmount = 0;

    const processedItems = purchase.items.map(item => {
      const itemTaxable = parseFloat(item.taxable_amount);
      const itemRate = parseFloat(item.tax_rate) || 0;
      if (!item.product_name || !item.product_name.trim()) {
        throw new Error('Product name is required for all items.');
      }
      if (isNaN(itemTaxable) || itemTaxable < 0) {
        throw new Error(`Invalid taxable amount for product: ${item.product_name}`);
      }
      const itemTax = parseFloat((itemTaxable * (itemRate / 100)).toFixed(2));
      const itemTotal = parseFloat((itemTaxable + itemTax).toFixed(2));

      taxableAmount += itemTaxable;
      taxAmount += itemTax;
      totalAmount += itemTotal;

      return {
        product_name: item.product_name.trim(),
        taxable_amount: itemTaxable,
        tax_rate: itemRate,
        tax_amount: itemTax,
        total_amount: itemTotal
      };
    });

    // Make overall sums formatted neatly
    taxableAmount = parseFloat(taxableAmount.toFixed(2));
    taxAmount = parseFloat(taxAmount.toFixed(2));
    totalAmount = parseFloat(totalAmount.toFixed(2));
    const firstTaxRate = processedItems[0]?.tax_rate || 0;

    // Check for duplicate invoice number under the same supplier
    const checkDuplicate = await dbGet(
      'SELECT id FROM purchases WHERE supplier_name = ? AND invoice_number = ? AND is_deleted = 0 AND id != ?',
      [purchase.supplier_name.trim(), purchase.invoice_number.trim().toUpperCase(), purchase.id || 0]
    );

    if (checkDuplicate) {
      throw new Error(`Duplicate purchase invoice: Invoice '${purchase.invoice_number}' already recorded for supplier '${purchase.supplier_name}'.`);
    }

    // Wrap in database transaction
    const { dbRun: dbRunTrans } = require('../database.cjs');
    await dbRunTrans('BEGIN TRANSACTION');
    try {
      let purchaseId = purchase.id;
      if (purchase.id) {
        // Edit existing
        await dbRunTrans(`
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
          firstTaxRate,
          taxAmount,
          taxableAmount,
          totalAmount,
          purchase.is_inter_state ? 1 : 0,
          purchase.supplier_state ? purchase.supplier_state.trim() : null,
          purchase.id
        ]);

        // Delete existing items
        await dbRunTrans('DELETE FROM purchase_items WHERE purchase_id = ?', [purchase.id]);
      } else {
        // Insert new
        const result = await dbRunTrans(`
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
          firstTaxRate,
          taxAmount,
          taxableAmount,
          totalAmount,
          purchase.is_inter_state ? 1 : 0,
          purchase.supplier_state ? purchase.supplier_state.trim() : null,
          purchase.created_by || 'Staff'
        ]);
        purchaseId = result.lastID;
      }

      // Insert purchase items
      for (const item of processedItems) {
        await dbRunTrans(`
          INSERT INTO purchase_items (
            purchase_id, product_name, taxable_amount, tax_rate, tax_amount, total_amount
          ) VALUES (?, ?, ?, ?, ?, ?)
        `, [
          purchaseId,
          item.product_name,
          item.taxable_amount,
          item.tax_rate,
          item.tax_amount,
          item.total_amount
        ]);
      }

      await dbRunTrans('COMMIT');
      return { success: true, id: purchaseId };
    } catch (transErr) {
      await dbRunTrans('ROLLBACK');
      throw transErr;
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
    const purchases = await dbAll(query, params);

    // Fetch items for each purchase
    for (const purchase of purchases) {
      purchase.items = await dbAll('SELECT * FROM purchase_items WHERE purchase_id = ? ORDER BY id ASC', [purchase.id]);
    }
    return purchases;
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
