import React, { useState, useEffect } from 'react'
import { TrendingUp, FileText, Archive, ArrowRight } from 'lucide-react'

export function Dashboard({ onNavigate }) {
  const [stats, setStats] = useState({
    totalBills: '0',
    lastBillNo: 'N/A',
    totalBales: '0'
  })

  const [recentBills, setRecentBills] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (window.electron && window.electron.ipcRenderer) {
      window.electron.ipcRenderer.invoke('get-dashboard-stats').then(s => {
        if (s) {
          setStats({
            totalBills: (s.totalBills || 0).toString(),
            lastBillNo: s.lastBillNo || 'N/A',
            totalBales: (s.totalBales || 0).toString()
          })
        }
      })

      window.electron.ipcRenderer.invoke('get-recent-bills').then(data => {
        setRecentBills(data || [])
        setLoading(false)
      })
    }
  }, [])

  const statCards = [
    { label: 'Total Bills', value: stats.totalBills, icon: FileText, accent: 'bg-m3-primary-container text-m3-on-primary-container' },
    { label: 'Last Bill No', value: stats.lastBillNo, icon: TrendingUp, accent: 'bg-m3-secondary-container text-m3-on-secondary-container' },
    { label: 'Bale Count', value: stats.totalBales, icon: Archive, accent: 'bg-m3-tertiary-container text-m3-on-tertiary-container' },
  ]

  return (
    <div className="space-y-8 animate-in fade-in duration-500 font-sans">
      {/* Welcome Header */}
      <div>
        <h1 className="m3-headline-medium font-display text-m3-on-surface">Welcome back</h1>
        <p className="m3-body-large text-m3-on-surface-variant mt-1">Here's a quick overview for your textile shop today.</p>
      </div>

      {/* M3 Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {statCards.map((stat, idx) => (
          <div key={idx} className="p-5 rounded-xl border border-m3-outline-variant bg-m3-surface-container-low transition-all duration-200 ease-m3-standard hover:shadow-m3-1 group cursor-default">
            <div className="flex justify-between items-start">
              <div>
                <p className="m3-label-medium text-m3-on-surface-variant">{stat.label}</p>
                <h3 className="m3-headline-small font-display font-medium mt-1 text-m3-on-surface">{stat.value}</h3>
              </div>
              <div className={`p-3 rounded-xl transition-transform duration-200 group-hover:scale-105 ${stat.accent}`}>
                <stat.icon size={20} />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Recent Activity - M3 Card */}
      <div className="rounded-xl border border-m3-outline-variant bg-m3-surface-container-lowest overflow-hidden">
        <div className="px-6 py-4 border-b border-m3-outline-variant flex justify-between items-center bg-m3-surface-container-low">
          <h3 className="m3-title-medium text-m3-on-surface">Recent Bills</h3>
          <button 
            onClick={() => onNavigate('reports')}
            className="m3-label-large text-m3-primary flex items-center gap-1 hover:underline underline-offset-4"
          >
            View All
            <ArrowRight size={16} />
          </button>
        </div>
        
        <div className="overflow-x-auto min-h-[200px]">
          {loading ? (
             <div className="p-12 text-center">
              <div className="w-8 h-8 border-2 border-m3-primary/30 border-t-m3-primary rounded-full animate-spin mx-auto mb-4"></div>
              <p className="m3-body-medium text-m3-on-surface-variant">Loading recent bills...</p>
            </div>
          ) : recentBills.length > 0 ? (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-m3-outline-variant bg-m3-surface-container-low">
                  <th className="px-6 py-3 m3-label-medium text-m3-on-surface-variant">Bill No</th>
                  <th className="px-6 py-3 m3-label-medium text-m3-on-surface-variant">Date</th>
                  <th className="px-6 py-3 m3-label-medium text-m3-on-surface-variant">Party Name</th>
                  <th className="px-6 py-3 m3-label-medium text-m3-on-surface-variant text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-m3-outline-variant">
                {recentBills.map((bill) => (
                  <tr key={bill.id} className="hover:bg-m3-surface-container-low transition-colors duration-150">
                    <td className="px-6 py-4">
                      <span className="m3-label-large font-mono text-m3-on-surface">
                         {bill.bill_number}
                      </span>
                    </td>
                    <td className="px-6 py-4 m3-body-medium text-m3-on-surface-variant">{bill.date}</td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="m3-body-medium font-medium text-m3-on-surface">{bill.party_name || 'N/A'}</span>
                        <span className="m3-label-small text-m3-on-surface-variant">{bill.party_short_name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <span className="m3-label-large font-mono text-m3-on-surface">
                        ₹{bill.total_amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="p-16 text-center">
              <div className="inline-flex p-5 rounded-full mb-4 bg-m3-surface-container-highest text-m3-on-surface-variant">
                <FileText size={32} />
              </div>
              <p className="m3-body-large text-m3-on-surface-variant">No recent activity found. Start by creating a new bill!</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
