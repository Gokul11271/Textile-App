const fs = require('fs');
const path = require('path');

// 1. Fix printService.cjs
const printFile = path.join(__dirname, 'electron', 'services', 'printService.cjs');
let printContent = fs.readFileSync(printFile, 'utf8');
printContent = printContent.replace(
  "const { BrowserWindow, app } = require('electron');",
  "const { BrowserWindow, app, shell } = require('electron');"
);
fs.writeFileSync(printFile, printContent, 'utf8');

// 2. Fix Statements.jsx
const stmtFile = path.join(__dirname, 'src', 'components', 'Statements.jsx');
let stmtContent = fs.readFileSync(stmtFile, 'utf8');

const oldImport = `import { 
  FileText, Plus, Printer, Search, CreditCard, Filter, ArrowUpRight, ArrowDownLeft, X, Calendar as CalendarIcon, User, ChevronDown, ChevronRight, Receipt
} from 'lucide-react';`;

const newImport = `import { 
  FileText, Plus, Printer, Search, CreditCard, Filter, ArrowUpRight, ArrowDownLeft, X, Calendar as CalendarIcon, User, ChevronDown, ChevronRight, Receipt, ArrowLeft
} from 'lucide-react';`;

const oldHeader = `      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold font-display text-m3-on-surface">Party Ledger & Payments</h1>
          <p className="text-m3-on-surface-variant text-sm mt-1">Invoice-level settlement tracking</p>
        </div>`;

const newHeader = `      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-3">
          {selectedPartyId && (
            <button 
              onClick={() => setSelectedPartyId('')}
              className="p-2 -ml-2 rounded-full hover:bg-m3-surface-container transition-colors text-m3-on-surface-variant"
              title="Back to Directory"
            >
              <ArrowLeft size={24} />
            </button>
          )}
          <div>
            <h1 className="text-2xl font-bold font-display text-m3-on-surface">Party Ledger & Payments</h1>
            <p className="text-m3-on-surface-variant text-sm mt-1">Invoice-level settlement tracking</p>
          </div>
        </div>`;

stmtContent = stmtContent.replace(/\r\n/g, '\n');
stmtContent = stmtContent.replace(oldImport.replace(/\r\n/g, '\n'), newImport);
stmtContent = stmtContent.replace(oldHeader.replace(/\r\n/g, '\n'), newHeader);

fs.writeFileSync(stmtFile, stmtContent, 'utf8');
console.log('Fixed shell and added back button');
