import { create } from 'zustand'

export const useStore = create((set, get) => ({
  parties: [],
  agents: [],
  settings: {},
  products: [],
  isLoading: true,
  error: null,

  // Load all foundational data from IPC
  fetchInitialData: async () => {
    set({ isLoading: true, error: null })
    try {
      // Execute IPC calls concurrently for performance
      const [partiesData, agentsData, settingsData, productsData] = await Promise.all([
        window.electron.ipcRenderer.invoke('get-parties'),
        window.electron.ipcRenderer.invoke('get-agents'),
        window.electron.ipcRenderer.invoke('get-settings'),
        window.electron.ipcRenderer.invoke('get-products')
      ])

      set({
        parties: partiesData || [],
        agents: agentsData || [],
        settings: settingsData || {},
        products: productsData || [],
        isLoading: false
      })
    } catch (err) {
      console.error('Failed to load initial data:', err)
      set({ error: err.message, isLoading: false })
    }
  },

  // Actions for Parties
  refreshParties: async () => {
    try {
      const partiesData = await window.electron.ipcRenderer.invoke('get-parties')
      set({ parties: partiesData || [] })
    } catch (err) {
      console.error('Failed to refresh parties:', err)
    }
  },

  // Actions for Agents
  refreshAgents: async () => {
    try {
      const agentsData = await window.electron.ipcRenderer.invoke('get-agents')
      set({ agents: agentsData || [] })
    } catch (err) {
      console.error('Failed to refresh agents:', err)
    }
  },

  // Actions for Settings
  refreshSettings: async () => {
    try {
      const settingsData = await window.electron.ipcRenderer.invoke('get-settings')
      set({ settings: settingsData || {} })
    } catch (err) {
      console.error('Failed to refresh settings:', err)
    }
  },

  // Actions for Products
  refreshProducts: async () => {
    try {
      const productsData = await window.electron.ipcRenderer.invoke('get-products')
      set({ products: productsData || [] })
    } catch (err) {
      console.error('Failed to refresh products:', err)
    }
  }
}))
