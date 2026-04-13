const fs   = require('fs');
const path = require('path');
const { app } = require('electron');

/**
 * Phase 5: Auto-backup service.
 *
 * On each app start, copies the SQLite database to a dated backup file.
 * Retains only the last N backups (default: 7) to avoid disk bloat.
 *
 * Backup location: <userData>/database/backups/
 * Filename format: dhanalakshmi_2026-04-13.db
 */

const DB_FILENAME      = 'dhanalakshmi.db';
const BACKUP_SUBDIR    = 'backups';
const MAX_BACKUPS      = 7;

/**
 * Run the auto-backup.
 * Safe to call on every app start — silently skips if DB doesn't exist yet.
 */
const autoBackup = () => {
  try {
    const dbDir    = path.join(app.getPath('userData'), 'database');
    const dbPath   = path.join(dbDir, DB_FILENAME);

    // Nothing to back up if the DB hasn't been created yet
    if (!fs.existsSync(dbPath)) return;

    const backupDir = path.join(dbDir, BACKUP_SUBDIR);
    if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });

    // One backup per calendar day (overwrite if run multiple times today)
    const today      = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    const backupFile = path.join(backupDir, `dhanalakshmi_${today}.db`);
    fs.copyFileSync(dbPath, backupFile);

    // Prune old backups — keep only the most recent MAX_BACKUPS files
    const allBackups = fs.readdirSync(backupDir)
      .filter(f => f.endsWith('.db'))
      .map(f => ({ name: f, time: fs.statSync(path.join(backupDir, f)).mtimeMs }))
      .sort((a, b) => b.time - a.time);   // newest first

    allBackups.slice(MAX_BACKUPS).forEach(old => {
      try { fs.unlinkSync(path.join(backupDir, old.name)); } catch (_) {}
    });

    console.log(`[Backup] Saved: ${backupFile} (keeping last ${MAX_BACKUPS} backups)`);
  } catch (err) {
    // Backup is best-effort — never crash the app over it
    console.error('[Backup] Auto-backup failed:', err.message);
  }
};

module.exports = { autoBackup };
