const { db, dbRun, dbGet, initDatabase } = require('./database.cjs');

async function seedBulk() {
  await initDatabase();
  console.log('Seeding 10 Parties...');

  const parties = [
    { name: 'Kishan Textiles (KT)', short: 'KT', address: '12, Market St, Surat', gst: '24AAAAA0000A1Z5', phone: '9000010001', city: 'Surat', state: 'Gujarat' },
    { name: 'Mehta & Sons (MS)', short: 'MS', address: '45, Industrial Area, Ahmedabad', gst: '24BBBBB1111B1Z6', phone: '9000010002', city: 'Ahmedabad', state: 'Gujarat' },
    { name: 'Sathyamoorthy Silks (SS)', short: 'SS', address: '78, Main Rd, Kanchipuram', gst: '33CCCCC2222C1Z7', phone: '9000010003', city: 'Kanchipuram', state: 'Tamil Nadu' },
    { name: 'Prabhat Fabrics (PF)', short: 'PF', address: '90, Cloth Market, Ludhiana', gst: '03DDDDD3333D1Z8', phone: '9000010004', city: 'Ludhiana', state: 'Punjab' },
    { name: 'Velan Traders (VT)', short: 'VT', address: '101, Erode Rd, Chennimalai', gst: '33EEEEE4444E1Z9', phone: '9000010005', city: 'Chennimalai', state: 'Tamil Nadu' },
    { name: 'Guru Fabrics (GF)', short: 'GF', address: '202, Salem Hwy, Erode', gst: '33FFFFF5555F1Z0', phone: '9000010006', city: 'Erode', state: 'Tamil Nadu' },
    { name: 'Arjun Textiles (AT)', short: 'AT', address: '303, Textile Hub, Mumbai', gst: '27GGGGG6666G1Z1', phone: '9000010007', city: 'Mumbai', state: 'Maharashtra' },
    { name: 'Lakshmi Cottons (LC)', short: 'LC', address: '404, Cotton Ln, Coimbatore', gst: '33HHHHH7777H1Z2', phone: '9000010008', city: 'Coimbatore', state: 'Tamil Nadu' },
    { name: 'Rajeshwari Silks (RS)', short: 'RS', address: '505, Silk St, Bangalore', gst: '29IIIII8888I1Z3', phone: '9000010009', city: 'Bangalore', state: 'Karnataka' },
    { name: 'Modern House (MH)', short: 'MH', address: '606, Design St, Delhi', gst: '07JJJJJ9999J1Z4', phone: '9000010010', city: 'Delhi', state: 'Delhi' },
  ];

  const partyIds = [];
  for (const p of parties) {
    // Insert Customer
    await dbRun('INSERT OR IGNORE INTO customers (name) VALUES (?)', [p.name]);
    const cust = await dbGet('SELECT id FROM customers WHERE name = ?', [p.name]);
    
    // Insert Party
    await dbRun(`
      INSERT OR IGNORE INTO parties (customer_id, short_name, address, gst_number, phone, city, state)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [cust.id, p.short, p.address, p.gst, p.phone, p.city, p.state]);
    
    const party = await dbGet('SELECT id FROM parties WHERE short_name = ?', [p.short]);
    partyIds.push(party.id);
  }

  console.log('Seeding 20 Bills...');
  const formatDate = (date) => {
    const d = new Date(date);
    const day = d.getDate().toString().padStart(2, '0');
    const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
    return `${day}-${months[d.getMonth()]}-${d.getFullYear()}`;
  };

  const today = new Date();
  for (let i = 1; i <= 20; i++) {
    const billNo = `INV-${1000 + i}`;
    const partyId = partyIds[i % 10];
    const date = formatDate(new Date(today.getTime() - (20 - i) * 24 * 60 * 60 * 1000));
    const subtotal = 5000 + (i * 250);
    const taxRate = 5;
    const taxAmount = (subtotal * taxRate) / 100;
    const totalAmount = subtotal + taxAmount;

    const billResult = await dbRun(`
      INSERT OR REPLACE INTO bills (
        bill_number, date, party_id, 
        discount_percent, discount_amount, 
        tax_rate, tax_amount, is_inter_state,
        total_amount
      )
      VALUES (?, ?, ?, 0, 0, ?, ?, 0, ?)
    `, [billNo, date, partyId, taxRate, taxAmount, totalAmount]);

    const billId = billResult.lastID;
    
    // Seed one item per bill
    await dbRun(`
      INSERT INTO bill_items (bill_id, size, product_name, quantity, rate, amount)
      VALUES (?, '32x32', 'Premium Cotton Fabric', 10, ?, ?)
    `, [billId, subtotal/10, subtotal]);
  }

  console.log('Bulk seeding completed!');
  process.exit(0);
}

seedBulk().catch(err => {
  console.error(err);
  process.exit(1);
});
