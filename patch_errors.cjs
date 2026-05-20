const fs = require('fs');
const path = require('path');

// 1. Fix printService.cjs
const printFile = path.join(__dirname, 'electron', 'services', 'printService.cjs');
let printContent = fs.readFileSync(printFile, 'utf8');
printContent = printContent.replace(
  /module\.exports = \{\s*printBill,\s*generatePdf,\s*printPartyStatement,\s*printPaymentReceipt\s*\};/,
  'module.exports = { getSettingsObj, getBillHtml, generateBillPdf, printBillDirect, printPartyStatement, printPaymentReceipt };'
);
fs.writeFileSync(printFile, printContent, 'utf8');

// 2. Fix Statements.jsx
const stmtFile = path.join(__dirname, 'src', 'components', 'Statements.jsx');
let stmtContent = fs.readFileSync(stmtFile, 'utf8');
stmtContent = stmtContent.replace(/\\`/g, '`');
stmtContent = stmtContent.replace(/\\\$/g, '$');
fs.writeFileSync(stmtFile, stmtContent, 'utf8');

console.log('Fixed syntax and exports');
