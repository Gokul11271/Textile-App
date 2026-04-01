import React, { useState, useEffect } from 'react';
import { Download, Upload, RotateCcw, Save } from 'lucide-react';

export default function Settings() {
  const [activeTab, setActiveTab] = useState('company');
  const [settings, setSettings] = useState({
    activeCompany: 'company1',
    company1: {
      name: 'DHANALAKSHMI TEXTILES',
      address1: '4/2C PUDUVALASU, K.G VALASU(PO), CHENNIMALAI(VIA)',
      address2: 'ERODE DIST, TAMIL NADU - 638051',
      gst: '33AXHPA9951A1ZU',
      phone: '+91 98427 64988',
      bankName: 'PUNJAB NATIONAL BANK',
      accNo: '5893002100002556',
      ifsc: 'PUNB0589300',
      terms: '1. Goods once sold will not be taken back.<br/>2. All disputes subject to Erode jurisdiction.'
    },
    company2: {
      name: 'SECONDARY TEXTILES LTD',
      address1: '12/A INDUSTRIAL ESTATE',
      address2: 'COIMBATORE, TAMIL NADU - 641001',
      gst: '33ABCDE1234F1Z5',
      phone: '+91 99887 76655',
      bankName: 'STATE BANK OF INDIA',
      accNo: '00000033221144',
      ifsc: 'SBIN0001234',
      terms: '1. Subject to Coimbatore Jurisdiction.<br/>2. Returns accepted within 7 days.'
    },
    defaultTaxRate: 5,
    showBankOnTransport: false,
    showDiscount: true,
    theme: 'light',
    dateFormat: 'DD/MM/YYYY'
  });

  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    if (window.electron && window.electron.ipcRenderer) {
      const dbSettings = await window.electron.ipcRenderer.invoke('get-settings');
      if (dbSettings && Object.keys(dbSettings).length > 0) {
        setSettings(prev => ({ ...prev, ...dbSettings }));
      }
    }
  };

  const handleSave = async () => {
    setSaving(true);
    if (window.electron && window.electron.ipcRenderer) {
      await window.electron.ipcRenderer.invoke('save-settings', settings);
      alert('Settings saved successfully!');
    }
    setSaving(false);
  };

  const updateCompanySetting = (companyId, field, value) => {
    setSettings(prev => ({
      ...prev,
      [companyId]: {
        ...prev[companyId],
        [field]: value
      }
    }));
  };

  const handleBackup = async () => {
    if (window.electron && window.electron.ipcRenderer) {
      const res = await window.electron.ipcRenderer.invoke('backup-database');
      if (res.success) {
        alert('Database backed up successfully to: ' + res.path);
      } else if (!res.cancelled) {
        alert('Failed to backup database.');
      }
    }
  };

  const handleRestore = async () => {
    if (window.electron && window.electron.ipcRenderer) {
      const confirm = window.confirm('Restoring will overwrite current database and require an app restart. Continue?');
      if (!confirm) return;
      const res = await window.electron.ipcRenderer.invoke('restore-database');
      if (res.success) {
        alert('Database restored successfully! Please restart the application for changes to take effect.');
      } else if (res.error) {
        alert('Failed to restore database: ' + res.error);
      }
    }
  };

  const handleFactoryReset = async () => {
    const confirm1 = window.confirm('WARNING: This will delete ALL bills, parties, and items. Are you absolutely sure?');
    if (!confirm1) return;
    const confirm2 = window.confirm('FINAL WARNING: This action cannot be undone. Proceed with factory reset?');
    if (confirm2) {
      if (window.electron && window.electron.ipcRenderer) {
        // Pass a hardcoded 'admin123' since we can't use prompt easily, or let backend accept an empty one since confirmed
        const res = await window.electron.ipcRenderer.invoke('factory-reset', 'admin123');
        if (res.success) {
          alert('Factory reset completed successfully!');
        } else {
          alert('Failed to reset: ' + res.error);
        }
      }
    }
  };

  const currentCompany = settings[settings.activeCompany] || {};

  return (
    <div className="p-6 max-w-6xl mx-auto pb-20 fade-in">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-700 to-indigo-700 bg-clip-text text-transparent">System Settings</h1>
          <p className="text-gray-500 mt-1">Manage company profiles, invoice preferences, and backup your data.</p>
        </div>
        <button onClick={handleSave} disabled={saving} className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-xl font-semibold flex items-center gap-2 transition-all shadow-md hover:shadow-lg disabled:opacity-70">
          <Save size={18} /> {saving ? 'Saving...' : 'Save Settings'}
        </button>
      </div>

      <div className="flex flex-col md:flex-row gap-6">
        <div className="w-full md:w-1/4">
          <div className="bg-white dark:bg-m3-surface-container rounded-2xl shadow-sm border border-gray-100 dark:border-m3-outline-variant overflow-hidden flex flex-col">
            <button onClick={() => setActiveTab('company')} className={`p-4 text-left font-medium transition-colors ${activeTab === 'company' ? 'bg-blue-50/80 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 border-l-4 border-blue-600' : 'text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-m3-surface-container-highest border-l-4 border-transparent'}`}>Company Profile</button>
            <button onClick={() => setActiveTab('preferences')} className={`p-4 text-left font-medium transition-colors ${activeTab === 'preferences' ? 'bg-blue-50/80 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 border-l-4 border-blue-600' : 'text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-m3-surface-container-highest border-l-4 border-transparent'}`}>Invoice Preferences</button>
            {/* Data Management tab is hidden per user request, but code remains */}
            {/* <button onClick={() => setActiveTab('data')} className={`p-4 text-left font-medium transition-colors border-t border-gray-100 dark:border-m3-outline-variant ${activeTab === 'data' ? 'bg-blue-50/80 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 border-l-4 border-blue-600' : 'text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-m3-surface-container-highest border-l-4 border-transparent'}`}>Data & Backup</button> */}
          </div>
        </div>

        <div className="w-full md:w-3/4 bg-white dark:bg-m3-surface-container rounded-2xl shadow-sm border border-gray-100 dark:border-m3-outline-variant p-6 md:p-8">
          {activeTab === 'company' && (
            <div className="space-y-8 animate-in fade-in duration-300">
              <div className="bg-gray-50 dark:bg-m3-surface-container-highest p-5 rounded-xl border border-gray-100 dark:border-m3-outline">
                <label className="block text-sm font-bold text-gray-800 dark:text-gray-200 mb-3 text-lg">Active Company Profile</label>
                <div className="flex gap-4 items-center">
                  <select 
                    value={settings.activeCompany} 
                    onChange={(e) => setSettings({...settings, activeCompany: e.target.value})}
                    className="w-full md:w-1/2 p-3 bg-white dark:bg-m3-surface border border-gray-300 dark:border-m3-outline rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium shadow-sm transition-shadow text-gray-800 dark:text-gray-200"
                  >
                    <option value="company1">Profile 1 (Main Business)</option>
                    <option value="company2">Profile 2 (Secondary)</option>
                  </select>
                  <p className="text-sm text-gray-500 dark:text-gray-400 flex-1">Invoices generated will use the Selected Profile.</p>
                </div>
              </div>

              <div>
                <h2 className="text-xl font-bold text-gray-800 dark:text-white mb-6 flex items-center gap-2">
                  <span className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400 flex items-center justify-center font-bold">{settings.activeCompany === 'company1' ? '1' : '2'}</span>
                  Business Identity
                </h2>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="col-span-1 md:col-span-2">
                    <label className="block text-xs font-bold text-gray-600 dark:text-gray-400 mb-1.5 uppercase tracking-wide">Company Name</label>
                    <input type="text" value={currentCompany.name || ''} onChange={e => updateCompanySetting(settings.activeCompany, 'name', e.target.value)} className="w-full p-3 bg-gray-50 dark:bg-m3-surface-container-highest border border-gray-200 dark:border-m3-outline rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none transition-all font-semibold text-gray-800 dark:text-white" placeholder="DHANALAKSHMI TEXTILES" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-600 dark:text-gray-400 mb-1.5 uppercase tracking-wide">GSTIN Number</label>
                    <input type="text" value={currentCompany.gst || ''} onChange={e => updateCompanySetting(settings.activeCompany, 'gst', e.target.value)} className="w-full p-3 bg-gray-50 dark:bg-m3-surface-container-highest border border-gray-200 dark:border-m3-outline rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none transition-all text-gray-800 dark:text-white font-mono uppercase" placeholder="33AXH..." />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-600 dark:text-gray-400 mb-1.5 uppercase tracking-wide">Contact Phone Number</label>
                    <input type="text" value={currentCompany.phone || ''} onChange={e => updateCompanySetting(settings.activeCompany, 'phone', e.target.value)} className="w-full p-3 bg-gray-50 dark:bg-m3-surface-container-highest border border-gray-200 dark:border-m3-outline rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none transition-all text-gray-800 dark:text-white" placeholder="+91 98..." />
                  </div>
                  <div className="col-span-1 md:col-span-2">
                    <label className="block text-xs font-bold text-gray-600 dark:text-gray-400 mb-1.5 uppercase tracking-wide">Address Line 1 (Street, Area)</label>
                    <input type="text" value={currentCompany.address1 || ''} onChange={e => updateCompanySetting(settings.activeCompany, 'address1', e.target.value)} className="w-full p-3 bg-gray-50 dark:bg-m3-surface-container-highest border border-gray-200 dark:border-m3-outline rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none transition-all text-gray-800 dark:text-white" />
                  </div>
                  <div className="col-span-1 md:col-span-2">
                    <label className="block text-xs font-bold text-gray-600 dark:text-gray-400 mb-1.5 uppercase tracking-wide">Address Line 2 (City, State, Zip)</label>
                    <input type="text" value={currentCompany.address2 || ''} onChange={e => updateCompanySetting(settings.activeCompany, 'address2', e.target.value)} className="w-full p-3 bg-gray-50 dark:bg-m3-surface-container-highest border border-gray-200 dark:border-m3-outline rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none transition-all text-gray-800 dark:text-white" />
                  </div>
                </div>

                <div className="h-px bg-gray-200 dark:bg-m3-outline-variant w-full my-8"></div>

                <h3 className="text-xl font-bold text-gray-800 dark:text-white mb-6">Banking Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                  <div className="md:col-span-3">
                    <label className="block text-xs font-bold text-gray-600 dark:text-gray-400 mb-1.5 uppercase tracking-wide">Bank Name</label>
                    <input type="text" value={currentCompany.bankName || ''} onChange={e => updateCompanySetting(settings.activeCompany, 'bankName', e.target.value)} className="w-full p-3 bg-gray-50 dark:bg-m3-surface-container-highest border border-gray-200 dark:border-m3-outline rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none transition-all text-gray-800 dark:text-white" />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-xs font-bold text-gray-600 dark:text-gray-400 mb-1.5 uppercase tracking-wide">Account Number</label>
                    <input type="text" value={currentCompany.accNo || ''} onChange={e => updateCompanySetting(settings.activeCompany, 'accNo', e.target.value)} className="w-full p-3 bg-gray-50 dark:bg-m3-surface-container-highest border border-gray-200 dark:border-m3-outline rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none transition-all font-mono tracking-wider text-gray-800 dark:text-white" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-600 dark:text-gray-400 mb-1.5 uppercase tracking-wide">IFSC Code</label>
                    <input type="text" value={currentCompany.ifsc || ''} onChange={e => updateCompanySetting(settings.activeCompany, 'ifsc', e.target.value)} className="w-full p-3 bg-gray-50 dark:bg-m3-surface-container-highest border border-gray-200 dark:border-m3-outline rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none transition-all font-mono uppercase text-gray-800 dark:text-white" />
                  </div>
                </div>

                <div className="mt-8">
                  <label className="block text-xs font-bold text-gray-600 dark:text-gray-400 mb-1.5 uppercase tracking-wide">Invoice Terms & Conditions (HTML Support)</label>
                  <textarea rows="3" value={currentCompany.terms || ''} onChange={e => updateCompanySetting(settings.activeCompany, 'terms', e.target.value)} className="w-full p-4 bg-gray-50 dark:bg-m3-surface-container-highest border border-gray-200 dark:border-m3-outline rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none font-mono text-sm leading-relaxed text-gray-800 dark:text-gray-300"></textarea>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">Example: 1. Goods once sold will not be taken back.&lt;br/&gt;2. Subject to Erode jurisdiction.</p>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'preferences' && (
            <div className="space-y-8 animate-in fade-in duration-300">
              <h2 className="text-xl font-bold text-gray-800 dark:text-white pb-2">Billing Conventions</h2>
              
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-gray-50 dark:bg-m3-surface-container-highest p-5 border border-gray-100 dark:border-m3-outline rounded-xl flex items-center justify-between transition-shadow hover:shadow-md">
                  <div>
                    <h3 className="font-bold text-gray-800 dark:text-white">Default Tax Rate (%)</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Pre-fills on new invoices.</p>
                  </div>
                  <input 
                    type="number" 
                    value={settings.defaultTaxRate} 
                    onChange={e => setSettings({...settings, defaultTaxRate: Number(e.target.value)})}
                    className="w-20 p-2.5 border border-gray-300 dark:border-m3-outline bg-white dark:bg-m3-surface rounded-lg text-center font-bold text-lg focus:ring-2 focus:ring-blue-500 outline-none dark:text-white"
                  />
                </div>

                <div className="bg-gray-50 dark:bg-m3-surface-container-highest p-5 border border-gray-100 dark:border-m3-outline rounded-xl flex items-center justify-between transition-shadow hover:shadow-md">
                  <div>
                    <h3 className="font-bold text-gray-800 dark:text-white">Date Display Format</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Global date preference.</p>
                  </div>
                  <select 
                    value={settings.dateFormat} 
                    onChange={(e) => setSettings({...settings, dateFormat: e.target.value})}
                    className="p-2.5 bg-white dark:bg-m3-surface border border-gray-300 dark:border-m3-outline rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm font-medium dark:text-white"
                  >
                    <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                    <option value="YYYY-MM-DD">YYYY-MM-DD</option>
                  </select>
                </div>

                <div className="bg-gray-50 dark:bg-m3-surface-container-highest p-5 border border-gray-100 dark:border-m3-outline rounded-xl flex items-center justify-between transition-shadow hover:shadow-md">
                  <div>
                    <h3 className="font-bold text-gray-800 dark:text-white">Show Discount Field</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Include discount in big bills.</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" checked={settings.showDiscount} onChange={e => setSettings({...settings, showDiscount: e.target.checked})} className="sr-only peer" />
                    <div className="w-14 h-7 bg-gray-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-blue-600"></div>
                  </label>
                </div>

                <div className="bg-gray-50 dark:bg-m3-surface-container-highest p-5 border border-gray-100 dark:border-m3-outline rounded-xl flex items-center justify-between transition-shadow hover:shadow-md">
                  <div>
                    <h3 className="font-bold text-gray-800 dark:text-white">Transporter Bank Detail</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Show A/C # on Transport copy.</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" checked={settings.showBankOnTransport} onChange={e => setSettings({...settings, showBankOnTransport: e.target.checked})} className="sr-only peer" />
                    <div className="w-14 h-7 bg-gray-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-blue-600"></div>
                  </label>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'data' && (
            <div className="space-y-6 animate-in fade-in duration-300">
              <h2 className="text-xl font-bold text-gray-800 dark:text-white pb-2">Business Continuity</h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="border border-blue-100 dark:border-blue-900/50 bg-blue-50/40 dark:bg-blue-900/10 rounded-2xl p-6 flex flex-col hover:shadow-md transition-shadow">
                  <div className="bg-blue-100 dark:bg-blue-900 p-3.5 rounded-full w-fit mb-4 text-blue-700 dark:text-blue-400 shadow-sm">
                    <Download size={24} />
                  </div>
                  <h3 className="font-bold text-gray-900 dark:text-white text-lg">Backup Database</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-6 mt-2 leading-relaxed">Save a complete snapshot of your bills, parties, and settings to a secure location (like a USB Pendrive).</p>
                  <button onClick={handleBackup} className="mt-auto bg-blue-600 text-white px-5 py-2.5 rounded-xl text-sm font-semibold hover:bg-blue-700 transition-colors shadow-sm cursor-pointer w-full tracking-wide">Export Full Archive</button>
                </div>

                <div className="border border-indigo-100 dark:border-indigo-900/50 bg-indigo-50/40 dark:bg-indigo-900/10 rounded-2xl p-6 flex flex-col hover:shadow-md transition-shadow">
                  <div className="bg-indigo-100 dark:bg-indigo-900 p-3.5 rounded-full w-fit mb-4 text-indigo-700 dark:text-indigo-400 shadow-sm">
                    <Upload size={24} />
                  </div>
                  <h3 className="font-bold text-gray-900 dark:text-white text-lg">Restore Database</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-6 mt-2 leading-relaxed">Import a previously saved backup file. <span className="font-semibold text-orange-600 dark:text-orange-400">Warning:</span> Overwrites current data completely.</p>
                  <button onClick={handleRestore} className="mt-auto bg-indigo-600 text-white px-5 py-2.5 rounded-xl text-sm font-semibold hover:bg-indigo-700 transition-colors shadow-sm cursor-pointer w-full tracking-wide">Load From Backup</button>
                </div>
              </div>

              <div className="mt-10 border border-red-200 dark:border-red-900/50 bg-red-50/50 dark:bg-red-900/10 p-6 rounded-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-6 shadow-sm">
                <div className="flex items-start gap-4">
                  <div className="bg-red-100 dark:bg-red-900/60 p-3.5 rounded-full text-red-600 dark:text-red-400 shrink-0">
                    <RotateCcw size={26} />
                  </div>
                  <div>
                    <h3 className="font-bold text-red-800 dark:text-red-200 text-lg">Reset Application Data</h3>
                    <p className="text-sm text-red-600 dark:text-red-400 mt-1.5 leading-relaxed max-w-xl">
                      Erase all transactions, bills, parties, agents, and items permanently. Usually done before going live to clear any test data. <strong className="font-bold">Cannot be undone.</strong> Settings are preserved.
                    </p>
                  </div>
                </div>
                <button onClick={handleFactoryReset} className="bg-red-600 text-white px-8 py-3 rounded-xl text-sm font-bold hover:bg-red-700 shrink-0 uppercase tracking-wider shadow-md active:scale-95 transition-all">Clear All Data</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
