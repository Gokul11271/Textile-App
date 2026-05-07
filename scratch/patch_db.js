const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, '..', 'electron', 'database.cjs');
let content = fs.readFileSync(dbPath, 'utf8');

// ── 1. Add party_gst table CREATE + bills column AFTER the existing schema block ──
if (!content.includes('party_gst table')) {
  const MARKER = "    CREATE INDEX IF NOT EXISTS idx_logs_timestamp ON system_logs(timestamp);\r\n  `);";
  const REPLACEMENT = [
    "    CREATE INDEX IF NOT EXISTS idx_logs_timestamp ON system_logs(timestamp);",
    "  `);",
    "",
    "  // Phase 6: party_gst table — one row per GST number per party",
    "  await dbExec(`",
    "    CREATE TABLE IF NOT EXISTS party_gst (",
    "      id INTEGER PRIMARY KEY AUTOINCREMENT,",
    "      party_id INTEGER NOT NULL REFERENCES parties(id) ON DELETE CASCADE,",
    "      gst_number TEXT NOT NULL,",
    "      is_active INTEGER NOT NULL DEFAULT 0,",
    "      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,",
    "      UNIQUE(party_id, gst_number)",
    "    );",
    "    CREATE INDEX IF NOT EXISTS idx_party_gst_party_id ON party_gst(party_id);",
    "  `);",
    "",
    "  // Add party_gst snapshot column to bills (frozen at creation time)",
    "  const billsInfo = await dbAll('PRAGMA table_info(bills)');",
    "  if (!billsInfo.some(c => c.name === 'party_gst')) {",
    "    try { await dbExec('ALTER TABLE bills ADD COLUMN party_gst TEXT;'); } catch (e) {}",
    "  }",
  ].join('\r\n');

  if (content.includes(MARKER)) {
    content = content.replace(MARKER, REPLACEMENT);
    console.log('✅ Phase 6 schema block injected.');
  } else {
    console.error('❌ Schema MARKER not found — check CRLF or whitespace');
    process.exit(1);
  }
} else {
  console.log('ℹ️  Phase 6 schema block already present, skipping.');
}

// ── 2. Add migration block BEFORE Phase 4 counter seeding ──
if (!content.includes('Migrate existing gst_number')) {
  const PHASE4 = "  // Phase 4: Seed counter from existing MAX bill number (safe migration)";
  const MIGRATION = [
    "  // Phase 6: Migrate existing parties.gst_number → party_gst table (one-time)",
    "  try {",
    "    const partyGstCount = await dbGet('SELECT COUNT(*) as cnt FROM party_gst');",
    "    if (!partyGstCount || partyGstCount.cnt === 0) {",
    "      const partiesWithGst = await dbAll(",
    "        'SELECT id, gst_number FROM parties WHERE gst_number IS NOT NULL AND gst_number != \"\"'",
    "      );",
    "      for (const p of partiesWithGst) {",
    "        try {",
    "          await dbRun(",
    "            'INSERT OR IGNORE INTO party_gst (party_id, gst_number, is_active) VALUES (?, ?, 1)',",
    "            [p.id, p.gst_number]",
    "          );",
    "        } catch (e) {}",
    "      }",
    "      console.log('Migrated existing GST numbers into party_gst table.');",
    "    }",
    "  } catch (e) { console.error('GST migration error:', e); }",
    "",
    "  // Migrate existing gst_number — done above",
    "",
    "  // Phase 4: Seed counter from existing MAX bill number (safe migration)",
  ].join('\r\n');

  if (content.includes(PHASE4)) {
    content = content.replace(PHASE4, MIGRATION);
    console.log('✅ Migration block injected.');
  } else {
    console.error('❌ Phase 4 MARKER not found');
    process.exit(1);
  }
} else {
  console.log('ℹ️  Migration block already present, skipping.');
}

fs.writeFileSync(dbPath, content, 'utf8');
console.log('✅ database.cjs patched successfully.');
