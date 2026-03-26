import React, { useState, useEffect } from 'react';
import { Plus, Package, Search, ArrowLeft, X } from 'lucide-react';

const Parties = () => {
  const [parties, setParties] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [formData, setFormData] = useState({
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
      setParties([]);
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

      if (formData.isNewCustomer) {
        const result = await window.electron.ipcRenderer.invoke('save-customer', { name: formData.newCustomerName });
        currentCustomerId = result.lastID;
        await fetchCustomers();
      }

      const partyData = { ...formData, customer_id: currentCustomerId };
      await window.electron.ipcRenderer.invoke('save-party', partyData);
      
      setSuccess('Location saved successfully!');
      resetForm();
      fetchParties();
      setTimeout(() => setShowForm(false), 1500);
    } catch (err) {
      setError('Error saving location: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
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

  /* M3 Input styling */
  const inputBase = "w-full rounded-md px-4 py-3 m3-body-large bg-m3-surface-container-highest border border-m3-outline-variant text-m3-on-surface placeholder:text-m3-on-surface-variant/50 focus:border-m3-primary focus:ring-2 focus:ring-m3-primary/20 outline-none transition-all duration-200";
  const labelBase = "block m3-label-medium text-m3-on-surface-variant mb-1.5";

  const filteredParties = (parties || []).filter(party => {
    const matchesSearch = 
      party.short_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      party.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      party.gst_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      party.aadhar_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      party.pan_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      party.city?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCity = !filterCity || party.city === filterCity;
    return matchesSearch && matchesCity;
  });

  return (
    <div className="font-sans min-h-full transition-colors duration-300">
      <div className="w-full mx-auto animate-in fade-in duration-500">
        {/* Page Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-1 h-8 rounded-full bg-m3-primary"></div>
          <h1 className="m3-headline-small font-display text-m3-on-surface">Manage Parties</h1>
        </div>

        {/* Form Card */}
        {showForm && (
          <div className="rounded-xl border border-m3-outline-variant bg-m3-surface-container-lowest p-8 mb-8 overflow-hidden relative transition-all shadow-m3-1">
            <div className="flex justify-between items-center mb-8">
              <div>
                <h2 className="m3-title-large font-display text-m3-on-surface">Add / Edit Party</h2>
                <p className="m3-body-medium text-m3-on-surface-variant mt-1">Fill in the details to save party information.</p>
              </div>
              <button 
                onClick={() => {
                  setShowForm(false);
                  setError('');
                  setSuccess('');
                  resetForm();
                }}
                className="flex items-center gap-2 px-4 py-2.5 rounded-full m3-label-large border border-m3-outline text-m3-on-surface-variant hover:bg-m3-surface-container-highest transition-all"
              >
                <ArrowLeft size={16} />
                Back to List
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Customer Selection */}
              <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className={labelBase}>
                    Select Customer <span className="text-m3-error">*</span>
                  </label>
                  <div className="flex gap-2">
                    <select
                      disabled={formData.isNewCustomer}
                      value={formData.customer_id}
                      onChange={(e) => setFormData(prev => ({ ...prev, customer_id: e.target.value }))}
                      className={`${inputBase} cursor-pointer disabled:opacity-50`}
                    >
                      <option value="">Choose Existing Customer...</option>
                      {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                    <button
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, isNewCustomer: !prev.isNewCustomer, newCustomerName: '' }))}
                      className={`px-4 rounded-full m3-label-large whitespace-nowrap transition-all ${
                        formData.isNewCustomer 
                          ? 'bg-m3-primary text-m3-on-primary' 
                          : 'border border-m3-outline text-m3-on-surface-variant hover:bg-m3-surface-container-highest'
                      }`}
                    >
                      {formData.isNewCustomer ? 'Cancel' : 'New Customer'}
                    </button>
                  </div>
                </div>

                {formData.isNewCustomer ? (
                  <div className="animate-in slide-in-from-top-2 duration-300">
                    <label className={labelBase}>
                      New Customer Legal Name <span className="text-m3-error">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.newCustomerName}
                      onChange={(e) => setFormData(prev => ({ ...prev, newCustomerName: e.target.value }))}
                      className={inputBase}
                      placeholder="Enter legal business name"
                    />
                  </div>
                ) : (
                  <div>
                    <label className={labelBase}>
                      Short Name (Unique Selection Name) <span className="text-m3-error">*</span>
                    </label>
                    <input
                      type="text"
                      name="short_name"
                      value={formData.short_name}
                      onChange={handleInputChange}
                      className={inputBase}
                      placeholder="Ex: Bhaniram (Raipur)"
                    />
                  </div>
                )}
              </div>

              {formData.isNewCustomer && (
                <div className="md:col-span-2 animate-in slide-in-from-top-2 duration-300">
                  <label className={labelBase}>
                    Initial Location Short Name <span className="text-m3-error">*</span>
                  </label>
                  <input
                    type="text"
                    name="short_name"
                    value={formData.short_name}
                    onChange={handleInputChange}
                    className={inputBase}
                    placeholder="Ex: Bhaniram (Main Office)"
                  />
                </div>
              )}

              <div className="md:col-span-2">
                <label className={labelBase}>
                  Address <span className="text-m3-error">*</span>
                </label>
                <textarea
                  name="address"
                  value={formData.address}
                  onChange={handleInputChange}
                  rows="3"
                  className={`${inputBase} resize-none`}
                  placeholder="Full billing address"
                ></textarea>
              </div>

              <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <label className={labelBase}>GST NO</label>
                  <input type="text" name="gst_number" value={formData.gst_number} onChange={handleInputChange} className={`${inputBase} font-mono`} placeholder="Ex: 33AAAAA0000A1Z5" />
                </div>
                <div>
                  <label className={labelBase}>Aadhaar Number</label>
                  <input type="text" name="aadhar_number" value={formData.aadhar_number} onChange={handleInputChange} className={`${inputBase} font-mono`} placeholder="12 digit number" />
                </div>
                <div>
                  <label className={labelBase}>PAN Number</label>
                  <input type="text" name="pan_number" value={formData.pan_number} onChange={handleInputChange} className={`${inputBase} font-mono`} placeholder="ABCDE1234F" />
                </div>
              </div>

              <div>
                <label className={labelBase}>Phone Number</label>
                <input type="text" name="phone" value={formData.phone} onChange={handleInputChange} className={inputBase} placeholder="Mobile or Landline" />
              </div>

              <div>
                <label className={labelBase}>Email ID</label>
                <input type="email" name="email" value={formData.email} onChange={handleInputChange} className={inputBase} placeholder="contact@company.com" />
              </div>

              <div className="md:col-span-2 grid grid-cols-2 md:grid-cols-3 gap-4">
                <div>
                  <label className={labelBase}>City</label>
                  <input type="text" name="city" value={formData.city} onChange={handleInputChange} className={inputBase} placeholder="Salem" />
                </div>
                <div>
                  <label className={labelBase}>State</label>
                  <input type="text" name="state" value={formData.state} onChange={handleInputChange} className={inputBase} placeholder="Tamil Nadu" />
                </div>
                <div>
                  <label className={labelBase}>Opening Balance</label>
                  <input type="number" name="opening_balance" value={formData.opening_balance} onChange={handleInputChange} className={`${inputBase} font-mono`} placeholder="0.00" step="0.01" />
                </div>
              </div>

              <div className="md:col-span-2 mt-4 space-y-4">
                {error && (
                  <div className="flex items-center gap-3 p-4 rounded-xl bg-m3-error-container text-m3-on-error-container m3-body-medium">
                    <X size={18} />
                    {error}
                  </div>
                )}
                {success && (
                  <div className="flex items-center gap-3 p-4 rounded-xl bg-[#c8ffc8] text-[#003300] dark:bg-[#003300] dark:text-[#c8ffc8] m3-body-medium">
                    ✓ {success}
                  </div>
                )}
                
                <button
                  type="submit"
                  disabled={loading}
                  className={`w-full py-4 rounded-full m3-label-large bg-m3-primary text-m3-on-primary hover:shadow-m3-2 transition-all active:scale-[0.99] ${loading ? 'opacity-60 cursor-not-allowed' : ''}`}
                >
                  {loading ? 'Processing...' : 'Save Party Details'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* List View */}
        {!showForm && (
          <div className="rounded-xl border border-m3-outline-variant bg-m3-surface-container-lowest overflow-hidden min-h-[80vh] flex flex-col">
            {/* List Header */}
            <div className="p-6 border-b border-m3-outline-variant bg-m3-surface-container-low flex flex-col md:flex-row justify-between items-center gap-4">
              <div className="flex flex-col md:flex-row items-center gap-4 w-full md:w-auto">
                <div className="flex-shrink-0">
                  <h2 className="m3-title-medium text-m3-on-surface">Location Records ({(parties || []).length})</h2>
                  <p className="m3-body-small text-m3-on-surface-variant">Manage business locations and GSTs</p>
                </div>
                
                {/* Search */}
                <div className="flex items-center gap-3 flex-1 w-full md:w-auto">
                  <div className="relative flex-1">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-m3-on-surface-variant" size={18} />
                    <input
                      type="text"
                      placeholder="Search name, GST, city, phone..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full pl-11 pr-4 py-2.5 rounded-full m3-body-medium bg-m3-surface-container-highest border border-m3-outline-variant text-m3-on-surface placeholder:text-m3-on-surface-variant/50 focus:border-m3-primary focus:ring-2 focus:ring-m3-primary/20 outline-none transition-all"
                    />
                  </div>

                  <div className="relative w-48">
                    <select
                      value={filterCity}
                      onChange={(e) => setFilterCity(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-full m3-body-medium bg-m3-surface-container-highest border border-m3-outline-variant text-m3-on-surface focus:border-m3-primary outline-none appearance-none cursor-pointer"
                    >
                      <option value="">All Cities</option>
                      {[...new Set((parties || []).map(p => p.city).filter(Boolean))].sort().map(city => (
                        <option key={city} value={city}>{city}</option>
                      ))}
                    </select>
                    <div className="absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-m3-on-surface-variant">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </div>
                </div>
              </div>

              <button 
                onClick={() => setShowForm(true)}
                className="flex items-center gap-2 px-6 py-3 rounded-full m3-label-large bg-m3-primary text-m3-on-primary hover:shadow-m3-1 transition-all active:scale-[0.98] whitespace-nowrap"
              >
                <Plus size={18} />
                <span>Add New Location</span>
              </button>
            </div>
            
            {/* Table */}
            <div className="overflow-x-auto flex-1 custom-scrollbar">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-m3-surface-container border-b border-m3-outline-variant">
                    <th className="px-6 py-4 m3-label-medium text-m3-on-surface-variant">Short Name</th>
                    <th className="px-6 py-4 m3-label-medium text-m3-on-surface-variant">Legal Customer Name</th>
                    <th className="px-6 py-4 m3-label-medium text-m3-on-surface-variant">Identification</th>
                    <th className="px-6 py-4 m3-label-medium text-m3-on-surface-variant">Opening Balance</th>
                    <th className="px-6 py-4 m3-label-medium text-m3-on-surface-variant">City</th>
                    <th className="px-6 py-4 m3-label-medium text-m3-on-surface-variant">Contact Info</th>
                    <th className="px-6 py-4 m3-label-medium text-m3-on-surface-variant text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-m3-outline-variant/50">
                  {filteredParties.map((party) => (
                    <tr key={party.id} className="hover:bg-m3-surface-container-low transition-colors group">
                      <td className="px-6 py-5">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-m3-secondary-container flex items-center justify-center text-m3-on-secondary-container m3-label-large">
                            {party.short_name?.[0]?.toUpperCase()}
                          </div>
                          <span className="m3-label-large text-m3-on-surface">{party.short_name}</span>
                        </div>
                      </td>
                      <td className="px-6 py-5">
                        <span className="m3-body-medium text-m3-on-surface-variant">{party.name}</span>
                      </td>
                      <td className="px-6 py-5">
                        <div className="flex flex-col gap-1.5">
                          {party.gst_number && (
                            <div className="flex items-center gap-2">
                              <span className="m3-label-small text-m3-on-surface-variant w-8">GST:</span>
                              <span className="font-mono m3-body-small px-2 py-0.5 rounded-md bg-m3-surface-container-high text-m3-on-surface-variant border border-m3-outline-variant/50">
                                {party.gst_number}
                              </span>
                            </div>
                          )}
                          {party.aadhar_number && (
                            <div className="flex items-center gap-2">
                              <span className="m3-label-small text-m3-on-surface-variant w-8">ADH:</span>
                              <span className="font-mono m3-body-small px-2 py-0.5 rounded-md bg-m3-surface-container-high text-m3-on-surface-variant border border-m3-outline-variant/50">
                                {party.aadhar_number}
                              </span>
                            </div>
                          )}
                          {party.pan_number && (
                            <div className="flex items-center gap-2">
                              <span className="m3-label-small text-m3-on-surface-variant w-8">PAN:</span>
                              <span className="font-mono m3-body-small px-2 py-0.5 rounded-md bg-m3-surface-container-high text-m3-on-surface-variant border border-m3-outline-variant/50">
                                {party.pan_number}
                              </span>
                            </div>
                          )}
                          {!party.gst_number && !party.aadhar_number && !party.pan_number && (
                            <span className="m3-body-small italic text-m3-on-surface-variant/50">No identification</span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-5">
                        <span className="m3-label-large font-mono text-m3-on-surface">
                          ₹ {(party.opening_balance || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </span>
                      </td>
                      <td className="px-6 py-5">
                        <span className="px-3 py-1.5 rounded-full m3-label-small bg-m3-tertiary-container text-m3-on-tertiary-container">
                          {party.city || 'N/A'}
                        </span>
                      </td>
                      <td className="px-6 py-5">
                        <div className="flex flex-col gap-0.5">
                          <span className="m3-body-medium text-m3-on-surface">{party.phone || '-'}</span>
                          <span className="m3-body-small text-m3-on-surface-variant italic">{party.email || 'No email provided'}</span>
                        </div>
                      </td>
                      <td className="px-6 py-5 text-center">
                        <button 
                          onClick={() => handleEdit(party)}
                          className="px-5 py-2 rounded-full m3-label-large border border-m3-outline text-m3-primary hover:bg-m3-primary-container hover:text-m3-on-primary-container transition-all"
                        >
                          Edit
                        </button>
                      </td>
                    </tr>
                  ))}
                  {(parties || []).length === 0 && (
                    <tr>
                      <td colSpan="7" className="px-8 py-20 text-center">
                        <div className="flex flex-col items-center justify-center gap-3 text-m3-on-surface-variant/40">
                          <Package size={48} />
                          <p className="m3-body-large">No parties found in records.</p>
                        </div>
                      </td>
                    </tr>
                  )}
                  {(parties || []).length > 0 && filteredParties.length === 0 && (
                    <tr>
                      <td colSpan="7" className="px-8 py-20 text-center">
                        <div className="flex flex-col items-center justify-center gap-2 text-m3-on-surface-variant/40">
                          <Search size={40} />
                          <p className="m3-body-large">No results match your current search criteria.</p>
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
