const fs = require('fs');
const path = require('path');

// 1. Add ipcHandler
const handlersFile = path.join(__dirname, 'electron', 'ipcHandlers.cjs');
let handlersContent = fs.readFileSync(handlersFile, 'utf8');

const newGlobalHandler = `
  ipcMain.handle('get-global-statements', async () => {
    try {
      const bills = await dbAll(\`
        SELECT b.id, b.bill_number, b.date as entry_date, b.total_amount as debit, b.party_id, p.short_name as party_short_name, c.name as party_name
        FROM bills b
        LEFT JOIN parties p ON b.party_id = p.id
        LEFT JOIN customers c ON p.customer_id = c.id
        ORDER BY b.date DESC, b.id DESC
      \`);
      
      const payments = await dbAll(\`
        SELECT bill_id, SUM(amount + COALESCE(discount_amount, 0)) as total_paid
        FROM payments 
        WHERE is_deleted = 0 AND bill_id IS NOT NULL
        GROUP BY bill_id
      \`);
      
      // Map payment sums to bills
      const paymentMap = {};
      payments.forEach(p => { paymentMap[p.bill_id] = p.total_paid; });
      
      const globalBills = bills.map(b => {
        const paid = paymentMap[b.id] || 0;
        return {
          ...b,
          paid,
          pending: b.debit - paid
        };
      });
      
      return { success: true, globalBills };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });
`;

if (!handlersContent.includes('get-global-statements')) {
  handlersContent = handlersContent.replace(
    "ipcMain.handle('get-party-statement', async (event, partyId) => {",
    newGlobalHandler + "\n  ipcMain.handle('get-party-statement', async (event, partyId) => {"
  );
  fs.writeFileSync(handlersFile, handlersContent, 'utf8');
}

// 2. Update Statements.jsx
const stmtFile = path.join(__dirname, 'src', 'components', 'Statements.jsx');
let stmtContent = fs.readFileSync(stmtFile, 'utf8');

const importsOld = `import React, { useState, useEffect, useMemo } from 'react';`;
const importsNew = `import React, { useState, useEffect, useMemo } from 'react';`;

// I will just completely rewrite Statements.jsx to incorporate the new Global Dashboard because the structure changes heavily.
