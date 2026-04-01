const { app } = require('electron');
const fs = require('fs');

app.whenReady().then(async () => {
  let logOutput = "";
  const log = (msg) => { logOutput += msg + '\n'; console.log(msg); };

  try {
    const { dbRun, dbAll, dbGet, initDatabase } = require('./electron/database.cjs');
    await initDatabase();
    
    log('--- GENERATING 10 DUMMY BILLS ---');
    for (let i = 1; i <= 10; i++) {
      const billNo = `TEST-${1000 + i}`;
      const existing = await dbGet('SELECT id FROM bills WHERE bill_number = ?', [billNo]);
      if (existing) {
        await dbRun('DELETE FROM bill_items WHERE bill_id = ?', [existing.id]).catch(() => {});
        await dbRun('DELETE FROM bills WHERE id = ?', [existing.id]);
      }
      const result = await dbRun('INSERT INTO bills (bill_number, date, total_amount, lr_number) VALUES (?, ?, ?, ?)', [billNo, '2026-03-30', 5000 + i * 100, '']);
      await dbRun('INSERT INTO bill_items (bill_id, product_name, quantity, rate, amount) VALUES (?, ?, ?, ?, ?)', [result.lastID, 'Test Product', 10, 500, 5000]);
    }
    log('Successfully generated 10 test bills (TEST-1001 to TEST-1010).');

    log('\n--- TESTING LR NUMBER BATCH UPDATE ---');
    const startNo = 'TEST-1001';
    const endNo = 'TEST-1010';
    const startLrNo = 'LR-500-A'; 

    const bills = await dbAll('SELECT id, bill_number FROM bills WHERE bill_number >= ? AND bill_number <= ? ORDER BY bill_number ASC', [startNo, endNo]);
    log(`Found ${bills.length} bills in range to update.`);

    let currentLrMatch = startLrNo.match(/^(\D*)(\d+)(\D*)$/);
    let currentLrNum = currentLrMatch ? parseInt(currentLrMatch[2], 10) : parseInt(startLrNo, 10);
    const prefix = currentLrMatch ? currentLrMatch[1] : '';
    const suffix = currentLrMatch ? currentLrMatch[3] : '';

    await dbRun('BEGIN TRANSACTION');
    try {
      for (const bill of bills) {
        let newLr = startLrNo;
        if (!isNaN(currentLrNum)) {
          newLr = `${prefix}${currentLrNum}${suffix}`;
          currentLrNum++;
        }
        await dbRun('UPDATE bills SET lr_number = ? WHERE id = ?', [newLr, bill.id]);
      }
      await dbRun('COMMIT');
      log('Successfully applied LR numbers to database.');
    } catch (err) {
      await dbRun('ROLLBACK');
      log(`Failed to update LR numbers: ${err}`);
    }

    log('\n--- VERIFICATION RESULTS ---');
    const updatedBills = await dbAll('SELECT bill_number, lr_number FROM bills WHERE bill_number >= ? AND bill_number <= ? ORDER BY bill_number ASC', [startNo, endNo]);
    updatedBills.forEach(b => log(`${b.bill_number.padEnd(10, ' ')} -> LR: ${b.lr_number}`));
    
    log('\nTest completed successfully.');
  } catch (error) {
    log(`Error during test: ${error}`);
  } finally {
    fs.writeFileSync('test_output.txt', logOutput, 'utf8');
    app.quit();
  }
});
