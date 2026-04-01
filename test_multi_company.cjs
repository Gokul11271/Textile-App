const { app } = require('electron');
const fs = require('fs');

app.whenReady().then(async () => {
  try {
    const { getSettingsObj, generateBillPdf } = require('./electron/ipcHandlers.cjs');
    const { initDatabase, dbRun, dbGet } = require('./electron/database.cjs');
    
    await initDatabase();

    const company1Settings = {
      activeCompany: 'company1',
      company1: {
        name: 'DHANALAKSHMI TEXTILES',
        address1: '4/2C PUDUVALASU',
        address2: 'ERODE DIST, TAMIL NADU - 638051',
        gst: '33AXHPA9951A1ZU',
        phone: '+91 98427 64988',
        bankName: 'PUNJAB NATIONAL BANK',
        accNo: '5893002100002556',
        ifsc: 'PUNB0589300',
        terms: '1. Subject to Erode jurisdiction.'
      },
      showBankOnTransport: true
    };

    const company2Settings = {
      activeCompany: 'company2',
      company2: {
        name: 'SECONDARY TEXTILES LTD',
        address1: '12/A INDUSTRIAL ESTATE',
        address2: 'COIMBATORE - 641001',
        gst: '33ABCDE1234F1Z5',
        phone: '+91 99887 76655',
        bankName: 'STATE BANK OF INDIA',
        accNo: '00000033221144',
        ifsc: 'SBIN0001234',
        terms: '1. Subject to Coimbatore jurisdiction.'
      },
      showBankOnTransport: true
    };

    const dummyBill = {
      id: 99991,
      bill_number: 'TEST-CTX-1',
      date: '01-APR-2026',
      party_name: 'TEST CUSTOMER PVT LTD',
      party_address: '123 Test Street, New York, NY',
      party_gst_number: '07AAACU1234F1Z9',
      total_amount: 15450.50,
      subtotal: 15000,
      tax_amount: 750,
      discount_amount: 300,
      tax_rate: 5,
      is_inter_state: 0,
      lr_number: 'LR-123',
      lorry_office: 'KPN PARCELS'
    };

    const dummyItems = [
      { product_name: 'TOWELS PREMIUM', size: '20X40', quantity: 50, rate: 100, amount: 5000 },
      { product_name: 'BEDSHEETS', size: '90X100', quantity: 20, rate: 500, amount: 10000 }
    ];

    // TEST 1: COMPANY 1
    console.log('--- TESTING COMPANY 1 CONTEXT ---');
    for (const [key, value] of Object.entries(company1Settings)) {
      const valStr = typeof value === 'object' ? JSON.stringify(value) : (value !== null && value !== undefined ? value.toString() : '');
      await dbRun('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', [key, valStr]);
    }
    let pdfPath1 = await generateBillPdf(dummyBill, dummyItems, 'big');
    console.log('Company 1 Big Bill generated at:', pdfPath1);
    let pdfPath1t = await generateBillPdf(dummyBill, dummyItems, 'transport');
    console.log('Company 1 Transport Bill generated at:', pdfPath1t);

    // TEST 2: COMPANY 2
    console.log('\n--- TESTING COMPANY 2 CONTEXT ---');
    for (const [key, value] of Object.entries(company2Settings)) {
      const valStr = typeof value === 'object' ? JSON.stringify(value) : (value !== null && value !== undefined ? value.toString() : '');
      await dbRun('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', [key, valStr]);
    }
    
    // update bill number to avoid pdf clash just in case, though the timestamp is there
    dummyBill.bill_number = 'TEST-CTX-2';
    
    let pdfPath2 = await generateBillPdf(dummyBill, dummyItems, 'big');
    console.log('Company 2 Big Bill generated at:', pdfPath2);
    let pdfPath2t = await generateBillPdf(dummyBill, dummyItems, 'transport');
    console.log('Company 2 Transport Bill generated at:', pdfPath2t);

    console.log('\nAll Multi-company tests completed successfully.');
    
  } catch (err) {
    console.error('Test Failed:', err);
  } finally {
    app.quit();
  }
});
