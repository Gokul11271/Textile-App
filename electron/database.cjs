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

    CREATE INDEX IF NOT EXISTS idx_bills_number ON bills(bill_number);
    CREATE INDEX IF NOT EXISTS idx_bills_date ON bills(date);
    CREATE INDEX IF NOT EXISTS idx_bill_items_bill_id ON bill_items(bill_id);
    CREATE INDEX IF NOT EXISTS idx_bills_party_id ON bills(party_id);
  `);

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
}

module.exports = {
  db,
  dbRun,
  dbAll,
  dbGet,
  dbExec,
  initDatabase,
};
