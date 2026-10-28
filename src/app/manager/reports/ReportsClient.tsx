'use client'

import { useState, useMemo } from 'react'
import Image from 'next/image'
import { AuditReportTransaction } from './page'

interface Props {
  initialTransactions: AuditReportTransaction[]
}

export default function ReportsClient({ initialTransactions }: Props) {
  const [transactions] = useState<AuditReportTransaction[]>(initialTransactions)
  const [typeFilter, setTypeFilter] = useState<string>('ALL')
  const [discrepancyFilter, setDiscrepancyFilter] = useState<'all' | 'shortage' | 'surplus' | 'match'>('all')
  const [searchQuery, setSearchQuery] = useState('')

  // KPI Calculations
  const stats = useMemo(() => {
    const cycleCounts = transactions.filter((t) => t.transaction_type === 'CYCLE_COUNT')
    const wasteLogs = transactions.filter((t) => t.transaction_type === 'WASTE')

    const exactMatches = cycleCounts.filter((t) => t.discrepancy === 0).length
    const accuracyRate = cycleCounts.length > 0 ? Math.round((exactMatches / cycleCounts.length) * 100) : 100

    const netVarianceImpact = cycleCounts.reduce((sum, t) => sum + (t.financialImpact || 0), 0)
    const totalWasteLoss = wasteLogs.reduce((sum, t) => sum + Math.abs(t.financialImpact || 0), 0)

    return {
      totalAudits: cycleCounts.length,
      accuracyRate,
      netVarianceImpact: Math.round(netVarianceImpact * 100) / 100,
      totalWasteLoss: Math.round(totalWasteLoss * 100) / 100,
    }
  }, [transactions])

  // Filtered transactions
  const filtered = useMemo(() => {
    return transactions.filter((tx) => {
      // Type filter
      if (typeFilter !== 'ALL' && tx.transaction_type !== typeFilter) return false

      // Discrepancy filter
      if (discrepancyFilter === 'shortage' && (tx.discrepancy === null || tx.discrepancy >= 0)) return false
      if (discrepancyFilter === 'surplus' && (tx.discrepancy === null || tx.discrepancy <= 0)) return false
      if (discrepancyFilter === 'match' && tx.discrepancy !== 0) return false

      // Search query
      if (searchQuery) {
        const query = searchQuery.toLowerCase()
        const matchesName = tx.ingredientName.toLowerCase().includes(query)
        const matchesNotes = (tx.notes || '').toLowerCase().includes(query)
        if (!matchesName && !matchesNotes) return false
      }

      return true
    })
  }, [transactions, typeFilter, discrepancyFilter, searchQuery])

  // Export to CSV
  function handleExportCSV() {
    const headers = ['Timestamp', 'Transaction Type', 'Ingredient', 'Quantity', 'Unit', 'Discrepancy', 'Financial Impact ($)', 'Notes']
    const rows = filtered.map((tx) => [
      new Date(tx.created_at).toLocaleString(),
      tx.transaction_type,
      `"${tx.ingredientName}"`,
      tx.quantity,
      tx.unit,
      tx.discrepancy !== null ? tx.discrepancy : 'N/A',
      tx.financialImpact,
      `"${(tx.notes || '').replace(/"/g, '""')}"`,
    ])

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n')
    const encodedUri = encodeURI(csvContent)
    const link = document.createElement('a')
    link.setAttribute('href', encodedUri)
    link.setAttribute('download', `chebong-inventory-audit-${new Date().toISOString().slice(0, 10)}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  return (
    <div className="space-y-6">
      {/* Branded Audit Ledger Header */}
      <div className="bg-white rounded-2xl border border-gray-200/80 shadow-xs p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="relative h-11 w-11 shrink-0">
            <Image
              src="/chebong-bowl.png"
              alt="CB Inventory Logo"
              fill
              className="object-contain"
              priority
            />
          </div>
          <div>
            <h2 className="text-lg font-extrabold text-gray-900 tracking-tight">
              Audit & Inventory Ledger
            </h2>
            <p className="text-xs text-gray-500">
              Official store audit records, variances, stock transactions, and waste tracking
            </p>
          </div>
        </div>

        <button
          onClick={handleExportCSV}
          className="inline-flex items-center justify-center gap-2 bg-[#e85d04] hover:bg-[#d45203] text-white text-xs font-bold px-4 py-2.5 rounded-xl shadow-xs transition-all active:scale-98 shrink-0"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="7 10 12 15 17 10"/>
            <line x1="12" y1="15" x2="12" y2="3"/>
          </svg>
          Export Audit CSV
        </button>
      </div>

      {/* Top Metric Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl border border-gray-200/80 shadow-xs p-5">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Manual Cycle Counts</p>
          <p className="text-2xl sm:text-3xl font-extrabold text-gray-900 mt-1">
            {stats.totalAudits}
          </p>
          <p className="text-xs text-gray-400 mt-1">Physical audit sessions logged</p>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200/80 shadow-xs p-5">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Audit Accuracy</p>
          <p className="text-2xl sm:text-3xl font-extrabold text-[#2e7d32] mt-1">
            {stats.accuracyRate}%
          </p>
          <p className="text-xs text-green-700 mt-1 font-semibold">Exact physical matches</p>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200/80 shadow-xs p-5">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Net Audit Variance</p>
          <p className={`text-2xl sm:text-3xl font-extrabold mt-1 ${stats.netVarianceImpact < 0 ? 'text-red-600' : 'text-gray-900'}`}>
            {stats.netVarianceImpact >= 0 ? `+$${stats.netVarianceImpact}` : `-$${Math.abs(stats.netVarianceImpact)}`}
          </p>
          <p className="text-xs text-gray-400 mt-1">Dollar value of variance</p>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200/80 shadow-xs p-5">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Total Waste Losses</p>
          <p className="text-2xl sm:text-3xl font-extrabold text-red-600 mt-1">
            ${stats.totalWasteLoss.toFixed(2)}
          </p>
          <p className="text-xs text-red-500 mt-1 font-semibold">Recorded discarded items</p>
        </div>
      </div>

      {/* Toolbar & Filters */}
      <div className="bg-white rounded-2xl border border-gray-200/80 shadow-xs p-4 sm:p-5 space-y-3.5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          {/* Transaction Type Filter Tabs */}
          <div className="flex items-center gap-1 overflow-x-auto no-scrollbar bg-gray-100/80 p-1 rounded-xl">
            {['ALL', 'CYCLE_COUNT', 'RESTOCK', 'WASTE', 'SALE'].map((t) => (
              <button
                key={t}
                onClick={() => setTypeFilter(t)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
                  typeFilter === t
                    ? 'bg-white text-gray-900 shadow-2xs'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                {t === 'ALL'
                  ? 'All Transactions'
                  : t === 'CYCLE_COUNT'
                  ? 'Audits (Cycle Count)'
                  : t === 'RESTOCK'
                  ? 'Restocks'
                  : t === 'WASTE'
                  ? 'Waste'
                  : 'Clover Sales'}
              </button>
            ))}
          </div>

          {/* Export Button */}
          <button
            onClick={handleExportCSV}
            className="inline-flex items-center gap-2 bg-white hover:bg-gray-50 border border-gray-200 text-gray-700 text-xs font-bold px-3.5 py-2 rounded-xl shadow-2xs transition-all active:scale-98 shrink-0 self-start lg:self-auto"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="7 10 12 15 17 10"/>
              <line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
            Export Audit CSV
          </button>
        </div>

        {/* Search & Audit Discrepancy Filter */}
        <div className="flex flex-col sm:flex-row items-center gap-3 pt-1">
          <div className="relative flex-1 w-full">
            <input
              type="text"
              placeholder="Search by ingredient name or audit note..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2 text-xs text-gray-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#e85d04]"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-2 text-xs text-gray-400"
              >
                ✕
              </button>
            )}
          </div>

          {typeFilter === 'CYCLE_COUNT' && (
            <div className="flex items-center gap-1 bg-gray-50 border border-gray-200 rounded-xl p-1 text-xs w-full sm:w-auto">
              <span className="text-[11px] font-bold text-gray-400 px-2 uppercase">Variance:</span>
              <button
                onClick={() => setDiscrepancyFilter('all')}
                className={`px-2.5 py-1 rounded-lg font-bold ${
                  discrepancyFilter === 'all' ? 'bg-white shadow-2xs text-gray-900' : 'text-gray-500'
                }`}
              >
                All
              </button>
              <button
                onClick={() => setDiscrepancyFilter('shortage')}
                className={`px-2.5 py-1 rounded-lg font-bold ${
                  discrepancyFilter === 'shortage' ? 'bg-red-50 text-red-700 shadow-2xs' : 'text-gray-500'
                }`}
              >
                Shortages
              </button>
              <button
                onClick={() => setDiscrepancyFilter('surplus')}
                className={`px-2.5 py-1 rounded-lg font-bold ${
                  discrepancyFilter === 'surplus' ? 'bg-blue-50 text-blue-700 shadow-2xs' : 'text-gray-500'
                }`}
              >
                Surplus
              </button>
              <button
                onClick={() => setDiscrepancyFilter('match')}
                className={`px-2.5 py-1 rounded-lg font-bold ${
                  discrepancyFilter === 'match' ? 'bg-green-50 text-green-700 shadow-2xs' : 'text-gray-500'
                }`}
              >
                Match
              </button>
            </div>
          )}
        </div>
      </div>

      {/* MOBILE CARD VIEW: Transaction and Audit logs for phone screens */}
      <div className="block md:hidden space-y-3">
        <div className="flex items-center justify-between px-1">
          <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">
            Audit Records ({filtered.length})
          </h3>
          <span className="text-[11px] text-gray-400">Mobile View</span>
        </div>
        {filtered.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-200 p-6 text-center text-xs text-gray-400">
            No transactions match the selected filter criteria.
          </div>
        ) : (
          filtered.map((tx) => {
            const date = new Date(tx.created_at)
            const formattedDate = date.toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
            })
            const formattedTime = date.toLocaleTimeString('en-US', {
              hour: '2-digit',
              minute: '2-digit',
            })

            return (
              <div
                key={tx.id}
                className="bg-white rounded-2xl border border-gray-200/80 shadow-xs p-4 space-y-2.5"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h4 className="font-extrabold text-gray-900 text-sm">{tx.ingredientName}</h4>
                    <span className="text-[11px] text-gray-400">{formattedDate} · {formattedTime}</span>
                  </div>
                  <div>
                    {tx.transaction_type === 'CYCLE_COUNT' ? (
                      <span className="text-[10px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md">
                        Cycle Count
                      </span>
                    ) : tx.transaction_type === 'RESTOCK' ? (
                      <span className="text-[10px] font-bold text-blue-800 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-md">
                        Restock
                      </span>
                    ) : tx.transaction_type === 'WASTE' ? (
                      <span className="text-[10px] font-bold text-red-800 bg-red-50 border border-red-200 px-2 py-0.5 rounded-md">
                        Waste
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold text-amber-800 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-md">
                        POS Sale
                      </span>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 bg-gray-50/80 rounded-xl p-2.5 text-xs">
                  <div>
                    <span className="text-gray-400 text-[10px] uppercase font-bold block">Recorded Qty</span>
                    <span className="font-extrabold text-gray-900">{tx.quantity} {tx.unit}</span>
                  </div>
                  <div>
                    <span className="text-gray-400 text-[10px] uppercase font-bold block">Variance</span>
                    {tx.discrepancy !== null ? (
                      <span className={`font-bold ${tx.discrepancy === 0 ? 'text-green-700' : tx.discrepancy > 0 ? 'text-blue-700' : 'text-red-700'}`}>
                        {tx.discrepancy === 0 ? '✓ Match' : `${tx.discrepancy > 0 ? '+' : ''}${tx.discrepancy} ${tx.unit}`}
                      </span>
                    ) : (
                      <span className="text-gray-400">N/A</span>
                    )}
                  </div>
                </div>

                {tx.notes && (
                  <p className="text-[11px] text-gray-500 italic bg-gray-50/50 rounded-lg px-2.5 py-1.5 border border-gray-100">
                    {tx.notes}
                  </p>
                )}
              </div>
            )
          })
        )}
      </div>

      {/* Robust Desktop Data Grid */}
      <div className="hidden md:block bg-white rounded-2xl border border-gray-200/80 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50/70 text-gray-600 text-xs font-bold uppercase tracking-wider border-b border-gray-100">
                <th className="py-3 px-5">Timestamp</th>
                <th className="py-3 px-4">Transaction Type</th>
                <th className="py-3 px-4">Ingredient</th>
                <th className="py-3 px-4">Quantity</th>
                <th className="py-3 px-4">Audit Discrepancy</th>
                <th className="py-3 px-4">Est. Financial Impact</th>
                <th className="py-3 px-5">Audit Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-sm">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-xs text-gray-400">
                    No transactions match the selected filter criteria.
                  </td>
                </tr>
              ) : (
                filtered.map((tx) => {
                  const date = new Date(tx.created_at)
                  const formattedDate = date.toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                  })
                  const formattedTime = date.toLocaleTimeString('en-US', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })

                  return (
                    <tr key={tx.id} className="hover:bg-gray-50/50 transition-colors">
                      {/* Timestamp */}
                      <td className="py-3 px-5 whitespace-nowrap">
                        <span className="font-bold text-gray-800 text-xs block">{formattedDate}</span>
                        <span className="text-[11px] text-gray-400">{formattedTime}</span>
                      </td>

                      {/* Transaction Type Badge */}
                      <td className="py-3 px-4">
                        {tx.transaction_type === 'CYCLE_COUNT' ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-200/80 px-2.5 py-0.5 rounded-md">
                            <span>📋</span> Cycle Count
                          </span>
                        ) : tx.transaction_type === 'RESTOCK' ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-800 bg-blue-50 border border-blue-200/80 px-2.5 py-0.5 rounded-md">
                            <span>📦</span> Restock
                          </span>
                        ) : tx.transaction_type === 'WASTE' ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-red-800 bg-red-50 border border-red-200/80 px-2.5 py-0.5 rounded-md">
                            <span>🗑️</span> Waste
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-purple-800 bg-purple-50 border border-purple-200/80 px-2.5 py-0.5 rounded-md">
                            <span>🛍️</span> Clover Sale
                          </span>
                        )}
                      </td>

                      {/* Ingredient */}
                      <td className="py-3 px-4 font-bold text-gray-900">
                        {tx.ingredientName}
                      </td>

                      {/* Quantity */}
                      <td className="py-3 px-4 text-xs font-semibold text-gray-700">
                        {tx.quantity} {tx.unit}
                      </td>

                      {/* Audit Discrepancy */}
                      <td className="py-3 px-4">
                        {tx.transaction_type === 'CYCLE_COUNT' && tx.discrepancy !== null ? (
                          tx.discrepancy === 0 ? (
                            <span className="inline-flex items-center text-[11px] font-bold text-green-700 bg-green-50 px-2.5 py-0.5 rounded-md border border-green-200/60">
                              ✓ 0.00 {tx.unit} (Exact Match)
                            </span>
                          ) : tx.discrepancy < 0 ? (
                            <span className="inline-flex items-center text-[11px] font-bold text-red-700 bg-red-50 px-2.5 py-0.5 rounded-md border border-red-200/60">
                              {tx.discrepancy.toFixed(2)} {tx.unit} Shortage
                            </span>
                          ) : (
                            <span className="inline-flex items-center text-[11px] font-bold text-blue-700 bg-blue-50 px-2.5 py-0.5 rounded-md border border-blue-200/60">
                              +{tx.discrepancy.toFixed(2)} {tx.unit} Surplus
                            </span>
                          )
                        ) : (
                          <span className="text-xs text-gray-400">—</span>
                        )}
                      </td>

                      {/* Est. Financial Impact */}
                      <td className="py-3 px-4 text-xs font-bold">
                        {tx.financialImpact === 0 ? (
                          <span className="text-gray-400">$0.00</span>
                        ) : tx.financialImpact > 0 ? (
                          <span className="text-green-700">+${tx.financialImpact.toFixed(2)}</span>
                        ) : (
                          <span className="text-red-600">-${Math.abs(tx.financialImpact).toFixed(2)}</span>
                        )}
                      </td>

                      {/* Audit Notes */}
                      <td className="py-3 px-5 text-xs text-gray-600 max-w-xs truncate" title={tx.notes || ''}>
                        {tx.notes || '—'}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

