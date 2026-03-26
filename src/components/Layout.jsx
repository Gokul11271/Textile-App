import React, { useState } from 'react'
import { LayoutDashboard, Receipt, Users, BarChart3, Settings, LogOut, Menu, ChevronLeft, Sun, Moon } from 'lucide-react'

export function Layout({ children, activePage, onNavigate, theme, onToggleTheme }) {
  const [isCollapsed, setIsCollapsed] = useState(false)

  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'billing', label: 'New Bill', icon: Receipt },
    { id: 'parties', label: 'Parties', icon: Users },
    { id: 'reports', label: 'Reports', icon: BarChart3 },
    { id: 'settings', label: 'Settings', icon: Settings },
  ]

  return (
    <div className="flex h-screen overflow-hidden font-sans transition-colors duration-300 ease-m3-standard bg-m3-surface text-m3-on-surface">
      {/* M3 Navigation Rail / Drawer */}
      <aside className={`${isCollapsed ? 'w-[80px]' : 'w-[260px]'} flex flex-col transition-all duration-300 ease-m3-emphasized relative group bg-m3-surface-container-low border-r border-m3-outline-variant`}>
        {/* Collapse Toggle */}
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="absolute -right-3.5 top-[72px] z-50 w-7 h-7 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200 bg-m3-primary-container text-m3-on-primary-container shadow-m3-1"
        >
          {isCollapsed ? <Menu size={14} /> : <ChevronLeft size={14} />}
        </button>

        {/* Brand */}
        <div className={`px-5 py-6 border-b border-m3-outline-variant ${isCollapsed ? 'flex flex-col items-center' : ''}`}>
          <h1 className={`font-display font-bold tracking-tight transition-all duration-300 text-m3-on-surface ${isCollapsed ? 'text-base' : 'text-lg'}`}>
            {isCollapsed ? 'DT' : 'Dhanalakshmi'}
          </h1>
          {!isCollapsed && (
            <p className="m3-label-small text-m3-on-surface-variant mt-0.5 tracking-wide">
              Textiles Billing
            </p>
          )}
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto overflow-x-hidden">
          {menuItems.map((item) => (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={`w-full flex items-center rounded-xl transition-all duration-200 ease-m3-standard
                ${activePage === item.id
                  ? 'bg-m3-secondary-container text-m3-on-secondary-container'
                  : 'text-m3-on-surface-variant hover:bg-m3-surface-container-highest'
                } ${isCollapsed ? 'justify-center px-0 py-3' : 'px-4 py-3 gap-3'}`}
              title={isCollapsed ? item.label : ''}
            >
              <item.icon size={20} strokeWidth={activePage === item.id ? 2.5 : 1.8} />
              {!isCollapsed && (
                <span className="m3-label-large">
                  {item.label}
                </span>
              )}
            </button>
          ))}
        </nav>

        {/* Footer Actions */}
        <div className={`px-3 py-4 border-t border-m3-outline-variant space-y-1 ${isCollapsed ? 'flex flex-col items-center' : ''}`}>
          <button
            onClick={onToggleTheme}
            className={`w-full flex items-center rounded-xl transition-all duration-200 ease-m3-standard text-m3-on-surface-variant hover:bg-m3-surface-container-highest ${isCollapsed ? 'justify-center px-0 py-3' : 'px-4 py-3 gap-3'}`}
            title="Toggle Theme"
          >
            {theme === 'dark' ? <Sun size={20} strokeWidth={1.8} /> : <Moon size={20} strokeWidth={1.8} />}
            {!isCollapsed && (
              <span className="m3-label-large">
                {theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
              </span>
            )}
          </button>
          <button
            className={`w-full flex items-center rounded-xl transition-all duration-200 ease-m3-standard text-m3-on-surface-variant hover:bg-m3-surface-container-highest ${isCollapsed ? 'justify-center px-0 py-3' : 'px-4 py-3 gap-3'}`}
            title={isCollapsed ? 'Logout' : ''}
          >
            <LogOut size={20} strokeWidth={1.8} />
            {!isCollapsed && (
              <span className="m3-label-large">
                Logout
              </span>
            )}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden bg-m3-surface">
        {/* M3 Top App Bar */}
        <header className="h-16 flex items-center justify-between px-6 bg-m3-surface-container border-b border-m3-outline-variant">
          <div className="flex items-center gap-3">
            {isCollapsed && (
              <button
                onClick={() => setIsCollapsed(false)}
                className="p-2 rounded-full text-m3-on-surface-variant hover:bg-m3-surface-container-highest transition-colors"
                title="Open Sidebar"
              >
                <Menu size={20} />
              </button>
            )}
            <h2 className="m3-title-medium text-m3-on-surface">
              {menuItems.find(m => m.id === activePage)?.label || 'Page'}
            </h2>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="m3-label-medium text-m3-on-surface">Staff User</p>
              <p className="m3-label-small text-m3-on-surface-variant">Admin Access</p>
            </div>
            <div className="w-10 h-10 rounded-full flex items-center justify-center m3-title-small bg-m3-primary-container text-m3-on-primary-container">
              D
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
          {children}
        </div>
      </main>
    </div>
  )
}
