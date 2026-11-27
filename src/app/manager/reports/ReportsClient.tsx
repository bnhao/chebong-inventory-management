'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowUpRight, Check, Download, Search, X } from 'lucide-react'
import { buildAuditCsv, downloadCsvFile } from '@/lib/csv'
import {
  formatStoreTimestamp,
  getStoreDateString,
  getStoreTimezone,
  StoreRangeBounds,
} from '@/lib/timezone'
import { AuditReportTransaction } from './page'

interface Props {
  initialTransactions: AuditReportTransaction[]
  rangeKey: StoreRangeBounds['rangeKey']
  fromDate: string
  toDate: string
}

const RANGE_OPTIONS: Array<{ key: StoreRangeBounds['rangeKey']; label: string }> = [
  { key: 'today', label: 'Today' },
  { key: '7d', label: '7 days' },
  { key: '30d', label: '30 days' },
  { key: 'month', label: 'This month' },
  { key: 'all', label: 'All time' },
]

const LOG_TYPE_LABEL: Record<string, string> = {
  CYCLE_COUNT: 'Audit',
  RESTOCK: 'Restock',
  WASTE: 'Waste',
  SALE: 'Clover sale',
}

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
  const [discrepancyFilter, setDiscrepancyFilter] = useState<
    'all' | 'shortage' | 'surplus' | 'match'
  >('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [inspectedTx, setInspectedTx] = useState<AuditReportTransaction | null>(null)

  const [customFrom, setCustomFrom] = useState(fromDate)
  const [customTo, setCustomTo] = useState(toDate)
  const [showCustomDates, setShowCustomDates] = useState(rangeKey === 'custom')

  function navigateWithRange(
    nextRange: StoreRangeBounds['rangeKey'],
    nextFrom?: string,
    nextTo?: string
  ) {
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

  const stats = useMemo(() => {
    const cycleCounts = transactions.filter((t) => t.transaction_type === 'CYCLE_COUNT')
    const wasteLogs = transactions.filter((t) => t.transaction_type === 'WASTE')
    const saleLogs = transactions.filter((t) => t.transaction_type === 'SALE')

    const exactMatches = cycleCounts.filter((t) => t.discrepancy === 0).length
    const accuracyRate =
      cycleCounts.length > 0 ? Math.round((exactMatches / cycleCounts.length) * 100) : 100

    const netVarianceImpact = cycleCounts.reduce(
      (sum, t) => sum + (t.financialImpact || 0),
      0
    )
    const totalWasteLoss = wasteLogs.reduce(
      (sum, t) => sum + Math.abs(t.financialImpact || 0),
      0
    )
    const totalSalesCogs = saleLogs.reduce(
      (sum, t) => sum + Math.abs(t.financialImpact || 0),
      0
    )

    return {
      totalAudits: cycleCounts.length,
      accuracyRate,
      netVarianceImpact: Math.round(netVarianceImpact * 100) / 100,
      totalWasteLoss: Math.round(totalWasteLoss * 100) / 100,
      totalSalesCogs: Math.round(totalSalesCogs * 100) / 100,
    }
  }, [transactions])

  const typeCounts = useMemo(() => {
    return {
      ALL: transactions.length,
      CYCLE_COUNT: transactions.filter((t) => t.transaction_type === 'CYCLE_COUNT').length,
      RESTOCK: transactions.filter((t) => t.transaction_type === 'RESTOCK').length,
      WASTE: transactions.filter((t) => t.transaction_type === 'WASTE').length,
      SALE: transactions.filter((t) => t.transaction_type === 'SALE').length,
    }
  }, [transactions])

  const filtered = useMemo(() => {
    return transactions.filter((tx) => {
      if (typeFilter !== 'ALL' && tx.transaction_type !== typeFilter) return false

      if (
        discrepancyFilter === 'shortage' &&
        (tx.discrepancy === null || tx.discrepancy >= 0)
      )
        return false
      if (
        discrepancyFilter === 'surplus' &&
        (tx.discrepancy === null || tx.discrepancy <= 0)
      )
        return false
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
      {/* Header & date range */}
      <div className="surface-card rounded-2xl p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-medium text-[#171717]">
              Activity and audit ledger
            </h2>
            <p className="text-xs text-[#737373] font-mono tabular-nums mt-0.5">
              {rangeKey === 'all'
                ? `${transactions.length} recorded movements`
                : `${fromDate} to ${toDate} · ${transactions.length} entries · ${storeTimeZone}`}
            </p>
          </div>

          <button
            type="button"
            onClick={handleExportCSV}
            className="h-9 px-4 btn-primary rounded-xl text-xs font-medium inline-flex items-center justify-center gap-2 shrink-0"
          >
            <Download size={14} strokeWidth={1.5} />
            <span>Export CSV ({filtered.length})</span>
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 pt-3 border-t border-neutral-900/[0.08]">
          {RANGE_OPTIONS.map((opt) => (
            <button
              key={opt.key}
              type="button"
              onClick={() => handlePresetClick(opt.key)}
              className={`h-8 px-3 rounded-lg text-xs font-medium transition-colors ${
                rangeKey === opt.key && !showCustomDates
                  ? 'bg-[#171717] text-white'
                  : 'bg-[#f4f4f5] text-[#525252] hover:text-[#171717]'
              }`}
            >
              {opt.label}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setShowCustomDates((prev) => !prev)}
            className={`h-8 px-3 rounded-lg text-xs font-medium transition-colors border ${
              rangeKey === 'custom' || showCustomDates
                ? 'bg-[#fff7ed] text-[#c2410c] border-[#fed7aa]'
                : 'bg-[#f4f4f5] text-[#525252] border-transparent hover:text-[#171717]'
            }`}
          >
            Custom range
          </button>

          {showCustomDates && (
            <form
              onSubmit={handleApplyCustomRange}
              className="flex flex-wrap items-center gap-2 w-full sm:w-auto pt-2 sm:pt-0 sm:ml-2"
            >
              <input
                type="date"
                value={customFrom}
                onChange={(e) => setCustomFrom(e.target.value)}
                className="h-8 bg-white border border-neutral-900/[0.14] rounded-lg px-2.5 text-xs font-mono tabular-nums text-[#171717] focus:outline-none focus:ring-2 focus:ring-[#c2410c]"
                required
              />
              <span className="text-xs text-[#737373]">to</span>
              <input
                type="date"
                value={customTo}
                onChange={(e) => setCustomTo(e.target.value)}
                className="h-8 bg-white border border-neutral-900/[0.14] rounded-lg px-2.5 text-xs font-mono tabular-nums text-[#171717] focus:outline-none focus:ring-2 focus:ring-[#c2410c]"
                required
              />
              <button
                type="submit"
                className="h-8 px-3 btn-primary rounded-lg text-xs font-medium"
              >
                Apply
              </button>
            </form>
          )}
        </div>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="surface-card rounded-2xl p-5">
          <p className="text-xs text-[#737373]">Cycle counts</p>
          <p className="text-2xl sm:text-[28px] leading-none font-medium font-mono tabular-nums text-[#171717] mt-2">
            {stats.totalAudits}
          </p>
          <p className="text-xs text-[#737373] mt-2 font-mono tabular-nums">
            {stats.accuracyRate}% match rate
          </p>
        </div>

        <div className="surface-card rounded-2xl p-5">
          <p className="text-xs text-[#737373]">Net audit variance</p>
          <p
            className={`text-2xl sm:text-[28px] leading-none font-medium font-mono tabular-nums mt-2 ${
              stats.netVarianceImpact < 0
                ? 'text-[#b91c1c]'
                : stats.netVarianceImpact > 0
                ? 'text-[#15803d]'
                : 'text-[#171717]'
            }`}
          >
            {formatSignedCurrency(stats.netVarianceImpact)}
          </p>
          <p className="text-xs text-[#737373] mt-2">Count discrepancy value</p>
        </div>

        <div className="surface-card rounded-2xl p-5">
          <p className="text-xs text-[#737373]">Waste losses</p>
          <p className="text-2xl sm:text-[28px] leading-none font-medium font-mono tabular-nums text-[#b91c1c] mt-2">
            -${stats.totalWasteLoss.toFixed(2)}
          </p>
          <p className="text-xs text-[#737373] mt-2">Discarded stock</p>
        </div>

        <div className="surface-card rounded-2xl p-5">
          <p className="text-xs text-[#737373]">POS sales COGS</p>
          <p className="text-2xl sm:text-[28px] leading-none font-medium font-mono tabular-nums text-[#171717] mt-2">
            -${stats.totalSalesCogs.toFixed(2)}
          </p>
          <p className="text-xs text-[#737373] mt-2">Ingredient cost deducted</p>
        </div>
      </div>

      {/* Filters */}
      <div className="surface-card rounded-2xl p-4 space-y-3">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="flex items-center gap-1 overflow-x-auto no-scrollbar bg-[#f4f4f5] p-1 rounded-xl w-fit max-w-full">
            {[
              { id: 'ALL', label: 'All logs', count: typeCounts.ALL },
              { id: 'RESTOCK', label: 'Restocks', count: typeCounts.RESTOCK },
              { id: 'WASTE', label: 'Waste', count: typeCounts.WASTE },
              { id: 'CYCLE_COUNT', label: 'Audits', count: typeCounts.CYCLE_COUNT },
              { id: 'SALE', label: 'POS sales', count: typeCounts.SALE },
            ].map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTypeFilter(t.id)}
                className={`h-8 px-3 rounded-lg text-xs font-medium transition-colors whitespace-nowrap flex items-center gap-1.5 ${
                  typeFilter === t.id
                    ? 'bg-white text-[#171717] border border-neutral-900/[0.08] shadow-[0_1px_2px_rgba(0,0,0,0.04)]'
                    : 'text-[#525252] hover:text-[#171717] border border-transparent'
                }`}
              >
                <span>{t.label}</span>
                <span className="font-mono text-xs tabular-nums text-[#737373]">
                  {t.count}
                </span>
              </button>
            ))}
          </div>

          <div className="relative flex-1 max-w-sm">
            <Search
              size={15}
              strokeWidth={1.5}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#737373]"
            />
            <input
              type="text"
              placeholder="Search logs"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-9 bg-white border border-neutral-900/[0.14] rounded-xl pl-9 pr-8 text-xs text-[#171717] placeholder-[#a3a3a3] focus:outline-none focus:ring-2 focus:ring-[#c2410c]"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                aria-label="Clear search"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#737373] hover:text-[#171717]"
              >
                <X size={14} strokeWidth={1.5} />
              </button>
            )}
          </div>
        </div>

        {typeFilter === 'CYCLE_COUNT' && (
          <div className="flex items-center gap-1 bg-[#f4f4f5] rounded-xl p-1 text-xs w-fit">
            <span className="text-[#737373] px-2">Variance:</span>
            {(
              [
                { id: 'all', label: 'All' },
                { id: 'shortage', label: 'Shortages' },
                { id: 'surplus', label: 'Surplus' },
                { id: 'match', label: 'Match' },
              ] as const
            ).map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setDiscrepancyFilter(opt.id)}
                className={`h-7 px-2.5 rounded-lg font-medium transition-colors ${
                  discrepancyFilter === opt.id
                    ? 'bg-white text-[#171717] shadow-[0_1px_2px_rgba(0,0,0,0.04)]'
                    : 'text-[#525252] hover:text-[#171717]'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Mobile card view */}
      <div className="block md:hidden space-y-3">
        <div className="flex items-center justify-between px-1">
          <span className="text-xs font-medium text-[#525252]">
            Records ({filtered.length})
          </span>
          <span className="text-xs text-[#737373]">Tap to inspect</span>
        </div>
        {filtered.length === 0 ? (
          <div className="surface-card rounded-2xl p-6 text-center text-xs text-[#737373]">
            No transactions match your filters
          </div>
        ) : (
          filtered.map((tx) => {
            const formattedTs = formatStoreTimestamp(tx.created_at, storeTimeZone)
            return (
              <div
                key={tx.id}
                onClick={() => setInspectedTx(tx)}
                className="surface-card-interactive rounded-2xl p-4 space-y-3 cursor-pointer"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h4 className="font-medium text-[#171717] text-sm">
                      {tx.ingredientName}
                    </h4>
                    <span className="text-xs text-[#737373] font-mono tabular-nums">
                      {formattedTs}
                    </span>
                  </div>
                  <span className="batch-stamp">
                    {LOG_TYPE_LABEL[tx.transaction_type] || tx.transaction_type}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2 bg-[#fafafa] border border-neutral-900/[0.06] rounded-xl p-3 text-xs font-mono tabular-nums">
                  <div>
                    <span className="font-sans text-[#737373] block">Qty</span>
                    <span className="font-medium text-[#171717]">
                      {tx.quantity} {tx.unit}
                    </span>
                  </div>
                  <div>
                    <span className="font-sans text-[#737373] block">Stock</span>
                    <span className="text-[#525252]">
                      {tx.previous_stock !== null && tx.new_stock !== null
                        ? `${tx.previous_stock} → ${tx.new_stock}`
                        : '—'}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="font-sans text-[#737373] block">Impact</span>
                    <span
                      className={`font-medium ${
                        tx.financialImpact < 0
                          ? 'text-[#b91c1c]'
                          : tx.financialImpact > 0
                          ? 'text-[#15803d]'
                          : 'text-[#525252]'
                      }`}
                    >
                      {formatSignedCurrency(tx.financialImpact)}
                    </span>
                  </div>
                </div>

                {tx.notes && (
                  <p className="text-xs text-[#525252] truncate">{tx.notes}</p>
                )}
              </div>
            )
          })
        )}
      </div>

      {/* Desktop table */}
      <div className="hidden md:block surface-card rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#fafafa] text-[#737373] text-xs font-medium border-b border-neutral-900/[0.08]">
                <th className="py-3 px-5 font-medium">Timestamp</th>
                <th className="py-3 px-4 font-medium">Type</th>
                <th className="py-3 px-4 font-medium">Ingredient</th>
                <th className="py-3 px-4 font-medium text-right">Quantity</th>
                <th className="py-3 px-4 font-medium text-right">Transition</th>
                <th className="py-3 px-4 font-medium text-right">Impact</th>
                <th className="py-3 px-5 font-medium">Notes</th>
                <th className="py-3 px-4 font-medium text-right">Inspect</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-900/[0.06] text-sm">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-xs text-[#737373]">
                    No transactions match your filters
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
                      className="hover:bg-[#fafafa] transition-colors cursor-pointer"
                    >
                      <td className="py-3 px-5 whitespace-nowrap font-mono tabular-nums">
                        <span
                          suppressHydrationWarning
                          className="text-xs font-medium text-[#171717] block"
                        >
                          {formattedDate}
                        </span>
                        <span
                          suppressHydrationWarning
                          className="text-xs text-[#737373]"
                        >
                          {formattedTime}
                        </span>
                      </td>

                      <td className="py-3 px-4">
                        <span className="batch-stamp">
                          {LOG_TYPE_LABEL[tx.transaction_type] || tx.transaction_type}
                        </span>
                      </td>

                      <td className="py-3 px-4 font-medium text-[#171717]">
                        {tx.ingredientName}
                      </td>

                      <td className="py-3 px-4 text-right font-mono text-xs tabular-nums text-[#525252]">
                        {tx.quantity} {tx.unit}
                      </td>

                      <td className="py-3 px-4 text-right font-mono text-xs tabular-nums text-[#525252]">
                        {tx.previous_stock !== null && tx.new_stock !== null ? (
                          <span>
                            {tx.previous_stock} →{' '}
                            <span className="text-[#171717] font-medium">
                              {tx.new_stock}
                            </span>{' '}
                            {tx.unit}
                          </span>
                        ) : (
                          <span className="text-[#a3a3a3]">—</span>
                        )}
                      </td>

                      <td className="py-3 px-4 text-right font-mono text-xs tabular-nums">
                        <div className="flex flex-col items-end gap-0.5">
                          {tx.transaction_type === 'CYCLE_COUNT' &&
                            tx.discrepancy !== null &&
                            (tx.discrepancy === 0 ? (
                              <span className="inline-flex items-center gap-1 text-[#15803d]">
                                <Check size={12} strokeWidth={1.75} />
                                <span>Match</span>
                              </span>
                            ) : (
                              <span
                                className={
                                  tx.discrepancy < 0 ? 'text-[#b91c1c]' : 'text-[#525252]'
                                }
                              >
                                {tx.discrepancy > 0 ? '+' : ''}
                                {tx.discrepancy.toFixed(2)} {tx.unit}
                              </span>
                            ))}
                          <span
                            className={`font-medium ${
                              tx.financialImpact < 0
                                ? 'text-[#b91c1c]'
                                : tx.financialImpact > 0
                                ? 'text-[#15803d]'
                                : 'text-[#737373]'
                            }`}
                          >
                            {formatSignedCurrency(tx.financialImpact)}
                          </span>
                        </div>
                      </td>

                      <td
                        className="py-3 px-5 text-xs text-[#525252] max-w-xs truncate"
                        title={tx.notes || ''}
                      >
                        {tx.notes || '—'}
                      </td>

                      <td className="py-3 px-4 text-right">
                        <button
                          type="button"
                          aria-label="Inspect transaction"
                          className="w-8 h-8 rounded-lg inline-flex items-center justify-center text-[#737373] hover:text-[#171717] hover:bg-[#f4f4f5] transition-colors"
                        >
                          <ArrowUpRight size={15} strokeWidth={1.5} />
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

      {/* Inspection modal */}
      {inspectedTx && (
        <div
          className="fixed inset-0 z-50 bg-black/40 backdrop-blur-[2px] flex items-center justify-center p-4"
          onClick={() => setInspectedTx(null)}
        >
          <div
            className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-[0_8px_24px_rgba(0,0,0,0.08)] border border-neutral-900/[0.08] space-y-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between pb-3 border-b border-neutral-900/[0.08]">
              <div>
                <span className="text-xs text-[#737373]">Log record</span>
                <h3 className="text-base font-medium text-[#171717] mt-0.5">
                  {inspectedTx.ingredientName}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setInspectedTx(null)}
                aria-label="Close"
                className="w-8 h-8 rounded-lg flex items-center justify-center text-[#737373] hover:text-[#171717] hover:bg-[#f4f4f5]"
              >
                <X size={16} strokeWidth={1.5} />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-4 bg-[#fafafa] border border-neutral-900/[0.08] rounded-xl p-4">
                <div>
                  <span className="text-[#737373] block">Type</span>
                  <span className="font-medium text-[#171717] text-sm mt-0.5 block">
                    {LOG_TYPE_LABEL[inspectedTx.transaction_type] ||
                      inspectedTx.transaction_type}
                  </span>
                </div>
                <div>
                  <span className="text-[#737373] block">Timestamp</span>
                  <span className="font-mono tabular-nums text-[#171717] mt-0.5 block">
                    {formatStoreTimestamp(inspectedTx.created_at, storeTimeZone)}
                  </span>
                </div>
                <div>
                  <span className="text-[#737373] block">Quantity</span>
                  <span className="font-mono tabular-nums font-medium text-sm text-[#171717] mt-0.5 block">
                    {inspectedTx.quantity} {inspectedTx.unit}
                  </span>
                </div>
                <div>
                  <span className="text-[#737373] block">Stock transition</span>
                  <span className="font-mono tabular-nums font-medium text-sm text-[#171717] mt-0.5 block">
                    {inspectedTx.previous_stock ?? '—'} → {inspectedTx.new_stock ?? '—'}{' '}
                    {inspectedTx.unit}
                  </span>
                </div>
                <div>
                  <span className="text-[#737373] block">Discrepancy</span>
                  <span className="font-mono tabular-nums text-[#171717] mt-0.5 block">
                    {inspectedTx.discrepancy !== null
                      ? `${inspectedTx.discrepancy} ${inspectedTx.unit}`
                      : '—'}
                  </span>
                </div>
                <div>
                  <span className="text-[#737373] block">Value impact</span>
                  <span
                    className={`font-mono tabular-nums font-medium mt-0.5 block ${
                      inspectedTx.financialImpact < 0
                        ? 'text-[#b91c1c]'
                        : inspectedTx.financialImpact > 0
                        ? 'text-[#15803d]'
                        : 'text-[#171717]'
                    }`}
                  >
                    {formatSignedCurrency(inspectedTx.financialImpact)}
                  </span>
                </div>
              </div>

              <div className="space-y-1">
                <span className="text-[#737373] block">Notes</span>
                <div className="bg-[#fafafa] border border-neutral-900/[0.08] rounded-xl p-3 text-[#171717]">
                  {inspectedTx.notes || 'No note entered'}
                </div>
              </div>

              {inspectedTx.reference_id && (
                <div className="space-y-1">
                  <span className="text-[#737373] block">Reference ID</span>
                  <div className="bg-[#fafafa] border border-neutral-900/[0.08] rounded-xl p-2.5 font-mono text-xs text-[#525252]">
                    {inspectedTx.reference_id}
                  </div>
                </div>
              )}

              <div className="space-y-1">
                <span className="text-[#737373] block">Transaction ID</span>
                <div className="bg-[#fafafa] border border-neutral-900/[0.08] rounded-xl p-2.5 font-mono text-xs text-[#737373] break-all">
                  {inspectedTx.id}
                </div>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setInspectedTx(null)}
                className="h-9 px-4 btn-secondary rounded-xl text-xs font-medium"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
