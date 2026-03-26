import React, { useState, useEffect } from 'react';
import { 
  Search, 
  Download, 
  Calendar as CalendarIcon, 
  Filter, 
  FileText,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  TrendingUp, 
  CreditCard, 
  User, 
  Hash,
  Printer
} from 'lucide-react';

export function Reports({ theme }) {
  const [bills, setBills] = useState([]);
  const [filteredBills, setFilteredBills] = useState([]);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  const [batchStart, setBatchStart] = useState('');
  const [batchEnd, setBatchEnd] = useState('');
  const [printing, setPrinting] = useState(false);

  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    setLoading(true);
    try {
      const data = await window.electron.ipcRenderer.invoke('get-sales-report');
      setBills(data || []);
      setFilteredBills(data || []);
    } catch (error) {
      console.error('Error fetching sales report:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFilter = async () => {
    setLoading(true);
    try {
      const data = await window.electron.ipcRenderer.invoke('get-sales-report', startDate, endDate);
      setBills(data);
      applySearch(data, searchTerm);
    } catch (error) {
      console.error('Error filtering sales report:', error);
    } finally {
      setLoading(false);
    }
  };

  const applySearch = (data, term) => {
    const filtered = data.filter(bill => 
      bill.bill_number.toLowerCase().includes(term.toLowerCase()) ||
      bill.party_name?.toLowerCase().includes(term.toLowerCase()) ||
      bill.party_short_name?.toLowerCase().includes(term.toLowerCase()) ||
      bill.party_gst_number?.toLowerCase().includes(term.toLowerCase())
    );
    setFilteredBills(filtered);
  };

  useEffect(() => {
    applySearch(bills, searchTerm);
  }, [searchTerm, bills]);

  const exportCSV = async () => {
    const headers = ['Date', 'Bill No', 'Party Name', 'GST Number', 'Taxable Value', 'Tax Rate', 'Tax Amount', 'Total Amount', 'LR No', 'Lorry Office'];
    const rows = filteredBills.map(b => {
      const taxableValue = b.total_amount - b.tax_amount;
      return [
        b.date,
        b.bill_number,
        b.party_name || b.party_short_name,
        b.party_gst_number || '',
        taxableValue.toFixed(2),
        b.tax_rate + '%',
        b.tax_amount.toFixed(2),
        b.total_amount.toFixed(2),
        b.lr_number || '',
        b.lorry_office || ''
      ].map(val => `"${val}"`).join(',');
    });

    const csvContent = [headers.join(','), ...rows].join('\n');
    const filename = `Sales_Report_${startDate || 'All'}_to_${endDate || 'Now'}.csv`;
    
    const result = await window.electron.ipcRenderer.invoke('export-to-csv', csvContent, filename);
    if (result) {
      alert(`Report exported to: ${result}`);
    }
  };

  const handleBatchPrint = async (type = 'big') => {
    if (!batchStart || !batchEnd) {
      alert('Please enter both Start and End Bill Numbers');
      return;
    }
    setPrinting(true);
    try {
      const results = await window.electron.ipcRenderer.invoke('print-bill-range', batchStart, batchEnd, type);
      const successCount = results.filter(r => r.success).length;
      alert(`Batch Print Completed: ${successCount}/${results.length} bills processed.`);
    } catch (error) {
      console.error('Batch print failed:', error);
      alert('Batch print failed. Check console for details.');
    } finally {
      setPrinting(false);
    }
  };

  const totals = filteredBills.reduce((acc, b) => {
    const taxableValue = b.total_amount - b.tax_amount;
    return {
      taxable: acc.taxable + taxableValue,
      tax: acc.tax + b.tax_amount,
      total: acc.total + b.total_amount
    };
  }, { taxable: 0, tax: 0, total: 0 });

  return (
    <div className="p-6 space-y-6 animate-in fade-in duration-700">
      {/* Header & Stats */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className={`text-2xl font-black tracking-tight ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
            SALES AUDIT REPORT
          </h1>
          <p className={`text-sm font-bold uppercase tracking-widest ${theme === 'dark' ? 'text-premium-500' : 'text-slate-500'}`}>
            Financial History & Tax Summary
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          <button
            onClick={exportCSV}
            className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-sm uppercase tracking-widest transition-all hover:scale-105 active:scale-95 ${
              theme === 'dark' 
                ? 'bg-white text-black shadow-xl shadow-white/10' 
                : 'bg-black text-white shadow-xl shadow-black/10'
            }`}
          >
            <Download size={18} strokeWidth={2.5} />
            Export CSV
          </button>
        </div>
      </div>

      {/* Batch Print Actions */}
      <div className={`p-6 rounded-2xl border ${
        theme === 'dark' ? 'bg-premium-black border-premium-800' : 'bg-white border-slate-100 shadow-sm'
      }`}>
        <div className="flex flex-wrap items-end gap-6">
          <div className="flex-1 min-w-[300px]">
            <h3 className={`text-xs font-black uppercase tracking-widest mb-4 ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
              Batch Print Bills
            </h3>
            <div className="flex items-center gap-4">
              <div className="space-y-1 flex-1">
                <label className="text-[9px] font-black uppercase tracking-tighter text-slate-400">Start No</label>
                <input
                  type="text"
                  placeholder="INV-1001"
                  value={batchStart}
                  onChange={(e) => setBatchStart(e.target.value.toUpperCase())}
                  className={`w-full px-4 py-2 rounded-lg border font-bold text-sm ${
                    theme === 'dark' ? 'bg-premium-900 border-premium-800 text-white' : 'bg-slate-50 border-slate-200'
                  }`}
                />
              </div>
              <div className="space-y-1 flex-1">
                <label className="text-[9px] font-black uppercase tracking-tighter text-slate-400">End No</label>
                <input
                  type="text"
                  placeholder="INV-1010"
                  value={batchEnd}
                  onChange={(e) => setBatchEnd(e.target.value.toUpperCase())}
                  className={`w-full px-4 py-2 rounded-lg border font-bold text-sm ${
                    theme === 'dark' ? 'bg-premium-900 border-premium-800 text-white' : 'bg-slate-50 border-slate-200'
                  }`}
                />
              </div>
            </div>
          </div>
          
          <div className="flex gap-2">
            <button
              onClick={() => handleBatchPrint('big')}
              disabled={printing}
              className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-xs uppercase tracking-widest transition-all ${
                printing ? 'opacity-50 cursor-not-allowed' : 'hover:scale-105 active:scale-95'
              } ${theme === 'dark' ? 'bg-white text-black' : 'bg-black text-white'}`}
            >
              <Printer size={16} />
              {printing ? 'Printing...' : 'Print (Original)'}
            </button>
            <button
              onClick={() => handleBatchPrint('transport')}
              disabled={printing}
              className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-xs uppercase tracking-widest transition-all ${
                printing ? 'opacity-50 cursor-not-allowed' : 'hover:scale-105 active:scale-95'
              } ${theme === 'dark' ? 'bg-premium-800 text-white' : 'bg-slate-100 text-slate-900'}`}
            >
              <Printer size={16} />
              {printing ? 'Printing...' : 'Print (Transport)'}
            </button>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[
          { label: 'Total Taxable', value: totals.taxable, icon: TrendingUp, color: 'text-blue-500' },
          { label: 'Total Tax (GST)', value: totals.tax, icon: CreditCard, color: 'text-purple-500' },
          { label: 'Grand Total', value: totals.total, icon: FileText, color: 'text-emerald-500' },
        ].map((stat, i) => (
          <div key={i} className={`p-6 rounded-2xl border ${
            theme === 'dark' ? 'bg-premium-black border-premium-800' : 'bg-white border-slate-100 shadow-sm'
          }`}>
            <div className="flex items-center justify-between mb-2">
              <span className={`text-[10px] font-black uppercase tracking-[0.2em] ${theme === 'dark' ? 'text-premium-500' : 'text-slate-400'}`}>
                {stat.label}
              </span>
              <stat.icon className={stat.color} size={20} />
            </div>
            <div className={`text-2xl font-black ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
              ₹{stat.value.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </div>
        ))}
      </div>

      {/* Filters Area */}
      <div className={`p-6 rounded-2xl border ${
        theme === 'dark' ? 'bg-premium-black border-premium-800' : 'bg-white border-slate-100 shadow-sm'
      }`}>
        <div className="flex flex-wrap items-end gap-6">
          <div className="space-y-2 flex-1 min-w-[200px]">
            <label className={`text-[10px] font-black uppercase tracking-widest ${theme === 'dark' ? 'text-premium-500' : 'text-slate-400'}`}>
              Search Transactions
            </label>
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input
                type="text"
                placeholder="Bill No, Party Name, GST..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className={`w-full pl-12 pr-4 py-3 rounded-xl border transition-all outline-none font-bold text-sm ${
                  theme === 'dark' 
                    ? 'bg-premium-900 border-premium-800 text-white focus:border-white/30' 
                    : 'bg-slate-50 border-slate-200 text-slate-900 focus:border-black/20'
                }`}
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className={`text-[10px] font-black uppercase tracking-widest ${theme === 'dark' ? 'text-premium-500' : 'text-slate-400'}`}>
              Start Date
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className={`px-4 py-3 rounded-xl border transition-all outline-none font-bold text-sm ${
                theme === 'dark' 
                  ? 'bg-premium-900 border-premium-800 text-white' 
                  : 'bg-slate-50 border-slate-200 text-slate-900'
              }`}
            />
          </div>

          <div className="space-y-2">
            <label className={`text-[10px] font-black uppercase tracking-widest ${theme === 'dark' ? 'text-premium-500' : 'text-slate-400'}`}>
              End Date
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className={`px-4 py-3 rounded-xl border transition-all outline-none font-bold text-sm ${
                theme === 'dark' 
                  ? 'bg-premium-900 border-premium-800 text-white' 
                  : 'bg-slate-50 border-slate-200 text-slate-900'
              }`}
            />
          </div>

          <button
            onClick={handleFilter}
            className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-sm uppercase tracking-widest transition-all ${
              theme === 'dark' 
                ? 'bg-premium-800 text-white hover:bg-premium-700' 
                : 'bg-slate-100 text-slate-900 hover:bg-slate-200'
            }`}
          >
            <Filter size={18} />
            Filter
          </button>
        </div>
      </div>

      {/* Table Area */}
      <div className={`rounded-2xl border overflow-hidden ${
        theme === 'dark' ? 'bg-premium-black border-premium-800' : 'bg-white border-slate-100 shadow-sm'
      }`}>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className={`${theme === 'dark' ? 'bg-white/5' : 'bg-slate-50'}`}>
                {[
                  { label: 'Date', icon: CalendarIcon },
                  { label: 'Bill No', icon: Hash },
                  { label: 'Party', icon: User },
                  { label: 'GST No', icon: FileText },
                  { label: 'Taxable', icon: ArrowUpDown },
                  { label: 'GST', icon: ArrowUpDown },
                  { label: 'Total', icon: ArrowUpDown },
                ].map((head, i) => (
                  <th key={i} className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] font-black uppercase tracking-[0.2em] ${theme === 'dark' ? 'text-premium-500' : 'text-slate-400'}`}>
                        {head.label}
                      </span>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-premium-800/10">
              {loading ? (
                <tr>
                  <td colSpan="7" className="px-6 py-12 text-center">
                    <div className="animate-pulse flex flex-col items-center gap-4">
                      <div className="w-12 h-12 rounded-full border-4 border-t-blue-500 border-slate-200 animate-spin"></div>
                      <p className="text-sm font-bold uppercase tracking-widest text-slate-400">Loading Data...</p>
                    </div>
                  </td>
                </tr>
              ) : filteredBills.length === 0 ? (
                <tr>
                  <td colSpan="7" className="px-6 py-12 text-center text-slate-400 font-bold uppercase tracking-widest">
                    No records found
                  </td>
                </tr>
              ) : (
                filteredBills.map((bill, index) => {
                  const taxableValue = bill.total_amount - bill.tax_amount;
                  return (
                    <tr key={index} className={`transition-colors ${theme === 'dark' ? 'hover:bg-white/5' : 'hover:bg-slate-50'}`}>
                      <td className="px-6 py-4 font-bold text-sm">{bill.date}</td>
                      <td className="px-6 py-4 font-black text-sm">{bill.bill_number}</td>
                      <td className="px-6 py-4 font-bold text-sm max-w-[200px] truncate">
                        {bill.party_name || bill.party_short_name}
                      </td>
                      <td className="px-6 py-4 font-medium text-xs text-slate-400 font-mono">
                        {bill.party_gst_number || 'N/A'}
                      </td>
                      <td className="px-6 py-4 font-bold text-sm">
                        ₹{taxableValue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-6 py-4 text-xs">
                        <span className={`px-2 py-1 rounded-md font-bold ${
                          theme === 'dark' ? 'bg-white/10 text-white' : 'bg-slate-100 text-slate-600'
                        }`}>
                          ₹{bill.tax_amount.toFixed(2)} ({bill.tax_rate}%)
                        </span>
                      </td>
                      <td className="px-6 py-4 font-black text-sm text-emerald-500">
                        ₹{bill.total_amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
