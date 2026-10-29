'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { submitRestockAction } from '@/app/actions/inventory'
import { ManagerDashboardData } from './page'

interface Props {
  data: ManagerDashboardData
}

export default function ManagerDashboardClient({ data }: Props) {
  const router = useRouter()

  // Alerts compact state
  const [showAllAlerts, setShowAllAlerts] = useState(false)

  // Manual Restock form state (matches right panel in Figma)
  const [selectedIngredientId, setSelectedIngredientId] = useState('')
  const [quantity, setQuantity] = useState('')
  const [expirationDate, setExpirationDate] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitSuccess, setSubmitSuccess] = useState(false)
  const [submitError, setSubmitError] = useState('')

  // Log filter state
  const [logTypeFilter, setLogTypeFilter] = useState<'ALL' | 'RESTOCK' | 'WASTE' | 'CYCLE_COUNT' | 'SALE'>('ALL')

  const selectedIngredient = data.ingredients.find((i) => i.id === selectedIngredientId)

  // Filtered logs calculation
  const logCounts = useMemo(() => {
    const logs = data.recentLogs || []
    return {
      ALL: logs.length,
      RESTOCK: logs.filter((l) => l.transaction_type === 'RESTOCK').length,
      WASTE: logs.filter((l) => l.transaction_type === 'WASTE').length,
      CYCLE_COUNT: logs.filter((l) => l.transaction_type === 'CYCLE_COUNT').length,
      SALE: logs.filter((l) => l.transaction_type === 'SALE').length,
    }
  }, [data.recentLogs])

  const filteredLogs = useMemo(() => {
    const logs = data.recentLogs || []
    if (logTypeFilter === 'ALL') return logs
    return logs.filter((log) => log.transaction_type === logTypeFilter)
  }, [data.recentLogs, logTypeFilter])

  // Visible alerts (compacted to 3 by default)
  const visibleAlerts = showAllAlerts ? data.alerts : data.alerts.slice(0, 3)

  async function handleRestockSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedIngredientId || !quantity) {
      setSubmitError('Please select an ingredient and enter a quantity.')
      return
    }

    setIsSubmitting(true)
    setSubmitError('')

    try {
      const res = await submitRestockAction({
        ingredientId: selectedIngredientId,
        quantity: parseFloat(quantity),
        expirationDate: expirationDate || null,
        costPerUnit: selectedIngredient?.cost_per_unit || 0,
        reason: 'Restock logged via Manager Dashboard',
      })

      if (!res.success) {
        setSubmitError(res.error || 'Failed to submit restock')
        return
      }

      setSubmitSuccess(true)
      setSelectedIngredientId('')
      setQuantity('')
      setExpirationDate('')
      router.refresh()

      setTimeout(() => setSubmitSuccess(false), 4000)
    } catch (err: unknown) {
      setSubmitError(err instanceof Error ? err.message : 'Failed to submit restock')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* High-level KPI Stats Grid for Managers */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-xs p-4 sm:p-5">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Total Valuation</p>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-2xl sm:text-3xl font-extrabold text-gray-900">
              ${data.totalValuation.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </span>
          </div>
          <p className="text-xs text-gray-400 mt-1.5">{data.totalItems} managed ingredients</p>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-xs p-4 sm:p-5">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Low Stock Alerts</p>
          <div className="flex items-baseline gap-2 mt-1">
            <span className={`text-2xl sm:text-3xl font-extrabold ${data.lowStockCount > 0 ? 'text-[#e85d04]' : 'text-gray-900'}`}>
              {data.lowStockCount}
            </span>
            <span className="text-xs text-gray-400">items</span>
          </div>
          <p className="text-xs text-orange-600 font-medium mt-1.5">
            {data.lowStockCount > 0 ? 'Immediate reorder recommended' : 'Stock levels optimal'}
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-xs p-4 sm:p-5">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Expiring / Spoiled</p>
          <div className="flex items-baseline gap-2 mt-1">
            <span className={`text-2xl sm:text-3xl font-extrabold ${data.expiringCount + data.spoiledCount > 0 ? 'text-red-600' : 'text-gray-900'}`}>
              {data.expiringCount + data.spoiledCount}
            </span>
            <span className="text-xs text-gray-400">batches</span>
          </div>
          <p className="text-xs text-red-500 font-medium mt-1.5">
            {data.spoiledCount} expired · {data.expiringCount} within 48h
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-xs p-4 sm:p-5">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Audit Adherence</p>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-2xl sm:text-3xl font-extrabold text-[#2e7d32]">
              {data.cycleCountStatus.filter((c) => c.status === 'counted').length} / {data.cycleCountStatus.length}
            </span>
          </div>
          <p className="text-xs text-green-700 font-medium mt-1.5">Cycle counts logged today</p>
        </div>
      </div>

      {/* Main Responsive Grid Layout (Matches Figma Desktop Split Screen) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: ALERTS, QUICK ACTIONS, and CYCLE COUNT (7 cols on lg:) */}
        <div className="lg:col-span-7 space-y-6">
          {/* Section: Alerts Header (Compacted to 3 newest with See More option & counter summarized in header) */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                  ALERTS
                </span>
                {data.alerts.length > 0 && (
                  <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-xs font-black bg-red-100 text-red-700 border border-red-200">
                    {data.alerts.length}
                  </span>
                )}
              </div>
              <span className="text-xs text-gray-500 font-medium">
                {data.alerts.length === 0
                  ? 'All clear'
                  : `${data.lowStockCount} low stock · ${data.expiringCount + data.spoiledCount} expiring`}
              </span>
            </div>

            {/* Alert Cards */}
            {data.alerts.length === 0 ? (
              <div className="bg-green-50 border border-green-200/80 rounded-2xl p-4 flex items-center gap-3">
                <span className="text-xl">✅</span>
                <div>
                  <p className="text-sm font-bold text-green-900">All systems normal</p>
                  <p className="text-xs text-green-700">No ingredients below minimum threshold or nearing expiration.</p>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {visibleAlerts.map((alert) => {
                  if (alert.type === 'expiring_soon') {
                    // Yellow Card (Figma style)
                    return (
                      <div
                        key={alert.id}
                        className="bg-[#fffbeb] border border-[#fef08a] rounded-2xl p-4 flex items-start gap-3.5 shadow-xs transition-all hover:border-amber-300"
                      >
                        <div className="text-amber-500 text-lg shrink-0 mt-0.5">⚠️</div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm sm:text-base font-bold text-[#78350f]">
                            {alert.message}
                          </p>
                          <p className="text-xs text-[#92400e]/85 mt-0.5">
                            {alert.subMessage || 'Check storage location and prioritize usage'}
                          </p>
                        </div>
                      </div>
                    )
                  }

                  // Red Alert Card (Figma style: with bright red circle indicator)
                  return (
                    <div
                      key={alert.id}
                      className="bg-[#fef2f2] border border-[#fecaca] rounded-2xl p-4 flex items-start gap-3.5 shadow-xs transition-all hover:border-red-300"
                    >
                      <div className="w-4 h-4 rounded-full bg-red-600 mt-1 shrink-0 ring-4 ring-red-100" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm sm:text-base font-bold text-[#991b1b]">
                          {alert.message}
                        </p>
                        <p className="text-xs sm:text-sm text-[#b91c1c] mt-0.5">
                          {alert.subMessage}
                        </p>
                      </div>
                    </div>
                  )
                })}

                {/* See More / Show Less Toggle Button */}
                {data.alerts.length > 3 && (
                  <button
                    type="button"
                    onClick={() => setShowAllAlerts(!showAllAlerts)}
                    className="w-full py-2.5 px-4 bg-white hover:bg-gray-50 border border-gray-200/90 rounded-xl text-xs font-bold text-gray-700 hover:text-gray-900 transition-all flex items-center justify-center gap-1.5 shadow-2xs active:scale-98"
                  >
                    <span>
                      {showAllAlerts
                        ? 'Show Less (3 Newest)'
                        : `See More (${data.alerts.length - 3} more alerts)`}
                    </span>
                    <svg
                      className={`w-3.5 h-3.5 transition-transform duration-200 ${showAllAlerts ? 'rotate-180' : ''}`}
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                    >
                      <polyline points="6 9 12 15 18 9" />
                    </svg>
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Section: QUICK ACTIONS (Figma exact match) */}
          <div className="space-y-3">
            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider block">
              QUICK ACTIONS
            </span>
            <div className="grid grid-cols-3 gap-3">
              {/* Log Waste */}
              <button
                onClick={() => router.push('/staff/waste')}
                className="flex flex-col items-center justify-center p-4 bg-white border border-gray-200/80 rounded-2xl shadow-xs hover:border-gray-300 hover:shadow-sm active:scale-98 transition-all group"
              >
                <div className="w-12 h-12 rounded-xl bg-red-50 flex items-center justify-center text-red-500 mb-2 group-hover:scale-105 transition-transform">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="3 6 5 6 21 6"/>
                    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                    <path d="M10 11v6"/>
                    <path d="M14 11v6"/>
                    <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
                  </svg>
                </div>
                <span className="text-xs font-bold text-gray-800">Log Waste</span>
              </button>

              {/* Manual Restock */}
              <button
                onClick={() => {
                  const el = document.getElementById('restock-form-container')
                  el?.scrollIntoView({ behavior: 'smooth' })
                }}
                className="flex flex-col items-center justify-center p-4 bg-white border border-gray-200/80 rounded-2xl shadow-xs hover:border-gray-300 hover:shadow-sm active:scale-98 transition-all group"
              >
                <div className="w-12 h-12 rounded-xl bg-orange-50 flex items-center justify-center text-[#e85d04] mb-2 group-hover:scale-105 transition-transform">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="12" y1="5" x2="12" y2="19"/>
                    <line x1="5" y1="12" x2="19" y2="12"/>
                  </svg>
                </div>
                <span className="text-xs font-bold text-gray-800">Manual Restock</span>
              </button>

              {/* Perform Cycle Count */}
              <button
                onClick={() => router.push('/staff/cycle-count')}
                className="flex flex-col items-center justify-center p-4 bg-white border border-gray-200/80 rounded-2xl shadow-xs hover:border-gray-300 hover:shadow-sm active:scale-98 transition-all group"
              >
                <div className="w-12 h-12 rounded-xl bg-green-50 flex items-center justify-center text-[#2e7d32] mb-2 group-hover:scale-105 transition-transform">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="9 11 12 14 22 4"/>
                    <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
                  </svg>
                </div>
                <span className="text-xs font-bold text-gray-800 text-center">Perform Cycle Count</span>
              </button>
            </div>
          </div>

          {/* Section: Cycle Count (Figma exact match) */}
          <div className="bg-white rounded-2xl border border-gray-200/80 shadow-xs p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-gray-900">Cycle Count Status</h3>
              <Link
                href="/manager/reports"
                className="text-xs font-semibold text-[#e85d04] hover:underline"
              >
                Audit Logs →
              </Link>
            </div>

            <div className="divide-y divide-gray-100">
              {data.cycleCountStatus.map((item, idx) => (
                <div key={idx} className="py-3 flex items-center justify-between first:pt-0 last:pb-0">
                  <span className="text-sm font-semibold text-gray-800">{item.name}</span>
                  {item.status === 'counted' ? (
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-green-50 text-[#2e7d32] border border-green-200/60">
                      Counted · {item.countedQty} {item.unit}
                    </span>
                  ) : (
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-500">
                      Pending
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column: Manual Restock Form & Manager Quick Navigation (5 cols on lg:) */}
        <div id="restock-form-container" className="lg:col-span-5 space-y-6">
          {/* Manual Restock Form Card (Figma exact match) */}
          <div className="bg-white rounded-2xl border border-gray-200/80 shadow-xs p-5 sm:p-6 space-y-5">
            <div>
              <h2 className="text-lg font-extrabold text-gray-900 tracking-tight">Manual Restock</h2>
              <p className="text-xs text-gray-500 mt-0.5">Log a delivery as it arrives.</p>
            </div>

            {submitSuccess && (
              <div className="p-3 bg-green-50 border border-green-200 rounded-xl text-green-700 text-xs font-medium flex items-center gap-2">
                <span>✓</span> Restock logged successfully into Supabase!
              </div>
            )}

            {submitError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-600 text-xs font-medium">
                {submitError}
              </div>
            )}

            <form onSubmit={handleRestockSubmit} className="space-y-4">
              {/* Ingredient Name */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider">
                  Ingredient Name
                </label>
                <div className="relative">
                  <select
                    value={selectedIngredientId}
                    onChange={(e) => setSelectedIngredientId(e.target.value)}
                    className="w-full appearance-none bg-white border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#e85d04] focus:border-transparent pr-10 shadow-2xs"
                    required
                  >
                    <option value="">Select ingredient...</option>
                    {data.ingredients.map((ing) => (
                      <option key={ing.id} value={ing.id}>
                        {ing.name} ({ing.unit})
                      </option>
                    ))}
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-gray-400">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="6 9 12 15 18 9"/>
                    </svg>
                  </div>
                </div>
              </div>

              {/* Quantity Received */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider">
                  Quantity Received {selectedIngredient && `(${selectedIngredient.unit})`}
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  placeholder="0"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#e85d04] focus:border-transparent shadow-2xs"
                  required
                />
              </div>

              {/* Expiration / Batch Date */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider">
                  Expiration / Batch Date
                </label>
                <input
                  type="date"
                  value={expirationDate}
                  onChange={(e) => setExpirationDate(e.target.value)}
                  className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#e85d04] focus:border-transparent shadow-2xs"
                />
                <p className="text-[11px] text-gray-400">Used for spoiled time limit and automated alerts.</p>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full bg-[#e85d04] hover:bg-[#d45203] text-white font-bold py-3.5 rounded-xl text-sm shadow-sm active:scale-98 transition-all disabled:opacity-50"
              >
                {isSubmitting ? 'Submitting Restock...' : 'Submit Restock'}
              </button>
            </form>
          </div>

          {/* Manager Action Shortcuts */}
          <div className="bg-linear-to-br from-orange-50/60 to-amber-50/40 border border-orange-200/60 rounded-2xl p-5 space-y-3">
            <h4 className="text-sm font-bold text-orange-950 flex items-center gap-2">
              <span>⚡</span> Manager Tools
            </h4>
            <p className="text-xs text-orange-900/80 leading-relaxed">
              Quickly manage Clover POS product recipe mappings, adjust low-stock thresholds, or run variance audits.
            </p>
            <div className="flex flex-col sm:flex-row gap-2 pt-1">
              <Link
                href="/manager/recipes"
                className="flex-1 bg-white border border-orange-200 hover:border-orange-300 text-xs font-bold text-[#e85d04] px-3.5 py-2.5 rounded-xl text-center shadow-2xs"
              >
                Recipes & Clover →
              </Link>
              <Link
                href="/manager/thresholds"
                className="flex-1 bg-white border border-orange-200 hover:border-orange-300 text-xs font-bold text-[#e85d04] px-3.5 py-2.5 rounded-xl text-center shadow-2xs"
              >
                Edit Thresholds →
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* SECTION: Compacted Recent Activity & Audit Logs (Navigates to /manager/reports on click) */}
      <div className="bg-white rounded-2xl border border-gray-200/80 shadow-xs p-5 sm:p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-gray-100">
          <div
            onClick={() => router.push('/manager/reports')}
            className="cursor-pointer group flex items-start sm:items-center gap-2.5"
          >
            <span className="text-xl">📜</span>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-extrabold text-gray-900 group-hover:text-[#e85d04] transition-colors tracking-tight">
                  Recent Activity & Audit Logs
                </h2>
                <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-xs font-black bg-gray-100 text-gray-700 border border-gray-200">
                  {data.recentLogs.length}
                </span>
              </div>
              <p className="text-xs text-gray-500 mt-0.5">
                Deliveries, spoilage discards, cycle count audits, and Clover POS deductions. Click any record to inspect.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => router.push('/manager/reports')}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-[#e85d04] hover:text-[#d45203] bg-orange-50 hover:bg-orange-100/80 px-3.5 py-2 rounded-xl border border-orange-200/60 transition-all shrink-0 self-start sm:self-auto active:scale-95"
          >
            <span>Open Logs & Audits Page</span>
            <span>→</span>
          </button>
        </div>

        {/* Quick Filter Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar bg-gray-100/80 p-1 rounded-xl">
          <button
            onClick={() => setLogTypeFilter('ALL')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 ${
              logTypeFilter === 'ALL'
                ? 'bg-white text-gray-900 shadow-2xs'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <span>All</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-gray-200/70 text-gray-700 font-extrabold">
              {logCounts.ALL}
            </span>
          </button>

          <button
            onClick={() => setLogTypeFilter('RESTOCK')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 ${
              logTypeFilter === 'RESTOCK'
                ? 'bg-emerald-600 text-white shadow-2xs'
                : 'text-emerald-700 hover:bg-emerald-50'
            }`}
          >
            <span>📦 Restocks</span>
            <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-extrabold ${logTypeFilter === 'RESTOCK' ? 'bg-emerald-700 text-white' : 'bg-emerald-100 text-emerald-800'}`}>
              {logCounts.RESTOCK}
            </span>
          </button>

          <button
            onClick={() => setLogTypeFilter('WASTE')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 ${
              logTypeFilter === 'WASTE'
                ? 'bg-red-600 text-white shadow-2xs'
                : 'text-red-700 hover:bg-red-50'
            }`}
          >
            <span>🗑️ Waste</span>
            <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-extrabold ${logTypeFilter === 'WASTE' ? 'bg-red-700 text-white' : 'bg-red-100 text-red-800'}`}>
              {logCounts.WASTE}
            </span>
          </button>

          <button
            onClick={() => setLogTypeFilter('CYCLE_COUNT')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 ${
              logTypeFilter === 'CYCLE_COUNT'
                ? 'bg-blue-600 text-white shadow-2xs'
                : 'text-blue-700 hover:bg-blue-50'
            }`}
          >
            <span>📋 Audits</span>
            <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-extrabold ${logTypeFilter === 'CYCLE_COUNT' ? 'bg-blue-700 text-white' : 'bg-blue-100 text-blue-800'}`}>
              {logCounts.CYCLE_COUNT}
            </span>
          </button>

          <button
            onClick={() => setLogTypeFilter('SALE')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 ${
              logTypeFilter === 'SALE'
                ? 'bg-purple-600 text-white shadow-2xs'
                : 'text-purple-700 hover:bg-purple-50'
            }`}
          >
            <span>🏷️ Clover</span>
            <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-extrabold ${logTypeFilter === 'SALE' ? 'bg-purple-700 text-white' : 'bg-purple-100 text-purple-800'}`}>
              {logCounts.SALE}
            </span>
          </button>
        </div>

        {/* Compacted Logs List: Top 4 recent items, all clickable to navigate to /manager/reports */}
        {filteredLogs.length === 0 ? (
          <div
            onClick={() => router.push('/manager/reports')}
            className="py-6 text-center bg-gray-50/70 border border-dashed border-gray-200 rounded-2xl cursor-pointer hover:bg-gray-100/60 transition-colors"
          >
            <p className="text-xs font-semibold text-gray-500">No logs found for this filter.</p>
            <p className="text-[11px] text-[#e85d04] font-bold mt-1">Click to open full logs history page →</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100 border border-gray-100 rounded-2xl overflow-hidden">
            {filteredLogs.slice(0, 4).map((log) => {
              const date = new Date(log.created_at)
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
                  key={log.id}
                  onClick={() => router.push('/manager/reports')}
                  className="p-3.5 hover:bg-orange-50/40 transition-colors cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-3 group"
                  title="Click to view full log details on the Logs & Audits page"
                >
                  <div className="flex items-start sm:items-center gap-3 min-w-0">
                    <div className="shrink-0">
                      {log.transaction_type === 'RESTOCK' ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-lg">
                          <span>📦</span> Restock
                        </span>
                      ) : log.transaction_type === 'WASTE' ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-red-800 bg-red-50 border border-red-200 px-2.5 py-0.5 rounded-lg">
                          <span>🗑️</span> Waste
                        </span>
                      ) : log.transaction_type === 'CYCLE_COUNT' ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-800 bg-blue-50 border border-blue-200 px-2.5 py-0.5 rounded-lg">
                          <span>📋</span> Audit
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-purple-800 bg-purple-50 border border-purple-200 px-2.5 py-0.5 rounded-lg">
                          <span>🏷️</span> Clover
                        </span>
                      )}
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-extrabold text-sm text-gray-900 group-hover:text-[#e85d04] transition-colors">
                          {log.ingredientName}
                        </span>
                        <span className="text-[11px] text-gray-400">
                          {formattedDate} · {formattedTime}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5 truncate">
                        {log.reason ? (
                          <span>Note: <span className="font-medium text-gray-700">{log.reason}</span></span>
                        ) : log.transaction_type === 'RESTOCK' ? (
                          'Delivery received & added to inventory'
                        ) : (
                          'Stock balance updated'
                        )}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 pl-10 sm:pl-0">
                    <div className="text-left sm:text-right">
                      <div className="text-xs font-black">
                        {log.transaction_type === 'RESTOCK' ? (
                          <span className="text-emerald-700">+{log.quantity_change} {log.unit}</span>
                        ) : log.transaction_type === 'WASTE' || log.transaction_type === 'SALE' ? (
                          <span className="text-red-700">-{log.quantity_change} {log.unit}</span>
                        ) : (
                          <span className="text-blue-700">Count: {log.new_stock !== null ? log.new_stock : log.quantity_change} {log.unit}</span>
                        )}
                      </div>
                      <div className="text-[11px] text-gray-400 font-medium">
                        {log.previous_stock !== null && log.new_stock !== null ? (
                          <span>{log.previous_stock} → {log.new_stock} {log.unit}</span>
                        ) : (
                          <span>Balance logged</span>
                        )}
                      </div>
                    </div>

                    <span className="text-[#e85d04] text-xs font-bold group-hover:translate-x-0.5 transition-transform">
                      →
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Clickable Card Footer */}
        <button
          type="button"
          onClick={() => router.push('/manager/reports')}
          className="w-full py-2.5 px-4 bg-gray-50 hover:bg-orange-50 border border-gray-200/80 hover:border-orange-200 rounded-xl text-xs font-bold text-gray-700 hover:text-[#e85d04] transition-all flex items-center justify-center gap-1.5 shadow-2xs active:scale-98"
        >
          <span>View all {data.recentLogs.length} logs in full ledger & export CSV</span>
          <span>→</span>
        </button>
      </div>
    </div>
  )
}
