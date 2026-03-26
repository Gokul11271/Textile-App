import React, { useState, useEffect, useCallback, useRef } from 'react'
import { Plus, Trash2, Save, Printer, FileText, Search, User, MapPin, Hash, Package } from 'lucide-react'

export function Billing() {
  const formatDate = (date) => {
    const d = new Date(date);
    const day = d.getDate().toString().padStart(2, '0');
    const month = d.toLocaleString('en-US', { month: 'short' }).toUpperCase();
    const year = d.getFullYear();
    return `${day}-${month}-${year}`;
  };

  const [billData, setBillData] = useState({
    billNumber: '',
    date: formatDate(new Date()),
    agentId: '',
    partyId: '',
    partyShortName: '',
    partyName: '',
    partyAddress: '',
    partyGst: '',
    partyIdLabel: 'Identification',
    discountPercent: 0,
    discountAmount: 0,
    isInterState: false,
    taxRate: 5,
    taxAmount: 0,
    cgstAmount: 0,
    sgstAmount: 0,
    lrNumber: '',
    lorryOffice: '',
    isBaleEnabled: false,
    isBaleSyncEnabled: false,
    baleNumbers: ['', '', '', '', '', '', '', ''],
    totalAmount: 0,
    subtotal: 0
  })

  const [printCopies, setPrintCopies] = useState({
    big: 1,
    transport: 1
  })

  const [items, setItems] = useState([
    { id: Date.now(), size: '', productName: '', quantity: 0, rate: 0, amount: 0, baleNumber: '' }
  ])

  const [stats, setStats] = useState({ totalBills: 0, lastBillNo: 'N/A', totalBales: 0 })
  const [parties, setParties] = useState([])
  const [agents, setAgents] = useState([])
  const [partyIndex, setPartyIndex] = useState(-1)

  const billNoRef = useRef(null)
  const dateRef = useRef(null)
  const partyNameRef = useRef(null)
  const firstItemSizeRef = useRef(null)

  const loadStats = useCallback(async () => {
    if (window.electron && window.electron.ipcRenderer) {
      const s = await window.electron.ipcRenderer.invoke('get-dashboard-stats')
      setStats(s)
    }
  }, [])

  useEffect(() => {
    if (window.electron && window.electron.db) {
      // Load initial data
      window.electron.db.getParties().then(data => setParties(data || []))
      window.electron.db.getAgents().then(data => setAgents(data || []))
      loadStats()
      window.electron.db.getLastBillNumber().then(lastNo => {
        if (lastNo) {
          const nextNo = lastNo.replace(/\d+$/, (n) => (parseInt(n) + 1).toString().padStart(n.length, '0'));
          setBillData(prev => ({ ...prev, billNumber: nextNo }))
        } else {
          setBillData(prev => ({ ...prev, billNumber: 'INV-1001' }))
        }
      })
    }
  }, [loadStats])

  const calculateTotals = useCallback((currentItems, currentBillData) => {
    const subtotal = currentItems.reduce((sum, item) => sum + item.amount, 0)
    let discountAmt = currentBillData.discountAmount

    if (currentBillData.discountPercent > 0) {
      discountAmt = (subtotal * currentBillData.discountPercent) / 100
    }

    const netAmount = subtotal - discountAmt
    const taxAmt = (netAmount * (currentBillData.taxRate || 0)) / 100
    const finalTotal = netAmount + taxAmt

    let cgstAmt = 0
    let sgstAmt = 0

    if (!currentBillData.isInterState) {
      cgstAmt = taxAmt / 2
      sgstAmt = taxAmt / 2
    }

    return {
      subtotal,
      discountAmount: discountAmt,
      taxAmount: taxAmt,
      cgstAmount: cgstAmt,
      sgstAmount: sgstAmt,
      totalAmount: finalTotal
    }
  }, [])

  const updateCalculations = useCallback((newItems, newBillData) => {
    const totals = calculateTotals(newItems, newBillData)
    setBillData(prev => ({ ...prev, ...totals }))
  }, [calculateTotals])

  useEffect(() => {
    if (billData.isBaleSyncEnabled) {
      setItems(prevItems => {
        const needsUpdate = prevItems.some((item, idx) =>
          idx < billData.baleNumbers.length && item.baleNumber !== billData.baleNumbers[idx]
        );
        if (!needsUpdate) return prevItems;
        return prevItems.map((item, idx) => {
          if (idx < billData.baleNumbers.length) {
            return { ...item, baleNumber: billData.baleNumbers[idx] };
          }
          return item;
        });
      });
    }
  }, [billData.isBaleSyncEnabled, billData.baleNumbers]);

  const handleItemChange = (id, field, value) => {
    const newItems = items.map(item => {
      if (item.id === id) {
        const updatedItem = { ...item, [field]: value }
        if (field === 'quantity' || field === 'rate') {
          updatedItem.amount = Number(updatedItem.quantity || 0) * Number(updatedItem.rate || 0)
        }
        if (field === 'baleNumber' && billData.isBaleSyncEnabled) {
          const idx = items.findIndex(it => it.id === id);
          if (idx !== -1 && idx < billData.baleNumbers.length) {
            const newBales = [...billData.baleNumbers];
            newBales[idx] = value;
            setBillData(prev => ({ ...prev, baleNumbers: newBales }));
          }
        }
        return updatedItem
      }
      return item
    })
    setItems(newItems)
    updateCalculations(newItems, billData)
  }

  const addItem = () => {
    const nextBale = (billData.isBaleSyncEnabled && items.length < billData.baleNumbers.length) ? billData.baleNumbers[items.length] : '';
    const newItems = [...items, { id: Date.now(), size: '', productName: '', quantity: 0, rate: 0, amount: 0, baleNumber: nextBale }]
    setItems(newItems)
    updateCalculations(newItems, billData)
  }

  const handleKeyDown = (e, index) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const currentInput = e.target;
      const row = currentInput.closest('tr');
      const inputs = Array.from(row.querySelectorAll('input:not([type="checkbox"])'));
      const inputIndex = inputs.indexOf(currentInput);

      if (inputIndex < inputs.length - 1) {
        inputs[inputIndex + 1].focus();
      } else {
        if (index < items.length - 1) {
          const nextRow = row.nextElementSibling;
          if (nextRow) {
            const nextInput = nextRow.querySelector('input');
            if (nextInput) nextInput.focus();
          }
        } else {
          addItem();
          setTimeout(() => {
            const table = row.closest('table');
            if (table) {
              const rows = table.querySelectorAll('tbody tr');
              const lastRow = rows[rows.length - 1];
              if (lastRow) {
                const firstInput = lastRow.querySelector('input');
                if (firstInput) firstInput.focus();
              }
            }
          }, 50);
        }
      }
    }
  };

  const removeItem = (id) => {
    if (items.length > 1) {
      const newItems = items.filter(item => item.id !== id)
      setItems(newItems)
      updateCalculations(newItems, billData)
    }
  }

  const handlePartySelect = (selection) => {
    // Try to match the combined format "Customer Name (Short Name)"
    const match = selection.match(/\(([^)]+)\)$/)
    const shortName = match ? match[1] : selection

    const party = parties.find(p => p.short_name === shortName)
    if (party) {
      // Priority: GST > PAN > Aadhaar
      let idNumber = '';
      let idLabel = 'Identification';

      if (party.gst_number) {
        idNumber = party.gst_number;
        idLabel = 'GST Number';
      } else if (party.pan_number) {
        idNumber = party.pan_number;
        idLabel = 'PAN Number';
      } else if (party.aadhar_number) {
        idNumber = party.aadhar_number;
        idLabel = 'Aadhaar Number';
      }

      setBillData(prev => ({
        ...prev,
        partyId: party.id,
        partyShortName: party.short_name,
        partyName: party.name,
        partyAddress: party.address,
        partyGst: idNumber,
        partyIdLabel: idLabel
      }))
    } else {
      setBillData(prev => ({ ...prev, partyName: selection, partyShortName: selection }))
    }
  }

  const handleQuickFill = async () => {
    if (!billData.billNumber) return;
    const oldBill = await window.electron.ipcRenderer.invoke('get-bill-by-number', billData.billNumber.trim());
    if (oldBill) {
      setBillData(prev => ({
        ...prev,
        agentId: oldBill.agent_id,
        partyId: oldBill.party_id,
        discountPercent: oldBill.discount_percent,
        lrNumber: oldBill.lr_number,
        lorryOffice: oldBill.lorry_office,
        isBaleEnabled: oldBill.is_bale_enabled === 1,
        totalAmount: oldBill.total_amount
      }));
      setItems(oldBill.items.map(item => ({
        id: Date.now() + Math.random(),
        size: item.size,
        productName: item.product_name,
        quantity: item.quantity,
        rate: item.rate,
        amount: item.amount,
        baleNumber: item.bale_number
      })));

      // Auto-fill party details from the bill object (if joined) or from the state
      const party = (parties || []).find(p => p.id === oldBill.party_id);
      if (party) {
        let idNumber = '';
        let idLabel = 'Identification';

        if (party.gst_number) {
          idNumber = party.gst_number;
          idLabel = 'GST Number';
        } else if (party.pan_number) {
          idNumber = party.pan_number;
          idLabel = 'PAN Number';
        } else if (party.aadhar_number) {
          idNumber = party.aadhar_number;
          idLabel = 'Aadhaar Number';
        }

        setBillData(prev => ({
          ...prev,
          partyShortName: party.short_name,
          partyName: party.name,
          partyAddress: party.address,
          partyGst: idNumber || '',
          partyIdLabel: idLabel
        }));
      } else if (oldBill.party_name) {
        // Fallback if the IPC handler returned joined party data
        setBillData(prev => ({
          ...prev,
          partyShortName: oldBill.party_short_name || oldBill.party_name,
          partyName: oldBill.party_name,
          partyAddress: oldBill.party_address,
          partyGst: oldBill.party_gst_number
        }));
      }
    } else {
      alert('Bill not found');
    }
  };

  const handleManualDiscount = (amount) => {
    const newBillData = { ...billData, discountAmount: amount, discountPercent: 0 }
    setBillData(newBillData)
    updateCalculations(items, newBillData)
  }

  const handlePercentDiscount = (percent) => {
    const newBillData = { ...billData, discountPercent: percent, discountAmount: 0 }
    setBillData(newBillData)
    updateCalculations(items, newBillData)
  }

  const handleDelete = async () => {
    if (!billData.billNumber) return;
    if (window.confirm('Are you sure you want to delete this bill?')) {
      alert('Delete function pending database implementation');
    }
  }

  const resetForm = useCallback((nextBillNo = '') => {
    setBillData({
      billNumber: nextBillNo,
      date: formatDate(new Date()),
      agentId: '',
      partyId: '',
      partyShortName: '',
      partyName: '',
      partyAddress: '',
      partyGst: '',
      partyIdLabel: 'Identification',
      discountPercent: 0,
      discountAmount: 0,
      isInterState: false,
      taxRate: 5,
      taxAmount: 0,
      cgstAmount: 0,
      sgstAmount: 0,
      lrNumber: '',
      lorryOffice: '',
      isBaleEnabled: false,
      isBaleSyncEnabled: false,
      baleNumbers: ['', '', '', '', '', '', '', ''],
      totalAmount: 0,
      subtotal: 0
    })
    setItems([{ id: Date.now(), size: '', productName: '', quantity: 0, rate: 0, amount: 0, baleNumber: '' }])
  }, [])

  const handleSave = async (silent = false) => {
    try {
      if (!billData.billNumber || !billData.partyName) {
        alert('Please fill Bill Number and Party Name');
        return false;
      }

      if (window.electron && window.electron.db) {
        await window.electron.db.saveBill(billData, items);
        if (!silent) alert('Bill saved successfully!');
        return true;
      } else {
        console.warn('Database not available. Action was not saved.');
        if (!silent) alert('Database not connected. Your changes were not saved locally.');
        return true; // Return true to allow flow to continue in mock/dev mode if desired
      }
    } catch (error) {
      console.error(error);
      alert('Error saving bill: ' + error.message);
      return false;
    }
  };

  const handleSaveAndGenerate = async () => {
    try {
      const saved = await handleSave(true);
      if (!saved) return;
      
      const pdfPath = await window.electron.ipcRenderer.invoke('generate-pdf', billData, items, 'big');
      alert('Bill saved and PDF generated successfully at: ' + pdfPath);
    } catch (error) {
      console.error(error);
      alert('Error in saving/generating bill');
    }
  };

  const handlePrint = async (type = 'big') => {
    try {
      const saved = await handleSave(true);
      if (!saved) return;

      const count = printCopies[type] || 1;
      for (let i = 0; i < count; i++) {
        const pdfPath = await window.electron.ipcRenderer.invoke('generate-pdf', billData, items, type);
        const printResult = await window.electron.ipcRenderer.invoke('print-bill', billData, items, type);

        if (i === 0) {
          if (printResult.success) {
            alert(`${type === 'big' ? 'Bill' : 'Transport Copy'} sent to printer and saved as PDF.`);
          } else if (printResult.error !== 'cancelled') {
            alert(`PDF saved at: ${pdfPath}, but print failed: ${printResult.error}`);
          }
        }
      }
    } catch (error) {
      console.error(error);
      alert('Error in printing system');
    }
  };

  const handleUpNext = async () => {
    const saved = await handleSave(true);
    if (!saved) return;

    // Generate Big Print Automatically
    const bigCount = printCopies.big || 1;
    for (let i = 0; i < bigCount; i++) {
      await window.electron.ipcRenderer.invoke('generate-pdf', billData, items, 'big');
    }

    // Increment bill number
    const currentNo = billData.billNumber;
    const nextNo = currentNo.replace(/\d+$/, (n) => (parseInt(n) + 1).toString().padStart(n.length, '0'));

    resetForm(nextNo);
  };

  return (
    <div className="h-[calc(100vh-1rem)] flex flex-col overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500 font-premium-text">
      {/* Header Actions - Fixed at Top */}
      <div className="flex justify-between items-center mb-4 flex-shrink-0">
        <div>
          <h1 className="text-xl font-bold  dark:text-white text-black leading-tight">Create New Bill</h1>
          <p className="text-[10px] dark:text-premium-400 text-gray-500">Professional textile invoicing system.</p>
        </div>
        <div className="flex space-x-2">
          {/* Action buttons kept relatively same but slightly more compact */}
          <button onClick={() => resetForm()} className="flex items-center space-x-1 px-3 py-1.5 rounded-lg text-xs transition-all border dark:bg-premium-700 dark:hover:bg-premium-600 dark:border-premium-600 dark:text-white bg-gray-50 hover:bg-white border-gray-200 text-gray-700">
            <Plus size={14} />
            <span>New</span>
          </button>
          <button onClick={handleDelete} className="flex items-center space-x-1 px-3 py-1.5 rounded-lg text-xs transition-all border dark:bg-transparent dark:hover:bg-premium-800 dark:border-premium-700 dark:text-premium-400 bg-transparent hover:bg-gray-50 border-gray-100 text-gray-400">
            <Trash2 size={14} />
          </button>
          <div className="w-px dark:bg-premium-700 bg-gray-200 mx-1"></div>
          <div className="flex items-center space-x-1 border dark:border-premium-700 rounded-lg px-2 dark:bg-premium-800/30 bg-gray-50/50">
            <span className="text-[10px] dark:text-premium-500 text-gray-400 font-bold uppercase tracking-tighter">Copies:</span>
            <input
              type="number"
              min="1"
              max="10"
              value={printCopies.transport}
              onChange={e => setPrintCopies(prev => ({ ...prev, transport: parseInt(e.target.value) || 1 }))}
              className="w-8 bg-transparent text-[10px] font-bold text-center dark:text-white text-black focus:outline-none"
            />
            <button onClick={() => handlePrint('transport')} className="flex items-center space-x-1 px-2 py-1.5 rounded-lg text-xs transition-all dark:text-premium-400 dark:hover:text-white text-gray-700 hover:text-black">
              <Printer size={14} />
              <span>Transport</span>
            </button>
          </div>

          <div className="flex items-center space-x-1 border dark:border-premium-700 rounded-lg px-2 dark:bg-white/5 bg-black/5 shadow-sm">
            <span className="text-[10px] dark:text-premium-500 text-gray-400 font-bold uppercase tracking-tighter">Copies:</span>
            <input
              type="number"
              min="1"
              max="10"
              value={printCopies.big}
              onChange={e => setPrintCopies(prev => ({ ...prev, big: parseInt(e.target.value) || 1 }))}
              className="w-8 bg-transparent text-[10px] font-bold text-center dark:text-white text-black focus:outline-none"
            />
            <button onClick={() => handlePrint('big')} className="flex items-center space-x-1 px-2 py-1.5 rounded-lg text-xs font-bold dark:text-white text-black hover:opacity-80">
              <Printer size={14} />
              <span>Big Print</span>
            </button>
          </div>
          <button onClick={handleSaveAndGenerate} className="flex items-center space-x-2 px-4 py-1.5 rounded-lg text-xs font-bold border dark:bg-white dark:text-black dark:hover:bg-gray-200 bg-black text-white hover:bg-gray-800 shadow-md transition-all active:scale-95">
            <FileText size={14} />
            <span>Save & Generate</span>
          </button>
          <button onClick={() => handleSave()} className="flex items-center space-x-1 px-4 py-1.5 rounded-lg text-xs font-bold border dark:bg-premium-800 dark:hover:bg-premium-700 dark:border-premium-700 dark:text-white bg-white border-gray-200 text-black">
            <Save size={14} />
            <span>Save</span>
          </button>
          <button onClick={handleUpNext} className="flex items-center space-x-1 px-4 py-1.5 rounded-lg text-xs font-bold border uppercase tracking-tighter dark:bg-white/10 dark:hover:bg-white/20 dark:border-white/20 dark:text-white bg-black/5 border-black/5 text-black">
            <span>Next Bill</span>
          </button>
        </div>
      </div>

      {/* Main Content Area - Scrollable */}
      <div className="flex-1 overflow-y-auto space-y-4 pr-1 custom-scrollbar">
        {/* Summary Info Bar - Compact */}
        <div className="grid grid-cols-4 gap-3 flex-shrink-0">
          {[
            { label: 'Last Bill No', value: stats.lastBillNo, color: 'dark:text-premium-400 text-gray-500' },
            { label: 'Total Bills', value: stats.totalBills, color: 'dark:text-white text-black' },
            { label: 'Total Bales', value: stats.totalBales, color: 'dark:text-white text-black' },
            { label: 'Ready for Print', value: 'Auto Generated', color: 'dark:text-premium-400 text-gray-400' }
          ].map((s, i) => (
            <div key={i} className="rounded-lg p-2 flex flex-col items-center justify-center border dark:bg-premium-800/20 dark:border-premium-700/30 bg-white border-gray-100">
              <span className="text-[8px] uppercase font-bold tracking-widest dark:text-premium-500 text-gray-400">{s.label}</span>
              <span className={`text-xs font-bold font-premium-mono ${s.color}`}>{s.value}</span>
            </div>
          ))}
        </div>

        {/* Bill Metadata Grid - Flexible */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="p-4 rounded-xl border-2 space-y-3 dark:bg-premium-800/80 dark:border-premium-700/50 bg-white border-gray-100 shadow-lg backdrop-blur-sm">
            <h3 className="text-[10px] font-black uppercase tracking-widest dark:text-premium-400 text-gray-400 border-b dark:border-premium-700/50 pb-2 mb-4">Invoice Metadata</h3>
            <div className="grid grid-cols-2 lg:grid-cols-1 gap-3">
              <div className="flex flex-col space-y-1">
                <label className="text-[9px] uppercase font-bold ml-1 dark:text-premium-400 text-gray-400">Bill Number</label>
                <div className="flex space-x-1">
                  <input
                    type="text"
                    ref={billNoRef}
                    value={billData.billNumber}
                    onChange={e => setBillData({ ...billData, billNumber: e.target.value })}
                    onKeyDown={e => e.key === 'Enter' && dateRef.current?.focus()}
                    className="flex-1 rounded-lg px-3 py-1.5 text-xs focus:outline-none dark:bg-premium-900 dark:border-premium-700 dark:text-white bg-gray-50 border-gray-100 font-premium-mono"
                    placeholder="DT-000"
                  />
                  <button onClick={handleQuickFill} className="p-1.5 rounded-lg dark:bg-premium-700 dark:text-premium-400 bg-gray-100 text-gray-500">
                    <Search size={14} />
                  </button>
                </div>
              </div>
              <div className="flex flex-col space-y-1">
                <label className="text-[9px] uppercase font-bold ml-1 dark:text-premium-400 text-gray-400">Date</label>
                <input
                  type="text"
                  ref={dateRef}
                  value={billData.date}
                  onChange={e => setBillData({ ...billData, date: e.target.value.toUpperCase() })}
                  onKeyDown={e => e.key === 'Enter' && partyNameRef.current?.focus()}
                  className="rounded-lg px-3 py-1.5 text-xs focus:outline-none dark:bg-premium-900 dark:border-premium-700 dark:text-premium-100 bg-gray-50 border-gray-100 font-premium-mono"
                  placeholder="DD-MMM-YYYY"
                />
              </div>
            </div>
          </div>

          <div className="lg:col-span-2 p-4 rounded-xl border-2 space-y-3 dark:bg-premium-800/80 dark:border-premium-700/50 bg-white border-gray-100 shadow-lg backdrop-blur-sm">
            <div className="flex justify-between items-center border-b dark:border-premium-700/50 pb-2 mb-4">
              <h3 className="text-[10px] font-black uppercase tracking-widest dark:text-premium-400 text-gray-400">Recipient Details</h3>
              <div className="flex items-center space-x-2 text-[9px] dark:text-premium-400 text-gray-500 bg-black/5 dark:bg-white/5 px-2 py-1 rounded-md">
                <label className="uppercase font-black text-[8px] opacity-60">Agent:</label>
                <select
                  value={billData.agentId}
                  onChange={e => setBillData({ ...billData, agentId: e.target.value })}
                  className="bg-transparent focus:outline-none dark:text-white text-black font-bold"
                >
                  <option value="">None</option>
                  {agents.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-3">
                <div className="flex flex-col space-y-1">
                  <label className="text-[9px] uppercase font-bold ml-1 dark:text-premium-400 text-gray-400">Party Name</label>
                  <div className="relative">
                    <span className="absolute left-2.5 top-2 dark:text-premium-500 text-gray-300"><User size={12} /></span>
                    <input
                      type="text"
                      ref={partyNameRef}
                      value={billData.partyShortName}
                      onChange={e => {
                        handlePartySelect(e.target.value);
                        setPartyIndex(-1);
                      }}
                      onKeyDown={e => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          firstItemSizeRef.current?.focus();
                        } else if (e.key === 'ArrowUp') {
                          e.preventDefault();
                          if (parties.length === 0) return;
                          setPartyIndex(newIndex);
                          handlePartySelect(parties[newIndex].short_name);
                        } else if (e.key === 'ArrowDown') {
                          e.preventDefault();
                          if (parties.length === 0) return;
                          const newIndex = partyIndex >= parties.length - 1 ? 0 : partyIndex + 1;
                          setPartyIndex(newIndex);
                          handlePartySelect(parties[newIndex].short_name);
                        }
                      }}
                      className="w-full rounded-lg pl-8 pr-3 py-1.5 text-xs focus:outline-none dark:bg-premium-900 dark:border-premium-700 dark:text-white bg-gray-50 border-gray-100"
                      placeholder="Search Party..."
                      list="parties-list"
                    />
                    <datalist id="parties-list">
                      {parties.map(p => <option key={p.id} value={`${p.name} (${p.short_name})`} />)}
                    </datalist>
                  </div>
                </div>
                <div className="flex flex-col space-y-1">
                  <label className="text-[9px] uppercase font-bold ml-1 dark:text-premium-400 text-gray-400">{billData.partyIdLabel || 'Identification'}</label>
                  <input
                    type="text"
                    readOnly
                    value={billData.partyGst}
                    className="w-full rounded-lg px-3 py-1.5 text-xs dark:bg-premium-900/50 dark:border-premium-700/50 dark:text-premium-400 bg-gray-50/50 border-gray-100"
                    placeholder="Auto-filled"
                  />
                </div>
              </div>
              <div className="flex flex-col space-y-1">
                <label className="text-[9px] uppercase font-bold ml-1 dark:text-premium-400 text-gray-400">Address</label>
                <textarea
                  readOnly
                  value={billData.partyAddress}
                  className="w-full flex-1 min-h-[70px] rounded-lg px-3 py-1.5 text-xs cursor-not-allowed resize-none dark:bg-premium-900/50 dark:border-premium-700/50 dark:text-premium-400 bg-gray-50/50 border-gray-100"
                  placeholder="Party address..."
                />
              </div>
            </div>
          </div>
        </div>

        {/* Product Section - Internally Scrollable if needed */}
        <div className="rounded-xl border-2 overflow-hidden dark:bg-premium-800/80 dark:border-premium-700/50 bg-white border-gray-100 shadow-lg backdrop-blur-sm flex flex-col">
          <div className="p-4 border-b-2 flex justify-between items-center dark:bg-premium-700/30 dark:border-premium-700/50 bg-gray-50/50 border-gray-100">
            <div className="flex items-center space-x-3">
              <div className="p-2 rounded-lg dark:bg-premium-700/50 bg-white shadow-inner">
                <Package size={16} className="dark:text-white text-black" />
              </div>
              <div>
                <span className="text-[10px] font-black uppercase tracking-widest dark:text-white text-black block">Line Items</span>
                <span className="text-[8px] dark:text-premium-500 text-gray-400 uppercase font-bold">HSN Code 6304</span>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={billData.isBaleEnabled}
                  onChange={e => setBillData({ ...billData, isBaleEnabled: e.target.checked })}
                  id="bale-enable"
                  className="w-3.5 h-3.5 rounded dark:bg-premium-900 bg-white"
                />
                <label htmlFor="bale-enable" className="text-[10px] cursor-pointer dark:text-premium-500 text-gray-500">Bale No.</label>
              </div>
              <button onClick={addItem} className="flex items-center space-x-1 text-[10px] py-1 px-2 rounded-lg font-bold dark:bg-white dark:text-black bg-black text-white">
                <Plus size={12} />
                <span>Add Row</span>
              </button>
            </div>
          </div>

          <div className="max-h-[300px] overflow-y-auto custom-scrollbar">
            <table className="w-full text-left text-xs">
              <thead className="text-[9px] uppercase border-b sticky top-0 dark:bg-premium-800 dark:text-premium-500 dark:border-premium-700 bg-white text-gray-400 border-gray-50 z-10">
                <tr>
                  <th className="px-4 py-2 font-bold w-20">Size</th>
                  <th className="px-4 py-2 font-bold">Product Name</th>
                  <th className="px-4 py-2 font-bold w-20">Qty</th>
                  <th className="px-4 py-2 font-bold w-28">Rate</th>
                  {billData.isBaleEnabled && <th className="px-4 py-2 font-bold w-24">Bale</th>}
                  <th className="px-4 py-2 font-bold w-32">Amount</th>
                  <th className="px-4 py-2 w-10"></th>
                </tr>
              </thead>
              <tbody className="divide-y dark:divide-premium-700/50 divide-gray-50 font-medium">
                {items.map((item, idx) => (
                  <tr key={item.id} className="dark:hover:bg-premium-700/10 hover:bg-gray-50/50">
                    <td className="px-4 py-1.5">
                      <input
                        type="text"
                        ref={idx === 0 ? firstItemSizeRef : null}
                        value={item.size}
                        onChange={e => handleItemChange(item.id, 'size', e.target.value)}
                        onKeyDown={e => handleKeyDown(e, idx)}
                        className="w-full bg-transparent border-none focus:outline-none dark:text-premium-100 text-black"
                        placeholder="Size"
                      />
                    </td>
                    <td className="px-4 py-1.5">
                      <input
                        type="text"
                        value={item.productName}
                        onChange={e => handleItemChange(item.id, 'productName', e.target.value)}
                        onKeyDown={e => handleKeyDown(e, idx)}
                        className="w-full bg-transparent border-none focus:outline-none dark:text-premium-100 text-black"
                        placeholder="Item name"
                      />
                    </td>
                    <td className="px-4 py-1.5">
                      <input
                        type="number"
                        value={item.quantity}
                        onChange={e => handleItemChange(item.id, 'quantity', e.target.value)}
                        onKeyDown={e => handleKeyDown(e, idx)}
                        className="w-full bg-transparent border-none focus:outline-none font-premium-mono dark:text-premium-100 text-black"
                      />
                    </td>
                    <td className="px-4 py-1.5">
                      <input
                        type="number"
                        value={item.rate}
                        onChange={e => handleItemChange(item.id, 'rate', e.target.value)}
                        onKeyDown={e => handleKeyDown(e, idx)}
                        className="w-full bg-transparent border-none focus:outline-none font-premium-mono dark:text-premium-100 text-black"
                      />
                    </td>
                    {billData.isBaleEnabled && (
                      <td className="px-4 py-1.5">
                        <input
                          type="text"
                          value={item.baleNumber}
                          onChange={e => handleItemChange(item.id, 'baleNumber', e.target.value)}
                          onKeyDown={e => handleKeyDown(e, idx)}
                          className="w-full bg-transparent border-none focus:outline-none font-premium-mono dark:text-premium-100 text-black"
                        />
                      </td>
                    )}
                    <td className="px-4 py-1.5 font-bold font-premium-mono dark:text-premium-100 text-black">
                      ₹{item.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-4 py-1.5 text-right">
                      <button onClick={() => removeItem(item.id)} className="dark:text-premium-600 dark:hover:text-red-400 text-gray-300">
                        <Trash2 size={12} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Footer Panel - Grid for Logistics & Calculations */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="p-4 rounded-xl border space-y-3 dark:bg-premium-800/50 dark:border-premium-700 bg-white border-gray-100">
            <h3 className="text-[10px] font-bold uppercase tracking-wider dark:text-premium-500 text-gray-400">Logistics</h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col space-y-1">
                <label className="text-[9px] uppercase font-bold ml-1 dark:text-premium-400 text-gray-400">LR Number</label>
                <input
                  type="text"
                  value={billData.lrNumber}
                  onChange={e => setBillData({ ...billData, lrNumber: e.target.value })}
                  className="rounded-lg px-3 py-1.5 text-xs focus:outline-none dark:bg-premium-900 dark:border-premium-700 bg-gray-50 border-gray-100"
                  placeholder="LR-0000"
                />
              </div>
              <div className="flex flex-col space-y-1">
                <label className="text-[9px] uppercase font-bold ml-1 dark:text-premium-400 text-gray-400">Lorry Office</label>
                <input
                  type="text"
                  value={billData.lorryOffice}
                  onChange={e => setBillData({ ...billData, lorryOffice: e.target.value })}
                  className="rounded-lg px-3 py-1.5 text-xs focus:outline-none dark:bg-premium-900 dark:border-premium-700 bg-gray-50 border-gray-100"
                  placeholder="Transport"
                />
              </div>
            </div>
            {/* Compact Bale System inside Logistics area or below */}
            <div className="mt-3 pt-3 border-t dark:border-premium-700/50 border-gray-50">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[9px] font-bold uppercase dark:text-premium-500 text-gray-400">Bale Tracking</span>
                <input
                  type="checkbox"
                  checked={billData.isBaleSyncEnabled}
                  onChange={e => setBillData({ ...billData, isBaleSyncEnabled: e.target.checked })}
                  className="w-3 h-3 rounded"
                />
              </div>
              <div className="grid grid-cols-8 gap-1.5">
                {billData.baleNumbers.map((num, idx) => (
                  <input
                    key={idx}
                    type="text"
                    value={num}
                    onChange={e => {
                      const newBales = [...billData.baleNumbers]
                      newBales[idx] = e.target.value
                      setBillData({ ...billData, baleNumbers: newBales })
                    }}
                    className="w-full text-[10px] py-1 text-center rounded bg-gray-50 dark:bg-premium-900 border-none focus:ring-1 ring-white/10 dark:text-premium-100 font-premium-mono"
                    placeholder="-"
                  />
                ))}
              </div>
            </div>
          </div>

          <div className="p-5 rounded-xl border dark:bg-premium-800 dark:border-premium-600 bg-[#0e0e0e] border-[#1a1a1a] shadow-xl">
            <div className="flex justify-between items-center text-[10px] uppercase font-bold text-[#666]">
              <span>Subtotal</span>
              <span className="font-premium-mono text-white">₹{billData.subtotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
            </div>

            <div className="flex justify-between items-center mt-3 text-[10px] font-bold">
              <div className="flex items-center space-x-2">
                <span className="text-[#666]">Disc %</span>
                <input
                  type="number"
                  value={billData.discountPercent}
                  onChange={e => handlePercentDiscount(Number(e.target.value))}
                  className="w-10 rounded-md px-1.5 py-0.5 text-[10px] dark:bg-premium-900 bg-white/5 text-white font-premium-mono"
                />
                <span className="text-[#666]">₹</span>
                <input
                  type="number"
                  value={billData.discountAmount}
                  onChange={e => handleManualDiscount(Number(e.target.value))}
                  className="w-16 rounded-md px-1.5 py-0.5 text-[10px] dark:bg-premium-900 bg-white/5 text-white font-premium-mono"
                />
              </div>
              <span className="font-premium-mono text-red-400">-₹{billData.discountAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
            </div>

            <div className="mt-3 pt-3 border-t border-white/5 flex justify-between items-center">
              <div className="flex items-center space-x-3">
                <button
                  onClick={() => {
                    const newBillData = { ...billData, isInterState: !billData.isInterState }
                    setBillData(newBillData)
                    updateCalculations(items, newBillData)
                  }}
                  className={`px-2 py-0.5 rounded-lg text-[8px] font-bold uppercase tracking-widest border transition-all ${!billData.isInterState
                    ? 'bg-white text-black border-white'
                    : 'bg-white/5 text-[#666] border-white/10'
                    }`}
                >
                  {!billData.isInterState ? 'Local' : 'Inter-State'}
                </button>
                <div className="flex items-center space-x-1">
                  <span className="text-[8px] uppercase font-bold text-[#444]">GST %</span>
                  <input
                    type="number"
                    value={billData.taxRate}
                    onChange={e => {
                      const val = Number(e.target.value)
                      const newBillData = { ...billData, taxRate: val }
                      setBillData(newBillData)
                      updateCalculations(items, newBillData)
                    }}
                    className="w-8 rounded-md px-1 py-0.5 text-[10px] dark:bg-premium-900 bg-white/10 text-white font-premium-mono"
                  />
                </div>
              </div>
              <div className="text-[10px] font-premium-mono text-white/50">
                +₹{billData.taxAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </div>
            </div>

            <div className="mt-4 flex justify-between items-baseline border-t border-white/10 pt-3">
              <div className="flex flex-col">
                <span className="text-[9px] font-black uppercase tracking-[0.2em] text-[#666]">Total Payable</span>
                <span className="text-xl font-black text-white italic leading-none font-premium-mono">₹{billData.totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="text-[8px] uppercase text-[#444] font-bold tracking-tighter">
                {billData.isInterState ? 'IGST Applied' : 'CGST + SGST Applied'}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Custom Global Scrollbar Style */}
      <style dangerouslySetInnerHTML={{
        __html: `
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(128, 128, 128, 0.2);
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(128, 128, 128, 0.4);
        }
      `}} />
    </div>
  )
}

export default Billing;
