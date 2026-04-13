const fs = require('fs');
const path = require('path');

/**
 * Load a template file and replace all {{TOKEN}} placeholders.
 * @param {string} templateName - Filename inside electron/templates/ (e.g. 'big.html')
 * @param {Object} vars - Key/value map of token replacements
 * @returns {string} - Fully rendered HTML string
 */
const renderTemplate = (templateName, vars) => {
  const templatePath = path.join(__dirname, '../templates', templateName);
  let html = fs.readFileSync(templatePath, 'utf8');

  for (const [key, value] of Object.entries(vars)) {
    // Replace ALL occurrences of {{KEY}} (global flag)
    html = html.split(`{{${key}}}`).join(value !== null && value !== undefined ? String(value) : '');
  }

  return html;
};

module.exports = { renderTemplate };
