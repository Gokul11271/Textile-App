import React, { useState, useEffect } from 'react';
import { Plus, Package, Search } from 'lucide-react';

const Parties = () => {
  const [parties, setParties] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [formData, setFormData] = useState({
    id: null,
    customer_id: '',
    isNewCustomer: false,
    newCustomerName: '',
    short_name: '',
    name: '', // Display name (linked customer name)
    address: '',
    gst_number: '',
    phone: '',
    email: '',
    city: '',
    state: '',
    aadhar_number: '',
    pan_number: '',
    opening_balance: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCity, setFilterCity] = useState('');

  useEffect(() => {
    fetchParties();
    fetchCustomers();
  }, []);

  const fetchCustomers = async () => {
    try {
      const data = await window.electron.ipcRenderer.invoke('get-customers');
      setCustomers(data || []);
    } catch (err) {
      console.error('Error fetching customers:', err);
    }
  };

  const fetchParties = async () => {
    try {
      const data = await window.electron.ipcRenderer.invoke('get-parties');
      setParties(data || []);
    } catch (err) {
      console.error('Error fetching parties:', err);
      setParties([]); // Fallback to empty array on error
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    // Mandatory fields validation
    if ((formData.isNewCustomer && !formData.newCustomerName) || (!formData.isNewCustomer && !formData.customer_id)) {
      setError('Please select or enter a Customer name.');
      return;
    }

    if (!formData.short_name || !formData.address) {
      setError('Short Name and Address are mandatory fields.');
      return;
    }

    if (!formData.gst_number && !formData.aadhar_number && !formData.pan_number) {
      setError('At least one identification (GST, Aadhaar, or PAN) is required.');
      return;
    }

    setLoading(true);
    try {
      let currentCustomerId = formData.customer_id;

      // Handle new customer creation
      if (formData.isNewCustomer) {
        const result = await window.electron.ipcRenderer.invoke('save-customer', { name: formData.newCustomerName });
        currentCustomerId = result.lastID;
        await fetchCustomers(); // Refresh list
      }

      const partyData = { ...formData, customer_id: currentCustomerId };
      await window.electron.ipcRenderer.invoke('save-party', partyData);
      
      setSuccess('Location saved successfully!');
      setFormData({
        id: null,
        customer_id: '',
        isNewCustomer: false,
        newCustomerName: '',
        short_name: '',
        name: '',
        address: '',
        gst_number: '',
        phone: '',
        email: '',
        city: '',
        state: '',
        aadhar_number: '',
        pan_number: '',
        opening_balance: ''
      });
      fetchParties();
      setTimeout(() => setShowForm(false), 1500);
    } catch (err) {
      setError('Error saving location: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (party) => {
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
  };

  return (
    <div className="p-4 dark:bg-premium-900 min-h-screen transition-colors duration-500">
      <div className="w-full mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
        <h1 className="text-3xl font-bold dark:text-white text-slate-800 mb-6 flex items-center px-2">
          <span className="dark:bg-white bg-blue-600 w-2 h-10 rounded-full mr-4 shadow-[0_0_15px_rgba(255,255,255,0.3)]"></span>
          Manage Parties
        </h1>

        {/* Form Card */}
        {showForm && (
          <div className="dark:bg-premium-800/50 bg-white rounded-2xl shadow-xl p-8 mb-10 border dark:border-premium-700 border-slate-100 overflow-hidden relative transition-all">
            <div className="absolute top-0 right-0 w-32 h-32 dark:bg-white/5 bg-blue-50 rounded-bl-full -mr-16 -mt-16 opacity-50"></div>
            
            <div className="flex justify-between items-center mb-8 relative z-10">
              <div>
                <h2 className="text-xl font-bold dark:text-white text-slate-700">Add / Edit Party</h2>
                <p className="text-sm dark:text-premium-400 text-slate-400 mt-1">Fill in the details to save party information.</p>
              </div>
              <button 
                onClick={() => {
                  setShowForm(false);
                  setError('');
                  setSuccess('');
                  setFormData({
                    id: null,
                    customer_id: '',
                    isNewCustomer: false,
                    newCustomerName: '',
                    short_name: '',
                    name: '',
                    address: '',
                    gst_number: '',
                    phone: '',
                    email: '',
                    city: '',
                    state: '',
                    aadhar_number: '',
                    pan_number: '',
                    opening_balance: ''
                  });
                }}
                className="px-4 py-2 rounded-xl text-sm font-bold border transition-all dark:bg-premium-800 dark:hover:bg-premium-700 dark:border-premium-700 dark:text-white bg-white hover:bg-gray-50 border-slate-200 text-black shadow-sm"
              >
                Back to List
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-8 relative z-10">
              <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-1">
                  <label className="block text-[10px] uppercase font-black tracking-[0.2em] dark:text-premium-400 text-slate-500 mb-2 ml-1">
                    Select Customer <span className="text-red-500 ml-1">*</span>
                  </label>
                  <div className="flex gap-2">
                    <select
                      disabled={formData.isNewCustomer}
                      value={formData.customer_id}
                      onChange={(e) => setFormData(prev => ({ ...prev, customer_id: e.target.value }))}
                      className="flex-1 px-5 py-4 dark:bg-premium-900 bg-slate-50 border dark:border-premium-700 border-slate-200 rounded-xl dark:text-white text-slate-800 focus:ring-2 dark:focus:ring-white/20 focus:ring-blue-500/20 outline-none transition-all disabled:opacity-50"
                    >
                      <option value="">Choose Existing Customer...</option>
                      {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                    <button
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, isNewCustomer: !prev.isNewCustomer, newCustomerName: '' }))}
                      className={`px-4 rounded-xl border transition-all text-xs font-bold ${formData.isNewCustomer ? 'bg-black text-white dark:bg-white dark:text-black border-transparent' : 'dark:bg-premium-800 dark:border-premium-700 dark:text-premium-400 bg-white border-slate-200 text-slate-600'}`}
                    >
                      {formData.isNewCustomer ? 'Cancel' : 'New Customer'}
                    </button>
                  </div>
                </div>

                {formData.isNewCustomer ? (
                  <div className="space-y-1 animate-in slide-in-from-top-2 duration-300">
                    <label className="block text-[10px] uppercase font-black tracking-[0.2em] dark:text-premium-400 text-slate-500 mb-2 ml-1">
                      New Customer Legal Name <span className="text-red-500 ml-1">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.newCustomerName}
                      onChange={(e) => setFormData(prev => ({ ...prev, newCustomerName: e.target.value }))}
                      className="w-full px-5 py-4 dark:bg-premium-900 bg-slate-50 border dark:border-premium-700 border-slate-200 rounded-xl dark:text-white text-slate-800 focus:ring-2 dark:focus:ring-white/20 focus:ring-blue-500/20 outline-none transition-all"
                      placeholder="Enter legal business name"
                    />
                  </div>
                ) : (
                  <div className="space-y-1">
                    <label className="block text-[10px] uppercase font-black tracking-[0.2em] dark:text-premium-400 text-slate-500 mb-2 ml-1">
                      Short Name (Unique Selection Name) <span className="text-red-500 ml-1">*</span>
                    </label>
                    <input
                      type="text"
                      name="short_name"
                      value={formData.short_name}
                      onChange={handleInputChange}
                      className="w-full px-5 py-4 dark:bg-premium-900 bg-slate-50 border dark:border-premium-700 border-slate-200 rounded-xl dark:text-white text-slate-800 focus:ring-2 dark:focus:ring-white/20 focus:ring-blue-500/20 outline-none transition-all"
                      placeholder="Ex: Bhaniram (Raipur)"
                    />
                  </div>
                )}
              </div>

              {formData.isNewCustomer && (
                <div className="md:col-span-2 space-y-1 animate-in slide-in-from-top-2 duration-300">
                  <label className="block text-[10px] uppercase font-black tracking-[0.2em] dark:text-premium-400 text-slate-500 mb-2 ml-1">
                    Initial Location Short Name <span className="text-red-500 ml-1">*</span>
                  </label>
                  <input
                    type="text"
                    name="short_name"
                    value={formData.short_name}
                    onChange={handleInputChange}
                    className="w-full px-5 py-4 dark:bg-premium-900 bg-slate-50 border dark:border-premium-700 border-slate-200 rounded-xl dark:text-white text-slate-800 focus:ring-2 dark:focus:ring-white/20 focus:ring-blue-500/20 outline-none transition-all"
                    placeholder="Ex: Bhaniram (Main Office)"
                  />
                </div>
              )}

              <div className="md:col-span-2">
                <label className="block text-[10px] uppercase font-black tracking-[0.2em] dark:text-premium-400 text-slate-500 mb-2 ml-1">
                  Address <span className="text-red-500 ml-1">*</span>
                </label>
                <textarea
                  name="address"
                  value={formData.address}
                  onChange={handleInputChange}
                  rows="3"
                  className="w-full px-5 py-4 dark:bg-premium-900 bg-slate-50 border dark:border-premium-700 border-slate-200 rounded-xl dark:text-white text-slate-800 focus:ring-2 dark:focus:ring-white/20 focus:ring-blue-500/20 outline-none transition-all resize-none"
                  placeholder="Full billing address"
                ></textarea>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <div className="space-y-1">
                  <label className="block text-[10px] uppercase font-black tracking-[0.2em] dark:text-premium-400 text-slate-500 mb-2 ml-1">
                    GST NO
                  </label>
                  <input
                    type="text"
                    name="gst_number"
                    value={formData.gst_number}
                    onChange={handleInputChange}
                    className="w-full px-5 py-4 dark:bg-premium-900 bg-slate-50 border dark:border-premium-700 border-slate-200 rounded-xl dark:text-white text-slate-800 font-mono focus:ring-2 dark:focus:ring-white/20 focus:ring-blue-500/20 outline-none transition-all"
                    placeholder="Ex: 33AAAAA0000A1Z5"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-[10px] uppercase font-black tracking-[0.2em] dark:text-premium-400 text-slate-500 mb-2 ml-1">
                    Aadhaar Number
                  </label>
                  <input
                    type="text"
                    name="aadhar_number"
                    value={formData.aadhar_number}
                    onChange={handleInputChange}
                    className="w-full px-5 py-4 dark:bg-premium-900 bg-slate-50 border dark:border-premium-700 border-slate-200 rounded-xl dark:text-white text-slate-800 font-mono focus:ring-2 dark:focus:ring-white/20 focus:ring-blue-500/20 outline-none transition-all"
                    placeholder="12 digit number"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-[10px] uppercase font-black tracking-[0.2em] dark:text-premium-400 text-slate-500 mb-2 ml-1">
                    PAN Number
                  </label>
                  <input
                    type="text"
                    name="pan_number"
                    value={formData.pan_number}
                    onChange={handleInputChange}
                    className="w-full px-5 py-4 dark:bg-premium-900 bg-slate-50 border dark:border-premium-700 border-slate-200 rounded-xl dark:text-white text-slate-800 font-mono focus:ring-2 dark:focus:ring-white/20 focus:ring-blue-500/20 outline-none transition-all"
                    placeholder="ABCDE1234F"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="block text-[10px] uppercase font-black tracking-[0.2em] dark:text-premium-400 text-slate-500 mb-2 ml-1">Phone Number</label>
                <input
                  type="text"
                  name="phone"
                  value={formData.phone}
                  onChange={handleInputChange}
                  className="w-full px-5 py-4 dark:bg-premium-900 bg-slate-50 border dark:border-premium-700 border-slate-200 rounded-xl dark:text-white text-slate-800 focus:ring-2 dark:focus:ring-white/20 focus:ring-blue-500/20 outline-none transition-all"
                  placeholder="Mobile or Landline"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-[10px] uppercase font-black tracking-[0.2em] dark:text-premium-400 text-slate-500 mb-2 ml-1">Email ID</label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  className="w-full px-5 py-4 dark:bg-premium-900 bg-slate-50 border dark:border-premium-700 border-slate-200 rounded-xl dark:text-white text-slate-800 focus:ring-2 dark:focus:ring-white/20 focus:ring-blue-500/20 outline-none transition-all"
                  placeholder="contact@company.com"
                />
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div className="space-y-1">
                  <label className="block text-[10px] uppercase font-black tracking-[0.2em] dark:text-premium-400 text-slate-500 mb-2 ml-1">City</label>
                  <input
                    type="text"
                    name="city"
                    value={formData.city}
                    onChange={handleInputChange}
                    className="w-full px-5 py-4 dark:bg-premium-900 bg-slate-50 border dark:border-premium-700 border-slate-200 rounded-xl dark:text-white text-slate-800 focus:ring-2 dark:focus:ring-white/20 focus:ring-blue-500/20 outline-none transition-all"
                    placeholder="Salem"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-[10px] uppercase font-black tracking-[0.2em] dark:text-premium-400 text-slate-500 mb-2 ml-1">State</label>
                  <input
                    type="text"
                    name="state"
                    value={formData.state}
                    onChange={handleInputChange}
                    className="w-full px-5 py-4 dark:bg-premium-900 bg-slate-50 border dark:border-premium-700 border-slate-200 rounded-xl dark:text-white text-slate-800 focus:ring-2 dark:focus:ring-white/20 focus:ring-blue-500/20 outline-none transition-all"
                    placeholder="Tamil Nadu"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-[10px] uppercase font-black tracking-[0.2em] dark:text-premium-400 text-slate-500 mb-2 ml-1">Opening Balance</label>
                  <input
                    type="number"
                    name="opening_balance"
                    value={formData.opening_balance}
                    onChange={handleInputChange}
                    className="w-full px-5 py-4 dark:bg-premium-900 bg-slate-50 border dark:border-premium-700 border-slate-200 rounded-xl dark:text-white text-slate-800 focus:ring-2 dark:focus:ring-white/20 focus:ring-blue-500/20 outline-none transition-all"
                    placeholder="0.00"
                    step="0.01"
                  />
                </div>
              </div>

              <div className="md:col-span-2 mt-6">
                {error && <p className="text-red-500 mb-6 bg-red-500/10 p-4 rounded-xl border border-red-500/20 text-sm font-medium">{error}</p>}
                {success && <p className="text-emerald-500 mb-6 bg-emerald-500/10 p-4 rounded-xl border border-emerald-500/20 text-sm font-medium">{success}</p>}
                
                <button
                  type="submit"
                  disabled={loading}
                  className={`w-full py-5 dark:bg-white dark:hover:bg-premium-100 dark:text-black bg-black hover:bg-slate-800 text-white font-black uppercase tracking-[0.2em] rounded-xl shadow-2xl transition-all transform active:scale-[0.98] ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  {loading ? 'Processing...' : 'Save Party Details'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* List Card */}
        {!showForm && (
          <div className="dark:bg-premium-800/50 bg-white rounded-2xl shadow-lg border dark:border-premium-700 border-slate-100 overflow-hidden transition-all min-h-[85vh] flex flex-col w-full">
            <div className="p-8 border-b dark:border-premium-700/50 border-slate-100 dark:bg-premium-800/30 bg-slate-50/50 flex flex-col md:flex-row justify-between items-center gap-6">
              <div className="flex flex-col md:flex-row items-center gap-6 w-full md:w-auto">
                <div className="flex-shrink-0">
                  <h2 className="text-lg font-bold dark:text-white text-slate-700 whitespace-nowrap">Location Records ({(parties || []).length})</h2>
                  <p className="text-[10px] dark:text-premium-500 text-slate-400">Manage business locations and GSTs.</p>
                </div>
                
                {/* Search and Filter Controls */}
                <div className="flex items-center gap-4 flex-1">
                  <div className="relative flex-[3] group">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 dark:text-premium-500 text-slate-400 group-focus-within:dark:text-white transition-colors">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                    </span>
                    <input
                      type="text"
                      placeholder="Search name, short name, GST, city, phone..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full pl-12 pr-6 py-3.5 dark:bg-premium-900 bg-white border dark:border-premium-700 border-slate-200 rounded-xl text-sm dark:text-white text-slate-800 focus:ring-2 dark:focus:ring-white/20 focus:ring-blue-500/20 outline-none transition-all shadow-sm"
                    />
                  </div>

                  <div className="relative w-64">
                    <select
                      value={filterCity}
                      onChange={(e) => setFilterCity(e.target.value)}
                      className="w-full px-4 py-3.5 dark:bg-premium-900 bg-white border dark:border-premium-700 border-slate-200 rounded-xl text-sm dark:text-white text-slate-800 focus:ring-2 dark:focus:ring-white/20 focus:ring-blue-500/20 outline-none transition-all appearance-none cursor-pointer shadow-sm"
                    >
                      <option value="">All Cities</option>
                      {[...new Set((parties || []).map(p => p.city).filter(Boolean))].sort().map(city => (
                        <option key={city} value={city}>{city}</option>
                      ))}
                    </select>
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none dark:text-premium-500 text-slate-400">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </div>
                </div>
              </div>

              <button 
                onClick={() => setShowForm(true)}
                className="dark:bg-white dark:hover:bg-premium-100 dark:text-black bg-black hover:bg-slate-800 text-white px-10 py-3.5 rounded-xl font-black uppercase tracking-[0.1em] text-sm transition-all shadow-2xl active:scale-95 whitespace-nowrap flex items-center gap-2"
              >
                <Plus size={18} />
                <span>Add New Location</span>
              </button>
            </div>
            
            <div className="overflow-x-auto flex-1">
              <table className="w-full text-left">
                <thead>
                  <tr className="dark:bg-premium-800/80 bg-slate-100/50 dark:text-premium-400 text-slate-500 text-[10px] items-center uppercase font-black tracking-[0.2em]">
                    <th className="px-8 py-5">Short Name</th>
                    <th className="px-8 py-5">Legal Customer Name</th>
                    <th className="px-8 py-5">Identification (GST/Adh/PAN)</th>
                    <th className="px-8 py-5">Opening Balance</th>
                    <th className="px-8 py-5">City</th>
                    <th className="px-8 py-5">Contact Info</th>
                    <th className="px-8 py-5 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y dark:divide-premium-700/30 divide-slate-100">
                  {parties
                    .filter(party => {
                      const matchesSearch = 
                        party.short_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                        party.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                        party.gst_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                        party.aadhar_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                        party.pan_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                        party.city?.toLowerCase().includes(searchTerm.toLowerCase());
                      const matchesCity = !filterCity || party.city === filterCity;
                      return matchesSearch && matchesCity;
                    })
                    .map((party) => (
                    <tr key={party.id} className="dark:hover:bg-white/5 hover:bg-slate-50/50 transition-colors group">
                      <td className="px-8 py-6">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg dark:bg-premium-700 bg-slate-100 flex items-center justify-center dark:text-white text-slate-400 font-bold text-xs">
                            {party.short_name?.[0]?.toUpperCase()}
                          </div>
                          <span className="font-bold dark:text-white text-slate-800">{party.short_name}</span>
                        </div>
                      </td>
                      <td className="px-8 py-6">
                        <span className="text-sm dark:text-premium-300 text-slate-600 font-medium">{party.name}</span>
                      </td>
                      <td className="px-8 py-6">
                        <div className="flex flex-col gap-2">
                          {party.gst_number && (
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] font-black dark:text-premium-500 text-slate-400 uppercase w-8">GST:</span>
                              <span className="font-mono text-xs dark:text-premium-400 text-slate-600 bg-slate-50 dark:bg-premium-900 px-2 py-1 rounded-lg border dark:border-premium-700 border-slate-100">
                                {party.gst_number}
                              </span>
                            </div>
                          )}
                          {party.aadhar_number && (
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] font-black dark:text-premium-500 text-slate-400 uppercase w-8">ADH:</span>
                              <span className="font-mono text-xs dark:text-premium-400 text-slate-600 bg-slate-50 dark:bg-premium-900 px-2 py-1 rounded-lg border dark:border-premium-700 border-slate-100">
                                {party.aadhar_number}
                              </span>
                            </div>
                          )}
                          {party.pan_number && (
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] font-black dark:text-premium-500 text-slate-400 uppercase w-8">PAN:</span>
                              <span className="font-mono text-xs dark:text-premium-400 text-slate-600 bg-slate-50 dark:bg-premium-900 px-2 py-1 rounded-lg border dark:border-premium-700 border-slate-100">
                                {party.pan_number}
                              </span>
                            </div>
                          )}
                          {!party.gst_number && !party.aadhar_number && !party.pan_number && (
                            <span className="text-xs italic text-slate-400">No identification</span>
                          )}
                        </div>
                      </td>
                      <td className="px-8 py-6">
                        <div className="font-bold dark:text-premium-100 text-slate-700">
                          ₹ {(party.opening_balance || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </div>
                      </td>
                      <td className="px-8 py-6 text-slate-600 font-medium">
                        <span className="dark:bg-emerald-500/10 dark:text-emerald-400 bg-blue-50 text-blue-600 px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border border-current opacity-70">
                          {party.city || 'N/A'}
                        </span>
                      </td>
                      <td className="px-8 py-6">
                        <div className="flex flex-col gap-0.5">
                          <div className="text-sm font-bold dark:text-premium-100 text-slate-700">{party.phone || '-'}</div>
                          <div className="text-[10px] dark:text-premium-500 text-slate-400 font-medium italic">{party.email || 'No email provided'}</div>
                        </div>
                      </td>
                      <td className="px-8 py-6 text-center">
                        <button 
                          onClick={() => handleEdit(party)}
                          className="px-6 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all dark:bg-premium-800 dark:hover:bg-white dark:text-premium-300 dark:hover:text-black dark:border-premium-700 border border-transparent bg-slate-50 hover:bg-black hover:text-white text-slate-500 group-hover:shadow-lg"
                        >
                          Edit
                        </button>
                      </td>
                    </tr>
                  ))}
                  {(parties || []).length === 0 && (
                    <tr>
                      <td colSpan="5" className="px-8 py-20 text-center">
                        <div className="flex flex-col items-center justify-center gap-3 opacity-30">
                          <Package size={48} />
                          <p className="text-sm font-bold uppercase tracking-widest">No parties found in records.</p>
                        </div>
                      </td>
                    </tr>
                  )}
                  {(parties || []).length > 0 && (parties || []).filter(party => {
                    const matchesSearch = 
                      party.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                      party.gst_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                      party.aadhar_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                      party.pan_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                      party.city?.toLowerCase().includes(searchTerm.toLowerCase());
                    const matchesCity = !filterCity || party.city === filterCity;
                    return matchesSearch && matchesCity;
                  }).length === 0 && (
                    <tr>
                      <td colSpan="5" className="px-8 py-20 text-center">
                        <div className="flex flex-col items-center justify-center gap-2 opacity-30">
                          <Search size={40} />
                          <p className="text-sm font-bold">No results match your current search criteria.</p>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Parties;
