import React, { useState, useEffect } from 'react';
import { useAlert } from './AlertProvider';
import { useStore } from '../store';
import { 
  Users, 
  Plus, 
  TrendingUp, 
  CreditCard, 
  FileText, 
  Edit, 
  Trash2, 
  X, 
  CircleAlert, 
  PiggyBank, 
  Calendar,
  Wallet,
  Handshake,
  Search,
  Download
} from 'lucide-react';

const formatDate = (dateStr) => {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length === 3 && parts[0].length === 4) {
    // YYYY-MM-DD to DD/MM/YYYY
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return dateStr;
};

export default function Agents() {
  const { showAlert } = useAlert();
  const { agents, refreshAgents } = useStore();
  
  // Dashboard & Active Selection State
  const [selectedAgent, setSelectedAgent] = useState(null);
  const [agentBills, setAgentBills] = useState([]);
  const [agentPayouts, setAgentPayouts] = useState([]);
  const [activeTab, setActiveTab] = useState('bills'); // 'bills' or 'payouts'
  
  // Modals state
  const [isAgentModalOpen, setIsAgentModalOpen] = useState(false);
  const [editingAgent, setEditingAgent] = useState(null);
  const [agentName, setAgentName] = useState('');
  const [commissionRate, setCommissionRate] = useState('2.0');

  const [isPayoutModalOpen, setIsPayoutModalOpen] = useState(false);
  const [payoutAmount, setPayoutAmount] = useState('');
  const [payoutDate, setPayoutDate] = useState(new Date().toISOString().slice(0, 10));
  const [paymentMode, setPaymentMode] = useState('Cash');
  const [referenceNo, setReferenceNo] = useState('');
  const [remarks, setRemarks] = useState('');

  const [searchTerm, setSearchTerm] = useState('');

  // Fetch details when agent changes
  useEffect(() => {
    if (selectedAgent) {
      fetchAgentDetails(selectedAgent.id);
    }
  }, [selectedAgent]);

  // Sync active selection when agents store updates
  useEffect(() => {
    if (selectedAgent) {
      const updated = agents.find(a => a.id === selectedAgent.id);
      if (updated) {
        setSelectedAgent(updated);
      } else {
        setSelectedAgent(null);
        setAgentBills([]);
        setAgentPayouts([]);
      }
    }
  }, [agents]);

  const fetchAgentDetails = async (agentId) => {
    try {
      const [billsRes, payoutsRes] = await Promise.all([
        window.electron.ipcRenderer.invoke('get-agent-bills', agentId),
        window.electron.ipcRenderer.invoke('get-agent-payouts', agentId)
      ]);
      
      if (billsRes.success) {
        setAgentBills(billsRes.bills || []);
      }
      if (payoutsRes.success) {
        setAgentPayouts(payoutsRes.payouts || []);
      }
    } catch (err) {
      console.error('Error fetching agent details:', err);
      showAlert('❌ Error loading agent details.', 'error');
    }
  };

  // Commission Calculations
  const calculations = React.useMemo(() => {
    if (!selectedAgent) return { totalBilled: 0, totalEarned: 0, totalRetained: 0, totalPaid: 0, balancePayable: 0 };
    
    let totalBilled = 0;
    let totalEarned = 0;
    let totalRetained = 0;
    const ratePercent = selectedAgent.commission_rate || 0;

    const billsDetails = agentBills.map(bill => {
      const subtotal = bill.total_amount - (bill.tax_amount || 0);
      const paidAmt = bill.paid_amount || 0;
      const totalAmt = bill.total_amount || 0;
      
      const unpaidAmt = Math.max(0, totalAmt - paidAmt);
      const paidRatio = totalAmt > 0 ? (paidAmt / totalAmt) : 1;
      const paidSubtotal = subtotal * paidRatio;
      
      const earned = paidSubtotal * (ratePercent / 100);
      const retained = (subtotal - paidSubtotal) * (ratePercent / 100);

      totalBilled += subtotal;
      totalEarned += earned;
      totalRetained += retained;

      return {
        ...bill,
        subtotal,
        unpaidAmt,
        earned,
        retained
      };
    });

    const totalPaid = agentPayouts.reduce((sum, p) => sum + (p.amount || 0), 0);
    const balancePayable = Math.max(0, totalEarned - totalPaid);

    return {
      totalBilled,
      totalEarned,
      totalRetained,
      totalPaid,
      balancePayable,
      billsDetails
    };
  }, [selectedAgent, agentBills, agentPayouts]);

  // Handle Agent Save (Add/Edit)
  const handleSaveAgent = async (e) => {
    e.preventDefault();
    if (!agentName.trim()) {
      showAlert('Please enter an agent name.', 'warning');
      return;
    }
    const rate = parseFloat(commissionRate);
    if (isNaN(rate) || rate < 0) {
      showAlert('Please enter a valid commission percentage.', 'warning');
      return;
    }

    const payload = {
      id: editingAgent ? editingAgent.id : null,
      name: agentName.trim(),
      commission_rate: rate
    };

    try {
      const res = await window.electron.ipcRenderer.invoke('save-agent', payload);
      if (res.success) {
        showAlert(editingAgent ? '✅ Agent updated successfully' : '✅ Agent added successfully', 'success');
        setIsAgentModalOpen(false);
        setAgentName('');
        setCommissionRate('2.0');
        setEditingAgent(null);
        refreshAgents();
        if (editingAgent && selectedAgent && selectedAgent.id === editingAgent.id) {
          // Update local selection
          setSelectedAgent({ ...selectedAgent, name: payload.name, commission_rate: payload.commission_rate });
        }
      } else {
        showAlert('❌ Failed to save agent: ' + res.error, 'error');
      }
    } catch (error) {
      showAlert('❌ Error saving agent: ' + error.message, 'error');
    }
  };

  const handleEditAgent = (agent) => {
    setEditingAgent(agent);
    setAgentName(agent.name);
    setCommissionRate(agent.commission_rate.toString());
    setIsAgentModalOpen(true);
  };

  const handleDeleteAgent = async (agent) => {
    if (!window.confirm(`Are you sure you want to delete agent "${agent.name}"?`)) return;
    try {
      const res = await window.electron.ipcRenderer.invoke('delete-agent', agent.id);
      if (res.success) {
        showAlert('✅ Agent deleted successfully', 'success');
        refreshAgents();
        if (selectedAgent && selectedAgent.id === agent.id) {
          setSelectedAgent(null);
        }
      } else {
        showAlert('❌ Failed to delete: ' + res.error, 'error');
      }
    } catch (err) {
      showAlert('❌ Error deleting agent: ' + err.message, 'error');
    }
  };

  // Handle Commission Payout Save
  const handleSavePayout = async (e) => {
    e.preventDefault();
    const amount = parseFloat(payoutAmount);
    if (isNaN(amount) || amount <= 0) {
      showAlert('Please enter a valid payout amount.', 'warning');
      return;
    }
    if (!payoutDate) {
      showAlert('Please choose a payout date.', 'warning');
      return;
    }

    const payload = {
      agent_id: selectedAgent.id,
      amount,
      payout_date: payoutDate,
      payment_mode: paymentMode,
      reference_no: referenceNo.trim() || null,
      remarks: remarks.trim() || null
    };

    try {
      const res = await window.electron.ipcRenderer.invoke('save-agent-payout', payload);
      if (res.success) {
        showAlert('✅ Commission payout recorded successfully', 'success');
        setIsPayoutModalOpen(false);
        setPayoutAmount('');
        setReferenceNo('');
        setRemarks('');
        fetchAgentDetails(selectedAgent.id);
      } else {
        showAlert('❌ Failed to record payout: ' + res.error, 'error');
      }
    } catch (err) {
      showAlert('❌ Error recording payout: ' + err.message, 'error');
    }
  };

  const handleDeletePayout = async (payoutId) => {
    if (!window.confirm('Are you sure you want to delete this payout log?')) return;
    try {
      const res = await window.electron.ipcRenderer.invoke('delete-agent-payout', payoutId);
      if (res.success) {
        showAlert('✅ Payout deleted successfully', 'success');
        fetchAgentDetails(selectedAgent.id);
      } else {
        showAlert('❌ Failed to delete payout: ' + res.error, 'error');
      }
    } catch (err) {
      showAlert('❌ Error deleting payout: ' + err.message, 'error');
    }
  };

  const filteredAgents = agents.filter(a =>
    a.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const inputBase = "w-full rounded-md px-4 py-2.5 m3-body-medium bg-m3-surface-container-highest border border-m3-outline-variant text-m3-on-surface placeholder:text-m3-on-surface-variant/50 focus:border-m3-primary focus:ring-2 focus:ring-m3-primary/20 outline-none transition-all";
  const labelBase = "m3-label-medium text-m3-on-surface-variant mb-1.5 block";

  return (
    <div className="h-[calc(100vh-140px)] flex flex-col md:flex-row gap-6 animate-in fade-in duration-500 font-sans">
      
      {/* 1. Left Sidebar: Agents Directory */}
      <div className="w-full md:w-[320px] bg-m3-surface-container-low border border-m3-outline-variant rounded-2xl flex flex-col overflow-hidden">
        <div className="p-4 border-b border-m3-outline-variant flex items-center justify-between">
          <div>
            <h3 className="m3-title-medium text-m3-on-surface">Agents</h3>
            <p className="m3-body-small text-m3-on-surface-variant">Manage rates & payouts</p>
          </div>
          <button
            onClick={() => {
              setEditingAgent(null);
              setAgentName('');
              setCommissionRate('2.0');
              setIsAgentModalOpen(true);
            }}
            className="p-2 rounded-full bg-m3-primary-container text-m3-on-primary-container hover:shadow-m3-1 transition-all"
            title="Add New Agent"
          >
            <Plus size={18} />
          </button>
        </div>

        {/* Search */}
        <div className="p-3 border-b border-m3-outline-variant/60">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-m3-on-surface-variant" size={16} />
            <input
              type="text"
              placeholder="Search agents..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full rounded-full bg-m3-surface-container-highest border border-m3-outline-variant pl-9 pr-4 py-2 m3-body-medium text-m3-on-surface placeholder:text-m3-on-surface-variant/50 focus:border-m3-primary outline-none transition-all"
            />
          </div>
        </div>

        {/* List of Agents */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar">
          {filteredAgents.length === 0 ? (
            <p className="text-center py-8 m3-body-medium text-m3-on-surface-variant/50">No agents found</p>
          ) : (
            filteredAgents.map(a => {
              const isSelected = selectedAgent && selectedAgent.id === a.id;
              return (
                <div
                  key={a.id}
                  onClick={() => setSelectedAgent(a)}
                  className={`w-full text-left px-4 py-3.5 rounded-xl cursor-pointer transition-all flex items-center justify-between group
                    ${isSelected 
                      ? 'bg-m3-secondary-container text-m3-on-secondary-container' 
                      : 'hover:bg-m3-surface-container-high text-m3-on-surface'
                    }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${isSelected ? 'bg-m3-on-secondary-container/10' : 'bg-m3-surface-container-highest'}`}>
                      <Users size={18} />
                    </div>
                    <div>
                      <p className="m3-label-large font-medium">{a.name}</p>
                      <p className="m3-body-small text-m3-on-surface-variant">Default Rate: {a.commission_rate}%</p>
                    </div>
                  </div>
                  
                  {/* Actions for item */}
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEditAgent(a);
                      }}
                      className="p-1.5 rounded-full hover:bg-m3-on-surface/10 text-m3-on-surface-variant hover:text-m3-on-surface transition-all"
                      title="Edit Agent Settings"
                    >
                      <Edit size={14} />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteAgent(a);
                      }}
                      className="p-1.5 rounded-full hover:bg-m3-error/10 text-m3-on-surface-variant hover:text-m3-error transition-all"
                      title="Delete Agent"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* 2. Right Workspace: Commission Dashboard */}
      <div className="flex-1 bg-m3-surface-container-lowest border border-m3-outline-variant rounded-2xl flex flex-col overflow-hidden relative">
        {selectedAgent ? (
          <div className="flex-1 flex flex-col h-full overflow-hidden">
            
            {/* Header info */}
            <div className="px-6 py-4 border-b border-m3-outline-variant flex items-center justify-between bg-m3-surface-container-low">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-m3-primary-container text-m3-on-primary-container">
                  <Handshake size={24} />
                </div>
                <div>
                  <h2 className="m3-headline-small text-m3-on-surface font-semibold">{selectedAgent.name}</h2>
                  <p className="m3-body-medium text-m3-on-surface-variant">Commission Ledger — Default Rate: {selectedAgent.commission_rate}%</p>
                </div>
              </div>
              
              <button
                onClick={() => setIsPayoutModalOpen(true)}
                className="flex items-center gap-2 px-5 py-3 rounded-full m3-label-large bg-m3-primary text-m3-on-primary hover:shadow-m3-1 active:scale-[0.98] transition-all"
              >
                <Wallet size={16} />
                Record Commission Payout
              </button>
            </div>

            {/* Dashboard Summary Statistics */}
            <div className="p-6 grid grid-cols-2 lg:grid-cols-5 gap-4 border-b border-m3-outline-variant/60 bg-m3-surface-container-lowest">
              {[
                {label: 'Total Billed (Subtotal)', value: calculations.totalBilled, icon: FileText, color: 'text-m3-on-surface' },
                { label: 'Commissions Earned (Paid)', value: calculations.totalEarned, icon: TrendingUp, color: 'text-emerald-500' },
                { label: 'Commissions Retained (Unpaid)', value: calculations.totalRetained, icon: PiggyBank, color: 'text-amber-500' },
                { label: 'Commissions Paid/Settled', value: calculations.totalPaid, icon: CreditCard, color: 'text-m3-primary' },
                { label: 'Balance Commission Payable', value: calculations.balancePayable, icon: Wallet, color: 'text-rose-500 font-bold' }
              ].map((stat, i) => (
                <div key={i} className="bg-m3-surface-container-low p-4 rounded-xl border border-m3-outline-variant flex flex-col justify-between">
                  <div className="flex items-center justify-between mb-1">
                    <span className="m3-label-medium text-m3-on-surface-variant/80">{stat.label}</span>
                    <stat.icon size={16} className={stat.color} />
                  </div>
                  <div className={`m3-title-large font-mono font-semibold ${stat.color}`}>
                    ₹{stat.value.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                </div>
              ))}
            </div>

            {/* Main Tabs */}
            <div className="px-6 border-b border-m3-outline-variant bg-m3-surface-container-low flex justify-between items-center">
              <div className="flex gap-1.5 py-2">
                {[
                  { id: 'bills', label: 'Commission Statement (Sales Bills)' },
                  { id: 'payouts', label: 'Payout History Ledger' }
                ].map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`px-4 py-2 rounded-lg m3-label-large transition-all
                      ${activeTab === tab.id 
                        ? 'bg-m3-secondary-container text-m3-on-secondary-container font-semibold' 
                        : 'text-m3-on-surface-variant hover:bg-m3-surface-container-high'
                      }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
              <div className="m3-body-small text-m3-on-surface-variant/60 flex items-center gap-1">
                <CircleAlert size={14} />
                Commissions are calculated dynamically on the Subtotal (excludes tax).
              </div>
            </div>

            {/* Tab content area */}
            <div className="flex-1 overflow-y-auto custom-scrollbar bg-m3-surface-container-lowest">
              
              {activeTab === 'bills' ? (
                <div className="p-6">
                  <div className="rounded-xl border border-m3-outline-variant bg-m3-surface-container-lowest overflow-hidden">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-m3-surface-container border-b border-m3-outline-variant">
                          {['Bill No.', 'Bill Date', 'Party/Customer Name', 'Grand Total', 'Unpaid Bal.', 'Subtotal (Net)', 'Comm. Rate', 'Earned Comm.', 'Retained Comm.', 'Projected'].map((label, idx) => (
                            <th key={idx} className="px-5 py-3.5 m3-label-medium text-m3-on-surface-variant font-semibold whitespace-nowrap">
                              {label}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-m3-outline-variant/50">
                        {calculations.billsDetails.length === 0 ? (
                          <tr>
                            <td colSpan="10" className="px-5 py-12 text-center text-m3-on-surface-variant/50 m3-body-large">
                              No sales bills have been booked under this agent.
                            </td>
                          </tr>
                        ) : (
                          calculations.billsDetails.map(bill => {
                            const isPaid = bill.unpaidAmt === 0;
                            return (
                              <tr key={bill.id} className="hover:bg-m3-surface-container-low transition-colors">
                                <td className="px-5 py-3.5 m3-label-large font-mono text-m3-on-surface whitespace-nowrap">{bill.bill_number}</td>
                                <td className="px-5 py-3.5 m3-body-medium text-m3-on-surface whitespace-nowrap">{formatDate(bill.date)}</td>
                                <td className="px-5 py-3.5 m3-body-medium text-m3-on-surface max-w-[150px] truncate" title={bill.party_name}>
                                  {bill.party_name}
                                </td>
                                <td className="px-5 py-3.5 m3-label-large font-mono text-m3-on-surface">₹{bill.total_amount.toFixed(2)}</td>
                                <td className="px-5 py-3.5 m3-label-large font-mono">
                                  {isPaid ? (
                                    <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-500 m3-body-small font-medium font-sans">Paid</span>
                                  ) : (
                                    <span className="text-amber-500">₹{bill.unpaidAmt.toFixed(2)}</span>
                                  )}
                                </td>
                                <td className="px-5 py-3.5 m3-label-large font-mono text-m3-on-surface">₹{bill.subtotal.toFixed(2)}</td>
                                <td className="px-5 py-3.5 m3-body-medium text-m3-on-surface">{selectedAgent.commission_rate}%</td>
                                <td className="px-5 py-3.5 m3-label-large font-mono text-emerald-500 font-semibold">₹{bill.earned.toFixed(2)}</td>
                                <td className="px-5 py-3.5 m3-label-large font-mono text-amber-500">₹{bill.retained.toFixed(2)}</td>
                                <td className="px-5 py-3.5 m3-label-large font-mono text-m3-primary/70">₹{(bill.earned + bill.retained).toFixed(2)}</td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div className="p-6">
                  <div className="rounded-xl border border-m3-outline-variant bg-m3-surface-container-lowest overflow-hidden">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-m3-surface-container border-b border-m3-outline-variant">
                          {['Payout Date', 'Payout Amount', 'Payment Mode', 'Reference No.', 'Remarks/Notes', 'Action'].map((label, idx) => (
                            <th key={idx} className="px-5 py-3.5 m3-label-medium text-m3-on-surface-variant font-semibold">
                              {label}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-m3-outline-variant/50 font-mono">
                        {agentPayouts.length === 0 ? (
                          <tr>
                            <td colSpan="6" className="px-5 py-12 text-center text-m3-on-surface-variant/50 m3-body-large font-sans">
                              No payout logs found for this agent.
                            </td>
                          </tr>
                        ) : (
                          agentPayouts.map(p => (
                            <tr key={p.id} className="hover:bg-m3-surface-container-low transition-colors">
                              <td className="px-5 py-3.5 m3-body-medium text-m3-on-surface whitespace-nowrap">{formatDate(p.payout_date)}</td>
                              <td className="px-5 py-3.5 m3-label-large text-rose-500 font-semibold">₹{p.amount.toFixed(2)}</td>
                              <td className="px-5 py-3.5 m3-body-medium text-m3-on-surface font-sans">{p.payment_mode}</td>
                              <td className="px-5 py-3.5 m3-body-medium text-m3-on-surface-variant">{p.reference_no || 'N/A'}</td>
                              <td className="px-5 py-3.5 m3-body-medium text-m3-on-surface-variant font-sans max-w-[200px] truncate" title={p.remarks}>
                                {p.remarks || '-'}
                              </td>
                              <td className="px-5 py-3.5">
                                <button
                                  onClick={() => handleDeletePayout(p.id)}
                                  className="p-1.5 rounded-full text-m3-on-surface-variant hover:bg-m3-error/10 hover:text-m3-error transition-all"
                                  title="Delete Payout Entry"
                                >
                                  <Trash2 size={16} />
                                </button>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-16 text-center">
            <div className="p-5 rounded-2xl bg-m3-surface-container-high text-m3-on-surface-variant mb-4">
              <Users size={48} strokeWidth={1.5} />
            </div>
            <h3 className="m3-headline-small text-m3-on-surface font-medium mb-1">Select an Agent</h3>
            <p className="m3-body-large text-m3-on-surface-variant max-w-[320px]">
              Select an agent from the sidebar directory to manage default rates, review commission credits, or log payout settlements.
            </p>
          </div>
        )}
      </div>

      {/* 3. Modal: Add / Edit Agent */}
      {isAgentModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="w-full max-w-md mx-4 bg-m3-surface-container-lowest rounded-2xl border border-m3-outline-variant overflow-hidden shadow-m3-3">
            <div className="px-6 py-4 bg-m3-surface-container flex items-center justify-between border-b border-m3-outline-variant">
              <div>
                <h3 className="m3-title-medium text-m3-on-surface">
                  {editingAgent ? 'Edit Agent Settings' : 'Create New Agent'}
                </h3>
                <p className="m3-body-small text-m3-on-surface-variant">Configure details and default commission rules</p>
              </div>
              <button
                onClick={() => setIsAgentModalOpen(false)}
                className="p-2 rounded-full text-m3-on-surface-variant hover:bg-m3-surface-container-high transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveAgent} className="p-6 space-y-4">
              <div>
                <label className={labelBase}>Agent Name *</label>
                <input
                  type="text"
                  required
                  value={agentName}
                  onChange={(e) => setAgentName(e.target.value)}
                  className={inputBase}
                  placeholder="e.g. Anand Kumar"
                />
              </div>

              <div>
                <label className={labelBase}>Default Commission Rate (%) *</label>
                <input
                  type="number"
                  step="0.05"
                  required
                  value={commissionRate}
                  onChange={(e) => setCommissionRate(e.target.value)}
                  className={`${inputBase} font-mono`}
                  placeholder="e.g. 2.50"
                />
              </div>

              <div className="pt-4 border-t border-m3-outline-variant flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAgentModalOpen(false)}
                  className="px-5 py-2.5 rounded-full m3-label-large border border-m3-outline text-m3-on-surface-variant hover:bg-m3-surface-container-high transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-full m3-label-large bg-m3-primary text-m3-on-primary hover:shadow-m3-1 active:scale-[0.98] transition-all"
                >
                  {editingAgent ? 'Save Changes' : 'Create Agent'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 4. Modal: Record Commission Payout */}
      {isPayoutModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="w-full max-w-md mx-4 bg-m3-surface-container-lowest rounded-2xl border border-m3-outline-variant overflow-hidden shadow-m3-3">
            <div className="px-6 py-4 bg-m3-surface-container flex items-center justify-between border-b border-m3-outline-variant">
              <div>
                <h3 className="m3-title-medium text-m3-on-surface">Record Commission Payout</h3>
                <p className="m3-body-small text-m3-on-surface-variant">Log settlement paid to {selectedAgent?.name}</p>
              </div>
              <button
                onClick={() => setIsPayoutModalOpen(false)}
                className="p-2 rounded-full text-m3-on-surface-variant hover:bg-m3-surface-container-high transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSavePayout} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelBase}>Amount Paid (₹) *</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={payoutAmount}
                    onChange={(e) => setPayoutAmount(e.target.value)}
                    className={`${inputBase} font-mono`}
                    placeholder="₹0.00"
                  />
                </div>
                <div>
                  <label className={labelBase}>Payout Date *</label>
                  <input
                    type="date"
                    required
                    value={payoutDate}
                    onChange={(e) => setPayoutDate(e.target.value)}
                    className={`${inputBase} font-mono`}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelBase}>Payment Mode</label>
                  <select
                    value={paymentMode}
                    onChange={(e) => setPaymentMode(e.target.value)}
                    className={inputBase}
                  >
                    <option value="Cash">Cash</option>
                    <option value="Online">Online Transfer</option>
                    <option value="Cheque">Cheque</option>
                  </select>
                </div>
                <div>
                  <label className={labelBase}>Reference No.</label>
                  <input
                    type="text"
                    value={referenceNo}
                    onChange={(e) => setReferenceNo(e.target.value)}
                    className={inputBase}
                    placeholder="e.g. TXN9876"
                  />
                </div>
              </div>

              <div>
                <label className={labelBase}>Remarks / Settlement Notes</label>
                <textarea
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  className={`${inputBase} min-h-[80px] resize-none`}
                  placeholder="e.g. Settled commission for May sales"
                />
              </div>

              {/* Outstanding Reference Helper */}
              <div className="bg-m3-surface-container p-3 rounded-lg border border-m3-outline-variant flex justify-between items-center text-m3-on-surface m3-body-small">
                <span>Earned commission balance:</span>
                <span className="font-mono font-semibold text-rose-500">
                  ₹{calculations.balancePayable.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>

              <div className="pt-4 border-t border-m3-outline-variant flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsPayoutModalOpen(false)}
                  className="px-5 py-2.5 rounded-full m3-label-large border border-m3-outline text-m3-on-surface-variant hover:bg-m3-surface-container-high transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-full m3-label-large bg-m3-primary text-m3-on-primary hover:shadow-m3-1 active:scale-[0.98] transition-all"
                >
                  Save Settlement
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
