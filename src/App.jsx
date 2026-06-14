import { useState, useEffect } from 'react'
import { Layout } from './components/Layout'
import { Dashboard } from './components/Dashboard'
import { Billing } from './components/Billing'
import Parties from './components/Parties'
import Statements from './components/Statements'
import { Reports } from './components/Reports'
import Purchases from './components/Purchases'
import Agents from './components/Agents'
import Settings from './components/Settings'
import { AlertProvider } from './components/AlertProvider'
import { Toaster } from 'sonner'
import { useStore } from './store'

function App() {
  const [currentPage, setCurrentPage] = useState(localStorage.getItem('currentPage') || 'dashboard')
  const [theme, setTheme] = useState(localStorage.getItem('theme') || 'dark')
  const { fetchInitialData, isLoading, error } = useStore()

  useEffect(() => {
    fetchInitialData()
  }, [])

  useEffect(() => {
    localStorage.setItem('currentPage', currentPage)
  }, [currentPage])

  useEffect(() => {
    localStorage.setItem('theme', theme)
    if (theme === 'dark') {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  }, [theme])

  const toggleTheme = () => setTheme(prev => prev === 'dark' ? 'light' : 'dark')

  if (isLoading) {
    return <div className="min-h-screen bg-gray-900 flex items-center justify-center text-white">Loading application data...</div>
  }

  if (error) {
    return <div className="min-h-screen bg-gray-900 flex items-center justify-center text-red-400">Error loading app: {error}</div>
  }

  return (
    <div className={theme === 'dark' ? 'dark' : ''}>
      <Toaster position="bottom-right" richColors theme={theme} />
      <AlertProvider>
        <Layout
          activePage={currentPage}
          onNavigate={setCurrentPage}
          theme={theme}
          onToggleTheme={toggleTheme}
        >
          {currentPage === 'dashboard' && <Dashboard onNavigate={setCurrentPage} />}
          {currentPage === 'billing' && <Billing />}
          {currentPage === 'parties' && <Parties />}
          {currentPage === 'statements' && <Statements />}
          {currentPage === 'reports' && <Reports theme={theme} />}
          {currentPage === 'purchases' && <Purchases theme={theme} />}
          {currentPage === 'agents' && <Agents />}
          {currentPage === 'settings' && <Settings />}
        </Layout>
      </AlertProvider>
    </div>
  )
}

export default App
