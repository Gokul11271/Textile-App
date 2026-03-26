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
  }
});
