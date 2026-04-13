const { dbRun } = require('../database.cjs');

/**
 * Phase 5: Structured Logging Service
 * Writes events to the system_logs table for traceability.
 */

const logToDb = async (level, source, message, data = null) => {
  try {
    const details = data ? JSON.stringify(data) : null;
    await dbRun(
      'INSERT INTO system_logs (level, source, message, details) VALUES (?, ?, ?, ?)',
      [level, source, message, details]
    );
    // Also output to console for dev visibility
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [${level}] [${source}] ${message}`);
  } catch (err) {
    console.error('[logService] Failed to write log to database:', err);
  }
};

const info = (source, message, data = null) => logToDb('INFO', source, message, data);
const warn = (source, message, data = null) => logToDb('WARN', source, message, data);
const error = (source, message, data = null) => logToDb('ERROR', source, message, data);

module.exports = { info, warn, error };
