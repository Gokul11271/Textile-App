import React, { useState, useEffect } from 'react'
import { TrendingUp, FileText, ShoppingBag, Archive } from 'lucide-react'

export function Dashboard() {
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
    { label: 'Total Bills', value: stats.totalBills, icon: FileText, darkBg: 'bg-white/5', lightBg: 'bg-gray-50', darkText: 'text-white', lightText: 'text-black' },
    { label: 'Last Bill No', value: stats.lastBillNo, icon: TrendingUp, darkBg: 'bg-white/10', lightBg: 'bg-gray-100', darkText: 'text-white', lightText: 'text-black' },
    { label: 'Bale Count', value: stats.totalBales, icon: Archive, darkBg: 'bg-premium-700', lightBg: 'bg-black', darkText: 'text-white', lightText: 'text-white' },
  ]

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div>
        <h1 className="text-2xl font-bold  dark:text-white text-black">Welcome back,</h1>
        <p className="mt-1 dark:text-premium-400 text-gray-500">Here is the quick overview for your textile shop today.</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statCards.map((stat, idx) => (
          <div key={idx} className="p-6 rounded-2xl border transition-all duration-300 group cursor-default dark:bg-premium-800/50 dark:border-premium-700 bg-white border-gray-100 shadow-[0_2px_4px_rgba(0,0,0,0.01)] hover:shadow-md dark:hover:border-premium-500">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-sm font-medium dark:text-premium-400 text-gray-400">{stat.label}</p>
                <h3 className="text-2xl font-bold mt-1 dark:text-white text-black">{stat.value}</h3>
              </div>
              <div className={`p-3 rounded-xl transition-transform group-hover:scale-110 ${stat.darkBg} ${stat.lightBg} ${stat.darkText} ${stat.lightText}`}>
                <stat.icon size={20} />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Recent Activity */}
      <div className="rounded-2xl border overflow-hidden transition-all duration-300 dark:bg-premium-800/50 dark:border-premium-700 bg-white border-gray-100 shadow-sm">
        <div className="p-6 border-b flex justify-between items-center dark:border-premium-700 border-gray-50">
          <h3 className="font-bold dark:text-white text-black">Recent Bills</h3>
          <button className="text-xs font-bold uppercase tracking-wider dark:text-premium-400 text-gray-400 hover:dark:text-white hover:text-black transition-colors">View All</button>
        </div>
        
        <div className="overflow-x-auto min-h-[200px]">
          {loading ? (
             <div className="p-12 text-center text-gray-400 text-sm">Loading recent bills...</div>
          ) : recentBills.length > 0 ? (
            <table className="w-full text-left border-collapse">
              <thead className="text-[10px] uppercase tracking-wider dark:text-premium-500 text-gray-400 border-b dark:border-premium-700/50 border-gray-50">
                <tr>
                  <th className="px-6 py-4 font-bold">Bill No</th>
                  <th className="px-6 py-4 font-bold">Date</th>
                  <th className="px-6 py-4 font-bold">Party Name</th>
                  <th className="px-6 py-4 font-bold text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y dark:divide-premium-700/30 divide-gray-50">
                {recentBills.map((bill) => (
                  <tr key={bill.id} className="dark:hover:bg-premium-400/5 hover:bg-gray-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <span className="text-sm font-bold dark:text-white text-black font-premium-mono">
                         {bill.bill_number}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm dark:text-premium-400 text-gray-500">{bill.date}</td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="text-sm font-semibold dark:text-white text-black">{bill.party_name || 'N/A'}</span>
                        <span className="text-[10px] dark:text-premium-500 text-gray-400">{bill.party_short_name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <span className="text-sm font-black dark:text-white text-black font-premium-mono">
                        ₹{bill.total_amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="p-12 text-center">
              <div className="inline-flex p-4 rounded-full mb-4 dark:bg-premium-700/50 dark:text-premium-500 bg-gray-50 text-gray-300">
                <FileText size={32} />
              </div>
              <p className="text-sm dark:text-premium-400 text-gray-400 font-medium">No recent activity found. Start by creating a new bill!</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
