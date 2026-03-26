
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = 'C:\\sqlite\\dhanalakshmi.db';
const db = new sqlite3.Database(dbPath);

db.all("SELECT * FROM bills", [], (err, rows) => {
  if (err) {
    console.error(err);
  } else {
    console.log(`Total bills found: ${rows.length}`);
    rows.forEach(r => {
      console.log(`Bill: ${r.bill_number}, Date: ${r.date}, Total: ${r.total_amount}`);
    });
  }
  db.close();
});
