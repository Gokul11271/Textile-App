const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, 'src', 'components', 'Statements.jsx');
let content = fs.readFileSync(file, 'utf8');

const oldState = `      ) : !selectedPartyId ? (
        <div className="flex flex-col justify-center items-center h-64 bg-m3-surface-container-low border border-m3-outline-variant rounded-2xl text-m3-on-surface-variant">
          <FileText className="w-12 h-12 mb-4 opacity-50" />
          <p className="text-lg font-medium">Select a party to view their ledger</p>
        </div>
      ) : processedData ? (`;

const newState = `      ) : !selectedPartyId ? (
        <div className="bg-m3-surface border border-m3-outline-variant rounded-2xl overflow-hidden shadow-m3-1 animate-in fade-in duration-300">
          <div className="p-5 border-b border-m3-outline-variant bg-m3-surface-container-low/50">
            <h2 className="text-xl font-display font-semibold text-m3-on-surface">Party Directory</h2>
            <p className="text-sm text-m3-on-surface-variant mt-1">Select a party to view their ledger and settle bills</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-0 divide-y md:divide-y-0 md:border-b-0 divide-m3-outline-variant/30">
            {parties.length === 0 ? (
              <div className="col-span-full p-8 text-center text-m3-on-surface-variant">
                No parties found. Please add parties in the Billing section.
              </div>
            ) : parties.map(p => (
              <div 
                key={p.id} 
                onClick={() => setSelectedPartyId(p.id)}
                className="group p-5 hover:bg-m3-surface-container-lowest cursor-pointer transition-colors border-r-0 md:border-r md:border-b border-m3-outline-variant/30 relative"
              >
                <div className="flex justify-between items-start mb-3">
                  <div className="font-semibold text-m3-on-surface group-hover:text-m3-primary transition-colors pr-4">{p.name || p.short_name}</div>
                  <div className="text-xs font-bold uppercase tracking-wide bg-m3-surface-container text-m3-on-surface-variant px-2 py-1 rounded-md shrink-0">{p.short_name}</div>
                </div>
                <div className="flex items-center justify-between mt-auto">
                  <div className="text-sm text-m3-on-surface-variant">
                    Opening Bal: <span className="font-medium text-m3-on-surface">₹ {Number(p.opening_balance || 0).toLocaleString('en-IN', {minimumFractionDigits: 2})}</span>
                  </div>
                  <ChevronRight size={18} className="text-m3-outline-variant group-hover:text-m3-primary transition-colors translate-x-0 group-hover:translate-x-1" />
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : processedData ? (`;

content = content.replace(/\r\n/g, '\n');
content = content.replace(oldState.replace(/\r\n/g, '\n'), newState);

fs.writeFileSync(file, content, 'utf8');
console.log("Statements.jsx empty state patched");
