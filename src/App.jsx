import { useState, useEffect } from 'react'
import { Layout } from './components/Layout'
import { Dashboard } from './components/Dashboard'
import { Billing } from './components/Billing'
import Parties from './components/Parties'
import { Reports } from './components/Reports'
import Settings from './components/Settings'
import { AlertProvider } from './components/AlertProvider'
import { Toaster } from 'sonner'

function App() {
  const [currentPage, setCurrentPage] = useState('dashboard')
  const [theme, setTheme] = useState(localStorage.getItem('theme') || 'dark')

  useEffect(() => {
    localStorage.setItem('theme', theme)
    if (theme === 'dark') {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  }, [theme])

  const toggleTheme = () => setTheme(prev => prev === 'dark' ? 'light' : 'dark')

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
          {currentPage === 'reports' && <Reports theme={theme} />}
          {currentPage === 'settings' && <Settings />}
        </Layout>
      </AlertProvider>
    </div>
  )
}

export default App
