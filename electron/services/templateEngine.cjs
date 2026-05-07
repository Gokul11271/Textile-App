const fs = require('fs');
const path = require('path');
const Handlebars = require('handlebars');

// Register helpers
Handlebars.registerHelper('eq', function (a, b) {
  return a === b;
});

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
    const templateSource = fs.readFileSync(templatePath, 'utf8');
    _cache[templateName] = Handlebars.compile(templateSource);
  }

  // vars contains our data, plus we can pass {{TOKEN}} syntax exactly as is
  // because Handlebars natively uses {{TOKEN}} syntax.
  // Note: Handlebars auto-escapes by default. For raw HTML strings (like ITEMS_ROWS), 
  // the templates must use {{{TOKEN}}} instead of {{TOKEN}}.
  const compiledTemplate = _cache[templateName];
  return compiledTemplate(vars);
};

module.exports = { renderTemplate, clearCache };
