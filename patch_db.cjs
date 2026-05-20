const fs = require('fs');
const path = require('path');

const dbFile = path.join(__dirname, 'electron', 'database.cjs');
let content = fs.readFileSync(dbFile, 'utf8');

// Replace payments table definition
const oldPayments = `    CREATE TABLE IF NOT EXISTS payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      party_id INTEGER NOT NULL REFERENCES parties(id) ON DELETE CASCADE,
      amount REAL NOT NULL DEFAULT 0,
      payment_mode TEXT DEFAULT 'Cash',
      payment_date TEXT NOT NULL,
      remarks TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_payments_party_id ON payments(party_id);
    CREATE INDEX IF NOT EXISTS idx_payments_date ON payments(payment_date);
  \`);`;

const newPayments = `    CREATE TABLE IF NOT EXISTS payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      party_id INTEGER NOT NULL REFERENCES parties(id) ON DELETE CASCADE,
      bill_id INTEGER REFERENCES bills(id) ON DELETE SET NULL,
      amount REAL NOT NULL DEFAULT 0,
      payment_mode TEXT DEFAULT 'Cash',
      payment_type TEXT DEFAULT 'bill_payment',
      payment_date TEXT NOT NULL,
      reference_no TEXT,
      remarks TEXT,
      is_deleted INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_payments_party_id ON payments(party_id);
    CREATE INDEX IF NOT EXISTS idx_payments_date ON payments(payment_date);
    CREATE INDEX IF NOT EXISTS idx_payments_bill_id ON payments(bill_id);
  \`);

  // Migrate existing payments table if it misses new columns
  const paymentsInfo = await dbAll('PRAGMA table_info(payments)');
  const missingPaymentColumns = [];
  if (paymentsInfo.length > 0) {
    if (!paymentsInfo.some(c => c.name === 'bill_id')) missingPaymentColumns.push('bill_id INTEGER REFERENCES bills(id) ON DELETE SET NULL');
    if (!paymentsInfo.some(c => c.name === 'payment_type')) missingPaymentColumns.push("payment_type TEXT DEFAULT 'bill_payment'");
    if (!paymentsInfo.some(c => c.name === 'reference_no')) missingPaymentColumns.push('reference_no TEXT');
    if (!paymentsInfo.some(c => c.name === 'is_deleted')) missingPaymentColumns.push('is_deleted INTEGER DEFAULT 0');
    
    for (const colDef of missingPaymentColumns) {
      try { await dbExec(\`ALTER TABLE payments ADD COLUMN \${colDef};\`); } catch (e) { console.error('Failed to alter payments table:', e); }
    }
  }`;

// Remove carriage returns before replacement
content = content.replace(/\r\n/g, '\n');
const oldPaymentsFixed = oldPayments.replace(/\r\n/g, '\n');

if (content.includes(oldPaymentsFixed)) {
  content = content.replace(oldPaymentsFixed, newPayments);
} else {
  console.log("Could not find payments table to replace.");
}

// Replace pruneLogs
const oldPrune = `  // Phase 5: Prune old logs to keep DB size small
  await pruneLogs();
}`;

const newPrune = `  // Phase 5: Prune old logs to keep DB size small
  await pruneLogs();

  // Phase 7: Date format migration (DD-MMM-YYYY -> YYYY-MM-DD)
  await migrateBillDates();
}

/**
 * Migrates old date format (DD-MMM-YYYY) to standard (YYYY-MM-DD)
 */
async function migrateBillDates() {
  const bills = await dbAll("SELECT id, date FROM bills WHERE date LIKE '%-%-%'");
  
  const monthMap = {
    'JAN': '01', 'FEB': '02', 'MAR': '03', 'APR': '04', 'MAY': '05', 'JUN': '06',
    'JUL': '07', 'AUG': '08', 'SEP': '09', 'OCT': '10', 'NOV': '11', 'DEC': '12'
  };

  let migratedCount = 0;
  await dbRun('BEGIN TRANSACTION');
  try {
    for (const bill of bills) {
      const parts = bill.date.split('-');
      if (parts.length === 3 && isNaN(parts[1])) {
        // Looks like DD-MMM-YYYY
        const day = parts[0].padStart(2, '0');
        const monthStr = parts[1].toUpperCase();
        const year = parts[2];
        const monthNum = monthMap[monthStr];
        
        if (monthNum && year.length === 4) {
          const newDate = \`\${year}-\${monthNum}-\${day}\`;
          await dbRun('UPDATE bills SET date = ? WHERE id = ?', [newDate, bill.id]);
          migratedCount++;
        }
      }
    }
    await dbRun('COMMIT');
    if (migratedCount > 0) {
      console.log(\`Migrated \${migratedCount} bill dates to YYYY-MM-DD format.\`);
    }
  } catch (e) {
    await dbRun('ROLLBACK');
    console.error('Failed to migrate bill dates:', e);
  }
}`;

const oldPruneFixed = oldPrune.replace(/\r\n/g, '\n');
if (content.includes(oldPruneFixed)) {
  content = content.replace(oldPruneFixed, newPrune);
} else {
  console.log("Could not find pruneLogs to replace.");
}

fs.writeFileSync(dbFile, content, 'utf8');
console.log("database.cjs patched successfully");
