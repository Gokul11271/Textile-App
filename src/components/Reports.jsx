import { useAlert } from './AlertProvider';
import React, { useState, useEffect } from 'react';
import { 
  Search, 
  Download, 
  Filter, 
  FileText,
  TrendingUp, 
  CreditCard,
  Printer,
  Trash2
} from 'lucide-react';

function useDebounce(value, delay) {
  const [debouncedValue, setDebouncedValue] = useState(value);
  useEffect(() => {
    const handler = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(handler);
  }, [value, delay]);
  return debouncedValue;
}

export function Reports({ theme }) {
  const { showAlert } = useAlert();
  const [bills, setBills] = useState([]);
  const [isPending, startTransition] = React.useTransition();
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  const [batchStart, setBatchStart] = useState('');
  const [batchEnd, setBatchEnd] = useState('');
  const [batchLr, setBatchLr] = useState('');
  const [printing, setPrinting] = useState(false);

  const debouncedSearch = useDebounce(searchTerm, 300);

  const filteredBills = React.useMemo(() => {
    return bills.filter(bill =>
      bill.bill_number.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
      bill.party_name?.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
      bill.party_short_name?.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
      bill.party_gst_number?.toLowerCase().includes(debouncedSearch.toLowerCase())
    );
  }, [bills, debouncedSearch]);

  const deferredBills = React.useDeferredValue(filteredBills);

  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async (isBackgroundRefresh = false) => {
    const isBg = isBackgroundRefresh === true;
    if (!isBg) setLoading(true);
    try {
      const data = await window.electron.ipcRenderer.invoke('get-sales-report');
      startTransition(() => {
        setBills(data || []);
      });
    } catch (error) {
      console.error('Error fetching sales report:', error);
    } finally {
      if (!isBg) setLoading(false);
    }
  };

  const handleFilter = async (isBackgroundRefresh = false) => {
    const isBg = isBackgroundRefresh === true;
    if (!isBg) setLoading(true);
    try {
      const data = await window.electron.ipcRenderer.invoke('get-sales-report', startDate, endDate);
      startTransition(() => {
        setBills(data || []);
      });
    } catch (error) {
      console.error('Error filtering sales report:', error);
    } finally {
      if (!isBg) setLoading(false);
    }
  };

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

    const csvContent = "\uFEFF" + [headers.join(','), ...rows].join('\n');
    const filename = `Sales_Report_${startDate || 'All'}_to_${endDate || 'Now'}.csv`;
    
    const result = await window.electron.ipcRenderer.invoke('export-to-csv', csvContent, filename);
    if (result) {
      showAlert(`Report exported to: ${result}`, 'info');
    }
  };

  const handleBatchPrint = async (type = 'big') => {
    if (!batchStart || !batchEnd) {
      showAlert('Please enter both Start and End Bill Numbers', 'warning');
      return;
    }
    setPrinting(true);
    try {
      const results = await window.electron.ipcRenderer.invoke('print-bill-range', batchStart, batchEnd, type);
      const successCount = results.filter(r => r.success).length;
      showAlert(`Batch Print Completed: ${successCount}/${results.length} bills processed.`, 'success');
    } catch (error) {
      console.error('Batch print failed:', error);
      showAlert('Batch print failed. Check console for details.', 'error');
    } finally {
      setPrinting(false);
    }
  };

  const handleDeleteBill = (billNumber) => {
    if (!window.confirm(`Are you sure you want to delete bill ${billNumber}? This action cannot be undone.`)) return;

    // 1. Instant UI update
    startTransition(() => {
      setBills(prev => prev.filter(b => b.bill_number !== billNumber));
    });

    showAlert('Deleting...', 'info');

    // 2. Background delete (non-blocking)
    window.electron.ipcRenderer.invoke('delete-bill', billNumber)
      .then(result => {
        if (result.success) {
          showAlert('✅ Bill deleted successfully', 'success');
          // Refresh component data in background
          if (startDate || endDate) {
            handleFilter(true);
          } else {
            fetchInitialData(true);
          }
        } else {
          showAlert('❌ Failed to delete bill: ' + result.error, 'error');
        }
      })
      .catch(err => {
        showAlert('❌ Error deleting bill: ' + err.message, 'error');
      });
  };

  const handleBatchUpdateLrAndPrint = async () => {
    if (!batchStart || !batchEnd || !batchLr) {
      showAlert('Please enter Start Bill No, End Bill No, and Starting LR Number', 'warning');
      return;
    }
    setPrinting(true);
    try {
      const updateResult = await window.electron.ipcRenderer.invoke('update-lr-numbers', batchStart, batchEnd, batchLr);
      if (updateResult.success) {
        // Now print the big bills
        const results = await window.electron.ipcRenderer.invoke('print-bill-range', batchStart, batchEnd, 'big');
        const successCount = results.filter(r => r.success).length;
        showAlert(`Updated LR for ${updateResult.count} bills. Print Completed: ${successCount}/${results.length} bills processed.`, 'success');
        
        // Update local state without full refetch if possible, or just refetch
        handleFilter(true); 
      } else {
        showAlert(updateResult.message || updateResult.error || 'Failed to update LR numbers', 'error');
      }
    } catch (error) {
      console.error('Batch LR update/print failed:', error);
      showAlert('Batch LR update and print failed. Check console for details.', 'error');
    } finally {
      setPrinting(false);
    }
  };

  const totals = React.useMemo(() => {
    return filteredBills.reduce((acc, b) => {
      const taxableValue = (b.total_amount || 0) - (b.tax_amount || 0);
      return {
        taxable: acc.taxable + taxableValue,
        tax: acc.tax + (b.tax_amount || 0),
        total: acc.total + (b.total_amount || 0)
      };
    }, { taxable: 0, tax: 0, total: 0 });
  }, [filteredBills]);

  const inputBase = "w-full rounded-md px-4 py-2.5 m3-body-medium bg-m3-surface-container-highest border border-m3-outline-variant text-m3-on-surface placeholder:text-m3-on-surface-variant/50 focus:border-m3-primary focus:ring-2 focus:ring-m3-primary/20 outline-none transition-all";
  const labelBase = "m3-label-medium text-m3-on-surface-variant mb-1.5 block";

  return (
    <div className="space-y-6 animate-in fade-in duration-500 font-sans">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="m3-headline-small font-display text-m3-on-surface">Sales Audit Report</h1>
          <p className="m3-body-medium text-m3-on-surface-variant">Financial history & tax summary</p>
        </div>
        
        <button
          onClick={exportCSV}
          className="flex items-center gap-2 px-6 py-3 rounded-full m3-label-large bg-m3-primary text-m3-on-primary hover:shadow-m3-1 active:scale-[0.98] transition-all"
        >
          <Download size={18} />
          Export CSV
        </button>
      </div>

      {/* Batch Print Card */}
      <div className="p-6 rounded-xl border border-m3-outline-variant bg-m3-surface-container-lowest">
        <div className="flex flex-wrap items-end gap-6">
          <div className="flex-1 min-w-[300px]">
            <h3 className="m3-title-small text-m3-on-surface mb-4">Batch Print & Assign LR</h3>
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <label className={labelBase}>Start No</label>
                <input
                  type="text"
                  placeholder="INV-1001"
                  value={batchStart}
                  onChange={(e) => setBatchStart(e.target.value.toUpperCase())}
                  className={`${inputBase} font-mono`}
                />
              </div>
              <div className="flex-1">
                <label className={labelBase}>End No</label>
                <input
                  type="text"
                  placeholder="INV-1010"
                  value={batchEnd}
                  onChange={(e) => setBatchEnd(e.target.value.toUpperCase())}
                  className={`${inputBase} font-mono`}
                />
              </div>
              <div className="flex-1">
                <label className={labelBase}>Start LR No</label>
                <input
                  type="text"
                  placeholder="e.g. 100"
                  value={batchLr}
                  onChange={(e) => setBatchLr(e.target.value)}
                  className={`${inputBase} font-mono`}
                />
              </div>
            </div>
          </div>
          
          <div className="flex flex-col gap-2">
            <div className="flex gap-2">
              <button
                onClick={() => handleBatchPrint('big')}
                disabled={printing || !batchStart || !batchEnd}
                className={`flex-1 flex items-center justify-center gap-2 px-5 py-2.5 rounded-full m3-label-large transition-all ${
                  printing || !batchStart || !batchEnd ? 'opacity-50 cursor-not-allowed' : 'active:scale-[0.98] hover:shadow-m3-1'
                } bg-m3-surface-container-highest text-m3-on-surface`}
              >
                <Printer size={16} />
                Print Big
              </button>
              <button
                onClick={() => handleBatchPrint('transport')}
                disabled={printing || !batchStart || !batchEnd}
                className={`flex-1 flex items-center justify-center gap-2 px-5 py-2.5 rounded-full m3-label-large transition-all ${
                  printing || !batchStart || !batchEnd ? 'opacity-50 cursor-not-allowed' : 'active:scale-[0.98] hover:shadow-m3-1'
                } bg-m3-surface-container-highest text-m3-on-surface`}
              >
                <Printer size={16} />
                Print Transport
              </button>
            </div>
            
            <button
              onClick={handleBatchUpdateLrAndPrint}
              disabled={printing || !batchStart || !batchEnd || !batchLr}
              className={`w-full flex items-center justify-center gap-2 px-5 py-2.5 rounded-full m3-label-large transition-all ${
                printing || !batchStart || !batchEnd || !batchLr ? 'opacity-50 cursor-not-allowed' : 'active:scale-[0.98] hover:shadow-m3-1'
              } bg-m3-primary text-m3-on-primary`}
            >
              <FileText size={16} />
              {printing ? 'Processing...' : 'Assign LR & Print Big Bills'}
            </button>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { label: 'Total Taxable', value: totals.taxable, icon: TrendingUp, accent: 'bg-m3-primary-container text-m3-on-primary-container' },
          { label: 'Total Tax (GST)', value: totals.tax, icon: CreditCard, accent: 'bg-m3-secondary-container text-m3-on-secondary-container' },
          { label: 'Grand Total', value: totals.total, icon: FileText, accent: 'bg-m3-tertiary-container text-m3-on-tertiary-container' },
        ].map((stat, i) => (
          <div key={i} className="p-5 rounded-xl border border-m3-outline-variant bg-m3-surface-container-low">
            <div className="flex items-center justify-between mb-2">
              <span className="m3-label-medium text-m3-on-surface-variant">{stat.label}</span>
              <div className={`p-2 rounded-lg ${stat.accent}`}>
                <stat.icon size={18} />
              </div>
            </div>
            <div className="m3-headline-small font-display font-medium text-m3-on-surface">
              ₹{stat.value.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="p-6 rounded-xl border border-m3-outline-variant bg-m3-surface-container-lowest">
        <div className="flex flex-wrap items-end gap-4">
          <div className="flex-1 min-w-[200px]">
            <label className={labelBase}>Search Transactions</label>
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-m3-on-surface-variant" size={18} />
              <input
                type="text"
                placeholder="Bill No, Party Name, GST..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className={`${inputBase} pl-11`}
              />
            </div>
          </div>

          <div>
            <label className={labelBase}>Start Date</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className={inputBase}
            />
          </div>

          <div>
            <label className={labelBase}>End Date</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className={inputBase}
            />
          </div>

          <button
            onClick={handleFilter}
            className="flex items-center gap-2 px-5 py-2.5 rounded-full m3-label-large bg-m3-secondary-container text-m3-on-secondary-container hover:shadow-m3-1 transition-all"
          >
            <Filter size={16} />
            Filter
          </button>
        </div>
      </div>

      {/* Data Table */}
      <div className="rounded-xl border border-m3-outline-variant bg-m3-surface-container-lowest overflow-hidden">
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-m3-surface-container border-b border-m3-outline-variant">
                {['Date', 'Bill No', 'Party', 'GST No', 'Taxable', 'GST', 'Total', 'Action'].map((label, i) => (
                  <th key={i} className="px-6 py-3.5 m3-label-medium text-m3-on-surface-variant">
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-m3-outline-variant/50">
              {loading ? (
                <tr>
                  <td colSpan="8" className="px-6 py-16 text-center">
                    <div className="flex flex-col items-center gap-4">
                      <div className="w-10 h-10 rounded-full border-3 border-m3-primary/30 border-t-m3-primary animate-spin"></div>
                      <p className="m3-body-medium text-m3-on-surface-variant">Loading Data...</p>
                    </div>
                  </td>
                </tr>
              ) : deferredBills.length === 0 ? (
                <tr>
                  <td colSpan="8" className="px-6 py-16 text-center">
                    <p className="m3-body-large text-m3-on-surface-variant/50">No records found</p>
                  </td>
                </tr>
              ) : (
                deferredBills.map((bill) => {
                  const taxableValue = (bill.total_amount || 0) - (bill.tax_amount || 0);
                  return (
                    <tr key={bill.bill_number} className="hover:bg-m3-surface-container-low transition-colors">
                      <td className="px-6 py-4 m3-body-medium text-m3-on-surface">{bill.date}</td>
                      <td className="px-6 py-4 m3-label-large font-mono text-m3-on-surface">{bill.bill_number}</td>
                      <td className="px-6 py-4 m3-body-medium text-m3-on-surface max-w-[200px] truncate">
                        {bill.party_name || bill.party_short_name}
                      </td>
                      <td className="px-6 py-4 m3-body-small font-mono text-m3-on-surface-variant">
                        {bill.party_gst_number || 'N/A'}
                      </td>
                      <td className="px-6 py-4 m3-label-large font-mono text-m3-on-surface">
                        ₹{taxableValue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-6 py-4">
                        <span className="px-2.5 py-1 rounded-full m3-label-small bg-m3-surface-container-high text-m3-on-surface-variant">
                          ₹{bill.tax_amount.toFixed(2)} ({bill.tax_rate}%)
                        </span>
                      </td>
                      <td className="px-6 py-4 m3-label-large font-mono text-m3-primary font-medium">
                        ₹{bill.total_amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-6 py-4">
                        <button
                          onClick={() => handleDeleteBill(bill.bill_number)}
                          className="p-1.5 rounded-full text-m3-on-surface-variant hover:bg-m3-error/10 hover:text-m3-error transition-all"
                          title="Delete Bill"
                        >
                          <Trash2 size={16} />
                        </button>
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
