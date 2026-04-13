const fs = require('fs');
const path = require('path');

// ─── Template Cache ────────────────────────────────────────────────────────────
// Each template is read from disk only once per process lifetime.
// Call clearCache() if templates are updated at runtime (dev mode).
const _cache = {};

const clearCache = () => { Object.keys(_cache).forEach(k => delete _cache[k]); };

/**
 * Load a template file and replace all {{TOKEN}} placeholders.
 * @param {string} templateName - Filename inside electron/templates/ (e.g. 'big.html')
 * @param {Object} vars - Key/value map of token replacements
 * @returns {string} - Fully rendered HTML string
 */
const renderTemplate = (templateName, vars) => {
  if (!_cache[templateName]) {
    const templatePath = path.join(__dirname, '../templates', templateName);
    _cache[templateName] = fs.readFileSync(templatePath, 'utf8');
  }

  let html = _cache[templateName];

  for (const [key, value] of Object.entries(vars)) {
    // Replace ALL occurrences of {{KEY}}
    html = html.split(`{{${key}}}`).join(value !== null && value !== undefined ? String(value) : '');
  }

  return html;
};

module.exports = { renderTemplate, clearCache };
