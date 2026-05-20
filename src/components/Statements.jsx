import React, { useState, useEffect, useMemo } from 'react';
import { useStore } from '../store';
import { toast } from 'sonner';
import { 
  FileText, Plus, Printer, Search, CreditCard, Filter, ArrowUpRight, ArrowDownLeft, X, Calendar as CalendarIcon, User, ChevronDown, ChevronRight, Receipt, ArrowLeft
} from 'lucide-react';

export default function Statements() {
  const { parties, refreshParties } = useStore();
  const [selectedPartyId, setSelectedPartyId] = useState('');
  const [statementData, setStatementData] = useState(null);
  const [globalBills, setGlobalBills] = useState([]);
  const [globalSearch, setGlobalSearch] = useState('');
  const [globalFilter, setGlobalFilter] = useState('pending'); // all, paid, pending
  const [isLoading, setIsLoading] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [expandedBills, setExpandedBills] = useState({});
  
  // Payment Modal State
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMode, setPaymentMode] = useState('Cash');
  const [paymentType, setPaymentType] = useState('bill_payment'); // advance, bill_payment
  const [selectedBillId, setSelectedBillId] = useState('');
  const [referenceNo, setReferenceNo] = useState('');
  const [paymentRemarks, setPaymentRemarks] = useState('');
  
  // Filters
  const [dateFilter, setDateFilter] = useState('all'); 
  const [statusFilter, setStatusFilter] = useState('all'); // all, pending, paid, advances
  
  useEffect(() => {
    if (selectedPartyId) {
      loadStatement(selectedPartyId);
    } else {
      setStatementData(null);
      loadGlobalStatements();
    }
  }, [selectedPartyId]);

  const loadGlobalStatements = async () => {
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

  const loadStatement = async (partyId) => {
    setIsLoading(true);
    try {
      const result = await window.electron.ipcRenderer.invoke('get-party-statement', partyId);
      if (result.success) {
        setStatementData(result);
      } else {
        toast.error('Failed to load statement: ' + result.error);
      }
    } catch (error) {
      toast.error('Failed to load statement');
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleBillExpand = (billId) => {
    setExpandedBills(prev => ({
      ...prev,
      [billId]: !prev[billId]
    }));
  };

  const handleSavePayment = async (e) => {
    e.preventDefault();
    if (!paymentDate || !paymentAmount) {
      toast.error('Please fill all required fields');
      return;
    }
    
    const payload = {
      party_id: Number(selectedPartyId),
      bill_id: selectedBillId ? Number(selectedBillId) : null,
      amount: Number(paymentAmount),
      payment_mode: paymentMode,
      payment_type: paymentType,
      payment_date: paymentDate,
      reference_no: referenceNo,
      remarks: paymentRemarks
    };

    try {
      const result = await window.electron.ipcRenderer.invoke('save-payment', payload);
      if (result.success !== false) {
        toast.success('Payment added successfully');
        setShowPaymentModal(false);
        setPaymentAmount('');
        setReferenceNo('');
        setPaymentRemarks('');
        setSelectedBillId('');
        loadStatement(selectedPartyId);
        refreshParties();
      } else {
        toast.error('Failed to save payment: ' + result.error);
      }
    } catch (error) {
      toast.error('Failed to save payment: ' + error.message);
    }
  };

  const handleDeletePayment = async (id) => {
    if (!window.confirm('Are you sure you want to delete this payment?')) return;
    
    try {
      const result = await window.electron.ipcRenderer.invoke('delete-payment', id);
      if (result.success) {
        toast.success('Payment deleted');
        loadStatement(selectedPartyId);
        refreshParties();
      } else {
        toast.error('Failed to delete payment');
      }
    } catch (error) {
      toast.error('Error deleting payment');
    }
  };

  const handlePrintStatement = async () => {
    if (!selectedPartyId) return;
    try {
      const result = await window.electron.ipcRenderer.invoke('print-party-statement', Number(selectedPartyId), null, null);
      if (result.success) {
        toast.success('Statement generated and opened');
      } else {
        toast.error('Failed to generate statement: ' + result.error);
      }
    } catch (error) {
      toast.error('Error generating statement');
    }
  };

  const handlePrintReceipt = async (paymentId) => {
    try {
      const result = await window.electron.ipcRenderer.invoke('print-payment-receipt', paymentId);
      if (result.success) {
        toast.success('Receipt generated');
      } else {
        toast.error('Failed to generate receipt: ' + result.error);
      }
    } catch (error) {
      toast.error('Error generating receipt');
    }
  };

  // Processing Data for the Bill-Centric Ledger View
  const processedData = useMemo(() => {
    if (!statementData || !statementData.bills) return null;
    
    let totalBilled = 0;
    let totalPaid = 0;
    const openingBal = statementData.party.opening_balance || 0;
    
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    // 1. Process Bills
    const processedBills = statementData.bills.map(b => {
      totalBilled += b.debit;
      return { ...b, item_type: 'BILL' };
    });

    // 2. Process Advances (Payments without a bill_id)
    // We also calculate totalPaid here across ALL payments (including linked ones)
    const advances = [];
    const allPayments = statementData.transactions.filter(t => t.type === 'PAYMENT');
    allPayments.forEach(p => {
      totalPaid += p.credit;
      if (!p.bill_id) {
        advances.push({ ...p, item_type: 'ADVANCE' });
      }
    });

    // Combine for display
    let displayList = [...processedBills, ...advances];

    // Apply Date Filter
    displayList = displayList.filter(item => {
      if (dateFilter === 'all') return true;
      const d = new Date(item.entry_date);
      if (dateFilter === 'this_month') {
        return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
      }
      if (dateFilter === 'last_month') {
        let lm = currentMonth - 1;
        let ly = currentYear;
        if (lm < 0) { lm = 11; ly--; }
        return d.getMonth() === lm && d.getFullYear() === ly;
      }
      if (dateFilter === 'this_year') {
        return d.getFullYear() === currentYear;
      }
      return true;
    });

    // Apply Status Filter
    displayList = displayList.filter(item => {
      if (statusFilter === 'all') return true;
      if (statusFilter === 'advances') return item.item_type === 'ADVANCE';
      if (item.item_type === 'BILL') {
        if (statusFilter === 'pending') return item.pending > 0;
        if (statusFilter === 'paid') return item.pending <= 0;
      }
      return false; // hide advances if filtering by paid/pending
    });

    // Sort by Date
    displayList.sort((a, b) => new Date(a.entry_date).getTime() - new Date(b.entry_date).getTime());

    // Calculate closing balance properly (Opening + Bills - Payments)
    const closingBal = openingBal + totalBilled - totalPaid;

    return {
      openingBal,
      totalBilled,
      totalPaid,
      closingBal,
      displayList,
      pendingBills: statementData.bills.filter(b => b.pending > 0)
    };
  }, [statementData, dateFilter, statusFilter]);

  const getPaymentColor = (mode) => {
    switch(mode.toLowerCase()) {
      case 'cash': return 'bg-green-100 text-green-800 border-green-200';
      case 'online': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'cheque': return 'bg-orange-100 text-orange-800 border-orange-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  return (
    <div className="w-full mx-auto space-y-6 pb-20">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-3">
          {selectedPartyId && (
            <button 
              onClick={() => setSelectedPartyId('')}
              className="p-2 -ml-2 rounded-full hover:bg-m3-surface-container transition-colors text-m3-on-surface-variant"
              title="Back to Directory"
            >
              <ArrowLeft size={24} />
            </button>
          )}
          <div>
            <h1 className="text-2xl font-bold font-display text-m3-on-surface">Party Ledger & Payments</h1>
            <p className="text-m3-on-surface-variant text-sm mt-1">Invoice-level settlement tracking</p>
          </div>
        </div>
        
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="relative w-full sm:w-64">
            <User className="absolute left-3 top-1/2 -translate-y-1/2 text-m3-on-surface-variant w-4 h-4" />
            <select
              value={selectedPartyId}
              onChange={(e) => setSelectedPartyId(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-m3-surface-container border border-m3-outline-variant rounded-xl text-m3-on-surface focus:outline-none focus:ring-2 focus:ring-m3-primary appearance-none cursor-pointer"
            >
              <option value="">Select a Party...</option>
              {parties.map(p => (
                <option key={p.id} value={p.id}>{p.name} - {p.short_name}</option>
              ))}
            </select>
          </div>
          
          <button
            onClick={() => setShowPaymentModal(true)}
            disabled={!selectedPartyId}
            className="flex items-center gap-2 px-4 py-2 bg-m3-primary text-m3-on-primary rounded-xl font-medium hover:bg-m3-primary/90 transition-colors disabled:opacity-50"
          >
            <Plus size={18} />
            <span>Receive Payment</span>
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-m3-primary"></div>
        </div>
      ) : !selectedPartyId ? (
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
      ) : processedData ? (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-4 bg-m3-surface-container-low border border-m3-outline-variant rounded-2xl relative overflow-hidden">
              <p className="text-m3-on-surface-variant text-sm font-medium">Opening Balance</p>
              <p className="text-2xl font-bold font-display text-m3-on-surface mt-1">₹ {processedData.openingBal.toLocaleString('en-IN', {minimumFractionDigits: 2})}</p>
            </div>
            <div className="p-4 bg-m3-surface-container-low border border-m3-outline-variant rounded-2xl relative overflow-hidden">
              <p className="text-m3-on-surface-variant text-sm font-medium">Total Billed</p>
              <p className="text-2xl font-bold font-display text-red-500 mt-1">₹ {processedData.totalBilled.toLocaleString('en-IN', {minimumFractionDigits: 2})}</p>
            </div>
            <div className="p-4 bg-m3-surface-container-low border border-m3-outline-variant rounded-2xl relative overflow-hidden">
              <p className="text-m3-on-surface-variant text-sm font-medium">Total Received</p>
              <p className="text-2xl font-bold font-display text-green-500 mt-1">₹ {processedData.totalPaid.toLocaleString('en-IN', {minimumFractionDigits: 2})}</p>
            </div>
            <div className="p-4 bg-m3-primary-container border border-m3-primary/20 rounded-2xl relative overflow-hidden shadow-m3-1">
              <p className="text-m3-on-primary-container/80 text-sm font-medium">Net Outstanding</p>
              <p className="text-2xl font-bold font-display text-m3-on-primary-container mt-1">₹ {processedData.closingBal.toLocaleString('en-IN', {minimumFractionDigits: 2})}</p>
            </div>
          </div>

          {/* Statement Toolbar */}
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4 bg-m3-surface-container-low p-3 rounded-2xl border border-m3-outline-variant">
            <div className="flex items-center gap-4 w-full sm:w-auto">
              <div className="flex items-center gap-2">
                <CalendarIcon size={16} className="text-m3-on-surface-variant" />
                <select
                  value={dateFilter}
                  onChange={(e) => setDateFilter(e.target.value)}
                  className="bg-transparent text-m3-on-surface text-sm font-medium focus:outline-none cursor-pointer"
                >
                  <option value="all">All Time</option>
                  <option value="this_month">This Month</option>
                  <option value="last_month">Last Month</option>
                  <option value="this_year">This Year</option>
                </select>
              </div>
              <div className="w-px h-4 bg-m3-outline-variant"></div>
              <div className="flex items-center gap-2">
                <Filter size={16} className="text-m3-on-surface-variant" />
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="bg-transparent text-m3-on-surface text-sm font-medium focus:outline-none cursor-pointer"
                >
                  <option value="all">All Statuses</option>
                  <option value="pending">Pending Bills</option>
                  <option value="paid">Fully Paid Bills</option>
                  <option value="advances">Advances Only</option>
                </select>
              </div>
            </div>
            
            <button
              onClick={handlePrintStatement}
              className="flex items-center gap-2 px-4 py-2 bg-m3-surface-container-high text-m3-on-surface rounded-xl hover:bg-m3-surface-container-highest transition-colors font-medium border border-m3-outline-variant"
            >
              <Printer size={18} />
              <span>Print Ledger</span>
            </button>
          </div>

          {/* Bill-Centric Ledger Table */}
          <div className="bg-m3-surface border border-m3-outline-variant rounded-2xl overflow-hidden shadow-m3-1">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-m3-surface-container-low border-b border-m3-outline-variant m3-label-medium text-m3-on-surface-variant">
                    <th className="px-6 py-4 font-medium w-10"></th>
                    <th className="px-4 py-4 font-medium">Date</th>
                    <th className="px-4 py-4 font-medium">Particulars</th>
                    <th className="px-4 py-4 font-medium text-right">Billed Amount</th>
                    <th className="px-4 py-4 font-medium text-right">Paid Amount</th>
                    <th className="px-4 py-4 font-medium text-right">Pending</th>
                    <th className="px-6 py-4 font-medium text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-m3-outline-variant">
                  {processedData.displayList.length === 0 ? (
                    <tr>
                      <td colSpan="7" className="px-6 py-8 text-center text-m3-on-surface-variant">
                        No records found for the selected filters.
                      </td>
                    </tr>
                  ) : (
                    processedData.displayList.map((item, idx) => (
                      <React.Fragment key={`${item.item_type}-${item.id}`}>
                        {/* Main Row */}
                        <tr className={`hover:bg-m3-surface-container-lowest transition-colors ${item.item_type === 'BILL' ? 'cursor-pointer' : ''}`}
                            onClick={() => item.item_type === 'BILL' && toggleBillExpand(item.id)}>
                          <td className="px-6 py-4 text-m3-on-surface-variant">
                            {item.item_type === 'BILL' && item.linkedPayments && item.linkedPayments.length > 0 && (
                              expandedBills[item.id] ? <ChevronDown size={18} /> : <ChevronRight size={18} />
                            )}
                          </td>
                          <td className="px-4 py-4 whitespace-nowrap text-sm text-m3-on-surface">
                            {new Date(item.entry_date).toLocaleDateString('en-IN')}
                          </td>
                          <td className="px-4 py-4">
                            <div className="flex items-center gap-2">
                              {item.item_type === 'BILL' ? (
                                <>
                                  <ArrowUpRight size={16} className="text-red-500" />
                                  <span className="font-semibold text-m3-on-surface">Bill #{item.bill_number}</span>
                                  {item.pending <= 0 ? (
                                    <span className="text-[10px] uppercase font-bold bg-green-100 text-green-700 px-2 py-0.5 rounded ml-2">Paid</span>
                                  ) : item.paid > 0 ? (
                                    <span className="text-[10px] uppercase font-bold bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded ml-2">Partial</span>
                                  ) : null}
                                </>
                              ) : (
                                <>
                                  <ArrowDownLeft size={16} className="text-blue-500" />
                                  <span className="font-semibold text-blue-600">Advance Payment</span>
                                  <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded ml-2 border ${getPaymentColor(item.payment_mode)}`}>
                                    {item.payment_mode}
                                  </span>
                                </>
                              )}
                            </div>
                            {item.item_type === 'ADVANCE' && (item.reference_no || item.remarks) && (
                              <p className="text-xs text-m3-on-surface-variant mt-1 ml-6">
                                Ref: {item.reference_no} {item.remarks ? `(${item.remarks})` : ''}
                              </p>
                            )}
                          </td>
                          <td className="px-4 py-4 text-right text-sm font-medium text-red-500">
                            {item.item_type === 'BILL' ? `₹ ${item.debit.toFixed(2)}` : '-'}
                          </td>
                          <td className="px-4 py-4 text-right text-sm font-medium text-green-600">
                            {item.item_type === 'BILL' ? (item.paid > 0 ? `₹ ${item.paid.toFixed(2)}` : '-') : `₹ ${item.credit.toFixed(2)}`}
                          </td>
                          <td className="px-4 py-4 text-right text-sm font-bold text-m3-on-surface">
                            {item.item_type === 'BILL' ? `₹ ${item.pending.toFixed(2)}` : '-'}
                          </td>
                          <td className="px-6 py-4 text-center flex justify-center items-center gap-2">
                            {item.item_type === 'ADVANCE' && (
                              <>
                                <button
                                  onClick={(e) => { e.stopPropagation(); handlePrintReceipt(item.id); }}
                                  className="text-blue-600 hover:bg-blue-50 p-1.5 rounded-lg transition-colors flex items-center gap-1"
                                  title="Print Receipt"
                                >
                                  <Receipt size={16} />
                                </button>
                                <button
                                  onClick={(e) => { e.stopPropagation(); handleDeletePayment(item.id); }}
                                  className="text-red-500 hover:bg-red-50 p-1.5 rounded-lg transition-colors"
                                  title="Delete Advance"
                                >
                                  <X size={16} />
                                </button>
                              </>
                            )}
                          </td>
                        </tr>

                        {/* Expanded Linked Payments Row */}
                        {item.item_type === 'BILL' && expandedBills[item.id] && item.linkedPayments && item.linkedPayments.length > 0 && (
                          <tr className="bg-m3-surface-container-lowest/50">
                            <td colSpan="7" className="p-0">
                              <div className="pl-16 pr-6 py-3 border-l-2 border-m3-primary ml-8 my-2 rounded-r-xl bg-m3-surface-container-low/30 shadow-inner">
                                <p className="text-xs font-medium text-m3-on-surface-variant uppercase tracking-wider mb-2">Linked Payments</p>
                                <table className="w-full text-sm">
                                  <tbody>
                                    {item.linkedPayments.map(p => (
                                      <tr key={p.id} className="border-b border-m3-outline-variant/30 last:border-0">
                                        <td className="py-2 text-m3-on-surface-variant w-28">
                                          {new Date(p.entry_date).toLocaleDateString('en-IN')}
                                        </td>
                                        <td className="py-2">
                                          <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded mr-2 border ${getPaymentColor(p.payment_mode)}`}>
                                            {p.payment_mode}
                                          </span>
                                          {p.reference_no && <span className="text-m3-on-surface-variant">Ref: {p.reference_no}</span>}
                                        </td>
                                        <td className="py-2 text-right font-medium text-green-600">
                                          ₹ {p.credit.toFixed(2)}
                                        </td>
                                        <td className="py-2 text-right w-24">
                                          <button
                                            onClick={() => handlePrintReceipt(p.id)}
                                            className="text-blue-600 hover:bg-blue-50 p-1 rounded-md transition-colors mr-2"
                                            title="Print Receipt"
                                          >
                                            <Receipt size={14} />
                                          </button>
                                          <button
                                            onClick={() => handleDeletePayment(p.id)}
                                            className="text-red-500 hover:bg-red-50 p-1 rounded-md transition-colors"
                                            title="Delete Payment"
                                          >
                                            <X size={14} />
                                          </button>
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : null}

      {/* Add Payment Modal */}
      {showPaymentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-m3-surface rounded-3xl shadow-m3-3 w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center px-6 py-4 border-b border-m3-outline-variant">
              <h2 className="text-xl font-display font-semibold text-m3-on-surface">Receive Payment</h2>
              <button
                onClick={() => setShowPaymentModal(false)}
                className="p-2 hover:bg-m3-surface-container rounded-full transition-colors text-m3-on-surface-variant"
              >
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleSavePayment} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-m3-on-surface-variant mb-1">Date</label>
                <input
                  type="date"
                  required
                  value={paymentDate}
                  onChange={(e) => setPaymentDate(e.target.value)}
                  className="w-full px-4 py-2.5 bg-m3-surface-container border border-m3-outline-variant rounded-xl focus:ring-2 focus:ring-m3-primary focus:border-m3-primary transition-all text-m3-on-surface"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-m3-on-surface-variant mb-1">Settle Against Bill</label>
                <select
                  value={selectedBillId}
                  onChange={(e) => {
                    setSelectedBillId(e.target.value);
                    // Auto-fill amount if bill is selected
                    if (e.target.value && processedData) {
                      const bill = processedData.pendingBills.find(b => b.id.toString() === e.target.value);
                      if (bill) setPaymentAmount(bill.pending.toString());
                    }
                  }}
                  className="w-full px-4 py-2.5 bg-m3-surface-container border border-m3-outline-variant rounded-xl focus:ring-2 focus:ring-m3-primary focus:border-m3-primary transition-all text-m3-on-surface appearance-none"
                >
                  <option value="">General Advance (No Specific Bill)</option>
                  {processedData?.pendingBills.map(b => (
                    <option key={b.id} value={b.id}>
                      Bill #{b.bill_number} - Pending: ₹{b.pending.toFixed(2)}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-m3-on-surface-variant mb-1">Amount (₹)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  required
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  className="w-full px-4 py-3 bg-m3-surface-container border border-m3-outline-variant rounded-xl focus:ring-2 focus:ring-m3-primary focus:border-m3-primary transition-all text-m3-on-surface text-lg font-bold"
                  placeholder="0.00"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-m3-on-surface-variant mb-1">Payment Mode</label>
                <div className="grid grid-cols-3 gap-2">
                  {['Cash', 'Online', 'Cheque'].map((mode) => (
                    <label
                      key={mode}
                      className={`flex items-center justify-center p-2 rounded-xl border cursor-pointer transition-all text-sm ${
                        paymentMode === mode
                          ? 'border-m3-primary bg-m3-primary-container text-m3-on-primary-container font-medium'
                          : 'border-m3-outline-variant hover:border-m3-primary/50 text-m3-on-surface-variant'
                      }`}
                    >
                      <input
                        type="radio"
                        name="paymentMode"
                        value={mode}
                        checked={paymentMode === mode}
                        onChange={(e) => setPaymentMode(e.target.value)}
                        className="sr-only"
                      />
                      {mode}
                    </label>
                  ))}
                </div>
              </div>

              {paymentMode !== 'Cash' && (
                <div>
                  <label className="block text-sm font-medium text-m3-on-surface-variant mb-1">
                    {paymentMode === 'Cheque' ? 'Cheque Number' : 'Reference / UTR Number'}
                  </label>
                  <input
                    type="text"
                    required
                    value={referenceNo}
                    onChange={(e) => setReferenceNo(e.target.value)}
                    placeholder={`Enter ${paymentMode} ref no...`}
                    className="w-full px-4 py-2.5 bg-m3-surface-container border border-m3-outline-variant rounded-xl focus:ring-2 focus:ring-m3-primary focus:border-m3-primary transition-all text-m3-on-surface"
                  />
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-m3-on-surface-variant mb-1">Remarks (Optional)</label>
                <input
                  type="text"
                  value={paymentRemarks}
                  onChange={(e) => setPaymentRemarks(e.target.value)}
                  placeholder="Additional notes"
                  className="w-full px-4 py-2.5 bg-m3-surface-container border border-m3-outline-variant rounded-xl focus:ring-2 focus:ring-m3-primary focus:border-m3-primary transition-all text-m3-on-surface"
                />
              </div>
              
              <div className="pt-2">
                <button
                  type="submit"
                  className="w-full py-3.5 bg-m3-primary text-m3-on-primary rounded-xl font-medium hover:bg-m3-primary/90 transition-colors shadow-m3-1 flex justify-center items-center gap-2"
                >
                  <Plus size={20} />
                  Save Payment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
