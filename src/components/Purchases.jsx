import { useAlert } from './AlertProvider';
import React, { useState, useEffect } from 'react';
import { 
  Search, 
  Download, 
  Filter, 
  Plus, 
  TrendingUp, 
  CreditCard,
  FileText,
  Trash2,
  X,
  Edit
} from 'lucide-react';

function useDebounce(value, delay) {
  const [debouncedValue, setDebouncedValue] = useState(value);
  useEffect(() => {
    const handler = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(handler);
  }, [value, delay]);
  return debouncedValue;
}

const formatDate = (dateStr) => {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length === 3 && parts[0].length === 4) {
    // YYYY-MM-DD to DD/MM/YYYY
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return dateStr;
};

export function Purchases({ theme }) {
  const { showAlert } = useAlert();
  const [purchases, setPurchases] = useState([]);
  const [availableProducts, setAvailableProducts] = useState([]);
  const [isPending, startTransition] = React.useTransition();
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  
  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPurchaseId, setEditingPurchaseId] = useState(null);
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [supplierName, setSupplierName] = useState('');
  const [supplierGst, setSupplierGst] = useState('');
  const [supplierState, setSupplierState] = useState('');
  const [isInterState, setIsInterState] = useState(false);
  
  // Items array for the purchase bill
  const [items, setItems] = useState([{ product_name: '', taxable_amount: '', tax_rate: 5 }]);

  useEffect(() => {
    fetchInitialData();
    fetchProducts();
  }, []);

  const fetchInitialData = async (isBackgroundRefresh = false) => {
    const isBg = isBackgroundRefresh === true;
    if (!isBg) setLoading(true);
    try {
      const data = await window.electron.ipcRenderer.invoke('get-purchases');
      startTransition(() => {
        setPurchases(data || []);
      });
    } catch (error) {
      console.error('Error fetching purchases:', error);
    } finally {
      if (!isBg) setLoading(false);
    }
  };

  const fetchProducts = async () => {
    try {
      const prods = await window.electron.ipcRenderer.invoke('get-products');
      setAvailableProducts(prods || []);
    } catch (error) {
      console.error('Error fetching products:', error);
    }
  };

  const handleFilter = async (isBackgroundRefresh = false) => {
    const isBg = isBackgroundRefresh === true;
    if (!isBg) setLoading(true);
    try {
      const data = await window.electron.ipcRenderer.invoke('get-purchases', startDate, endDate);
      startTransition(() => {
        setPurchases(data || []);
      });
    } catch (error) {
      console.error('Error filtering purchases:', error);
    } finally {
      if (!isBg) setLoading(false);
    }
  };

  const handleResetFilters = () => {
    setStartDate('');
    setEndDate('');
    fetchInitialData();
  };

  // Flattened purchases list for row-by-row item-level GSTR-2 audit display
  const flattenedPurchases = React.useMemo(() => {
    const rows = [];
    purchases.forEach(p => {
      const invoiceItems = p.items || [];
      if (invoiceItems.length > 0) {
        invoiceItems.forEach(item => {
          const taxable = item.taxable_amount;
          const rate = item.tax_rate;
          const taxAmount = item.tax_amount;
          const total = item.total_amount;
          
          const isInterState = !!p.is_inter_state;
          const igst = isInterState ? taxAmount : 0;
          const cgst = !isInterState ? taxAmount / 2 : 0;
          const sgst = !isInterState ? taxAmount / 2 : 0;

          rows.push({
            ...p,
            item_id: item.id,
            product_name: item.product_name,
            item_tax_rate: rate,
            item_taxable: taxable,
            item_tax_amount: taxAmount,
            item_total: total,
            igst,
            cgst,
            sgst
          });
        });
      } else {
        const taxable = p.taxable_amount ?? (p.total_amount - p.tax_amount);
        const rate = p.tax_rate;
        const taxAmount = p.tax_amount;
        const total = p.total_amount;
        
        const isInterState = !!p.is_inter_state;
        const igst = isInterState ? taxAmount : 0;
        const cgst = !isInterState ? taxAmount / 2 : 0;
        const sgst = !isInterState ? taxAmount / 2 : 0;

        rows.push({
          ...p,
          item_id: null,
          product_name: 'General Purchase',
          item_tax_rate: rate,
          item_taxable: taxable,
          item_tax_amount: taxAmount,
          item_total: total,
          igst,
          cgst,
          sgst
        });
      }
    });
    return rows;
  }, [purchases]);

  const debouncedSearch = useDebounce(searchTerm, 300);

  const filteredPurchases = React.useMemo(() => {
    return flattenedPurchases.filter(p =>
      p.invoice_number.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
      p.supplier_name.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
      p.supplier_gst?.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
      p.supplier_state?.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
      p.product_name.toLowerCase().includes(debouncedSearch.toLowerCase())
    );
  }, [flattenedPurchases, debouncedSearch]);

  const deferredPurchases = React.useDeferredValue(filteredPurchases);

  const handleAddItem = () => {
    setItems(prev => [...prev, { product_name: '', taxable_amount: '', tax_rate: 5 }]);
  };

  const handleRemoveItem = (index) => {
    if (items.length === 1) {
      showAlert('A purchase must have at least one product line.', 'warning');
      return;
    }
    setItems(prev => prev.filter((_, i) => i !== index));
  };

  const handleItemChange = (index, field, value) => {
    setItems(prev => prev.map((item, i) => {
      if (i === index) {
        return { ...item, [field]: value };
      }
      return item;
    }));
  };

  const modalTotals = React.useMemo(() => {
    return items.reduce((acc, item) => {
      const taxable = parseFloat(item.taxable_amount) || 0;
      const rate = parseFloat(item.tax_rate) || 0;
      const tax = taxable * (rate / 100);
      return {
        taxable: acc.taxable + taxable,
        tax: acc.tax + tax,
        total: acc.total + taxable + tax
      };
    }, { taxable: 0, tax: 0, total: 0 });
  }, [items]);

  const handleOpenAddModal = () => {
    setEditingPurchaseId(null);
    setInvoiceNumber('');
    setDate(new Date().toISOString().slice(0, 10));
    setSupplierName('');
    setSupplierGst('');
    setSupplierState('');
    setIsInterState(false);
    setItems([{ product_name: '', taxable_amount: '', tax_rate: 5 }]);
    setIsModalOpen(true);
  };

  const handleEditPurchase = (pur) => {
    setEditingPurchaseId(pur.id);
    setInvoiceNumber(pur.invoice_number);
    setDate(pur.date);
    setSupplierName(pur.supplier_name);
    setSupplierGst(pur.supplier_gst || '');
    setSupplierState(pur.supplier_state || '');
    setIsInterState(pur.is_inter_state === 1);
    
    if (pur.items && pur.items.length > 0) {
      setItems(pur.items.map(item => ({
        product_name: item.product_name,
        taxable_amount: item.taxable_amount.toString(),
        tax_rate: item.tax_rate
      })));
    } else {
      const taxableAmount = pur.taxable_amount ?? ((pur.total_amount || 0) - (pur.tax_amount || 0));
      setItems([{
        product_name: 'General Purchase',
        taxable_amount: taxableAmount.toString(),
        tax_rate: pur.tax_rate
      }]);
    }
    setIsModalOpen(true);
  };

  const handleAddPurchase = async (e) => {
    e.preventDefault();
    if (!invoiceNumber || !supplierName || !date) {
      showAlert('Please fill in all required fields.', 'warning');
      return;
    }

    // Validate and build items payload
    const formattedItems = [];
    for (const item of items) {
      if (!item.product_name.trim()) {
        showAlert('Product name is required for all lines.', 'warning');
        return;
      }
      const taxable = parseFloat(item.taxable_amount);
      if (isNaN(taxable) || taxable < 0) {
        showAlert(`Please enter a valid taxable amount for product: "${item.product_name}".`, 'warning');
        return;
      }
      formattedItems.push({
        product_name: item.product_name.trim(),
        taxable_amount: taxable,
        tax_rate: parseFloat(item.tax_rate)
      });
    }

    const purchasePayload = {
      id: editingPurchaseId || null,
      invoice_number: invoiceNumber.trim().toUpperCase(),
      date,
      supplier_name: supplierName.trim(),
      supplier_gst: supplierGst.trim().toUpperCase() || null,
      is_inter_state: isInterState ? 1 : 0,
      supplier_state: supplierState.trim() || 'N/A',
      created_by: 'Staff',
      items: formattedItems
    };

    try {
      const result = await window.electron.ipcRenderer.invoke('save-purchase', purchasePayload);
      if (result.success) {
        showAlert(editingPurchaseId ? '✅ Purchase updated successfully' : '✅ Purchase recorded successfully', 'success');
        setIsModalOpen(false);
        // Reset modal form states
        setEditingPurchaseId(null);
        setInvoiceNumber('');
        setSupplierName('');
        setSupplierGst('');
        setSupplierState('');
        setIsInterState(false);
        setItems([{ product_name: '', taxable_amount: '', tax_rate: 5 }]);
        // Refresh list
        fetchInitialData();
      } else {
        showAlert('❌ Failed to save purchase: ' + result.error, 'error');
      }
    } catch (error) {
      showAlert('❌ Error saving purchase: ' + error.message, 'error');
    }
  };

  const handleDeletePurchase = (id, invoiceNo) => {
    const reason = window.prompt(`Please enter the reason for deleting purchase invoice ${invoiceNo} (required for auditing):`);
    if (reason === null) return; // Cancelled
    if (!reason.trim()) {
      showAlert('A deletion reason is required for auditing purposes.', 'warning');
      return;
    }

    // Instant UI update
    startTransition(() => {
      setPurchases(prev => prev.filter(p => p.id !== id));
    });

    showAlert('Deleting...', 'info');

    window.electron.ipcRenderer.invoke('delete-purchase', id, 'Staff', reason.trim())
      .then(result => {
        if (result.success) {
          showAlert('✅ Purchase deleted successfully (Soft Deleted for Audit)', 'success');
        } else {
          showAlert('❌ Failed to delete purchase: ' + result.error, 'error');
          fetchInitialData();
        }
      })
      .catch(err => {
        showAlert('❌ Error deleting purchase: ' + err.message, 'error');
        fetchInitialData();
      });
  };

  const exportCSV = async () => {
    const headers = ['GSTIN/UIN', 'Supplier Name', 'Invoice No.', 'Invoice Date', 'Product Name', 'Rate', 'S TOTAL', 'IGST', 'CGST', 'SGST', 'Value', 'POS'];
    const rows = filteredPurchases.map(p => {
      return [
        p.supplier_gst || '',
        p.supplier_name || '',
        p.invoice_number,
        formatDate(p.date),
        p.product_name,
        p.item_tax_rate,
        p.item_taxable.toFixed(2),
        p.igst.toFixed(2),
        p.cgst.toFixed(2),
        p.sgst.toFixed(2),
        p.item_total.toFixed(2),
        p.supplier_state || ''
      ].map(val => `"${val}"`).join(',');
    });

    const csvContent = "\uFEFF" + [headers.join(','), ...rows].join('\n');
    const filename = `Purchase_Audit_Report_${startDate || 'All'}_to_${endDate || 'Now'}.csv`;
    
    const result = await window.electron.ipcRenderer.invoke('export-to-csv', csvContent, filename);
    if (result) {
      showAlert(`Report exported to: ${result}`, 'info');
    }
  };

  const totals = React.useMemo(() => {
    return filteredPurchases.reduce((acc, p) => {
      return {
        taxable: acc.taxable + p.item_taxable,
        tax: acc.tax + p.item_tax_amount,
        total: acc.total + p.item_total
      };
    }, { taxable: 0, tax: 0, total: 0 });
  }, [filteredPurchases]);

  const inputBase = "w-full rounded-md px-4 py-2.5 m3-body-medium bg-m3-surface-container-highest border border-m3-outline-variant text-m3-on-surface placeholder:text-m3-on-surface-variant/50 focus:border-m3-primary focus:ring-2 focus:ring-m3-primary/20 outline-none transition-all";
  const labelBase = "m3-label-medium text-m3-on-surface-variant mb-1.5 block";

  return (
    <div className="space-y-6 animate-in fade-in duration-500 font-sans">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="m3-headline-small font-display text-m3-on-surface">Purchase Audit Report</h1>
          <p className="m3-body-medium text-m3-on-surface-variant">Log supplier invoices & track Input Tax Credit (ITC)</p>
        </div>
        
        <div className="flex gap-2">
          <button
            onClick={handleOpenAddModal}
            className="flex items-center gap-2 px-5 py-3 rounded-full m3-label-large bg-m3-primary-container text-m3-on-primary-container hover:shadow-m3-1 active:scale-[0.98] transition-all"
          >
            <Plus size={18} />
            Add Purchase
          </button>
          
          <button
            onClick={exportCSV}
            className="flex items-center gap-2 px-5 py-3 rounded-full m3-label-large bg-m3-primary text-m3-on-primary hover:shadow-m3-1 active:scale-[0.98] transition-all"
          >
            <Download size={18} />
            Export CSV
          </button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { label: 'Total Taxable Value (S TOTAL)', value: totals.taxable, icon: TrendingUp, accent: 'bg-m3-primary-container text-m3-on-primary-container' },
          { label: 'Total Input GST (ITC)', value: totals.tax, icon: CreditCard, accent: 'bg-m3-secondary-container text-m3-on-secondary-container' },
          { label: 'Grand Total Value', value: totals.total, icon: FileText, accent: 'bg-m3-tertiary-container text-m3-on-tertiary-container' },
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
            <label className={labelBase}>Search Purchases</label>
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-m3-on-surface-variant" size={18} />
              <input
                type="text"
                placeholder="Invoice, Supplier, Product, GST..."
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

          <div className="flex gap-2">
            <button
              onClick={() => handleFilter(false)}
              className="flex items-center gap-2 px-5 py-3 rounded-full m3-label-large bg-m3-secondary-container text-m3-on-secondary-container hover:bg-m3-surface-container-high transition-all"
            >
              <Filter size={16} />
              Apply
            </button>
            <button
              onClick={handleResetFilters}
              className="px-5 py-3 rounded-full m3-label-large border border-m3-outline text-m3-on-surface-variant hover:bg-m3-surface-container-high transition-all"
            >
              Reset
            </button>
          </div>
        </div>
      </div>

      {/* Data Table */}
      <div className="rounded-xl border border-m3-outline-variant bg-m3-surface-container-lowest overflow-hidden">
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-m3-surface-container border-b border-m3-outline-variant">
                {['GSTIN/UIN', 'Supplier Name', 'Invoice No.', 'Invoice Date', 'Product Name', 'Rate', 'S TOTAL', 'IGST', 'CGST', 'SGST', 'Value', 'POS', 'Action'].map((label, i) => (
                  <th key={i} className="px-6 py-3.5 m3-label-medium text-m3-on-surface-variant whitespace-nowrap">
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-m3-outline-variant/50">
              {loading ? (
                <tr>
                  <td colSpan="13" className="px-6 py-16 text-center">
                    <div className="flex flex-col items-center gap-4">
                      <div className="w-10 h-10 rounded-full border-3 border-m3-primary/30 border-t-m3-primary animate-spin"></div>
                      <p className="m3-body-medium text-m3-on-surface-variant">Loading Data...</p>
                    </div>
                  </td>
                </tr>
              ) : deferredPurchases.length === 0 ? (
                <tr>
                  <td colSpan="13" className="px-6 py-16 text-center">
                    <p className="m3-body-large text-m3-on-surface-variant/50">No purchase records found</p>
                  </td>
                </tr>
              ) : (
                deferredPurchases.map((pur, index) => {
                  return (
                    <tr key={`${pur.id}-${pur.item_id || index}`} className="hover:bg-m3-surface-container-low transition-colors">
                      <td className="px-6 py-4 m3-body-small font-mono text-m3-on-surface-variant">
                        {pur.supplier_gst || 'N/A'}
                      </td>
                      <td className="px-6 py-4 m3-body-medium text-m3-on-surface max-w-[180px] truncate" title={pur.supplier_name}>
                        {pur.supplier_name}
                      </td>
                      <td className="px-6 py-4 m3-label-large font-mono text-m3-on-surface">{pur.invoice_number}</td>
                      <td className="px-6 py-4 m3-body-medium text-m3-on-surface whitespace-nowrap">{formatDate(pur.date)}</td>
                      <td className="px-6 py-4 m3-body-medium text-m3-on-surface font-medium max-w-[150px] truncate" title={pur.product_name}>
                        {pur.product_name}
                      </td>
                      <td className="px-6 py-4 m3-body-medium text-m3-on-surface whitespace-nowrap">{pur.item_tax_rate}%</td>
                      <td className="px-6 py-4 m3-label-large font-mono text-m3-on-surface">
                        ₹{pur.item_taxable.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className="px-6 py-4 m3-body-medium font-mono text-m3-on-surface">
                        {pur.igst > 0 ? `₹${pur.igst.toFixed(2)}` : '0.00'}
                      </td>
                      <td className="px-6 py-4 m3-body-medium font-mono text-m3-on-surface">
                        {pur.cgst > 0 ? `₹${pur.cgst.toFixed(2)}` : '0.00'}
                      </td>
                      <td className="px-6 py-4 m3-body-medium font-mono text-m3-on-surface">
                        {pur.sgst > 0 ? `₹${pur.sgst.toFixed(2)}` : '0.00'}
                      </td>
                      <td className="px-6 py-4 m3-label-large font-mono text-m3-primary font-semibold">
                        ₹{pur.item_total.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className="px-6 py-4 m3-body-medium text-m3-on-surface-variant whitespace-nowrap">
                        {pur.supplier_state || 'N/A'}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleEditPurchase(pur)}
                            className="p-1.5 rounded-full text-m3-on-surface-variant hover:bg-m3-primary/10 hover:text-m3-primary transition-all"
                            title="Edit Purchase Record"
                          >
                            <Edit size={16} />
                          </button>
                          <button
                            onClick={() => handleDeletePurchase(pur.id, pur.invoice_number)}
                            className="p-1.5 rounded-full text-m3-on-surface-variant hover:bg-m3-error/10 hover:text-m3-error transition-all"
                            title="Delete Purchase Record"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Purchase Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="w-full max-w-2xl mx-4 bg-m3-surface-container-lowest rounded-2xl border border-m3-outline-variant overflow-hidden shadow-m3-3 flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 bg-m3-surface-container flex items-center justify-between border-b border-m3-outline-variant">
              <div>
                <h3 className="m3-title-medium text-m3-on-surface">
                  {editingPurchaseId ? 'Edit Supplier Purchase' : 'Record Supplier Purchase'}
                </h3>
                <p className="m3-body-small text-m3-on-surface-variant">Add details for input GST tax credits</p>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-2 rounded-full text-m3-on-surface-variant hover:bg-m3-surface-container-high transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleAddPurchase} className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelBase}>Invoice No. *</label>
                  <input
                    type="text"
                    required
                    value={invoiceNumber}
                    onChange={(e) => setInvoiceNumber(e.target.value)}
                    className={inputBase}
                    placeholder="e.g. PUR-001"
                  />
                </div>
                <div>
                  <label className={labelBase}>Invoice Date *</label>
                  <input
                    type="date"
                    required
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className={inputBase}
                  />
                </div>
              </div>

              <div>
                <label className={labelBase}>Supplier Name *</label>
                <input
                  type="text"
                  required
                  value={supplierName}
                  onChange={(e) => setSupplierName(e.target.value)}
                  className={inputBase}
                  placeholder="Company or Supplier Name"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelBase}>Supplier GSTIN</label>
                  <input
                    type="text"
                    maxLength={15}
                    value={supplierGst}
                    onChange={(e) => setSupplierGst(e.target.value.toUpperCase())}
                    className={`${inputBase} font-mono uppercase`}
                    placeholder="15-digit GSTIN"
                  />
                </div>
                <div>
                  <label className={labelBase}>Supplier State / POS</label>
                  <input
                    type="text"
                    value={supplierState}
                    onChange={(e) => setSupplierState(e.target.value)}
                    className={inputBase}
                    placeholder="e.g. Tamil Nadu"
                  />
                </div>
              </div>

              <div className="pt-2">
                <label className="flex items-center gap-2 cursor-pointer bg-m3-surface-container-low p-3 rounded-lg border border-m3-outline-variant/50 hover:bg-m3-surface-container-high transition-colors">
                  <input
                    type="checkbox"
                    checked={isInterState}
                    onChange={(e) => setIsInterState(e.target.checked)}
                    className="w-4 h-4 text-m3-primary border-m3-outline focus:ring-m3-primary/30"
                  />
                  <span className="m3-body-medium text-m3-on-surface">Is Interstate (IGST applies instead of CGST+SGST)</span>
                </label>
              </div>

              {/* Purchase Items Section */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between border-b border-m3-outline-variant pb-2">
                  <span className="m3-title-small text-m3-on-surface font-semibold">Purchase Items *</span>
                  <button
                    type="button"
                    onClick={handleAddItem}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full m3-label-medium bg-m3-primary-container text-m3-on-primary-container hover:shadow-m3-1 active:scale-[0.98] transition-all"
                  >
                    <Plus size={14} />
                    Add Product Line
                  </button>
                </div>
                
                <div className="space-y-3 max-h-[30vh] overflow-y-auto pr-1 custom-scrollbar">
                  {items.map((item, idx) => {
                    const taxable = parseFloat(item.taxable_amount) || 0;
                    const rate = parseFloat(item.tax_rate) || 0;
                    const tax = taxable * (rate / 100);
                    const total = taxable + tax;

                    return (
                      <div key={idx} className="flex gap-2.5 items-end bg-m3-surface-container-low p-3 rounded-lg border border-m3-outline-variant/40 relative group">
                        <div className="flex-1">
                          <label className="m3-label-small text-m3-on-surface-variant block mb-1">Product Name *</label>
                          <input
                            type="text"
                            required
                            list="products-list"
                            value={item.product_name}
                            onChange={(e) => handleItemChange(idx, 'product_name', e.target.value)}
                            className="w-full rounded bg-m3-surface-container-highest border border-m3-outline-variant px-2.5 py-1.5 m3-body-medium text-m3-on-surface outline-none focus:border-m3-primary transition-all"
                            placeholder="e.g. Cotton fabric"
                          />
                        </div>
                        
                        <div className="w-[110px]">
                          <label className="m3-label-small text-m3-on-surface-variant block mb-1">S TOTAL (₹) *</label>
                          <input
                            type="number"
                            step="0.01"
                            required
                            value={item.taxable_amount}
                            onChange={(e) => handleItemChange(idx, 'taxable_amount', e.target.value)}
                            className="w-full rounded bg-m3-surface-container-highest border border-m3-outline-variant px-2.5 py-1.5 m3-body-medium font-mono text-m3-on-surface outline-none focus:border-m3-primary transition-all"
                            placeholder="Taxable"
                          />
                        </div>

                        <div className="w-[95px]">
                          <label className="m3-label-small text-m3-on-surface-variant block mb-1">GST Rate (%)</label>
                          <input
                            type="number"
                            step="0.01"
                            required
                            value={item.tax_rate}
                            onChange={(e) => handleItemChange(idx, 'tax_rate', e.target.value)}
                            className="w-full rounded bg-m3-surface-container-highest border border-m3-outline-variant px-2.5 py-1.5 m3-body-medium font-mono text-m3-on-surface outline-none focus:border-m3-primary transition-all"
                            placeholder="Rate %"
                          />
                        </div>

                        <div className="w-[100px] pb-2 text-right">
                          <span className="m3-label-small text-m3-on-surface-variant block mb-0.5">Incl. GST</span>
                          <span className="m3-body-small font-mono text-m3-primary font-medium">₹{total.toFixed(2)}</span>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleRemoveItem(idx)}
                          className="p-2 mb-0.5 rounded text-m3-on-surface-variant hover:bg-m3-error/10 hover:text-m3-error transition-colors"
                          title="Remove Item Line"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    );
                  })}
                </div>
                
                {/* Dynamically calculated bill summary box */}
                <div className="bg-m3-surface-container p-3 rounded-lg border border-m3-outline-variant flex items-center justify-between text-m3-on-surface">
                  <div className="flex gap-4">
                    <div>
                      <span className="m3-label-small text-m3-on-surface-variant block">Subtotal (S TOTAL)</span>
                      <span className="m3-body-medium font-mono font-medium">₹{modalTotals.taxable.toFixed(2)}</span>
                    </div>
                    <div>
                      <span className="m3-label-small text-m3-on-surface-variant block">Total Tax ({isInterState ? 'IGST' : 'CGST+SGST'})</span>
                      <span className="m3-body-medium font-mono font-medium">₹{modalTotals.tax.toFixed(2)}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="m3-label-small text-m3-on-surface-variant block">Total Bill Value</span>
                    <span className="m3-title-medium font-mono text-m3-primary font-bold">₹{modalTotals.total.toFixed(2)}</span>
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-m3-outline-variant flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-5 py-2.5 rounded-full m3-label-large border border-m3-outline text-m3-on-surface-variant hover:bg-m3-surface-container-high transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-full m3-label-large bg-m3-primary text-m3-on-primary hover:shadow-m3-1 active:scale-[0.98] transition-all"
                >
                  {editingPurchaseId ? 'Update Record' : 'Save Record'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Auto-complete Products List Datalist */}
      <datalist id="products-list">
        {availableProducts.map(p => (
          <option key={p.id} value={p.name} />
        ))}
      </datalist>
    </div>
  );
}

export default Purchases;
