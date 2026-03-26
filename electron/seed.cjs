const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const os = require('os');

const dbPath = 'C:\\sqlite\\dhanalakshmi.db';

const database = require('./database.cjs');

const db = database.db;

async function seed() {
  await database.initDatabase();
  
  const run = (query, params = []) => new Promise((resolve, reject) => {
    db.run(query, params, function(err) {
      if (err) reject(err);
      else resolve(this);
    });
  });

  try {
    console.log('Seeding Agents...');
    await run('INSERT OR IGNORE INTO agents (name) VALUES (?)', ['Rajesh Kumar']);
    await run('INSERT OR IGNORE INTO agents (name) VALUES (?)', ['Suresh Raina']);
    await run('INSERT OR IGNORE INTO agents (name) VALUES (?)', ['Priya Sharma']);

    console.log('Seeding Customers...');
    const customer1 = await run('INSERT OR IGNORE INTO customers (name) VALUES (?)', ['Cotton House']);
    const customer2 = await run('INSERT OR IGNORE INTO customers (name) VALUES (?)', ['Silk Palace']);
    const customer3 = await run('INSERT OR IGNORE INTO customers (name) VALUES (?)', ['Dhanalakshmi Textiles']);

    // Get the IDs of the seeded customers
    const getCustomerId = async (name) => {
      const row = await database.dbGet('SELECT id FROM customers WHERE name = ?', [name]);
      return row ? row.id : null;
    };

    const id1 = await getCustomerId('Cotton House');
    const id2 = await getCustomerId('Silk Palace');
    const id3 = await getCustomerId('Dhanalakshmi Textiles');

    console.log('Seeding Parties (Locations)...');
    if (id1) {
      await run('INSERT OR IGNORE INTO parties (customer_id, short_name, address, gst_number, phone, email, city, state) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', 
        [id1, 'Cotton House Bangalore', '123, MG Road, Bangalore - 560001', '29ABCDE1234F1Z5', '9876543210', 'info@cottonhouse.com', 'Bangalore', 'Karnataka']);
    }
    if (id2) {
      await run('INSERT OR IGNORE INTO parties (customer_id, short_name, address, gst_number, phone, email, city, state) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', 
        [id2, 'Silk Palace Chennai', '45, Anna Salai, Chennai - 600002', '33FGHIJ5678K2Z6', '9123456789', 'contact@silkpalace.in', 'Chennai', 'Tamil Nadu']);
    }
    if (id3) {
      await run('INSERT OR IGNORE INTO parties (customer_id, short_name, address, gst_number, phone, email, city, state) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', 
        [id3, 'Dhanalakshmi Textiles Retail', 'Main Bazaar, Salem - 636001', '33KLMNO9012L3Z7', '8234567890', 'salem@dhanalakshmi.com', 'Salem', 'Tamil Nadu']);
    }

    console.log('Seeding completed successfully!');
  } catch (error) {
    console.error('Seeding failed:', error);
  } finally {
    db.close();
  }
}

seed();
