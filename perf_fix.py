import os

billing_path = r"c:\Users\Admin\OneDrive\Desktop\Textile-Project\src\components\Billing.jsx"
ipc_path = r"c:\Users\Admin\OneDrive\Desktop\Textile-Project\electron\ipcHandlers.cjs"

# 1. Update ipcHandlers.cjs
with open(ipc_path, "r", encoding="utf-8") as f:
    ipc_content = f.read()

ipc_content = ipc_content.replace(
    "ipcMain.handle('print-bill', async (event, bill, items, type = 'big') => {",
    "ipcMain.handle('print-bill', async (event, bill, items, type = 'big', copies = 1) => {"
)

ipc_content = ipc_content.replace(
    "win.webContents.print({ silent: true, printBackground: true, deviceName: '' }",
    "win.webContents.print({ silent: true, printBackground: true, deviceName: '', copies: copies }"
)

with open(ipc_path, "w", encoding="utf-8") as f:
    f.write(ipc_content)

# 2. Update Billing.jsx
with open(billing_path, "r", encoding="utf-8") as f:
    content = f.read()

# Chunk 1: useEffect load everything optimized
old_use_effect = """  useEffect(() => {
    if (window.electron && window.electron.db) {
      window.electron.db.getParties().then(data => setParties(data || []))
      window.electron.db.getAgents().then(data => setAgents(data || []))

      window.electron.ipcRenderer.invoke('get-settings').then(settings => {
        if (settings && settings.defaultTaxRate !== undefined) {
          setBillData(prev => ({ ...prev, taxRate: Number(settings.defaultTaxRate) }));
        }
      });
      loadStats()
      window.electron.db.getProducts && window.electron.db.getProducts().then(data => setProducts(data || []))
      window.electron.db.getLastBillNumber().then(lastNo => {
        if (lastNo) {
          setBillData(prev => ({ ...prev, billNumber: (parseInt(lastNo) + 1).toString() }))
        } else {
          setBillData(prev => ({ ...prev, billNumber: '1' }))
        }
      })
    }
  }, [loadStats])"""

new_use_effect = """  useEffect(() => {
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
  }, [loadStats])"""

content = content.replace(old_use_effect, new_use_effect)

# Chunk 2: handleSaveAndGenerate
old_sg = """      const transportCount = printCopies.transport || 1;
      for (let i = 0; i < transportCount; i++) {
        window.electron.ipcRenderer.invoke('generate-pdf', billData, items, 'transport').catch(console.error);
        window.electron.ipcRenderer.invoke('print-bill', billData, items, 'transport').catch(console.error);
      }

      const bigCount = printCopies.big || 1;
      for (let i = 0; i < bigCount; i++) {
        window.electron.ipcRenderer.invoke('generate-pdf', billData, items, 'big').catch(console.error);
        window.electron.ipcRenderer.invoke('print-bill', billData, items, 'big').catch(console.error);
      }"""

new_sg = """      const transportCount = printCopies.transport || 1;
      if (transportCount > 0) {
        window.electron.ipcRenderer.invoke('generate-pdf', billData, items, 'transport').catch(console.error);
        window.electron.ipcRenderer.invoke('print-bill', billData, items, 'transport', transportCount).catch(console.error);
      }

      const bigCount = printCopies.big || 1;
      if (bigCount > 0) {
        window.electron.ipcRenderer.invoke('generate-pdf', billData, items, 'big').catch(console.error);
        window.electron.ipcRenderer.invoke('print-bill', billData, items, 'big', bigCount).catch(console.error);
      }"""
content = content.replace(old_sg, new_sg)

# Chunk 3: handlePrint
old_p = """      // Fire and forget printing/generation so user doesn't wait
      for (let i = 0; i < count; i++) {
        window.electron.ipcRenderer.invoke('generate-pdf', billData, items, type).catch(console.error);
        window.electron.ipcRenderer.invoke('print-bill', billData, items, type).catch(console.error);
      }"""

new_p = """      // Fire and forget printing/generation so user doesn't wait
      if (count > 0) {
        window.electron.ipcRenderer.invoke('generate-pdf', billData, items, type).catch(console.error);
        window.electron.ipcRenderer.invoke('print-bill', billData, items, type, count).catch(console.error);
      }"""
content = content.replace(old_p, new_p)

# Chunk 4: resetForm focus 
# Just replacing the final bracket logic to introduce setTimeout
old_rf = """    })
    setItems([{ id: Date.now(), size: '', productName: '', quantity: 0, rate: 0, amount: 0, baleNumber: '' }])
  }, [])"""

new_rf = """    })
    setItems([{ id: Date.now(), size: '', productName: '', quantity: 0, rate: 0, amount: 0, baleNumber: '' }])
    
    // UI Focus Restore optimization
    setTimeout(() => {
      if (partyNameRef.current) partyNameRef.current.focus();
    }, 50);
  }, [])"""
content = content.replace(old_rf, new_rf)

with open(billing_path, "w", encoding="utf-8") as f:
    f.write(content)

print("Perf updates applied")
