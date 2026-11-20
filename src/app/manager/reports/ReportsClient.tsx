'use client'

import { useState, useMemo } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { buildAuditCsv, downloadCsvFile } from '@/lib/csv'
import { formatStoreTimestamp, getStoreDateString, getStoreTimezone, StoreRangeBounds } from '@/lib/timezone'
import { AuditReportTransaction } from './page'

interface Props {
  initialTransactions: AuditReportTransaction[]
  rangeKey: StoreRangeBounds['rangeKey']
  fromDate: string
  toDate: string
}

const RANGE_OPTIONS: Array<{ key: StoreRangeBounds['rangeKey']; label: string }> = [
  { key: 'today', label: 'Today' },
  { key: '7d', label: '7 Days' },
  { key: '30d', label: '30 Days' },
  { key: 'month', label: 'This Month' },
  { key: 'all', label: 'All Time' },
]

function formatSignedCurrency(amount: number): string {
  const abs = Math.abs(amount).toFixed(2)
  if (amount > 0) return `+$${abs}`
  if (amount < 0) return `-$${abs}`
  return '$0.00'
}

export default function ReportsClient({
  initialTransactions,
  rangeKey,
  fromDate,
  toDate,
}: Props) {
  const router = useRouter()
  const storeTimeZone = getStoreTimezone()

  const transactions = initialTransactions
  const [typeFilter, setTypeFilter] = useState<string>('ALL')
  const [discrepancyFilter, setDiscrepancyFilter] = useState<'all' | 'shortage' | 'surplus' | 'match'>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [inspectedTx, setInspectedTx] = useState<AuditReportTransaction | null>(null)

  const [customFrom, setCustomFrom] = useState(fromDate)
  const [customTo, setCustomTo] = useState(toDate)
  const [showCustomDates, setShowCustomDates] = useState(rangeKey === 'custom')

  function navigateWithRange(nextRange: StoreRangeBounds['rangeKey'], nextFrom?: string, nextTo?: string) {
    const params = new URLSearchParams()
    params.set('range', nextRange)
    if (nextRange === 'custom' && nextFrom && nextTo) {
      params.set('from', nextFrom)
      params.set('to', nextTo)
    }
    router.push(`/manager/reports?${params.toString()}`)
  }

  function handlePresetClick(key: StoreRangeBounds['rangeKey']) {
    setShowCustomDates(false)
    navigateWithRange(key)
  }

  function handleApplyCustomRange(e: React.FormEvent) {
    e.preventDefault()
    if (!customFrom || !customTo) return
    navigateWithRange('custom', customFrom, customTo)
  }

  // KPI Calculations
  const stats = useMemo(() => {
    const cycleCounts = transactions.filter((t) => t.transaction_type === 'CYCLE_COUNT')
    const wasteLogs = transactions.filter((t) => t.transaction_type === 'WASTE')
    const saleLogs = transactions.filter((t) => t.transaction_type === 'SALE')

    const exactMatches = cycleCounts.filter((t) => t.discrepancy === 0).length
    const accuracyRate = cycleCounts.length > 0 ? Math.round((exactMatches / cycleCounts.length) * 100) : 100

    const netVarianceImpact = cycleCounts.reduce((sum, t) => sum + (t.financialImpact || 0), 0)
    const totalWasteLoss = wasteLogs.reduce((sum, t) => sum + Math.abs(t.financialImpact || 0), 0)
    const totalSalesCogs = saleLogs.reduce((sum, t) => sum + Math.abs(t.financialImpact || 0), 0)

    return {
      totalAudits: cycleCounts.length,
      accuracyRate,
      netVarianceImpact: Math.round(netVarianceImpact * 100) / 100,
      totalWasteLoss: Math.round(totalWasteLoss * 100) / 100,
      totalSalesCogs: Math.round(totalSalesCogs * 100) / 100,
    }
  }, [transactions])

  // Count by log type
  const typeCounts = useMemo(() => {
    return {
      ALL: transactions.length,
      CYCLE_COUNT: transactions.filter((t) => t.transaction_type === 'CYCLE_COUNT').length,
      RESTOCK: transactions.filter((t) => t.transaction_type === 'RESTOCK').length,
      WASTE: transactions.filter((t) => t.transaction_type === 'WASTE').length,
      SALE: transactions.filter((t) => t.transaction_type === 'SALE').length,
    }
  }, [transactions])

  // Filtered transactions
  const filtered = useMemo(() => {
    return transactions.filter((tx) => {
      if (typeFilter !== 'ALL' && tx.transaction_type !== typeFilter) return false

      if (discrepancyFilter === 'shortage' && (tx.discrepancy === null || tx.discrepancy >= 0)) return false
      if (discrepancyFilter === 'surplus' && (tx.discrepancy === null || tx.discrepancy <= 0)) return false
      if (discrepancyFilter === 'match' && tx.discrepancy !== 0) return false

      if (searchQuery) {
        const query = searchQuery.toLowerCase()
        const matchesName = tx.ingredientName.toLowerCase().includes(query)
        const matchesNotes = (tx.notes || '').toLowerCase().includes(query)
        const matchesRef = (tx.reference_id || '').toLowerCase().includes(query)
        if (!matchesName && !matchesNotes && !matchesRef) return false
      }

      return true
    })
  }, [transactions, typeFilter, discrepancyFilter, searchQuery])

  function handleExportCSV() {
    const csv = buildAuditCsv(filtered, storeTimeZone)
    const dateStamp = getStoreDateString(new Date(), storeTimeZone)
    downloadCsvFile(csv, `chebong-inventory-logs-${dateStamp}.csv`)
  }

  return (
    <div className="space-y-6">
      {/* Branded Audit Ledger Header */}
      <div className="bg-white rounded-2xl border border-gray-200/80 shadow-xs p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
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
                Activity Log History &amp; Audit Ledger
              </h2>
              <p className="text-xs text-gray-500">
                {rangeKey === 'all'
                  ? `All recorded store movements (${transactions.length} entries)`
                  : `Showing ${fromDate} to ${toDate} (${transactions.length} entries · ${storeTimeZone})`}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleExportCSV}
            className="inline-flex items-center justify-center gap-2 bg-[#e85d04] hover:bg-[#d45203] text-white text-xs font-bold px-4 py-2.5 rounded-xl shadow-xs transition-all active:scale-98 shrink-0"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="7 10 12 15 17 10"/>
              <line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
            Export Logs CSV ({filtered.length})
          </button>
        </div>

        {/* Date Range Filter Bar */}
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-gray-100">
          <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mr-1">
            Date Range:
          </span>
          {RANGE_OPTIONS.map((opt) => (
            <button
              key={opt.key}
              type="button"
              onClick={() => handlePresetClick(opt.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                rangeKey === opt.key && !showCustomDates
                  ? 'bg-gray-900 text-white shadow-2xs'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200/80 hover:text-gray-900'
              }`}
            >
              {opt.label}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setShowCustomDates((prev) => !prev)}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              rangeKey === 'custom' || showCustomDates
                ? 'bg-orange-50 text-[#e85d04] border border-orange-200'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200/80'
            }`}
          >
            Custom Range
          </button>

          {showCustomDates && (
            <form onSubmit={handleApplyCustomRange} className="flex flex-wrap items-center gap-2 w-full sm:w-auto pt-1 sm:pt-0 sm:ml-2">
              <input
                type="date"
                value={customFrom}
                onChange={(e) => setCustomFrom(e.target.value)}
                className="bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-1 text-xs font-semibold text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#e85d04]"
                required
              />
              <span className="text-xs text-gray-400">to</span>
              <input
                type="date"
                value={customTo}
                onChange={(e) => setCustomTo(e.target.value)}
                className="bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-1 text-xs font-semibold text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#e85d04]"
                required
              />
              <button
                type="submit"
                className="px-3 py-1 rounded-lg bg-[#e85d04] hover:bg-[#d45203] text-white text-xs font-bold"
              >
                Apply
              </button>
            </form>
          )}
        </div>
      </div>

      {/* Top Metric Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl border border-gray-200/80 shadow-xs p-5">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Manual Cycle Counts</p>
          <p className="text-2xl sm:text-3xl font-extrabold text-gray-900 mt-1">
            {stats.totalAudits}
          </p>
          <p className="text-xs text-gray-400 mt-1">Accuracy: <strong className="text-[#2e7d32]">{stats.accuracyRate}%</strong></p>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200/80 shadow-xs p-5">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Net Audit Variance</p>
          <p className={`text-2xl sm:text-3xl font-extrabold mt-1 ${stats.netVarianceImpact < 0 ? 'text-red-600' : stats.netVarianceImpact > 0 ? 'text-blue-700' : 'text-gray-900'}`}>
            {formatSignedCurrency(stats.netVarianceImpact)}
          </p>
          <p className="text-xs text-gray-400 mt-1">Signed count discrepancy value</p>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200/80 shadow-xs p-5">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Total Waste Losses</p>
          <p className="text-2xl sm:text-3xl font-extrabold text-red-600 mt-1">
            -${stats.totalWasteLoss.toFixed(2)}
          </p>
          <p className="text-xs text-red-500 mt-1 font-semibold">Recorded discarded stock</p>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200/80 shadow-xs p-5">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">POS Sales COGS</p>
          <p className="text-2xl sm:text-3xl font-extrabold text-purple-700 mt-1">
            -${stats.totalSalesCogs.toFixed(2)}
          </p>
          <p className="text-xs text-gray-400 mt-1">Raw ingredient cost deducted</p>
        </div>
      </div>

      {/* Toolbar & Filters */}
      <div className="bg-white rounded-2xl border border-gray-200/80 shadow-xs p-4 sm:p-5 space-y-3.5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          {/* Transaction Type Filter Tabs with Counts */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar bg-gray-100/80 p-1 rounded-xl">
            {[
              { id: 'ALL', label: 'All Logs', count: typeCounts.ALL },
              { id: 'RESTOCK', label: '📦 Restocks', count: typeCounts.RESTOCK },
              { id: 'WASTE', label: '🗑️ Waste', count: typeCounts.WASTE },
              { id: 'CYCLE_COUNT', label: '📋 Audits', count: typeCounts.CYCLE_COUNT },
              { id: 'SALE', label: '🏷️ POS Sales', count: typeCounts.SALE },
            ].map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTypeFilter(t.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 ${
                  typeFilter === t.id
                    ? 'bg-white text-gray-900 shadow-2xs'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <span>{t.label}</span>
                <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-gray-200/70 text-gray-700 font-extrabold">
                  {t.count}
                </span>
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={handleExportCSV}
            className="inline-flex items-center gap-2 bg-white hover:bg-gray-50 border border-gray-200 text-gray-700 text-xs font-bold px-3.5 py-2 rounded-xl shadow-2xs transition-all active:scale-98 shrink-0 self-start lg:self-auto"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="7 10 12 15 17 10"/>
              <line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
            Export Logs CSV
          </button>
        </div>

        {/* Search & Audit Discrepancy Filter */}
        <div className="flex flex-col sm:flex-row items-center gap-3 pt-1">
          <div className="relative flex-1 w-full">
            <input
              type="text"
              placeholder="Search by ingredient, note, or reference ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2 text-xs text-gray-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#e85d04]"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-2 text-xs text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            )}
          </div>

          {typeFilter === 'CYCLE_COUNT' && (
            <div className="flex items-center gap-1 bg-gray-50 border border-gray-200 rounded-xl p-1 text-xs w-full sm:w-auto">
              <span className="text-[11px] font-bold text-gray-400 px-2 uppercase">Variance:</span>
              <button
                type="button"
                onClick={() => setDiscrepancyFilter('all')}
                className={`px-2.5 py-1 rounded-lg font-bold ${
                  discrepancyFilter === 'all' ? 'bg-white shadow-2xs text-gray-900' : 'text-gray-500'
                }`}
              >
                All
              </button>
              <button
                type="button"
                onClick={() => setDiscrepancyFilter('shortage')}
                className={`px-2.5 py-1 rounded-lg font-bold ${
                  discrepancyFilter === 'shortage' ? 'bg-red-50 text-red-700 shadow-2xs' : 'text-gray-500'
                }`}
              >
                Shortages
              </button>
              <button
                type="button"
                onClick={() => setDiscrepancyFilter('surplus')}
                className={`px-2.5 py-1 rounded-lg font-bold ${
                  discrepancyFilter === 'surplus' ? 'bg-blue-50 text-blue-700 shadow-2xs' : 'text-gray-500'
                }`}
              >
                Surplus
              </button>
              <button
                type="button"
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

      {/* MOBILE CARD VIEW */}
      <div className="block md:hidden space-y-3">
        <div className="flex items-center justify-between px-1">
          <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">
            Log Records ({filtered.length})
          </h3>
          <span className="text-[11px] text-gray-400">Tap to inspect</span>
        </div>
        {filtered.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-200 p-6 text-center text-xs text-gray-400">
            No transactions match the selected filter criteria.
          </div>
        ) : (
          filtered.map((tx) => {
            const formattedTs = formatStoreTimestamp(tx.created_at, storeTimeZone)
            return (
              <div
                key={tx.id}
                onClick={() => setInspectedTx(tx)}
                className="bg-white rounded-2xl border border-gray-200/80 shadow-xs p-4 space-y-2.5 hover:border-orange-300 transition-all cursor-pointer active:scale-99"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h4 className="font-extrabold text-gray-900 text-sm">{tx.ingredientName}</h4>
                    <span className="text-[11px] text-gray-400">{formattedTs}</span>
                  </div>
                  <div>
                    {tx.transaction_type === 'CYCLE_COUNT' ? (
                      <span className="text-[10px] font-bold text-blue-800 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-md">
                        📋 Audit
                      </span>
                    ) : tx.transaction_type === 'RESTOCK' ? (
                      <span className="text-[10px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md">
                        📦 Restock
                      </span>
                    ) : tx.transaction_type === 'WASTE' ? (
                      <span className="text-[10px] font-bold text-red-800 bg-red-50 border border-red-200 px-2 py-0.5 rounded-md">
                        🗑️ Waste
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold text-purple-800 bg-purple-50 border border-purple-200 px-2 py-0.5 rounded-md">
                        🏷️ Clover Sale
                      </span>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 bg-gray-50/80 rounded-xl p-2.5 text-xs">
                  <div>
                    <span className="text-gray-400 text-[10px] uppercase font-bold block">Qty</span>
                    <span className="font-extrabold text-gray-900">{tx.quantity} {tx.unit}</span>
                  </div>
                  <div>
                    <span className="text-gray-400 text-[10px] uppercase font-bold block">Transition</span>
                    <span className="font-bold text-gray-700">
                      {tx.previous_stock !== null && tx.new_stock !== null
                        ? `${tx.previous_stock} → ${tx.new_stock}`
                        : 'Updated'}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-400 text-[10px] uppercase font-bold block">Impact</span>
                    <span
                      className={`font-extrabold ${
                        tx.financialImpact < 0
                          ? 'text-red-600'
                          : tx.financialImpact > 0
                          ? 'text-emerald-700'
                          : 'text-gray-600'
                      }`}
                    >
                      {formatSignedCurrency(tx.financialImpact)}
                    </span>
                  </div>
                </div>

                {tx.notes && (
                  <p className="text-[11px] text-gray-600 bg-gray-50/50 rounded-lg px-2.5 py-1.5 border border-gray-100 truncate">
                    Note: <span className="font-medium text-gray-800">{tx.notes}</span>
                  </p>
                )}
              </div>
            )
          })
        )}
      </div>

      {/* Desktop Data Grid */}
      <div className="hidden md:block bg-white rounded-2xl border border-gray-200/80 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50/70 text-gray-600 text-xs font-bold uppercase tracking-wider border-b border-gray-100">
                <th className="py-3 px-5">Timestamp</th>
                <th className="py-3 px-4">Log Kind</th>
                <th className="py-3 px-4">Ingredient</th>
                <th className="py-3 px-4">Recorded Qty</th>
                <th className="py-3 px-4">Stock Transition</th>
                <th className="py-3 px-4">Variance / Impact</th>
                <th className="py-3 px-5">Notes / Ref</th>
                <th className="py-3 px-4 text-center">Inspect</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-sm">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-xs text-gray-400">
                    No transactions match the selected filter criteria.
                  </td>
                </tr>
              ) : (
                filtered.map((tx) => {
                  const date = new Date(tx.created_at)
                  const formattedDate = date.toLocaleDateString('en-US', {
                    timeZone: storeTimeZone,
                    month: 'short',
                    day: 'numeric',
                  })
                  const formattedTime = date.toLocaleTimeString('en-US', {
                    timeZone: storeTimeZone,
                    hour: '2-digit',
                    minute: '2-digit',
                  })

                  return (
                    <tr
                      key={tx.id}
                      onClick={() => setInspectedTx(tx)}
                      className="hover:bg-orange-50/30 transition-colors cursor-pointer group"
                    >
                      <td className="py-3 px-5 whitespace-nowrap">
                        <span className="font-bold text-gray-800 text-xs block">{formattedDate}</span>
                        <span className="text-[11px] text-gray-400">{formattedTime}</span>
                      </td>

                      <td className="py-3 px-4">
                        {tx.transaction_type === 'CYCLE_COUNT' ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-800 bg-blue-50 border border-blue-200/80 px-2.5 py-0.5 rounded-md">
                            <span>📋</span> Audit
                          </span>
                        ) : tx.transaction_type === 'RESTOCK' ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-200/80 px-2.5 py-0.5 rounded-md">
                            <span>📦</span> Restock
                          </span>
                        ) : tx.transaction_type === 'WASTE' ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-red-800 bg-red-50 border border-red-200/80 px-2.5 py-0.5 rounded-md">
                            <span>🗑️</span> Waste
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-purple-800 bg-purple-50 border border-purple-200/80 px-2.5 py-0.5 rounded-md">
                            <span>🏷️</span> Clover Sale
                          </span>
                        )}
                      </td>

                      <td className="py-3 px-4 font-bold text-gray-900 group-hover:text-[#e85d04] transition-colors">
                        {tx.ingredientName}
                      </td>

                      <td className="py-3 px-4 text-xs font-semibold text-gray-700">
                        {tx.quantity} {tx.unit}
                      </td>

                      <td className="py-3 px-4 text-xs font-medium text-gray-600">
                        {tx.previous_stock !== null && tx.new_stock !== null ? (
                          <span>
                            {tx.previous_stock} → <span className="font-bold text-gray-900">{tx.new_stock}</span> {tx.unit}
                          </span>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>

                      <td className="py-3 px-4">
                        <div className="flex flex-col gap-0.5">
                          {tx.transaction_type === 'CYCLE_COUNT' && tx.discrepancy !== null && (
                            tx.discrepancy === 0 ? (
                              <span className="inline-flex items-center w-fit text-[11px] font-bold text-green-700 bg-green-50 px-2 py-0.5 rounded-md border border-green-200/60">
                                ✓ Match
                              </span>
                            ) : tx.discrepancy < 0 ? (
                              <span className="inline-flex items-center w-fit text-[11px] font-bold text-red-700 bg-red-50 px-2 py-0.5 rounded-md border border-red-200/60">
                                {tx.discrepancy.toFixed(2)} {tx.unit}
                              </span>
                            ) : (
                              <span className="inline-flex items-center w-fit text-[11px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-200/60">
                                +{tx.discrepancy.toFixed(2)} {tx.unit}
                              </span>
                            )
                          )}
                          <span
                            className={`text-xs font-bold ${
                              tx.financialImpact < 0
                                ? 'text-red-600'
                                : tx.financialImpact > 0
                                ? 'text-emerald-700'
                                : 'text-gray-500'
                            }`}
                          >
                            {formatSignedCurrency(tx.financialImpact)}
                          </span>
                        </div>
                      </td>

                      <td className="py-3 px-5 text-xs text-gray-600 max-w-xs truncate" title={tx.notes || ''}>
                        {tx.notes || '—'}
                      </td>

                      <td className="py-3 px-4 text-center">
                        <button
                          type="button"
                          className="text-gray-400 group-hover:text-[#e85d04] hover:bg-orange-50 p-1 rounded-lg text-xs font-bold transition-all"
                        >
                          🔍
                        </button>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* INSPECTION MODAL */}
      {inspectedTx && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200"
          onClick={() => setInspectedTx(null)}
        >
          <div
            className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-gray-100 space-y-5 animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between pb-3 border-b border-gray-100">
              <div>
                <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                  Log Inspection Record
                </span>
                <h3 className="text-lg font-black text-gray-900 mt-0.5">
                  {inspectedTx.ingredientName}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setInspectedTx(null)}
                className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-600 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3 bg-gray-50 rounded-2xl p-4">
                <div>
                  <span className="text-gray-400 uppercase font-bold text-[10px] block">Log Type</span>
                  <span className="font-extrabold text-gray-900 text-sm">{inspectedTx.transaction_type}</span>
                </div>
                <div>
                  <span className="text-gray-400 uppercase font-bold text-[10px] block">Recorded Timestamp</span>
                  <span className="font-semibold text-gray-800 text-xs">
                    {formatStoreTimestamp(inspectedTx.created_at, storeTimeZone)}
                  </span>
                </div>
                <div>
                  <span className="text-gray-400 uppercase font-bold text-[10px] block">Recorded Quantity</span>
                  <span className="font-extrabold text-sm text-gray-900">
                    {inspectedTx.quantity} {inspectedTx.unit}
                  </span>
                </div>
                <div>
                  <span className="text-gray-400 uppercase font-bold text-[10px] block">Stock Transition</span>
                  <span className="font-extrabold text-sm text-gray-900">
                    {inspectedTx.previous_stock ?? '—'} {inspectedTx.unit} → {inspectedTx.new_stock ?? '—'} {inspectedTx.unit}
                  </span>
                </div>
                <div>
                  <span className="text-gray-400 uppercase font-bold text-[10px] block">Audit Discrepancy</span>
                  <span className="font-bold text-gray-900">
                    {inspectedTx.discrepancy !== null ? `${inspectedTx.discrepancy} ${inspectedTx.unit}` : 'N/A'}
                  </span>
                </div>
                <div>
                  <span className="text-gray-400 uppercase font-bold text-[10px] block">Inventory Value Impact</span>
                  <span
                    className={`font-bold ${
                      inspectedTx.financialImpact < 0
                        ? 'text-red-600'
                        : inspectedTx.financialImpact > 0
                        ? 'text-emerald-700'
                        : 'text-gray-900'
                    }`}
                  >
                    {formatSignedCurrency(inspectedTx.financialImpact)}
                  </span>
                </div>
              </div>

              <div className="space-y-1 pt-1">
                <span className="text-gray-400 uppercase font-bold text-[10px] block">Notes / Reason Recorded</span>
                <div className="bg-gray-50 border border-gray-200/80 rounded-xl p-3 text-gray-800 font-medium">
                  {inspectedTx.notes || 'No specific note was entered for this action.'}
                </div>
              </div>

              {inspectedTx.reference_id && (
                <div className="space-y-1">
                  <span className="text-gray-400 uppercase font-bold text-[10px] block">Reference / EOD Batch ID</span>
                  <div className="bg-gray-50 border border-gray-200/80 rounded-xl p-2.5 font-mono text-[11px] text-gray-700">
                    {inspectedTx.reference_id}
                  </div>
                </div>
              )}

              <div className="space-y-1">
                <span className="text-gray-400 uppercase font-bold text-[10px] block">System Transaction UUID</span>
                <div className="bg-gray-50 border border-gray-200/80 rounded-xl p-2.5 font-mono text-[11px] text-gray-500 break-all">
                  {inspectedTx.id}
                </div>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setInspectedTx(null)}
                className="bg-gray-900 hover:bg-black text-white text-xs font-bold px-5 py-2.5 rounded-xl transition-all"
              >
                Close Inspector
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
