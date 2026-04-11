import { useAlert } from './AlertProvider';
import React, { useState, useEffect, useCallback, useRef } from 'react'
import { Plus, Trash2, Save, Printer, FileText, Search, User, Package, ChevronRight, ChevronLeft } from 'lucide-react'

export function Billing() {
  const { showAlert } = useAlert();
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
    financialYear: '',
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
  const [products, setProducts] = useState([])
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
    const loadInitialData = async () => {
      if (!window.electron || !window.electron.db) return;
      try {
        const [partiesData, agentsData, productsData, settings, lastNo] = await Promise.all([
          window.electron.db.getParties(),
          window.electron.db.getAgents(),
          window.electron.db.getProducts ? window.electron.db.getProducts() : Promise.resolve([]),
          window.electron.ipcRenderer.invoke('get-settings'),
          window.electron.db.getLastBillNumber()
        ]);
        
        setParties(partiesData || []);
        setAgents(agentsData || []);
        setProducts(productsData || []);
        
        setBillData(prev => ({
          ...prev,
          taxRate: (settings && settings.defaultTaxRate !== undefined) ? Number(settings.defaultTaxRate) : prev.taxRate,
          billNumber: lastNo ? (parseInt(lastNo) + 1).toString() : '1'
        }));
        
        loadStats();
      } catch (error) {
        console.error("Error loading initial data", error);
      }
    };
    loadInitialData();
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
    const match = selection.match(/\(([^)]+)\)$/)
    const shortName = match ? match[1] : selection

    const party = parties.find(p => p.short_name === shortName)
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

      const isInterState = !(party.state && party.state.toLowerCase().includes('tamil nadu'));

      setBillData(prev => ({
        ...prev,
        partyId: party.id,
        partyShortName: party.short_name,
        partyName: party.name,
        partyAddress: party.address,
        partyGst: idNumber,
        partyIdLabel: idLabel,
        isInterState
      }))
    } else {
      setBillData(prev => ({ ...prev, partyName: selection, partyShortName: selection }))
    }
  }

  const loadBillByNumber = async (billNoStr) => {
    if (!billNoStr) return;
    const oldBill = await window.electron.ipcRenderer.invoke('get-bill-by-number', billNoStr.toString().trim());
    if (oldBill) {
      setBillData(prev => ({
        ...prev,
        billNumber: oldBill.bill_number ? oldBill.bill_number.toString() : billNoStr,
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
        setBillData(prev => ({
          ...prev,
          partyShortName: oldBill.party_short_name || oldBill.party_name,
          partyName: oldBill.party_name,
          partyAddress: oldBill.party_address,
          partyGst: oldBill.party_gst_number
        }));
      }
    } else {
      showAlert('Bill not found', 'error');
    }
  };

  const handleQuickFill = () => loadBillByNumber(billData.billNumber);

  const handlePreviousBill = () => {
    if (!billData.billNumber || isNaN(billData.billNumber)) return;
    const prevNo = parseInt(billData.billNumber) - 1;
    if (prevNo > 0) {
      loadBillByNumber(prevNo.toString());
    } else {
      showAlert('No previous bill exists.', 'warning');
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
    if (window.confirm(`Are you sure you want to delete bill ${billData.billNumber}?`)) {
      try {
        const result = await window.electron.ipcRenderer.invoke('delete-bill', billData.billNumber);
        if (result.success) {
          showAlert('✅ Bill deleted successfully', 'success');
          loadStats();
          // After delete, clear the form but maybe suggest the next number or just refresh
          window.electron.db.getLastBillNumber().then(lastNo => {
            if (lastNo) {
              const nextNo = (parseInt(lastNo) + 1).toString();
              resetForm(nextNo);
            } else {
              resetForm('1');
            }
          });
        } else {
          showAlert('❌ Failed to delete bill: ' + result.error, 'error');
        }
      } catch (error) {
        showAlert('❌ Error deleting bill: ' + error.message, 'error');
      }
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
      financialYear: '',
      totalAmount: 0,
      subtotal: 0
    })
    setItems([{ id: Date.now(), size: '', productName: '', quantity: 0, rate: 0, amount: 0, baleNumber: '' }])
    
    // UI Focus Restore optimization
    setTimeout(() => {
      if (partyNameRef.current) partyNameRef.current.focus();
    }, 50);
  }, [])

  const handleSave = async (silent = false, generateDefaultPdf = true) => {
    try {
      if (!billData.billNumber) {
        showAlert('Please enter a Bill Number.', 'warning');
        billNoRef.current?.focus();
        return false;
      }
      if (!billData.partyName && !billData.partyShortName) {
        showAlert('Please select or enter a Party Name.', 'warning');
        partyNameRef.current?.focus();
        return false;
      }

      // Check at least one valid item exists
      const hasValidItem = items.some(item =>
        (item.productName && item.productName.trim()) || Number(item.quantity) > 0 || Number(item.rate) > 0
      );
      if (!hasValidItem) {
        showAlert('Please add at least one line item with a product name, quantity, or rate.', 'warning');
        firstItemSizeRef.current?.focus();
        return false;
      }

      if (window.electron && window.electron.db) {
        const savedResult = await window.electron.db.saveBill(billData, items);
        if (savedResult && savedResult.billNumber) {
          setBillData(prev => ({ ...prev, billNumber: savedResult.billNumber }));
          billData.billNumber = savedResult.billNumber; // Mutation important for scope
        }

        // AUTO-GENERATE PDF ON SAVE (Requested fix)
        // This ensures that even clicking just "Save" creates the file in the folder
        let pdfPath = '';
        if (generateDefaultPdf) {
          pdfPath = await window.electron.ipcRenderer.invoke('generate-pdf', billData, items, 'big');
        }

        loadStats(); // Refresh stats after save
        if (!silent) showAlert('✅ Bill ' + billData.billNumber + ' saved successfully!' + (pdfPath ? '\n📁 Saved to: ' + pdfPath : ''), 'success');
        return true;
      } else {
        showAlert('⚠️ Database not connected. Please restart the application.', 'error');
        return false;
      }
    } catch (error) {
      console.error('Save error:', error);
      showAlert('❌ Error saving bill: ' + (error.message || 'Unknown error'), 'error');
      return false;
    }
  };

  const handleSaveAndGenerate = async () => {
    try {
      const saved = await handleSave(true, false);
      if (!saved) return;

      const transportCount = printCopies.transport || 1;
      if (transportCount > 0) {
        window.electron.ipcRenderer.invoke('generate-pdf', billData, items, 'transport').catch(console.error);
        window.electron.ipcRenderer.invoke('print-bill', billData, items, 'transport', transportCount).catch(console.error);
      }

      const bigCount = printCopies.big || 1;
      if (bigCount > 0) {
        window.electron.ipcRenderer.invoke('generate-pdf', billData, items, 'big').catch(console.error);
        window.electron.ipcRenderer.invoke('print-bill', billData, items, 'big', bigCount).catch(console.error);
      }

      // Automatically move to next bill to save clicks
      window.electron.db.getLastBillNumber().then(lastNo => {
        const nextNo = lastNo ? (parseInt(lastNo) + 1).toString() : '1';
        resetForm(nextNo);
      });
    } catch (error) {
      console.error(error);
      showAlert('❌ Error generating PDF: ' + (error.message || 'Unknown error'), 'error');
    }
  };

  const handlePrint = async (type = 'big') => {
    try {
      const saved = await handleSave(true, false);
      if (!saved) return;

      const count = printCopies[type] || 1;

      // Fire and forget printing/generation so user doesn't wait
      if (count > 0) {
        window.electron.ipcRenderer.invoke('generate-pdf', billData, items, type).catch(console.error);
        window.electron.ipcRenderer.invoke('print-bill', billData, items, type, count).catch(console.error);
      }

      // Immediately move to next bill
      window.electron.db.getLastBillNumber().then(lastNo => {
        const nextNo = lastNo ? (parseInt(lastNo) + 1).toString() : '1';
        resetForm(nextNo);
      });

    } catch (error) {
      console.error(error);
      showAlert('❌ Error in printing: ' + (error.message || 'Unknown error'), 'error');
    }
  };


  const handleUpNext = async () => {
    const saved = await handleSave(true, false);
    if (!saved) return;

    // Generate big bill PDF
    const bigCount = printCopies.big || 1;
    for (let i = 0; i < bigCount; i++) {
      window.electron.ipcRenderer.invoke('generate-pdf', billData, items, 'big').catch(console.error);
    }

    // Also generate transport copy PDF
    const transportCount = printCopies.transport || 1;
    for (let i = 0; i < transportCount; i++) {
      window.electron.ipcRenderer.invoke('generate-pdf', billData, items, 'transport').catch(console.error);
    }

    window.electron.db.getLastBillNumber().then(lastNo => {
      const nextNo = lastNo ? (parseInt(lastNo) + 1).toString() : '1';
      resetForm(nextNo);
    });
  };

  const inputBase = "w-full rounded-md px-3 py-2 m3-body-medium bg-m3-surface-container-highest border border-m3-outline-variant text-m3-on-surface placeholder:text-m3-on-surface-variant/50 focus:border-m3-primary focus:ring-1 focus:ring-m3-primary/30 transition-all duration-200";
  const labelBase = "m3-label-medium text-m3-on-surface-variant mb-1 block";

  return (
    <div className="h-[calc(100vh-5rem)] flex flex-col overflow-hidden animate-in fade-in duration-500 font-sans">
      <datalist id="products-list">
        {products.map((p, i) => <option key={i} value={p} />)}
      </datalist>
      {/* Header Actions */}
      <div className="flex justify-between items-center mb-4 flex-shrink-0">
        <div>
          <h1 className="m3-title-large font-display text-m3-on-surface">Create New Bill</h1>
          <p className="m3-body-small text-m3-on-surface-variant">Professional textile invoicing system</p>
        </div>
        <div className="flex items-center gap-2">
          {/* M3 Outlined/Tonal Buttons */}
          <button onClick={handlePreviousBill} className="flex items-center gap-1.5 px-3 py-2 rounded-full m3-label-large border border-m3-outline text-m3-on-surface-variant hover:bg-m3-surface-container-highest transition-all">
            <ChevronLeft size={16} />
            <span>Prev</span>
          </button>
          <button onClick={() => resetForm()} className="flex items-center gap-1.5 px-3 py-2 rounded-full m3-label-large border border-m3-outline text-m3-primary hover:bg-m3-primary/8 transition-all">
            <Plus size={16} />
            <span>New</span>
          </button>
          <button onClick={handleDelete} className="flex items-center gap-1 px-3 py-2 rounded-full m3-label-large border border-m3-outline text-m3-on-surface-variant hover:bg-m3-error/8 hover:text-m3-error hover:border-m3-error/50 transition-all">
            <Trash2 size={16} />
          </button>

          <div className="w-px h-8 bg-m3-outline-variant mx-1"></div>

          {/* Transport Print Group */}
          <div className="flex items-center gap-1 border border-m3-outline-variant rounded-full px-3 py-1.5 bg-m3-surface-container-low">
            <span className="m3-label-small text-m3-on-surface-variant">×</span>
            <input
              type="number"
              min="1"
              max="10"
              value={printCopies.transport}
              onChange={e => setPrintCopies(prev => ({ ...prev, transport: parseInt(e.target.value) || 1 }))}
              className="w-6 bg-transparent m3-label-medium text-center text-m3-on-surface focus:outline-none"
            />
            <button onClick={() => handlePrint('transport')} className="flex items-center gap-1 px-2 py-1 rounded-full m3-label-medium text-m3-on-surface-variant hover:text-m3-primary transition-colors">
              <Printer size={14} />
              <span>Transport</span>
            </button>
          </div>

          {/* Big Print Group */}
          <div className="flex items-center gap-1 border border-m3-outline-variant rounded-full px-3 py-1.5 bg-m3-surface-container">
            <span className="m3-label-small text-m3-on-surface-variant">×</span>
            <input
              type="number"
              min="1"
              max="10"
              value={printCopies.big}
              onChange={e => setPrintCopies(prev => ({ ...prev, big: parseInt(e.target.value) || 1 }))}
              className="w-6 bg-transparent m3-label-medium text-center text-m3-on-surface focus:outline-none"
            />
            <button onClick={() => handlePrint('big')} className="flex items-center gap-1 px-2 py-1 rounded-full m3-label-medium font-medium text-m3-on-surface hover:text-m3-primary transition-colors">
              <Printer size={14} />
              <span>Big Print</span>
            </button>
          </div>

          {/* M3 Filled Button */}
          <button onClick={handleSaveAndGenerate} className="flex items-center gap-2 px-5 py-2.5 rounded-full m3-label-large bg-m3-primary text-m3-on-primary hover:shadow-m3-1 active:scale-[0.98] transition-all">
            <FileText size={16} />
            <span>Save & Generate</span>
          </button>

          {/* M3 Tonal Button */}
          <button onClick={() => handleSave()} className="flex items-center gap-1.5 px-4 py-2.5 rounded-full m3-label-large bg-m3-secondary-container text-m3-on-secondary-container hover:shadow-m3-1 transition-all">
            <Save size={16} />
            <span>Save</span>
          </button>

          <button onClick={handleUpNext} className="flex items-center gap-1 px-4 py-2.5 rounded-full m3-label-large bg-m3-tertiary-container text-m3-on-tertiary-container hover:shadow-m3-1 transition-all">
            <span>Next Bill</span>
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      {/* Main Content - Scrollable */}
      <div className="flex-1 overflow-y-auto space-y-4 pr-1 custom-scrollbar">
        {/* Stats Summary Bar */}
        <div className="grid grid-cols-4 gap-3 flex-shrink-0">
          {[
            { label: 'Last Bill No', value: stats.lastBillNo },
            { label: 'Total Bills', value: stats.totalBills },
            { label: 'Total Bales', value: stats.totalBales },
            { label: 'Ready for Print', value: 'Auto Generated' }
          ].map((s, i) => (
            <div key={i} className="rounded-lg px-3 py-2.5 flex flex-col items-center justify-center bg-m3-surface-container-low border border-m3-outline-variant">
              <span className="m3-label-small text-m3-on-surface-variant">{s.label}</span>
              <span className="m3-label-large font-mono text-m3-on-surface">{s.value}</span>
            </div>
          ))}
        </div>

        {/* Bill Metadata */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Invoice Card */}
          <div className="p-5 rounded-xl border border-m3-outline-variant bg-m3-surface-container-lowest space-y-4">
            <h3 className="m3-title-small text-m3-on-surface border-b border-m3-outline-variant pb-3">Invoice Metadata</h3>
            <div className="space-y-3">
              <div>
                <label className={labelBase}>Bill Number & FY</label>
                <div className="flex gap-1.5 flex-wrap">
                  <input
                    type="text"
                    ref={billNoRef}
                    value={billData.billNumber}
                    onChange={e => setBillData({ ...billData, billNumber: e.target.value })}
                    onKeyDown={e => e.key === 'Enter' && dateRef.current?.focus()}
                    className={`${inputBase} font-mono w-24`}
                    placeholder="Auto"
                  />
                  <input
                    type="text"
                    list="fy-list"
                    value={billData.financialYear}
                    onChange={e => setBillData({ ...billData, financialYear: e.target.value })}
                    className={`${inputBase} flex-1 min-w-[120px]`}
                    placeholder="FY (e.g. 24-25)"
                  />
                  <datalist id="fy-list">
                    <option value="2023-2024" />
                    <option value="2024-2025" />
                    <option value="2025-2026" />
                    <option value="2026-2027" />
                  </datalist>
                  <button onClick={handleQuickFill} className="p-2.5 rounded-md bg-m3-surface-container-high text-m3-on-surface-variant hover:bg-m3-primary-container hover:text-m3-on-primary-container transition-colors">
                    <Search size={16} />
                  </button>
                </div>
              </div>
              <div>
                <label className={labelBase}>Date</label>
                <input
                  type="text"
                  ref={dateRef}
                  value={billData.date}
                  onChange={e => setBillData({ ...billData, date: e.target.value.toUpperCase() })}
                  onKeyDown={e => e.key === 'Enter' && partyNameRef.current?.focus()}
                  className={`${inputBase} font-mono`}
                  placeholder="DD-MMM-YYYY"
                />
              </div>
            </div>
          </div>

          {/* Recipient Card */}
          <div className="lg:col-span-2 p-5 rounded-xl border border-m3-outline-variant bg-m3-surface-container-lowest space-y-4">
            <div className="flex justify-between items-center border-b border-m3-outline-variant pb-3">
              <h3 className="m3-title-small text-m3-on-surface">Recipient Details</h3>
              <div className="flex items-center gap-2 bg-m3-surface-container px-3 py-1.5 rounded-full">
                <span className="m3-label-small text-m3-on-surface-variant">Agent:</span>
                <select
                  value={billData.agentId}
                  onChange={e => setBillData({ ...billData, agentId: e.target.value })}
                  className="bg-transparent focus:outline-none m3-label-medium text-m3-on-surface cursor-pointer"
                >
                  <option value="">None</option>
                  {agents.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-3">
                <div>
                  <label className={labelBase}>Party Name</label>
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 text-m3-on-surface-variant"><User size={14} /></span>
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
                          const newIndex = partyIndex <= 0 ? parties.length - 1 : partyIndex - 1;
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
                      className={`${inputBase} pl-9`}
                      placeholder="Search Party..."
                      list="parties-list"
                    />
                    <datalist id="parties-list">
                      {parties.map(p => <option key={p.id} value={`${p.name} (${p.short_name})`} />)}
                    </datalist>
                  </div>
                </div>
                <div>
                  <label className={labelBase}>{billData.partyIdLabel || 'Identification'}</label>
                  <input
                    type="text"
                    readOnly
                    value={billData.partyGst}
                    className={`${inputBase} cursor-not-allowed opacity-70 font-mono`}
                    placeholder="Auto-filled"
                  />
                </div>
              </div>
              <div>
                <label className={labelBase}>Address</label>
                <textarea
                  readOnly
                  value={billData.partyAddress}
                  className={`${inputBase} min-h-[88px] cursor-not-allowed opacity-70 resize-none`}
                  placeholder="Party address..."
                />
              </div>
            </div>
          </div>
        </div>

        {/* Line Items - M3 Card */}
        <div className="rounded-xl border border-m3-outline-variant bg-m3-surface-container-lowest overflow-hidden flex flex-col">
          <div className="px-5 py-3 border-b border-m3-outline-variant flex justify-between items-center bg-m3-surface-container-low">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-m3-primary-container text-m3-on-primary-container">
                <Package size={16} />
              </div>
              <div>
                <span className="m3-title-small text-m3-on-surface block">Line Items</span>
                <span className="m3-label-small text-m3-on-surface-variant">HSN Code 6304</span>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={billData.isBaleEnabled}
                  onChange={e => setBillData({ ...billData, isBaleEnabled: e.target.checked })}
                  id="bale-enable"
                  className="w-4 h-4 rounded accent-m3-primary"
                />
                <span className="m3-label-medium text-m3-on-surface-variant">Bale No.</span>
              </label>
              <button onClick={addItem} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full m3-label-medium bg-m3-primary text-m3-on-primary hover:shadow-m3-1 transition-all">
                <Plus size={14} />
                <span>Add Row</span>
              </button>
            </div>
          </div>

          <div className="max-h-[300px] overflow-y-auto custom-scrollbar">
            <table className="w-full text-left">
              <thead className="sticky top-0 z-10 bg-m3-surface-container border-b border-m3-outline-variant">
                <tr>
                  <th className="px-4 py-2.5 m3-label-medium text-m3-on-surface-variant w-20">Size</th>
                  <th className="px-4 py-2.5 m3-label-medium text-m3-on-surface-variant">Product Name</th>
                  <th className="px-4 py-2.5 m3-label-medium text-m3-on-surface-variant w-20">Qty</th>
                  <th className="px-4 py-2.5 m3-label-medium text-m3-on-surface-variant w-28">Rate</th>
                  {billData.isBaleEnabled && <th className="px-4 py-2.5 m3-label-medium text-m3-on-surface-variant w-24">Bale</th>}
                  <th className="px-4 py-2.5 m3-label-medium text-m3-on-surface-variant w-32">Amount</th>
                  <th className="px-4 py-2.5 w-10"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-m3-outline-variant/50">
                {items.map((item, idx) => (
                  <tr key={item.id} className="hover:bg-m3-surface-container-low/50 transition-colors">
                    <td className="px-4 py-1.5">
                      <input
                        type="text"
                        ref={idx === 0 ? firstItemSizeRef : null}
                        value={item.size}
                        onChange={e => handleItemChange(item.id, 'size', e.target.value)}
                        onKeyDown={e => handleKeyDown(e, idx)}
                        className="w-full bg-transparent border-none focus:outline-none m3-body-medium text-m3-on-surface"
                        placeholder="Size"
                      />
                    </td>
                    <td className="px-4 py-1.5">
                      <input
                        type="text"
                        list="products-list"
                        value={item.productName}
                        onChange={e => handleItemChange(item.id, 'productName', e.target.value)}
                        onKeyDown={e => handleKeyDown(e, idx)}
                        className="w-full bg-transparent border-none focus:outline-none m3-body-medium text-m3-on-surface"
                        placeholder="Item name"
                      />
                    </td>
                    <td className="px-4 py-1.5">
                      <input
                        type="number"
                        value={item.quantity}
                        onChange={e => handleItemChange(item.id, 'quantity', e.target.value)}
                        onKeyDown={e => handleKeyDown(e, idx)}
                        className="w-full bg-transparent border-none focus:outline-none font-mono m3-body-medium text-m3-on-surface"
                      />
                    </td>
                    <td className="px-4 py-1.5">
                      <input
                        type="number"
                        value={item.rate}
                        onChange={e => handleItemChange(item.id, 'rate', e.target.value)}
                        onKeyDown={e => handleKeyDown(e, idx)}
                        className="w-full bg-transparent border-none focus:outline-none font-mono m3-body-medium text-m3-on-surface"
                      />
                    </td>
                    {billData.isBaleEnabled && (
                      <td className="px-4 py-1.5">
                        <input
                          type="text"
                          value={item.baleNumber}
                          onChange={e => handleItemChange(item.id, 'baleNumber', e.target.value)}
                          onKeyDown={e => handleKeyDown(e, idx)}
                          className="w-full bg-transparent border-none focus:outline-none font-mono m3-body-medium text-m3-on-surface"
                        />
                      </td>
                    )}
                    <td className="px-4 py-1.5 font-mono m3-label-large text-m3-on-surface">
                      ₹{item.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-4 py-1.5 text-right">
                      <button onClick={() => removeItem(item.id)} className="text-m3-on-surface-variant hover:text-m3-error transition-colors p-1 rounded-full hover:bg-m3-error-container/30">
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Footer - Logistics & Calculations */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 pb-4">
          {/* Logistics Card */}
          <div className="p-5 rounded-xl border border-m3-outline-variant bg-m3-surface-container-lowest space-y-4">
            <h3 className="m3-title-small text-m3-on-surface">Logistics</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelBase}>LR Number</label>
                <input
                  type="text"
                  value={billData.lrNumber}
                  onChange={e => setBillData({ ...billData, lrNumber: e.target.value })}
                  className={`${inputBase} font-mono`}
                  placeholder="LR-0000"
                />
              </div>
              <div>
                <label className={labelBase}>Lorry Office</label>
                <input
                  type="text"
                  value={billData.lorryOffice}
                  onChange={e => setBillData({ ...billData, lorryOffice: e.target.value })}
                  className={inputBase}
                  placeholder="Transport"
                />
              </div>
            </div>

            {/* Bale Tracking */}
            <div className="pt-3 border-t border-m3-outline-variant">
              <div className="flex items-center justify-between mb-3">
                <span className="m3-label-medium text-m3-on-surface-variant">Bale Tracking</span>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={billData.isBaleSyncEnabled}
                    onChange={e => setBillData({ ...billData, isBaleSyncEnabled: e.target.checked })}
                    className="w-4 h-4 rounded accent-m3-primary"
                  />
                  <span className="m3-label-small text-m3-on-surface-variant">Sync</span>
                </label>
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
                    className="w-full m3-label-medium py-1.5 text-center rounded-md bg-m3-surface-container-high border border-m3-outline-variant/50 text-m3-on-surface font-mono focus:outline-none focus:border-m3-primary"
                    placeholder="—"
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Calculation Card */}
          <div className="p-5 rounded-xl border border-m3-outline-variant bg-m3-surface-container-lowest space-y-3">
            <h3 className="m3-title-small text-m3-on-surface border-b border-m3-outline-variant pb-3">Summary</h3>

            <div className="flex justify-between items-center">
              <span className="m3-label-medium text-m3-on-surface-variant">Subtotal</span>
              <span className="m3-label-large font-mono text-m3-on-surface">₹{billData.subtotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
            </div>

            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <span className="m3-label-medium text-m3-on-surface-variant">Disc %</span>
                <input
                  type="number"
                  value={billData.discountPercent}
                  onChange={e => handlePercentDiscount(Number(e.target.value))}
                  className="w-12 rounded-md px-1.5 py-1 m3-label-medium bg-m3-surface-container-highest border border-m3-outline-variant text-m3-on-surface font-mono text-center focus:outline-none focus:border-m3-primary"
                />
                <span className="m3-label-medium text-m3-on-surface-variant">₹</span>
                <input
                  type="number"
                  value={billData.discountAmount}
                  onChange={e => handleManualDiscount(Number(e.target.value))}
                  className="w-20 rounded-md px-1.5 py-1 m3-label-medium bg-m3-surface-container-highest border border-m3-outline-variant text-m3-on-surface font-mono text-center focus:outline-none focus:border-m3-primary"
                />
              </div>
              <span className="m3-label-large font-mono text-m3-error">-₹{billData.discountAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
            </div>

            <div className="pt-3 border-t border-m3-outline-variant flex justify-between items-center">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => {
                    const newBillData = { ...billData, isInterState: !billData.isInterState }
                    setBillData(newBillData)
                    updateCalculations(items, newBillData)
                  }}
                  className={`px-3 py-1 rounded-full m3-label-small transition-all ${!billData.isInterState
                    ? 'bg-m3-primary text-m3-on-primary'
                    : 'bg-m3-surface-container-high text-m3-on-surface-variant border border-m3-outline-variant'
                    }`}
                >
                  {!billData.isInterState ? 'Local' : 'Inter-State'}
                </button>
                <div className="flex items-center gap-1.5">
                  <span className="m3-label-small text-m3-on-surface-variant">GST %</span>
                  <input
                    type="number"
                    value={billData.taxRate}
                    onChange={e => {
                      const val = Number(e.target.value)
                      const newBillData = { ...billData, taxRate: val }
                      setBillData(newBillData)
                      updateCalculations(items, newBillData)
                    }}
                    className="w-10 rounded-md px-1 py-1 m3-label-medium bg-m3-surface-container-highest border border-m3-outline-variant text-m3-on-surface font-mono text-center focus:outline-none focus:border-m3-primary"
                  />
                </div>
              </div>
              <span className="m3-label-large font-mono text-m3-on-surface-variant">
                +₹{billData.taxAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </span>
            </div>

            <div className="pt-3 border-t border-m3-outline-variant flex justify-between items-baseline">
              <div className="flex flex-col">
                <span className="m3-label-small text-m3-on-surface-variant tracking-wider">Total Payable</span>
                <span className="m3-headline-small font-display font-medium font-mono text-m3-on-surface mt-1">₹{billData.totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              </div>
              <span className="m3-label-small text-m3-on-surface-variant">
                {billData.isInterState ? 'IGST Applied' : 'CGST + SGST Applied'}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Billing;
