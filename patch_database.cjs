const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, 'electron', 'database.cjs');
let content = fs.readFileSync(file, 'utf8');

const oldTable = `    CREATE TABLE IF NOT EXISTS payments (
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
    );`;

const newTable = `    CREATE TABLE IF NOT EXISTS payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      party_id INTEGER NOT NULL REFERENCES parties(id) ON DELETE CASCADE,
      bill_id INTEGER REFERENCES bills(id) ON DELETE SET NULL,
      amount REAL NOT NULL DEFAULT 0,
      discount_amount REAL DEFAULT 0,
      payment_mode TEXT DEFAULT 'Cash',
      payment_type TEXT DEFAULT 'bill_payment',
      payment_date TEXT NOT NULL,
      reference_no TEXT,
      remarks TEXT,
      is_deleted INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );`;

const oldMigration = `    if (!paymentsInfo.some(c => c.name === 'is_deleted')) missingPaymentColumns.push('is_deleted INTEGER DEFAULT 0');`;
const newMigration = `    if (!paymentsInfo.some(c => c.name === 'is_deleted')) missingPaymentColumns.push('is_deleted INTEGER DEFAULT 0');
    if (!paymentsInfo.some(c => c.name === 'discount_amount')) missingPaymentColumns.push('discount_amount REAL DEFAULT 0');`;

content = content.replace(/\r\n/g, '\n');
content = content.replace(oldTable.replace(/\r\n/g, '\n'), newTable);
content = content.replace(oldMigration.replace(/\r\n/g, '\n'), newMigration);

fs.writeFileSync(file, content, 'utf8');
console.log('database.cjs updated');
