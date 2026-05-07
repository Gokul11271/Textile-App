const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const os = require('os');

// Helper to get userData path on Windows
const appName = 'billing_software_textile';
const userDataPath = path.join(os.homedir(), 'AppData', 'Roaming', appName);
const dbPath = path.join(userDataPath, 'database', 'dhanalakshmi.db');

console.log('Connecting to database at:', dbPath);

if (!fs.existsSync(dbPath)) {
    console.error('Database file not found at:', dbPath);
    process.exit(1);
}

const db = new sqlite3.Database(dbPath);

const dbRun = (query, params = []) => new Promise((resolve, reject) => {
    db.run(query, params, function(err) {
        if (err) reject(err);
        else resolve(this);
    });
});

const dbGet = (query, params = []) => new Promise((resolve, reject) => {
    db.get(query, params, (err, row) => {
        if (err) reject(err);
        else resolve(row);
    });
});

const dbAll = (query, params = []) => new Promise((resolve, reject) => {
    db.all(query, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
    });
});

async function seed() {
    try {
        console.log('--- Seeding Multi-GST Test Data ---');

        // 1. Ensure we have customers
        await dbRun('INSERT OR IGNORE INTO customers (name) VALUES (?)', ['Multi-GST Test Corp']);
        const customerRow = await dbGet('SELECT id FROM customers WHERE name = ?', ['Multi-GST Test Corp']);
        const customerId = customerRow.id;

        // 2. Identify/Create 2 Existing-style Parties (already in parties table)
        const existingParties = await dbAll('SELECT id, short_name FROM parties LIMIT 2');
        
        for (let i = 0; i < existingParties.length; i++) {
            const p = existingParties[i];
            console.log(`Updating existing party: ${p.short_name} (ID: ${p.id})`);
            
            // Add 3 GSTs to each
            const gsts = [
                { gst: `33EXIST${p.id}A1Z${i}`, active: 1 },
                { gst: `33EXIST${p.id}B1Z${i}`, active: 0 },
                { gst: `33EXIST${p.id}C1Z${i}`, active: 0 }
            ];

            for (const g of gsts) {
                await dbRun('INSERT OR IGNORE INTO party_gst (party_id, gst_number, is_active) VALUES (?, ?, ?)', 
                    [p.id, g.gst, g.active]);
            }
            
            // Sync primary gst_number
            await dbRun('UPDATE parties SET gst_number = ? WHERE id = ?', [gsts[0].gst, p.id]);
        }

        // 3. Create 2 New Parties
        for (let i = 1; i <= 2; i++) {
            const shortName = `New Multi-GST Party ${i}`;
            console.log(`Creating new party: ${shortName}`);
            
            await dbRun('INSERT OR IGNORE INTO parties (customer_id, short_name, address, city, state) VALUES (?, ?, ?, ?, ?)',
                [customerId, shortName, `${i}23 Test Lane, Mumbai`, 'Mumbai', 'Maharashtra']);
            
            const newParty = await dbGet('SELECT id FROM parties WHERE short_name = ?', [shortName]);
            
            // Add 5 GSTs to new parties
            const gsts = [
                { gst: `27NEWP${newParty.id}A1Z${i}`, active: 1 },
                { gst: `27NEWP${newParty.id}B1Z${i}`, active: 0 },
                { gst: `27NEWP${newParty.id}C1Z${i}`, active: 0 },
                { gst: `27NEWP${newParty.id}D1Z${i}`, active: 0 },
                { gst: `27NEWP${newParty.id}E1Z${i}`, active: 0 }
            ];

            for (const g of gsts) {
                await dbRun('INSERT OR IGNORE INTO party_gst (party_id, gst_number, is_active) VALUES (?, ?, ?)', 
                    [newParty.id, g.gst, g.active]);
            }
            
            // Sync primary gst_number
            await dbRun('UPDATE parties SET gst_number = ? WHERE id = ?', [gsts[0].gst, newParty.id]);
        }

        console.log('Seeding completed successfully!');
    } catch (err) {
        console.error('Seeding failed:', err);
    } finally {
        db.close();
    }
}

seed();
