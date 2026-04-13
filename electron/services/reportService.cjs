const { dbGet, dbAll } = require('../database.cjs');

/**
 * Returns high-level dashboard stats: total bills, last bill number, total bales.
 */
const getDashboardStats = async () => {
  const totalBillsRow = await dbGet('SELECT COUNT(*) as count FROM bills');
  const lastBill = await dbGet('SELECT bill_number FROM bills ORDER BY id DESC LIMIT 1');
  const totalBalesRow = await dbGet(
    'SELECT COUNT(*) as count FROM bill_items WHERE bale_number IS NOT NULL AND bale_number != ""'
  );

  return {
    totalBills: totalBillsRow ? totalBillsRow.count : 0,
    lastBillNo: lastBill ? lastBill.bill_number : 'N/A',
    totalBales: totalBalesRow ? totalBalesRow.count : 0
  };
};

/**
 * Returns the 5 most recently created bills with party/customer info.
 */
const getRecentBills = async () => {
  return await dbAll(`
    SELECT b.*, p.short_name as party_short_name, c.name as party_name
    FROM bills b
    LEFT JOIN parties p ON b.party_id = p.id
    LEFT JOIN customers c ON p.customer_id = c.id
    ORDER BY b.id DESC LIMIT 5
  `);
};

/**
 * Returns bills within an optional date range (YYYY-MM-DD format required),
 * ordered by date descending. Uses pure SQL BETWEEN for efficiency.
 */
const getSalesReport = async (startDate, endDate) => {
  // ⚠️ Dates must be stored in YYYY-MM-DD format in the database for BETWEEN to sort correctly
  let query = `
    SELECT b.*, p.short_name as party_short_name, c.name as party_name, p.gst_number as party_gst_number
    FROM bills b
    LEFT JOIN parties p ON b.party_id = p.id
    LEFT JOIN customers c ON p.customer_id = c.id
  `;
  const params = [];

  if (startDate && endDate) {
    query += ` WHERE b.date BETWEEN ? AND ?`;
    params.push(startDate, endDate);
  }

  query += ` ORDER BY b.date DESC`;
  return await dbAll(query, params);
};

module.exports = { getDashboardStats, getRecentBills, getSalesReport };
