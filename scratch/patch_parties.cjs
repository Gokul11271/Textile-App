const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'src', 'components', 'Parties.jsx');
let content = fs.readFileSync(filePath, 'utf8');

// ─── 1. Update imports ───
content = content.replace(
  `import { Plus, Package, Search, ArrowLeft, X } from 'lucide-react';`,
  `import { Plus, Package, Search, ArrowLeft, X, Trash2, CheckCircle2, Circle } from 'lucide-react';`
);

// ─── 2. Add gst_entries to initial formData ───
content = content.replace(
  `    opening_balance: ''\r\n  });\r\n  const [loading,`,
  `    opening_balance: '',\r\n    gst_entries: []\r\n  });\r\n  const [loading,`
);

// ─── 3. Add gst_entries state after filterCity ───
content = content.replace(
  `  const [filterCity, setFilterCity] = useState('');\r\n\r\n  useEffect`,
  `  const [filterCity, setFilterCity] = useState('');\r\n  const [gstEntries, setGstEntries] = useState([{ gst_number: '', is_active: true }]);\r\n  const [gstError, setGstError] = useState('');\r\n\r\n  useEffect`
);

// ─── 4. Replace fetchCustomers useEffect block to also fetch gst entries when editing ───
// No change needed to fetchCustomers itself

// ─── 5. Update resetForm to clear gst_entries ───
content = content.replace(
  `    gst_number: '',\r\n      phone: '',`,
  `    gst_number: '',\r\n      gst_entries: [],\r\n      phone: '',`
);

// ─── 6. Update handleEdit to load GST entries ───
const OLD_HANDLE_EDIT = `  const handleEdit = (party) => {
    setFormData({
      id: party.id,
      customer_id: party.customer_id,
      isNewCustomer: false,
      newCustomerName: '',
      short_name: party.short_name,
      name: party.name,
      address: party.address,
      gst_number: party.gst_number,
      phone: party.phone || '',
      email: party.email || '',
      city: party.city || '',
      state: party.state || '',
      aadhar_number: party.aadhar_number || '',
      pan_number: party.pan_number || '',
      opening_balance: party.opening_balance || ''
    });
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };`.replace(/\r?\n/g, '\r\n');

const NEW_HANDLE_EDIT = `  const handleEdit = async (party) => {
    setFormData({
      id: party.id,
      customer_id: party.customer_id,
      isNewCustomer: false,
      newCustomerName: '',
      short_name: party.short_name,
      name: party.name,
      address: party.address,
      gst_number: party.gst_number,
      gst_entries: [],
      phone: party.phone || '',
      email: party.email || '',
      city: party.city || '',
      state: party.state || '',
      aadhar_number: party.aadhar_number || '',
      pan_number: party.pan_number || '',
      opening_balance: party.opening_balance || ''
    });
    // Load all GST entries for this party
    try {
      const gsts = await window.electron.db.getPartyGsts(party.id);
      if (gsts && gsts.length > 0) {
        setGstEntries(gsts.map(g => ({ id: g.id, gst_number: g.gst_number, is_active: g.is_active === 1 })));
      } else {
        setGstEntries(party.gst_number ? [{ gst_number: party.gst_number, is_active: true }] : [{ gst_number: '', is_active: true }]);
      }
    } catch (e) {
      setGstEntries(party.gst_number ? [{ gst_number: party.gst_number, is_active: true }] : [{ gst_number: '', is_active: true }]);
    }
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };`.replace(/\r?\n/g, '\r\n');

if (content.includes(OLD_HANDLE_EDIT)) {
  content = content.replace(OLD_HANDLE_EDIT, NEW_HANDLE_EDIT);
  console.log('✅ handleEdit updated');
} else {
  // Try with LF only
  const OLD_LF = OLD_HANDLE_EDIT.replace(/\r\n/g, '\n');
  if (content.includes(OLD_LF)) {
    content = content.replace(OLD_LF, NEW_HANDLE_EDIT);
    console.log('✅ handleEdit updated (LF)');
  } else {
    console.warn('⚠️  handleEdit marker not found — check manually');
  }
}

// ─── 7. Update handleSubmit to include gst_entries ───
const OLD_SUBMIT_LINE = `      const partyData = { ...formData, customer_id: currentCustomerId };`;
const NEW_SUBMIT_LINE = `      // Validate gst_entries
      const validGsts = gstEntries.filter(g => g.gst_number && g.gst_number.trim());
      if (validGsts.length === 0 && !formData.aadhar_number && !formData.pan_number) {
        setError('At least one GST number, Aadhaar, or PAN is required.');
        setLoading(false);
        return;
      }
      // Ensure exactly one is active
      const hasActive = validGsts.some(g => g.is_active);
      if (validGsts.length > 0 && !hasActive) validGsts[0].is_active = true;
      const activeGst = validGsts.find(g => g.is_active);
      const partyData = { ...formData, customer_id: currentCustomerId, gst_number: activeGst ? activeGst.gst_number : formData.gst_number, gst_entries: validGsts };`;

content = content.replace(OLD_SUBMIT_LINE, NEW_SUBMIT_LINE);
console.log('✅ handleSubmit updated with gst_entries');

// ─── 8. Also reset gstEntries in resetForm ───
const OLD_RESET = `    setFormData({\r\n      id: null,\r\n      customer_id: '',\r\n      isNewCustomer: false,\r\n      newCustomerName: '',\r\n      short_name: '',\r\n      name: '',\r\n      address: '',\r\n      gst_number: '',\r\n      phone: '',`;
const NEW_RESET = `    setGstEntries([{ gst_number: '', is_active: true }]);\r\n    setGstError('');\r\n    setFormData({\r\n      id: null,\r\n      customer_id: '',\r\n      isNewCustomer: false,\r\n      newCustomerName: '',\r\n      short_name: '',\r\n      name: '',\r\n      address: '',\r\n      gst_number: '',\r\n      gst_entries: [],\r\n      phone: '',`;

if (content.includes(OLD_RESET)) {
  content = content.replace(OLD_RESET, NEW_RESET);
  console.log('✅ resetForm updated');
} else {
  console.warn('⚠️  resetForm marker not found');
}

// ─── 9. Replace the single GST input with the multi-GST block ───
const OLD_GST_SECTION = `              <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-3 gap-6">\r\n                <div>\r\n                  <label className={labelBase}>GST NO</label>\r\n                  <input type="text" name="gst_number" value={formData.gst_number} onChange={handleInputChange} className={\`\${inputBase} font-mono\`} placeholder="Ex: 33AAAAA0000A1Z5" />\r\n                </div>`;

const NEW_GST_SECTION = `              <div className="md:col-span-2">
                <div className="flex items-center justify-between mb-2">
                  <label className={labelBase} style={{marginBottom:0}}>GST Numbers <span className="text-xs text-m3-on-surface-variant ml-1">(select active for billing)</span></label>
                  <button type="button" onClick={() => setGstEntries(prev => [...prev, { gst_number: '', is_active: false }])} className="flex items-center gap-1 px-3 py-1 rounded-full text-xs bg-m3-primary text-m3-on-primary hover:shadow-m3-1 transition-all">
                    <Plus size={13} /> Add GST
                  </button>
                </div>
                <div className="space-y-2">
                  {gstEntries.map((entry, idx) => (
                    <div key={idx} className={\`flex items-center gap-2 p-2 rounded-lg border transition-all \${entry.is_active ? 'border-m3-primary bg-m3-primary/5' : 'border-m3-outline-variant bg-transparent'}\`}>
                      <button type="button" title={entry.is_active ? 'Active GST' : 'Set as Active'} onClick={() => setGstEntries(prev => prev.map((g, i) => ({ ...g, is_active: i === idx })))} className="flex-shrink-0 transition-colors">
                        {entry.is_active ? <CheckCircle2 size={18} className="text-m3-primary" /> : <Circle size={18} className="text-m3-on-surface-variant/40 hover:text-m3-primary" />}
                      </button>
                      <input type="text" value={entry.gst_number} onChange={e => setGstEntries(prev => prev.map((g, i) => i === idx ? { ...g, gst_number: e.target.value.toUpperCase() } : g))} className={\`flex-1 rounded-md px-3 py-2 m3-body-medium bg-m3-surface-container-highest border border-m3-outline-variant text-m3-on-surface placeholder:text-m3-on-surface-variant/40 focus:border-m3-primary focus:ring-1 focus:ring-m3-primary/20 outline-none transition-all font-mono text-sm\`} placeholder={\`GST #\${idx + 1} — e.g. 33AAAA00000A1Z5\`} />
                      {entry.is_active && <span className="text-xs text-m3-primary font-semibold px-2 py-0.5 bg-m3-primary/10 rounded-full whitespace-nowrap">Active</span>}
                      {gstEntries.length > 1 && (
                        <button type="button" onClick={() => setGstEntries(prev => { const next = prev.filter((_, i) => i !== idx); if (!next.some(g => g.is_active) && next.length > 0) next[0].is_active = true; return next; })} className="flex-shrink-0 text-m3-on-surface-variant/40 hover:text-m3-error transition-colors p-1 rounded-full hover:bg-m3-error/10">
                          <X size={14} />
                        </button>
                      )}
                    </div>
                  ))}
                  {gstError && <p className="text-xs text-m3-error">{gstError}</p>}
                </div>
              </div>
              <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-3 gap-6" style={{display:'contents'}}>
                <div style={{display:'none'}} />\n              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">`;

// Replace old GST section
if (content.includes(OLD_GST_SECTION)) {
  // Insert new GST section, then keep Aadhaar/PAN fields
  const OLD_GST_FULL = `              <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-3 gap-6">\r\n                <div>\r\n                  <label className={labelBase}>GST NO</label>\r\n                  <input type="text" name="gst_number" value={formData.gst_number} onChange={handleInputChange} className={\`\${inputBase} font-mono\`} placeholder="Ex: 33AAAAA0000A1Z5" />\r\n                </div>\r\n                <div>\r\n                  <label className={labelBase}>Aadhaar Number</label>\r\n                  <input type="text" name="aadhar_number" value={formData.aadhar_number} onChange={handleInputChange} className={\`\${inputBase} font-mono\`} placeholder="12 digit number" />\r\n                </div>\r\n                <div>\r\n                  <label className={labelBase}>PAN Number</label>\r\n                  <input type="text" name="pan_number" value={formData.pan_number} onChange={handleInputChange} className={\`\${inputBase} font-mono\`} placeholder="ABCDE1234F" />\r\n                </div>\r\n              </div>`;

  const NEW_GST_FULL = `              {/* Multi-GST Management */}
              <div className="md:col-span-2">
                <div className="flex items-center justify-between mb-2">
                  <label className={labelBase} style={{marginBottom:0}}>GST Numbers <span className="text-xs text-m3-on-surface-variant ml-1">(● = active for billing)</span></label>
                  <button type="button" onClick={() => setGstEntries(prev => [...prev, { gst_number: '', is_active: false }])} className="flex items-center gap-1 px-3 py-1 rounded-full text-xs bg-m3-primary text-m3-on-primary hover:shadow-m3-1 transition-all">
                    <Plus size={13} /> Add GST
                  </button>
                </div>
                <div className="space-y-2">
                  {gstEntries.map((entry, idx) => (
                    <div key={idx} className={\`flex items-center gap-2 p-2 rounded-lg border transition-all \${entry.is_active ? 'border-m3-primary bg-m3-primary/5' : 'border-m3-outline-variant'}\`}>
                      <button type="button" title={entry.is_active ? 'Active GST for billing' : 'Click to set as Active'} onClick={() => setGstEntries(prev => prev.map((g, i) => ({ ...g, is_active: i === idx })))} className="flex-shrink-0 transition-colors">
                        {entry.is_active ? <CheckCircle2 size={18} className="text-m3-primary" /> : <Circle size={18} className="text-m3-on-surface-variant/40 hover:text-m3-primary" />}
                      </button>
                      <input
                        type="text"
                        value={entry.gst_number}
                        onChange={e => setGstEntries(prev => prev.map((g, i) => i === idx ? { ...g, gst_number: e.target.value.toUpperCase() } : g))}
                        className="flex-1 rounded-md px-3 py-2 text-sm bg-m3-surface-container-highest border border-m3-outline-variant text-m3-on-surface placeholder:text-m3-on-surface-variant/40 focus:border-m3-primary outline-none transition-all font-mono"
                        placeholder={\`GST #\${idx + 1} — e.g. 33AAAA0000A1Z5\`}
                      />
                      {entry.is_active && <span className="text-xs text-m3-primary font-semibold px-2 py-0.5 bg-m3-primary/10 rounded-full whitespace-nowrap">Active</span>}
                      {gstEntries.length > 1 && (
                        <button type="button" onClick={() => setGstEntries(prev => { const next = prev.filter((_, i) => i !== idx); if (!next.some(g => g.is_active) && next.length > 0) next[0].is_active = true; return next; })} className="flex-shrink-0 text-m3-on-surface-variant/40 hover:text-m3-error transition-colors p-1 rounded-full hover:bg-m3-error/10" title="Remove GST">
                          <X size={14} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className={labelBase}>Aadhaar Number</label>
                  <input type="text" name="aadhar_number" value={formData.aadhar_number} onChange={handleInputChange} className={\`\${inputBase} font-mono\`} placeholder="12 digit number" />
                </div>
                <div>
                  <label className={labelBase}>PAN Number</label>
                  <input type="text" name="pan_number" value={formData.pan_number} onChange={handleInputChange} className={\`\${inputBase} font-mono\`} placeholder="ABCDE1234F" />
                </div>
              </div>`;

  if (content.includes(OLD_GST_FULL)) {
    content = content.replace(OLD_GST_FULL, NEW_GST_FULL);
    console.log('✅ GST form section replaced');
  } else {
    // Try LF version
    const OLD_GST_FULL_LF = OLD_GST_FULL.replace(/\r\n/g, '\n');
    if (content.includes(OLD_GST_FULL_LF)) {
      content = content.replace(OLD_GST_FULL_LF, NEW_GST_FULL);
      console.log('✅ GST form section replaced (LF)');
    } else {
      console.warn('⚠️  GST form section marker not found — may need manual update');
    }
  }
} else {
  console.warn('⚠️  Old GST section not matched');
}

// ─── 10. Update table identification cell to show all GSTs ───
const OLD_TABLE_GST = `                        {party.gst_number && (\r\n                            <div className="flex items-center gap-2">\r\n                              <span className="m3-label-small text-m3-on-surface-variant w-8">GST:</span>\r\n                              <span className="font-mono m3-body-small px-2 py-0.5 rounded-md bg-m3-surface-container-high text-m3-on-surface-variant border border-m3-outline-variant/50">\r\n                                {party.gst_number}\r\n                              </span>\r\n                            </div>\r\n                          )}`;
const NEW_TABLE_GST = `                        {party.gst_number && (
                            <div className="flex items-center gap-1 flex-wrap">
                              <span className="m3-label-small text-m3-on-surface-variant">GST:</span>
                              <span className="font-mono m3-body-small px-2 py-0.5 rounded-md bg-m3-primary/10 text-m3-primary border border-m3-primary/30 font-semibold" title="Active GST">
                                {party.gst_number}
                              </span>
                              <span className="text-xs text-m3-on-surface-variant/50 italic">(active)</span>
                            </div>
                          )}`;

if (content.includes(OLD_TABLE_GST)) {
  content = content.replace(OLD_TABLE_GST, NEW_TABLE_GST);
  console.log('✅ Table GST cell updated');
} else {
  const OLD_LF = OLD_TABLE_GST.replace(/\r\n/g, '\n');
  if (content.includes(OLD_LF)) {
    content = content.replace(OLD_LF, NEW_TABLE_GST);
    console.log('✅ Table GST cell updated (LF)');
  } else {
    console.warn('⚠️  Table GST cell marker not found');
  }
}

fs.writeFileSync(filePath, content, 'utf8');
console.log('\n✅ Parties.jsx patched successfully!');
