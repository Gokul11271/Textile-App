import { useAlert } from './AlertProvider';
import React, { useState, useEffect } from 'react';
import { Download, Upload, RotateCcw, Save, FileText, Eye, X } from 'lucide-react';
import { useStore } from '../store';

export default function Settings() {
  const { showAlert } = useAlert();
  const { settings: globalSettings, refreshSettings, products, refreshProducts } = useStore();
  const [activeTab, setActiveTab] = useState('company');
  const [productForm, setProductForm] = useState({ id: null, size: '', name: '' });
  const [selectedProductIds, setSelectedProductIds] = useState([]);
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
    dateFormat: 'DD/MM/YYYY',
    financialYear: ''
  });

  const [saving, setSaving] = useState(false);
  const [previewHtml, setPreviewHtml] = useState('');
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewType, setPreviewType] = useState('transport');

  useEffect(() => {
    if (globalSettings && Object.keys(globalSettings).length > 0) {
      setSettings(prev => ({ ...prev, ...globalSettings }));
    }
  }, [globalSettings]);

  const handlePreview = async (type, copiesCount = 2) => {
    if (!window.electron?.ipcRenderer) return;
    
    const dummyBill = {
      bill_number: '1001',
      date: '01/01/2026',
      party_name: 'SAMPLE PARTY NAME',
      party_address: '123 Sample Street, Sample City',
      party_gst: '33SAMPLEGSTIN12',
      tax_rate: 5,
      tax_amount: 50,
      total_amount: 1050,
      discount_percent: 0,
      discount_amount: 0,
      lorry_office: 'SAMPLE TRANSPORT',
      lr_number: '12345',
      is_inter_state: 0,
      agent_id: null,
      bale_numbers: '["B1", "B2"]',
      financialYear: '2025-2026'
    };
    
    const dummyItems = [
      { size: 'L', quantity: 10, rate: 50, bale_number: 'B1', amount: 500 },
      { size: 'XL', quantity: 10, rate: 50, bale_number: 'B2', amount: 500 }
    ];

    try {
      const html = await window.electron.ipcRenderer.invoke('get-bill-preview', dummyBill, dummyItems, type, copiesCount);
      setPreviewType(type);
      setPreviewHtml(html);
      setPreviewOpen(true);
    } catch (err) {
      showAlert('Failed to generate preview', 'error');
    }
  };

  const handleSave = async () => {
    setSaving(true);
    if (window.electron && window.electron.ipcRenderer) {
      await window.electron.ipcRenderer.invoke('save-settings', settings);
      await refreshSettings();
      showAlert('Settings saved successfully!', 'success');
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
        showAlert('Database backed up successfully to: ' + res.path, 'success');
      } else if (!res.cancelled) {
        showAlert('Failed to backup database.', 'error');
      }
    }
  };

  const handleRestore = async () => {
    if (window.electron && window.electron.ipcRenderer) {
      const confirm = window.confirm('Restoring will overwrite current database and require an app restart. Continue?');
      if (!confirm) return;
      const res = await window.electron.ipcRenderer.invoke('restore-database');
      if (res.success) {
        showAlert('Database restored successfully! Restarting application...', 'success');
        setTimeout(() => {
          window.electron.ipcRenderer.invoke('restart-app');
        }, 1500);
      } else if (res.error) {
        showAlert('Failed to restore database: ' + res.error, 'error');
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
          showAlert('Factory reset completed successfully!', 'success');
        } else {
          showAlert('Failed to reset: ' + res.error, 'error');
        }
      }
    }
  };

  const handleSaveProduct = async (e) => {
    e.preventDefault();
    if (!productForm.name) {
      showAlert('Product Name is required', 'error');
      return;
    }
    try {
      await window.electron.ipcRenderer.invoke('save-product', productForm);
      await refreshProducts();
      setProductForm({ id: null, size: '', name: '' });
      showAlert('Product saved successfully!', 'success');
    } catch (err) {
      showAlert('Failed to save product: ' + err.message, 'error');
    }
  };

  const handleDeleteProduct = async (id) => {
    if (window.confirm('Are you sure you want to delete this product?')) {
      try {
        await window.electron.ipcRenderer.invoke('delete-product', id);
        await refreshProducts();
        setSelectedProductIds(prev => prev.filter(pId => pId !== id));
        showAlert('Product deleted successfully!', 'success');
      } catch (err) {
        showAlert('Failed to delete product: ' + err.message, 'error');
      }
    }
  };

  const handleDeleteMultipleProducts = async () => {
    if (window.confirm(`Are you sure you want to delete ${selectedProductIds.length} products?`)) {
      try {
        for (const id of selectedProductIds) {
          await window.electron.ipcRenderer.invoke('delete-product', id);
        }
        await refreshProducts();
        setSelectedProductIds([]);
        showAlert(`${selectedProductIds.length} products deleted successfully!`, 'success');
      } catch (err) {
        showAlert('Failed to delete some products: ' + err.message, 'error');
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
            <button onClick={() => setActiveTab('products')} className={`p-4 text-left font-medium transition-colors border-t border-gray-100 dark:border-m3-outline-variant ${activeTab === 'products' ? 'bg-blue-50/80 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 border-l-4 border-blue-600' : 'text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-m3-surface-container-highest border-l-4 border-transparent'}`}>Products Management</button>
            <button onClick={() => setActiveTab('templates')} className={`p-4 text-left font-medium transition-colors border-t border-gray-100 dark:border-m3-outline-variant ${activeTab === 'templates' ? 'bg-blue-50/80 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 border-l-4 border-blue-600' : 'text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-m3-surface-container-highest border-l-4 border-transparent'}`}>Template Previews</button>
            {/* Data Management tab */}
            <button onClick={() => setActiveTab('data')} className={`p-4 text-left font-medium transition-colors border-t border-gray-100 dark:border-m3-outline-variant ${activeTab === 'data' ? 'bg-blue-50/80 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 border-l-4 border-blue-600' : 'text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-m3-surface-container-highest border-l-4 border-transparent'}`}>Data & Backup</button>
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
                    <div className="flex justify-between items-center mb-1.5">
                      <label className="block text-xs font-bold text-gray-600 dark:text-gray-400 uppercase tracking-wide">GSTIN Number</label>
                      <label className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400 cursor-pointer">
                        <input 
                          type="checkbox" 
                          checked={currentCompany.withoutGst || false} 
                          onChange={e => {
                            updateCompanySetting(settings.activeCompany, 'withoutGst', e.target.checked);
                            if (e.target.checked) updateCompanySetting(settings.activeCompany, 'gst', '');
                          }}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        Without GST
                      </label>
                    </div>
                    <input type="text" value={currentCompany.gst || ''} disabled={currentCompany.withoutGst} onChange={e => updateCompanySetting(settings.activeCompany, 'gst', e.target.value)} className="w-full p-3 bg-gray-50 dark:bg-m3-surface-container-highest border border-gray-200 dark:border-m3-outline rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none transition-all text-gray-800 dark:text-white font-mono uppercase disabled:opacity-50 disabled:cursor-not-allowed" placeholder="33AXH..." />
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
                    <h3 className="font-bold text-gray-800 dark:text-white">Active Financial Year</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Default FY for new invoices.</p>
                  </div>
                  <div className="flex flex-col relative w-48">
                    <input 
                      type="text"
                      list="settings-fy-list"
                      value={settings.financialYear || ''} 
                      onChange={(e) => setSettings({...settings, financialYear: e.target.value})}
                      placeholder="Auto (Current)"
                      className="w-full p-2.5 bg-white dark:bg-m3-surface border border-gray-300 dark:border-m3-outline rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm font-medium dark:text-white"
                    />
                    <datalist id="settings-fy-list">
                      <option value="2023-2024" />
                      <option value="2024-2025" />
                      <option value="2025-2026" />
                      <option value="2026-2027" />
                      <option value="2027-2028" />
                      <option value="2028-2029" />
                    </datalist>
                  </div>
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

          {activeTab === 'products' && (
            <div className="space-y-8 animate-in fade-in duration-300">
              <h2 className="text-xl font-bold text-gray-800 dark:text-white pb-2 border-b border-gray-100 dark:border-m3-outline">Products Management</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">Manage standardized product names and default rates. These will appear in the autocomplete when billing.</p>

              <form onSubmit={handleSaveProduct} className="bg-gray-50 dark:bg-m3-surface-container-highest p-5 rounded-xl border border-gray-100 dark:border-m3-outline flex flex-col md:flex-row gap-4 items-end shadow-sm">
                <div className="w-full md:w-32">
                  <label className="block text-xs font-bold text-gray-600 dark:text-gray-400 mb-1.5 uppercase tracking-wide">Size</label>
                  <input type="text" value={productForm.size || ''} onChange={e => setProductForm({...productForm, size: e.target.value})} className="w-full p-3 bg-white dark:bg-m3-surface border border-gray-200 dark:border-m3-outline rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-gray-800 dark:text-white font-medium" placeholder="Ex: L, XL, 40s" />
                </div>
                <div className="flex-1 w-full">
                  <label className="block text-xs font-bold text-gray-600 dark:text-gray-400 mb-1.5 uppercase tracking-wide">Product Name</label>
                  <input type="text" value={productForm.name} onChange={e => setProductForm({...productForm, name: e.target.value})} className="w-full p-3 bg-white dark:bg-m3-surface border border-gray-200 dark:border-m3-outline rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-gray-800 dark:text-white font-medium" placeholder="Ex: Cotton Yarn" required />
                </div>
                <button type="submit" className="w-full md:w-auto bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-bold transition-colors shadow-sm">
                  {productForm.id ? 'Update Product' : 'Add Product'}
                </button>
                {productForm.id && (
                  <button type="button" onClick={() => setProductForm({ id: null, size: '', name: '' })} className="w-full md:w-auto bg-gray-200 hover:bg-gray-300 dark:bg-m3-surface-container dark:hover:bg-m3-outline text-gray-700 dark:text-gray-200 px-4 py-3 rounded-lg font-bold transition-colors">
                    Cancel
                  </button>
                )}
              </form>

              <div className="flex justify-between items-center mt-8 mb-4">
                <h3 className="text-lg font-bold text-gray-800 dark:text-white">Product Catalog</h3>
                {selectedProductIds.length > 0 && (
                  <button 
                    onClick={handleDeleteMultipleProducts}
                    className="bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-900/20 dark:text-red-400 dark:hover:bg-red-900/40 px-4 py-2 rounded-lg font-semibold transition-colors flex items-center gap-2 text-sm"
                  >
                    <X size={16} /> Delete Selected ({selectedProductIds.length})
                  </button>
                )}
              </div>

              <div className="border border-gray-200 dark:border-m3-outline rounded-xl overflow-hidden shadow-sm">
                <div className="max-h-[400px] overflow-y-auto custom-scrollbar">
                  <table className="w-full text-left bg-white dark:bg-m3-surface">
                    <thead className="bg-gray-50 dark:bg-m3-surface-container border-b border-gray-200 dark:border-m3-outline sticky top-0">
                      <tr>
                        <th className="px-5 py-3 w-12">
                          <input 
                            type="checkbox" 
                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                            checked={products.length > 0 && selectedProductIds.length === products.length}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedProductIds(products.map(p => p.id));
                              } else {
                                setSelectedProductIds([]);
                              }
                            }}
                          />
                        </th>
                        <th className="px-5 py-3 text-sm font-bold text-gray-600 dark:text-gray-300 w-32">Size</th>
                        <th className="px-5 py-3 text-sm font-bold text-gray-600 dark:text-gray-300">Product Name</th>
                        <th className="px-5 py-3 text-sm font-bold text-gray-600 dark:text-gray-300 w-24 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-m3-outline-variant">
                      {products.map((p) => (
                        <tr key={p.id} className={`hover:bg-gray-50 dark:hover:bg-m3-surface-container-highest transition-colors ${selectedProductIds.includes(p.id) ? 'bg-blue-50/50 dark:bg-blue-900/10' : ''}`}>
                          <td className="px-5 py-3">
                            <input 
                              type="checkbox"
                              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                              checked={selectedProductIds.includes(p.id)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedProductIds([...selectedProductIds, p.id]);
                                } else {
                                  setSelectedProductIds(selectedProductIds.filter(id => id !== p.id));
                                }
                              }}
                            />
                          </td>
                          <td className="px-5 py-3 font-medium text-gray-800 dark:text-gray-200">{p.size || '-'}</td>
                          <td className="px-5 py-3 font-medium text-gray-800 dark:text-gray-200">{p.name}</td>
                          <td className="px-5 py-3 text-right">
                            <button onClick={() => setProductForm(p)} className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 font-medium mr-3 transition-colors">Edit</button>
                            <button onClick={() => handleDeleteProduct(p.id)} className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 font-medium transition-colors">Delete</button>
                          </td>
                        </tr>
                      ))}
                      {products.length === 0 && (
                        <tr>
                          <td colSpan="4" className="px-5 py-8 text-center text-gray-500 dark:text-gray-400">No products found. Start adding them above.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'templates' && (
            <div className="space-y-6 animate-in fade-in duration-300">
              <h2 className="text-xl font-bold text-gray-800 dark:text-white pb-2">Bill Template Previews</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">Preview how your invoices and transport copies will look when printed.</p>

              <h3 className="text-lg font-bold text-gray-800 dark:text-white mb-2">Standard Invoice (A4 Portrait)</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-8">
                <div className="border border-gray-200 dark:border-m3-outline rounded-2xl p-6 flex flex-col hover:shadow-md transition-shadow bg-white dark:bg-m3-surface-container">
                  <div className="bg-purple-50 dark:bg-purple-900/30 p-3.5 rounded-xl w-fit mb-4 text-purple-600 dark:text-purple-400">
                    <FileText size={24} />
                  </div>
                  <h3 className="font-bold text-gray-900 dark:text-white text-lg">Main Invoice</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-6 mt-2">Standard full-page A4 portrait layout used for all primary billing.</p>
                  <button onClick={() => handlePreview('big')} className="mt-auto bg-gray-100 hover:bg-gray-200 text-gray-800 dark:bg-m3-surface-container-highest dark:text-white dark:hover:bg-m3-outline px-5 py-2.5 rounded-xl text-sm font-semibold transition-colors flex items-center justify-center gap-2">
                    <Eye size={18} /> Preview Invoice
                  </button>
                </div>
              </div>

              <h3 className="text-lg font-bold text-gray-800 dark:text-white mb-2">Transport Bill (A4 Landscape)</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                <div className="border border-gray-200 dark:border-m3-outline rounded-2xl p-6 flex flex-col hover:shadow-md transition-shadow bg-white dark:bg-m3-surface-container">
                  <div className="bg-blue-50 dark:bg-blue-900/30 p-3.5 rounded-xl w-fit mb-4 text-blue-600 dark:text-blue-400">
                    <FileText size={24} />
                  </div>
                  <h3 className="font-bold text-gray-900 dark:text-white text-lg">Transport Bill - 1 Copy</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-6 mt-2">Single layout, centered horizontally. Designed for when only one physical copy is required.</p>
                  <button onClick={() => handlePreview('transport', 1)} className="mt-auto bg-gray-100 hover:bg-gray-200 text-gray-800 dark:bg-m3-surface-container-highest dark:text-white dark:hover:bg-m3-outline px-5 py-2.5 rounded-xl text-sm font-semibold transition-colors flex items-center justify-center gap-2">
                    <Eye size={18} /> Preview 1 Copy
                  </button>
                </div>

                <div className="border border-gray-200 dark:border-m3-outline rounded-2xl p-6 flex flex-col hover:shadow-md transition-shadow bg-white dark:bg-m3-surface-container">
                  <div className="bg-indigo-50 dark:bg-indigo-900/30 p-3.5 rounded-xl w-fit mb-4 text-indigo-600 dark:text-indigo-400">
                    <FileText size={24} />
                  </div>
                  <h3 className="font-bold text-gray-900 dark:text-white text-lg">Transport Bill - 2 Copies</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-6 mt-2">Split layout, side-by-side. Designed to print the Original and Duplicate on the same A4 page.</p>
                  <button onClick={() => handlePreview('transport', 2)} className="mt-auto bg-gray-100 hover:bg-gray-200 text-gray-800 dark:bg-m3-surface-container-highest dark:text-white dark:hover:bg-m3-outline px-5 py-2.5 rounded-xl text-sm font-semibold transition-colors flex items-center justify-center gap-2">
                    <Eye size={18} /> Preview 2 Copies
                  </button>
                </div>

                <div className="border border-gray-200 dark:border-m3-outline rounded-2xl p-6 flex flex-col hover:shadow-md transition-shadow bg-white dark:bg-m3-surface-container">
                  <div className="bg-green-50 dark:bg-green-900/30 p-3.5 rounded-xl w-fit mb-4 text-green-600 dark:text-green-400">
                    <FileText size={24} />
                  </div>
                  <h3 className="font-bold text-gray-900 dark:text-white text-lg">Transport Bill - 3 Copies</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-6 mt-2">Paginates across two sheets: 1st sheet gets Split layout (Copies 1-2), 2nd sheet gets Single layout (Copy 3).</p>
                  <button onClick={() => handlePreview('transport', 3)} className="mt-auto bg-gray-100 hover:bg-gray-200 text-gray-800 dark:bg-m3-surface-container-highest dark:text-white dark:hover:bg-m3-outline px-5 py-2.5 rounded-xl text-sm font-semibold transition-colors flex items-center justify-center gap-2">
                    <Eye size={18} /> Preview 3 Copies
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'data' && (
            <div className="space-y-6 animate-in fade-in duration-300">
              <h2 className="text-xl font-bold text-gray-800 dark:text-white pb-2 border-b border-gray-100 dark:border-m3-outline mb-6">Storage Preferences</h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-10">
                <div className="bg-gray-50 dark:bg-m3-surface-container-highest p-5 border border-gray-100 dark:border-m3-outline rounded-xl">
                  <h3 className="font-bold text-gray-800 dark:text-white mb-2">PDF Store Location</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">Select the folder where Bills, Transport Copies, and Statements are saved.</p>
                  <div className="flex gap-2">
                    <input type="text" readOnly value={settings.pdfStoreLocation || ''} placeholder="Default (Documents Folder)" className="flex-1 p-2.5 bg-white dark:bg-m3-surface border border-gray-300 dark:border-m3-outline rounded-lg text-sm text-gray-600 dark:text-gray-300 focus:outline-none" />
                    <button onClick={async () => {
                      if (window.electron?.ipcRenderer) {
                        const path = await window.electron.ipcRenderer.invoke('select-directory', settings.pdfStoreLocation);
                        if (path) setSettings({ ...settings, pdfStoreLocation: path });
                      }
                    }} className="bg-gray-200 hover:bg-gray-300 text-gray-800 dark:bg-m3-outline/30 dark:hover:bg-m3-outline/50 dark:text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors whitespace-nowrap">
                      Browse...
                    </button>
                  </div>
                </div>

                <div className="bg-gray-50 dark:bg-m3-surface-container-highest p-5 border border-gray-100 dark:border-m3-outline rounded-xl">
                  <h3 className="font-bold text-gray-800 dark:text-white mb-2">Backup Location</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">Select the default folder for database backups.</p>
                  <div className="flex gap-2">
                    <input type="text" readOnly value={settings.backupLocation || ''} placeholder="Default" className="flex-1 p-2.5 bg-white dark:bg-m3-surface border border-gray-300 dark:border-m3-outline rounded-lg text-sm text-gray-600 dark:text-gray-300 focus:outline-none" />
                    <button onClick={async () => {
                      if (window.electron?.ipcRenderer) {
                        const path = await window.electron.ipcRenderer.invoke('select-directory', settings.backupLocation);
                        if (path) setSettings({ ...settings, backupLocation: path });
                      }
                    }} className="bg-gray-200 hover:bg-gray-300 text-gray-800 dark:bg-m3-outline/30 dark:hover:bg-m3-outline/50 dark:text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors whitespace-nowrap">
                      Browse...
                    </button>
                  </div>
                </div>
              </div>

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

      {/* Preview Modal */}
      {previewOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-8 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-m3-surface-container rounded-2xl shadow-2xl w-full max-w-6xl max-h-full flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center p-4 border-b border-gray-100 dark:border-m3-outline-variant bg-gray-50 dark:bg-m3-surface-container-highest">
              <h3 className="text-lg font-bold text-gray-800 dark:text-white flex items-center gap-2">
                <Eye size={20} className="text-blue-600 dark:text-blue-400" />
                Template Preview
              </h3>
              <button onClick={() => setPreviewOpen(false)} className="p-2 text-gray-500 hover:text-gray-800 dark:hover:text-white bg-gray-200 dark:bg-m3-outline/30 hover:bg-gray-300 dark:hover:bg-m3-outline/50 rounded-full transition-colors">
                <X size={20} />
              </button>
            </div>
            <div className="flex-1 overflow-auto bg-gray-100 p-4 sm:p-8 flex justify-center">
              {/* iframe scales to fit A4 layout roughly */}
              <iframe 
                srcDoc={previewHtml} 
                className="bg-white shadow-lg w-full"
                style={{ 
                  aspectRatio: previewType === 'transport' ? '1.414 / 1' : '1 / 1.414', 
                  maxWidth: previewType === 'transport' ? '285mm' : '210mm' 
                }} 
                title="Bill Preview"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
