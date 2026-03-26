import React, { useState } from 'react'
import { LayoutDashboard, Receipt, Users, Package, Settings, LogOut, Menu, ChevronLeft, Sun, Moon } from 'lucide-react'

export function Layout({ children, activePage, onNavigate, theme, onToggleTheme }) {
  const [isCollapsed, setIsCollapsed] = useState(false)

  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'billing', label: 'New Bill', icon: Receipt },
    { id: 'parties', label: 'Parties', icon: Users },
    { id: 'reports', label: 'Reports', icon: Receipt }, // Note: Using Receipt for now, maybe FileText is better
    { id: 'settings', label: 'Settings', icon: Settings },
  ]

  return (
    <div className={`flex h-screen overflow-hidden font-sans transition-colors duration-500 ${theme === 'dark' ? 'bg-premium-900 text-premium-100' : 'bg-[#fcfdfd] text-[#1a1a1a]'}`}>
      {/* Sidebar */}
      <aside className={`${isCollapsed ? 'w-20' : 'w-64'} flex flex-col transition-all duration-300 ease-in-out relative group ${theme === 'dark' ? 'bg-premium-black border-r border-premium-800' : 'bg-white border-r border-gray-100 shadow-sm'}`}>
        {/* Collapse Toggle */}
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className={`absolute -right-3 top-20 rounded-full p-1 transition-colors z-50 shadow-xl opacity-0 group-hover:opacity-100 border ${theme === 'dark' ? 'bg-premium-800 border-premium-700 text-premium-400 hover:text-white' : 'bg-white border-gray-200 text-gray-400 hover:text-black'}`}
        >
          {isCollapsed ? <Menu size={14} /> : <ChevronLeft size={14} />}
        </button>

        <div className={`p-6 border-b ${isCollapsed ? 'items-center flex flex-col' : ''} ${theme === 'dark' ? 'border-premium-800' : 'border-gray-50'}`}>
          <h1 className={`font-bold tracking-widest transition-all duration-300 ${isCollapsed ? 'text-lg' : 'text-xl'} ${theme === 'dark' ? 'text-white' : 'text-black'}`}>
            {isCollapsed ? 'DT' : 'DHANALAKSHMI'}
          </h1>
          {!isCollapsed && (
            <p className={`text-[10px] mt-1 uppercase tracking-[0.2em] font-bold animate-in fade-in duration-500 ${theme === 'dark' ? 'text-premium-500' : 'text-gray-400'}`}>
              Textiles Billing
            </p>
          )}
        </div>

        <nav className="flex-1 p-4 space-y-2 overflow-y-auto overflow-x-hidden">
          {menuItems.map((item) => (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={`w-full flex items-center px-4 py-3 rounded-xl transition-all duration-300 ${activePage === item.id
                  ? (theme === 'dark' ? 'bg-white text-black shadow-xl shadow-white/10 scale-[1.02]' : 'bg-black text-white shadow-xl shadow-black/10 scale-[1.02]')
                  : (theme === 'dark' ? 'text-premium-400 hover:bg-premium-800 hover:text-white' : 'text-gray-500 hover:bg-gray-50 hover:text-black')
                } ${isCollapsed ? 'justify-center border border-transparent' : 'space-x-3'}`}
              title={isCollapsed ? item.label : ''}
            >
              <item.icon size={20} strokeWidth={activePage === item.id ? 2.5 : 2} />
              {!isCollapsed && (
                <span className="font-bold text-sm uppercase tracking-wider animate-in fade-in slide-in-from-left-2 duration-300">
                  {item.label}
                </span>
              )}
            </button>
          ))}
        </nav>

        <div className={`p-4 border-t ${isCollapsed ? 'items-center flex flex-col' : ''} ${theme === 'dark' ? 'border-premium-800' : 'border-gray-50'}`}>
          <button
            onClick={onToggleTheme}
            className={`w-full flex items-center rounded-xl transition-colors py-3 mb-2 ${theme === 'dark' ? 'text-premium-500 hover:bg-white/5 hover:text-white' : 'text-gray-500 hover:bg-gray-50 hover:text-black'} ${isCollapsed ? 'justify-center' : 'px-4 space-x-3'}`}
            title="Toggle Light/Dark Theme"
          >
            {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
            {!isCollapsed && (
              <span className="font-bold text-xs uppercase tracking-widest">
                {theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
              </span>
            )}
          </button>
          <button
            className={`w-full flex items-center rounded-xl transition-colors py-3 ${theme === 'dark' ? 'text-premium-500 hover:bg-white/5 hover:text-white' : 'text-gray-500 hover:bg-gray-50 hover:text-black'} ${isCollapsed ? 'justify-center' : 'px-4 space-x-3'}`}
            title={isCollapsed ? 'Logout' : ''}
          >
            <LogOut size={20} />
            {!isCollapsed && (
              <span className="font-bold text-xs uppercase tracking-widest">
                Logout
              </span>
            )}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className={`flex-1 flex flex-col overflow-hidden ${theme === 'dark' ? 'bg-premium-900' : 'bg-[#fcfdfd]'}`}>
        <header className={`h-16 border-b flex items-center justify-between px-8 ${theme === 'dark' ? 'bg-premium-black/50 backdrop-blur-xl border-premium-800' : 'bg-white/80 backdrop-blur-xl border-gray-100 shadow-[0_1px_2px_0_rgba(0,0,0,0.02)]'}`}>
          <div className="flex items-center space-x-4">
            {isCollapsed && (
              <button
                onClick={() => setIsCollapsed(false)}
                className={`p-2 transition-colors ${theme === 'dark' ? 'text-premium-400 hover:text-white' : 'text-gray-400 hover:text-black'}`}
                title="Open Sidebar"
              >
                <Menu size={20} />
              </button>
            )}
            <h2 className={`text-[10px] font-black uppercase tracking-[0.3em] ${theme === 'dark' ? 'text-premium-500' : 'text-[#8c8c8c]'}`}>
              {menuItems.find(m => m.id === activePage)?.label || 'Page'}
            </h2>
          </div>
          <div className="flex items-center space-x-5">
            <div className="text-right">
              <p className={`text-[11px] font-black uppercase tracking-wider ${theme === 'dark' ? 'text-white' : 'text-black'}`}>Staff User</p>
              <p className={`text-[9px] font-bold uppercase ${theme === 'dark' ? 'text-premium-600' : 'text-gray-400'}`}>Admin Access</p>
            </div>
            <div className={`w-9 h-9 border rounded-full flex items-center justify-center font-black text-xs ${theme === 'dark' ? 'border-premium-700 bg-premium-800 text-white' : 'border-gray-300 bg-white text-black'}`}>
              D
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-2">
          {children}
        </div>
      </main>
    </div>
  )
}
