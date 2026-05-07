const fs = require('fs');

// 1. database.cjs
const db = fs.readFileSync('electron/database.cjs', 'utf8');
console.log('DB party_gst table:', db.includes('CREATE TABLE IF NOT EXISTS party_gst'));
console.log('DB bills.party_gst column:', db.includes('ALTER TABLE bills ADD COLUMN party_gst'));
console.log('DB migration block:', db.includes('Migrate existing gst_number'));

// 2. ipcHandlers.cjs
const ipc = fs.readFileSync('electron/ipcHandlers.cjs', 'utf8');
console.log('IPC get-party-gsts:', ipc.includes("'get-party-gsts'"));
console.log('IPC set-active-gst:', ipc.includes("'set-active-gst'"));
console.log('IPC delete-party-gst:', ipc.includes("'delete-party-gst'"));
console.log('IPC save-party gst_entries:', ipc.includes('gst_entries'));

// 3. billService.cjs
const bs = fs.readFileSync('electron/services/billService.cjs', 'utf8');
console.log('BillService frozen INSERT:', bs.includes('FROZEN at creation time'));
console.log('BillService COALESCE UPDATE:', bs.includes('COALESCE(party_gst, ?)'));
console.log('BillService COALESCE get:', bs.includes('COALESCE(b.party_gst'));

// 4. preload.cjs
const pre = fs.readFileSync('electron/preload.cjs', 'utf8');
console.log('Preload getPartyGsts:', pre.includes('getPartyGsts'));
console.log('Preload setActiveGst:', pre.includes('setActiveGst'));
console.log('Preload deletePartyGst:', pre.includes('deletePartyGst'));

// 5. Parties.jsx
const p = fs.readFileSync('src/components/Parties.jsx', 'utf8');
console.log('Parties gstEntries state:', p.includes('gstEntries, setGstEntries'));
console.log('Parties Add GST button:', p.includes('Add GST'));
console.log('Parties CheckCircle2:', p.includes('CheckCircle2'));
console.log('Parties gst_entries submit:', p.includes('gst_entries: validGsts'));
console.log('Parties getPartyGsts call:', p.includes('getPartyGsts'));
console.log('Parties resetForm clears gstEntries:', p.includes('setGstEntries'));
