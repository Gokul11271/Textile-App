const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electron', {
  ipcRenderer: {
    invoke: (channel, ...args) => ipcRenderer.invoke(channel, ...args),
    on: (channel, func) => ipcRenderer.on(channel, (event, ...args) => func(...args)),
  },
  db: {
    getParties: () => ipcRenderer.invoke('get-parties'),
    saveParty: (party) => ipcRenderer.invoke('save-party', party),
    getAgents: () => ipcRenderer.invoke('get-agents'),
    saveBill: (bill, items) => ipcRenderer.invoke('save-bill', bill, items),
    getLastBillNumber: () => ipcRenderer.invoke('get-last-bill-number'),
    getBillByNumber: (num) => ipcRenderer.invoke('get-bill-by-number', num),
    getDashboardStats: () => ipcRenderer.invoke('get-dashboard-stats'),
    getProducts: () => ipcRenderer.invoke('get-products'),
    getPartyGsts: (partyId) => ipcRenderer.invoke('get-party-gsts', partyId),
    setActiveGst: (partyId, gstId) => ipcRenderer.invoke('set-active-gst', partyId, gstId),
    deletePartyGst: (partyId, gstId) => ipcRenderer.invoke('delete-party-gst', partyId, gstId),
    getPurchases: (startDate, endDate) => ipcRenderer.invoke('get-purchases', startDate, endDate),
    savePurchase: (purchase) => ipcRenderer.invoke('save-purchase', purchase),
    deletePurchase: (id) => ipcRenderer.invoke('delete-purchase', id),
  }
});
