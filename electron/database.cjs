const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const { app } = require('electron');

// Use app.getPath('userData') to ensure the database is stored in a location
// that doesn't require admin privileges and persists across updates.
const dbDir = path.join(app.getPath('userData'), 'database');
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const dbPath = path.join(dbDir, 'dhanalakshmi.db');
const db = new sqlite3.Database(dbPath);

// Helper for running queries with promises
const dbRun = (query, params = []) => {
  return new Promise((resolve, reject) => {
    db.run(query, params, function(err) {
      if (err) reject(err);
      else resolve(this);
    });
  });
};

const dbAll = (query, params = []) => {
  return new Promise((resolve, reject) => {
    db.all(query, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
};

const dbGet = (query, params = []) => {
  return new Promise((resolve, reject) => {
    db.get(query, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
};

const dbExec = (query) => {
  return new Promise((resolve, reject) => {
    db.exec(query, (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
};

// Initialize schema
async function initDatabase() {
  // Enable WAL mode for better concurrency and Foreign Keys for cascade deletes
  await dbExec('PRAGMA journal_mode=WAL');
  await dbExec('PRAGMA foreign_keys = ON');

  // Check if customers table exists
  const tableCheck = await dbAll("SELECT name FROM sqlite_master WHERE type='table' AND name='customers'");
  if (tableCheck.length === 0) {
    console.log('Creating customers table...');
    await dbExec(`
      CREATE TABLE IF NOT EXISTS customers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Only populate if parties table or parties_old exists
    const partiesExist = await dbAll("SELECT name FROM sqlite_master WHERE type='table' AND (name='parties' OR name='parties_old')");
    if (partiesExist.length > 0) {
      console.log('Populating customers from existing parties...');
      const sourceTable = partiesExist.some(t => t.name === 'parties') ? 'parties' : 'parties_old';
      await dbExec(`INSERT OR IGNORE INTO customers (name) SELECT DISTINCT name FROM ${sourceTable}`);
    }
  }

  // Check state of parties table
  const partiesInfo = await dbAll("PRAGMA table_info(parties)");
  const partiesOldExists = (await dbAll("SELECT name FROM sqlite_master WHERE type='table' AND name='parties_old'")).length > 0;
  const hasCustomerId = partiesInfo.some(col => col.name === 'customer_id');
  const hasNameColumn = partiesInfo.some(col => col.name === 'name');
  
  // Check if we have the composite unique index (customer_id, short_name)
  const indices = await dbAll("PRAGMA index_list(parties)");
  let hasCompositeUnique = false;
  for (const idx of indices) {
    const info = await dbAll(`PRAGMA index_info(${idx.name})`);
    if (info.length === 2 && info.some(c => c.name === 'customer_id') && info.some(c => c.name === 'short_name')) {
      hasCompositeUnique = true;
      break;
    }
  }

  if (partiesInfo.length > 0 && (!hasCustomerId || hasNameColumn || !hasCompositeUnique)) {
    // Stage 1: Migrating to Customer-Location structure or updating unique constraints
    console.log('Migrating parties table to update schema/constraints...');
    try {
      await dbExec('ALTER TABLE parties RENAME TO parties_old');
      await createAndPopulateParties();
    } catch (err) {
      console.error('Migration failed during Stage 1:', err);
      const checkParties = await dbAll("SELECT name FROM sqlite_master WHERE type='table' AND name='parties'");
      if (checkParties.length === 0 && partiesOldExists) {
        await createAndPopulateParties();
      }
    }
  } else if (partiesInfo.length === 0 && partiesOldExists) {
    // Stage 2: Recovering from a partially failed migration
    console.log('Recovering from failed migration (parties_old found)...');
    await createAndPopulateParties();
  } else if (partiesInfo.length === 0) {
    // Stage 3: Fresh install or no parties data
    await dbExec(`
      CREATE TABLE IF NOT EXISTS parties (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        customer_id INTEGER NOT NULL REFERENCES customers(id),
        short_name TEXT NOT NULL,
        address TEXT,
        gst_number TEXT,
        phone TEXT,
        email TEXT,
        city TEXT,
        state TEXT,
        aadhar_number TEXT,
        pan_number TEXT,
        opening_balance REAL DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(customer_id, short_name)
      );
    `);
  }

  // Cleanup parties_old if it still exists
  const finalOldCheck = await dbAll("SELECT name FROM sqlite_master WHERE type='table' AND name='parties_old'");
  if (finalOldCheck.length > 0) {
    console.log('Cleaning up orphaned parties_old table...');
    try {
      await dbExec('DROP TABLE parties_old');
    } catch (e) {
      console.error('Failed to drop parties_old:', e);
    }
  }

  async function createAndPopulateParties() {
    await dbExec(`
      CREATE TABLE IF NOT EXISTS parties (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        customer_id INTEGER NOT NULL REFERENCES customers(id),
        short_name TEXT NOT NULL,
        address TEXT,
        gst_number TEXT,
        phone TEXT,
        email TEXT,
        city TEXT,
        state TEXT,
        aadhar_number TEXT,
        pan_number TEXT,
        opening_balance REAL DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(customer_id, short_name)
      )
    `);

    // Link by name which is now in customers
    console.log('Linking parties to customers and populating new table...');
    const oldCols = await dbAll("PRAGMA table_info(parties_old)");
    const hasNameColumn = oldCols.some(col => col.name === 'name');
    
    if (hasNameColumn) {
      await dbExec(`
        INSERT INTO parties (id, customer_id, short_name, address, gst_number, phone, email, city, state, aadhar_number, pan_number, opening_balance, created_at)
        SELECT p.id, c.id, COALESCE(p.short_name, p.name), p.address, p.gst_number, p.phone, p.email, p.city, p.state, p.aadhar_number, p.pan_number, p.opening_balance, p.created_at
        FROM parties_old p
        JOIN customers c ON p.name = c.name
      `);
    } else {
      // If name column is missing from parties_old, this is very unexpected, skip data migration for rows
      console.warn('Cannot migrate data: "name" column missing from parties_old');
    }
    
    await dbExec('DROP TABLE parties_old');
    console.log('Parties table successfully migrated/recovered.');
  }

  await dbExec(`
    CREATE TABLE IF NOT EXISTS agents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      default_rate REAL DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS bills (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      bill_number TEXT NOT NULL UNIQUE,
      date TEXT NOT NULL,
      agent_id INTEGER,
      party_id INTEGER,
      discount_percent REAL DEFAULT 0,
      discount_amount REAL DEFAULT 0,
      tax_rate REAL DEFAULT 5,
      tax_amount REAL DEFAULT 0,
      is_inter_state INTEGER DEFAULT 0,
      lr_number TEXT,
      lorry_office TEXT,
      is_bale_enabled INTEGER DEFAULT 0,
      bale_numbers TEXT,
      total_amount REAL DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (agent_id) REFERENCES agents (id),
      FOREIGN KEY (party_id) REFERENCES parties (id)
    );

    CREATE TABLE IF NOT EXISTS bill_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      bill_id INTEGER NOT NULL,
      size TEXT,
      product_name TEXT NOT NULL,
      quantity INTEGER DEFAULT 0,
      rate REAL DEFAULT 0,
      amount REAL DEFAULT 0,
      bale_number TEXT,
      FOREIGN KEY (bill_id) REFERENCES bills (id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT
    );

    -- Phase 4: Atomic bill number counter
    CREATE TABLE IF NOT EXISTS counters (
      name TEXT PRIMARY KEY,
      value INTEGER NOT NULL DEFAULT 0
    );

    -- Phase 5: Structured Audit Logging
    CREATE TABLE IF NOT EXISTS system_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      level TEXT NOT NULL, -- INFO, WARN, ERROR
      source TEXT NOT NULL, -- e.g., 'billService', 'printService'
      message TEXT NOT NULL,
      details TEXT -- JSON data
    );

    CREATE INDEX IF NOT EXISTS idx_bills_number ON bills(bill_number);
    CREATE INDEX IF NOT EXISTS idx_bills_date ON bills(date);
    CREATE INDEX IF NOT EXISTS idx_bill_items_bill_id ON bill_items(bill_id);
    CREATE INDEX IF NOT EXISTS idx_bills_party_id ON bills(party_id);
    CREATE INDEX IF NOT EXISTS idx_logs_timestamp ON system_logs(timestamp);

    CREATE TABLE IF NOT EXISTS payments (
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
    );

    CREATE INDEX IF NOT EXISTS idx_payments_party_id ON payments(party_id);
    CREATE INDEX IF NOT EXISTS idx_payments_date ON payments(payment_date);
    CREATE INDEX IF NOT EXISTS idx_payments_bill_id ON payments(bill_id);
  `);

  // Migrate existing payments table if it misses new columns
  const paymentsInfo = await dbAll('PRAGMA table_info(payments)');
  const missingPaymentColumns = [];
  if (paymentsInfo.length > 0) {
    if (!paymentsInfo.some(c => c.name === 'bill_id')) missingPaymentColumns.push('bill_id INTEGER REFERENCES bills(id) ON DELETE SET NULL');
    if (!paymentsInfo.some(c => c.name === 'payment_type')) missingPaymentColumns.push("payment_type TEXT DEFAULT 'bill_payment'");
    if (!paymentsInfo.some(c => c.name === 'reference_no')) missingPaymentColumns.push('reference_no TEXT');
    if (!paymentsInfo.some(c => c.name === 'is_deleted')) missingPaymentColumns.push('is_deleted INTEGER DEFAULT 0');
    if (!paymentsInfo.some(c => c.name === 'discount_amount')) missingPaymentColumns.push('discount_amount REAL DEFAULT 0');
    
    for (const colDef of missingPaymentColumns) {
      try { await dbExec(`ALTER TABLE payments ADD COLUMN ${colDef};`); } catch (e) { console.error('Failed to alter payments table:', e); }
    }
  }

  // Phase 6: party_gst table — one row per GST number per party
  await dbExec(`
    CREATE TABLE IF NOT EXISTS party_gst (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      party_id INTEGER NOT NULL REFERENCES parties(id) ON DELETE CASCADE,
      gst_number TEXT NOT NULL,
      is_active INTEGER NOT NULL DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(party_id, gst_number)
    );
    CREATE INDEX IF NOT EXISTS idx_party_gst_party_id ON party_gst(party_id);
  `);

  // Drop old purchases dev table if it lacks the new schema fields
  const purchasesInfo = await dbAll('PRAGMA table_info(purchases)');
  if (purchasesInfo.length > 0 && !purchasesInfo.some(c => c.name === 'taxable_amount')) {
    try {
      await dbExec('DROP TABLE purchases;');
    } catch (e) {
      console.error('Failed to drop old purchases table:', e);
    }
  }

  await dbExec(`
    CREATE TABLE IF NOT EXISTS purchases (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      invoice_number TEXT NOT NULL,
      supplier_name TEXT NOT NULL,
      supplier_gst TEXT,
      supplier_state TEXT,
      date TEXT NOT NULL,
      taxable_amount REAL NOT NULL,
      tax_rate REAL DEFAULT 0,
      tax_amount REAL DEFAULT 0,
      total_amount REAL NOT NULL,
      is_inter_state INTEGER DEFAULT 0,
      created_by TEXT DEFAULT 'Staff',
      deleted_by TEXT,
      delete_reason TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      is_deleted INTEGER DEFAULT 0,
      UNIQUE(supplier_name, invoice_number)
    );
    CREATE INDEX IF NOT EXISTS idx_purchases_invoice ON purchases(invoice_number);
    CREATE INDEX IF NOT EXISTS idx_purchases_date ON purchases(date);

    CREATE TABLE IF NOT EXISTS purchase_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      purchase_id INTEGER NOT NULL REFERENCES purchases(id) ON DELETE CASCADE,
      product_name TEXT NOT NULL,
      taxable_amount REAL NOT NULL,
      tax_rate REAL NOT NULL,
      tax_amount REAL NOT NULL,
      total_amount REAL NOT NULL,
      FOREIGN KEY (purchase_id) REFERENCES purchases(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_purchase_items_purchase_id ON purchase_items(purchase_id);
  `);

  // Migrate existing purchases to purchase_items
  try {
    const purchaseItemsCount = await dbGet('SELECT COUNT(*) as cnt FROM purchase_items');
    if (!purchaseItemsCount || purchaseItemsCount.cnt === 0) {
      const existingPurchases = await dbAll('SELECT id, taxable_amount, tax_rate, tax_amount, total_amount FROM purchases WHERE is_deleted = 0');
      if (existingPurchases && existingPurchases.length > 0) {
        await dbRun('BEGIN TRANSACTION');
        for (const p of existingPurchases) {
          await dbRun(
            'INSERT INTO purchase_items (purchase_id, product_name, taxable_amount, tax_rate, tax_amount, total_amount) VALUES (?, ?, ?, ?, ?, ?)',
            [p.id, 'General Purchase', p.taxable_amount, p.tax_rate, p.tax_amount, p.total_amount]
          );
        }
        await dbRun('COMMIT');
        console.log(`Migrated ${existingPurchases.length} existing purchases into purchase_items table.`);
      }
    }
  } catch (e) {
    await dbRun('ROLLBACK');
    console.error('Purchase items migration error:', e);
  }

  // Add party_gst snapshot column to bills (frozen at creation time)
  const billsInfo = await dbAll('PRAGMA table_info(bills)');
  if (!billsInfo.some(c => c.name === 'party_gst')) {
    try { await dbExec('ALTER TABLE bills ADD COLUMN party_gst TEXT;'); } catch (e) {}
  }

  // Seed products from existing bill_items
  await dbRun(`INSERT OR IGNORE INTO products (name) SELECT DISTINCT product_name FROM bill_items`);

  const columns = ['phone', 'email', 'city', 'state', 'aadhar_number', 'pan_number', 'opening_balance', 'customer_id'];
  for (const col of columns) {
    try {
      if (col === 'opening_balance') {
        await dbExec(`ALTER TABLE parties ADD COLUMN ${col} REAL DEFAULT 0;`);
      } else if (col === 'customer_id') {
        // Special case: adding customer_id if it's still missing
        const currentPartiesInfo = await dbAll("PRAGMA table_info(parties)");
        if (!currentPartiesInfo.some(c => c.name === 'customer_id')) {
            // Need a default customer if table has rows
            const defaultCustomer = await dbGet("SELECT id FROM customers LIMIT 1");
            const defaultId = defaultCustomer ? defaultCustomer.id : 1;
            await dbExec(`ALTER TABLE parties ADD COLUMN customer_id INTEGER NOT NULL DEFAULT ${defaultId} REFERENCES customers(id);`);
        }
      } else {
        await dbExec(`ALTER TABLE parties ADD COLUMN ${col} TEXT;`);
      }
    } catch (e) {}
  }

  // Agent Commission schema updates
  try {
    const agentsInfo = await dbAll('PRAGMA table_info(agents)');
    if (!agentsInfo.some(c => c.name === 'commission_rate')) {
      await dbExec('ALTER TABLE agents ADD COLUMN commission_rate REAL DEFAULT 0;');
    }
  } catch (e) {
    console.error('Failed to alter agents table:', e);
  }

  await dbExec(`
    CREATE TABLE IF NOT EXISTS agent_payouts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      agent_id INTEGER NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
      amount REAL NOT NULL,
      payout_date TEXT NOT NULL,
      payment_mode TEXT DEFAULT 'Cash',
      reference_no TEXT,
      remarks TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_agent_payouts_agent_id ON agent_payouts(agent_id);
  `);

  // Phase 6: Migrate existing parties.gst_number → party_gst table (one-time)
  try {
    const partyGstCount = await dbGet('SELECT COUNT(*) as cnt FROM party_gst');
    if (!partyGstCount || partyGstCount.cnt === 0) {
      const partiesWithGst = await dbAll(
        'SELECT id, gst_number FROM parties WHERE gst_number IS NOT NULL AND gst_number != ""'
      );
      for (const p of partiesWithGst) {
        try {
          await dbRun(
            'INSERT OR IGNORE INTO party_gst (party_id, gst_number, is_active) VALUES (?, ?, 1)',
            [p.id, p.gst_number]
          );
        } catch (e) {}
      }
      console.log('Migrated existing GST numbers into party_gst table.');
    }
  } catch (e) { console.error('GST migration error:', e); }

  // Migrate existing gst_number — done above

  // Phase 4: Seed counter from existing MAX bill number (safe migration)
  await initBillCounter();

  // Phase 5: Prune old logs to keep DB size small
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
          const newDate = `${year}-${monthNum}-${day}`;
          await dbRun('UPDATE bills SET date = ? WHERE id = ?', [newDate, bill.id]);
          migratedCount++;
        }
      }
    }
    await dbRun('COMMIT');
    if (migratedCount > 0) {
      console.log(`Migrated ${migratedCount} bill dates to YYYY-MM-DD format.`);
    }
  } catch (e) {
    await dbRun('ROLLBACK');
    console.error('Failed to migrate bill dates:', e);
  }
}

/**
 * Seeds the counters table so it matches the current highest bill number.
 * Safe to call on every start — uses INSERT OR IGNORE so it never overwrites.
 * If bills already exist, syncs the counter to MAX to prevent gaps/duplicates.
 */
async function initBillCounter() {
  // Ensure a row exists (INSERT OR IGNORE is idempotent)
  await dbRun(`INSERT OR IGNORE INTO counters (name, value) VALUES ('bill_number', 0)`);

  // Sync counter upwards to the current MAX (never move it backwards)
  const row = await dbGet(`SELECT MAX(CAST(bill_number AS INTEGER)) as max_no FROM bills`);
  const currentMax = (row && row.max_no) ? row.max_no : 0;
  await dbRun(
    `UPDATE counters SET value = MAX(value, ?) WHERE name = 'bill_number'`,
    [currentMax]
  );
}

/**
 * Atomically increment a counter and return its NEW value.
 * Uses RETURNING (SQLite 3.35+) for a single round-trip.
 * Falls back to UPDATE + SELECT for older Electron/SQLite builds.
 */
async function incrementCounter(name) {
  try {
    // RETURNING is supported in SQLite 3.35.0+ (Electron 12+)
    const row = await dbGet(
      `UPDATE counters SET value = value + 1 WHERE name = ? RETURNING value`,
      [name]
    );
    if (row && row.value !== undefined) return row.value;
  } catch (_) {
    // Silently fall through to the safe two-step fallback
  }
  // Safe fallback: UPDATE then SELECT (still inside the caller's transaction)
  await dbRun(`UPDATE counters SET value = value + 1 WHERE name = ?`, [name]);
  const row = await dbGet(`SELECT value FROM counters WHERE name = ?`, [name]);
  return row.value;
}

/**
 * Prunes the system_logs table to keep only the most recent N entries.
 * Default: 1000 logs.
 */
async function pruneLogs(maxLogs = 1000) {
  try {
    await dbRun(`
      DELETE FROM system_logs 
      WHERE id NOT IN (
        SELECT id FROM system_logs 
        ORDER BY timestamp DESC 
        LIMIT ?
      )
    `, [maxLogs]);
  } catch (err) {
    console.error('Failed to prune logs:', err);
  }
}

const getAgents = async () => {
  return await dbAll('SELECT * FROM agents ORDER BY name ASC');
};

const getProducts = async () => {
  return await dbAll('SELECT * FROM products ORDER BY name ASC');
};

const saveProduct = async (product) => {
  return await dbRun(
    'INSERT OR REPLACE INTO products (id, name, default_rate) VALUES (?, ?, ?)',
    [product.id || null, product.name, product.default_rate || 0]
  );
};

const deleteProduct = async (id) => {
  return await dbRun('DELETE FROM products WHERE id = ?', [id]);
};

module.exports = {
  db,
  dbRun,
  dbAll,
  dbGet,
  dbExec,
  initDatabase,
  initBillCounter,
  incrementCounter,
  pruneLogs,
  getAgents,
  getProducts,
  saveProduct,
  deleteProduct
};
