const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const os = require('os');

const dbPath = path.join(os.homedir(), 'AppData', 'Roaming', 'billing_software_textile', 'database', 'dhanalakshmi.db');
const db = new sqlite3.Database(dbPath);

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

const seedData = async () => {
  console.log('Seeding data to:', dbPath);
  
  try {
    const partyIds = [];
    
    // Insert 10 Customers and 10 Parties
    for (let i = 1; i <= 10; i++) {
      const name = `Test Trading Co. ${i}`;
      const short_name = `TTC${i}`;
      const opening_balance = Math.floor(Math.random() * 5000) * 10;
      
      const existingParty = await dbAll('SELECT id FROM parties WHERE short_name = ?', [short_name]);
      if (existingParty.length === 0) {
        // Create Customer
        const resCust = await dbRun('INSERT INTO customers (name) VALUES (?)', [name]);
        const customerId = resCust.lastID;
        
        // Create Party
        const resParty = await dbRun(
          'INSERT INTO parties (customer_id, short_name, gst_number, opening_balance, address) VALUES (?, ?, ?, ?, ?)',
          [customerId, short_name, `23AAACT1${i}1${i}A1Z${i}`, opening_balance, `Test Market, Lane ${i}`]
        );
        partyIds.push(resParty.lastID);
      } else {
        partyIds.push(existingParty[0].id);
      }
    }
    
    console.log(`Ensured 10 test parties. IDs: ${partyIds.join(', ')}`);

    // Insert 10 Bills across these parties
    for (let i = 1; i <= 10; i++) {
      const billNo = `TEST-${1000 + i}`;
      const partyId = partyIds[i % partyIds.length];
      const amount = Math.floor(Math.random() * 10000) + 5000;
      
      const existingBill = await dbAll('SELECT id FROM bills WHERE bill_number = ?', [billNo]);
      let billId;
      if (existingBill.length === 0) {
        const date = new Date();
        date.setDate(date.getDate() - (i * 5)); 
        const dateStr = date.toISOString().split('T')[0];

        const res = await dbRun(
          'INSERT INTO bills (bill_number, date, party_id, total_amount) VALUES (?, ?, ?, ?)',
          [billNo, dateStr, partyId, amount]
        );
        billId = res.lastID;
        
        await dbRun(
          'INSERT INTO bill_items (bill_id, product_name, quantity, rate, amount) VALUES (?, ?, ?, ?, ?)',
          [billId, `Test Fabric ${i}`, 100, amount / 100, amount]
        );
      } else {
        billId = existingBill[0].id;
      }

      // Add a payment for some bills
      if (i % 2 === 0) {
        const existingPayment = await dbAll('SELECT id FROM payments WHERE reference_no = ?', [`UTR-TEST-${i}`]);
        if (existingPayment.length === 0) {
          const payDate = new Date();
          payDate.setDate(payDate.getDate() - (i * 2));
          const payDateStr = payDate.toISOString().split('T')[0];

          await dbRun(
            'INSERT INTO payments (party_id, bill_id, amount, payment_mode, payment_type, payment_date, reference_no) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [partyId, billId, amount / 2, 'Online', 'bill_payment', payDateStr, `UTR-TEST-${i}`]
          );
        }
      }
    }
    
    console.log('Seeded 10 bills and some partial payments.');
    db.close();
  } catch (err) {
    console.error('Seed Error:', err);
  }
};

seedData();
