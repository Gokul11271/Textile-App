import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'

// Mock Electron for Browser/Development Testing
if (!window.electron) {
  console.warn('Electron not detected. Injecting mock for development.');
  window.electron = {
    ipcRenderer: {
      invoke: async (channel, ...args) => {
        console.log(`[Mock Electron] Invoke channel: ${channel}`, args);
        if (channel === 'get-dashboard-stats') return { totalBills: 5, lastBillNo: 'DT-Mock-005', totalBales: 12 };
        if (channel === 'get-recent-bills') return [
          { id: 1, bill_number: 'DT-MOCK-001', date: '26-MAR-2026', party_name: 'Mock Customer', party_short_name: 'MC', total_amount: 1500 },
          { id: 2, bill_number: 'DT-MOCK-002', date: '25-MAR-2026', party_name: 'Test Party', party_short_name: 'TP', total_amount: 2500 }
        ];
        return [];
      },
      on: (channel, func) => console.log(`[Mock Electron] On channel: ${channel}`),
    },
    db: {
      getParties: async () => [{ id: 1, name: 'Mock Party', address: '123 Mock St', gst_number: '22AAAAA0000A1Z5' }],
      saveParty: async (party) => { console.log('Mock Save Party', party); return 1; },
      getAgents: async () => [{ id: 1, name: 'Mock Agent' }],
      saveBill: async (bill, items) => { console.log('Mock Save Bill', { bill, items }); return 1; },
      getLastBillNumber: async () => 'DT-Mock-005',
      getBillByNumber: async (num) => null,
      getDashboardStats: async () => ({ totalBills: 5, lastBillNo: 'DT-Mock-005', totalBales: 12 }),
    }
  };
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
