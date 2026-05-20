const fs = require('fs');
const path = require('path');

const stmtFile = path.join(__dirname, 'src', 'components', 'Statements.jsx');
let content = fs.readFileSync(stmtFile, 'utf8');

// We will add global statements state
content = content.replace(
  "const [statementData, setStatementData] = useState(null);",
  "const [statementData, setStatementData] = useState(null);\n  const [globalBills, setGlobalBills] = useState([]);\n  const [globalSearch, setGlobalSearch] = useState('');\n  const [globalFilter, setGlobalFilter] = useState('pending'); // all, paid, pending"
);

// We will fetch global statements
content = content.replace(
  "      setStatementData(null);",
  "      setStatementData(null);\n      loadGlobalStatements();"
);

// We will add the function
content = content.replace(
  "  const loadStatement = async (partyId) => {",
  `  const loadGlobalStatements = async () => {
    setIsLoading(true);
    try {
      const result = await window.electron.ipcRenderer.invoke('get-global-statements');
      if (result.success) setGlobalBills(result.globalBills);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  const loadStatement = async (partyId) => {`
);

// We need to build the Global Dashboard UI.
// I will find the Party Directory empty state block and replace it.
const emptyStateStart = `      ) : !selectedPartyId ? (
        <div className="bg-m3-surface border border-m3-outline-variant rounded-2xl overflow-hidden shadow-m3-1 animate-in fade-in duration-300">`;
        
const emptyStateEnd = `          </div>
        </div>
      ) : processedData ? (`

// We will use regex to replace the entire block.
const regex = /\) : !selectedPartyId \? \([\s\S]*?\) : processedData \? \(/;

const newDashboard = `) : !selectedPartyId ? (
        <div className="bg-m3-surface border border-m3-outline-variant rounded-2xl overflow-hidden shadow-m3-1 animate-in fade-in duration-300 flex flex-col">
          <div className="p-5 border-b border-m3-outline-variant bg-m3-surface-container-low/50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h2 className="text-xl font-display font-semibold text-m3-on-surface">Global Outstanding Dashboard</h2>
              <p className="text-sm text-m3-on-surface-variant mt-1">Search and filter all bills across all parties</p>
            </div>
            
            <div className="flex items-center gap-3 w-full sm:w-auto">
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-m3-on-surface-variant w-4 h-4" />
                <input
                  type="text"
                  placeholder="Search Bill No or Party..."
                  value={globalSearch}
                  onChange={(e) => setGlobalSearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-m3-surface-container-lowest border border-m3-outline-variant rounded-xl text-sm focus:ring-2 focus:ring-m3-primary focus:outline-none"
                />
              </div>
              <div className="flex items-center gap-2">
                <Filter size={16} className="text-m3-on-surface-variant hidden sm:block" />
                <select
                  value={globalFilter}
                  onChange={(e) => setGlobalFilter(e.target.value)}
                  className="px-3 py-2 bg-m3-surface-container-lowest border border-m3-outline-variant rounded-xl text-sm focus:ring-2 focus:ring-m3-primary focus:outline-none cursor-pointer"
                >
                  <option value="all">All Bills</option>
                  <option value="pending">Unpaid / Pending</option>
                  <option value="paid">Fully Paid</option>
                </select>
              </div>
            </div>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[800px]">
              <thead>
                <tr className="bg-m3-surface-container-lowest text-m3-on-surface-variant text-sm border-b border-m3-outline-variant">
                  <th className="p-4 font-medium">Date</th>
                  <th className="p-4 font-medium">Party Name</th>
                  <th className="p-4 font-medium">Bill No</th>
                  <th className="p-4 font-medium">Billed Amount</th>
                  <th className="p-4 font-medium">Paid</th>
                  <th className="p-4 font-medium">Pending</th>
                  <th className="p-4 font-medium">Status</th>
                  <th className="p-4 font-medium text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-m3-outline-variant/30">
                {globalBills
                  .filter(b => {
                    const search = globalSearch.toLowerCase();
                    const matchesSearch = b.bill_number.toLowerCase().includes(search) || (b.party_name && b.party_name.toLowerCase().includes(search)) || (b.party_short_name && b.party_short_name.toLowerCase().includes(search));
                    
                    let matchesFilter = true;
                    if (globalFilter === 'pending') matchesFilter = b.pending > 0;
                    if (globalFilter === 'paid') matchesFilter = b.pending <= 0;
                    
                    return matchesSearch && matchesFilter;
                  })
                  .map(b => (
                  <tr key={b.id} className="hover:bg-m3-surface-container-lowest/50 transition-colors group">
                    <td className="p-4 text-sm text-m3-on-surface-variant">{new Date(b.entry_date).toLocaleDateString('en-GB')}</td>
                    <td className="p-4 text-sm font-medium text-m3-on-surface cursor-pointer hover:text-m3-primary transition-colors" onClick={() => setSelectedPartyId(b.party_id)}>
                      {b.party_name || b.party_short_name}
                    </td>
                    <td className="p-4 text-sm font-medium text-m3-on-surface">{b.bill_number}</td>
                    <td className="p-4 text-sm text-m3-on-surface">₹ {b.debit.toLocaleString('en-IN', {minimumFractionDigits: 2})}</td>
                    <td className="p-4 text-sm text-green-600">₹ {b.paid.toLocaleString('en-IN', {minimumFractionDigits: 2})}</td>
                    <td className="p-4 text-sm font-semibold text-red-500">₹ {b.pending.toLocaleString('en-IN', {minimumFractionDigits: 2})}</td>
                    <td className="p-4 text-sm">
                      {b.pending <= 0 ? (
                        <span className="bg-green-100 text-green-800 text-xs font-bold px-2 py-1 rounded uppercase">PAID</span>
                      ) : b.paid > 0 ? (
                        <span className="bg-yellow-100 text-yellow-800 text-xs font-bold px-2 py-1 rounded uppercase">PARTIAL</span>
                      ) : (
                        <span className="bg-red-100 text-red-800 text-xs font-bold px-2 py-1 rounded uppercase">UNPAID</span>
                      )}
                    </td>
                    <td className="p-4 text-right">
                      <button 
                        onClick={() => setSelectedPartyId(b.party_id)}
                        className="opacity-0 group-hover:opacity-100 px-3 py-1 bg-m3-surface-container hover:bg-m3-primary hover:text-white transition-all text-sm rounded-lg border border-m3-outline-variant font-medium text-m3-on-surface"
                      >
                        View Ledger
                      </button>
                    </td>
                  </tr>
                ))}
                
                {globalBills.length === 0 && (
                  <tr>
                    <td colSpan="8" className="p-8 text-center text-m3-on-surface-variant">
                      No bills found. Create a bill in the Billing section to see it here.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : processedData ? (`;

content = content.replace(regex, newDashboard);

fs.writeFileSync(stmtFile, content, 'utf8');
console.log('Statements global dashboard injected');
