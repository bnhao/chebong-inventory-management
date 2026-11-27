'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  AlertTriangle,
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronDown,
  ClipboardCheck,
  Clock,
  PackagePlus,
  Trash2,
} from 'lucide-react'
import { submitRestockAction } from '@/app/actions/inventory'
import { getStoreTimezone } from '@/lib/timezone'
import { ManagerDashboardData } from './page'

interface Props {
  data: ManagerDashboardData
}

const LOG_TYPE_LABEL: Record<string, string> = {
  RESTOCK: 'Restock',
  WASTE: 'Waste',
  CYCLE_COUNT: 'Audit',
  SALE: 'Clover',
}

export default function ManagerDashboardClient({ data }: Props) {
  const router = useRouter()

  const [showAllAlerts, setShowAllAlerts] = useState(false)

  const [selectedIngredientId, setSelectedIngredientId] = useState('')
  const [quantity, setQuantity] = useState('')
  const [expirationDate, setExpirationDate] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitSuccess, setSubmitSuccess] = useState(false)
  const [submitError, setSubmitError] = useState('')

  const [logTypeFilter, setLogTypeFilter] = useState<
    'ALL' | 'RESTOCK' | 'WASTE' | 'CYCLE_COUNT' | 'SALE'
  >('ALL')

  const selectedIngredient = data.ingredients.find((i) => i.id === selectedIngredientId)

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

  const visibleAlerts = showAllAlerts ? data.alerts : data.alerts.slice(0, 3)

  async function handleRestockSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedIngredientId || !quantity) {
      setSubmitError('Select an ingredient and enter a quantity')
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
      {/* KPI row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="surface-card rounded-2xl p-5">
          <p className="text-xs text-[#737373]">Inventory value</p>
          <p className="text-2xl sm:text-[28px] leading-none font-medium font-mono tabular-nums text-[#171717] mt-2">
            ${data.totalValuation.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </p>
          <p className="text-xs text-[#737373] mt-2 tabular-nums">
            {data.totalItems} managed ingredients
          </p>
        </div>

        <div className="surface-card rounded-2xl p-5">
          <p className="text-xs text-[#737373]">Running low</p>
          <div className="flex items-baseline gap-1.5 mt-2">
            <span
              className={`text-2xl sm:text-[28px] leading-none font-medium font-mono tabular-nums ${
                data.lowStockCount > 0 ? 'text-[#c2410c]' : 'text-[#171717]'
              }`}
            >
              {data.lowStockCount}
            </span>
            <span className="text-xs text-[#737373]">items</span>
          </div>
          <p className="text-xs text-[#737373] mt-2">
            {data.lowStockCount > 0 ? 'Below threshold' : 'All above par'}
          </p>
        </div>

        <div className="surface-card rounded-2xl p-5">
          <p className="text-xs text-[#737373]">Use soon</p>
          <div className="flex items-baseline gap-1.5 mt-2">
            <span
              className={`text-2xl sm:text-[28px] leading-none font-medium font-mono tabular-nums ${
                data.expiringCount + data.spoiledCount > 0
                  ? 'text-[#b91c1c]'
                  : 'text-[#171717]'
              }`}
            >
              {data.expiringCount + data.spoiledCount}
            </span>
            <span className="text-xs text-[#737373]">batches</span>
          </div>
          <p className="text-xs text-[#737373] mt-2 font-mono tabular-nums">
            {data.spoiledCount} expired · {data.expiringCount} within 48h
          </p>
        </div>

        <div className="surface-card rounded-2xl p-5">
          <p className="text-xs text-[#737373]">Counts today</p>
          <p className="text-2xl sm:text-[28px] leading-none font-medium font-mono tabular-nums text-[#171717] mt-2">
            {data.cycleCountSummary.countedCount} / {data.cycleCountSummary.totalCount}
          </p>
          <p className="text-xs text-[#737373] mt-2 font-mono tabular-nums">
            {data.cycleCountSummary.progressPct}% completed
          </p>
        </div>
      </div>

      {/* Main 12-col split */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-7 space-y-6">
          {/* Alerts */}
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-medium text-[#171717]">Alerts</h2>
                {data.alerts.length > 0 && (
                  <span className="font-mono text-xs tabular-nums text-[#737373]">
                    {data.alerts.length}
                  </span>
                )}
              </div>
              <span className="text-xs text-[#737373] font-mono tabular-nums">
                {data.alerts.length === 0
                  ? 'Clear'
                  : `${data.lowStockCount} low · ${data.expiringCount + data.spoiledCount} expiry`}
              </span>
            </div>

            {data.alerts.length === 0 ? (
              <div className="surface-card rounded-2xl p-4 flex items-center gap-3">
                <CheckCircle2 size={18} strokeWidth={1.5} className="text-[#15803d] shrink-0" />
                <div>
                  <p className="text-sm font-medium text-[#171717]">All systems normal</p>
                  <p className="text-xs text-[#737373] mt-0.5">
                    No ingredients below threshold or nearing expiration
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                {visibleAlerts.map((alert) => {
                  const isExpiring = alert.type === 'expiring_soon'
                  return (
                    <div
                      key={alert.id}
                      className={`rounded-xl border px-4 py-3 flex items-start justify-between gap-3 ${
                        isExpiring
                          ? 'bg-[#fffbeb] border-[#fde68a]'
                          : 'bg-[#fef2f2] border-[#fecaca]'
                      }`}
                    >
                      <div className="flex items-start gap-3 min-w-0">
                        {isExpiring ? (
                          <Clock
                            size={16}
                            strokeWidth={1.5}
                            className="text-[#b45309] mt-0.5 shrink-0"
                          />
                        ) : (
                          <AlertTriangle
                            size={16}
                            strokeWidth={1.5}
                            className="text-[#b91c1c] mt-0.5 shrink-0"
                          />
                        )}
                        <div className="min-w-0">
                          <p
                            className={`text-sm font-medium ${
                              isExpiring ? 'text-[#78350f]' : 'text-[#7f1d1d]'
                            }`}
                          >
                            {alert.message}
                          </p>
                          <p
                            className={`text-xs mt-0.5 ${
                              isExpiring ? 'text-[#92400e]' : 'text-[#991b1b]'
                            }`}
                          >
                            {alert.subMessage || 'Prioritize usage in walk-in fridge'}
                          </p>
                        </div>
                      </div>
                      <span
                        className={`font-mono text-xs tabular-nums shrink-0 px-2 py-0.5 rounded-md border ${
                          isExpiring
                            ? 'bg-white/70 border-[#fde68a] text-[#b45309]'
                            : 'bg-white/70 border-[#fecaca] text-[#b91c1c]'
                        }`}
                      >
                        {isExpiring ? 'Expiring' : alert.type === 'spoiled' ? 'Spoiled' : 'Low'}
                      </span>
                    </div>
                  )
                })}

                {data.alerts.length > 3 && (
                  <button
                    type="button"
                    onClick={() => setShowAllAlerts(!showAllAlerts)}
                    className="w-full h-9 px-4 btn-secondary rounded-xl text-xs font-medium flex items-center justify-center gap-1.5"
                  >
                    <span>
                      {showAllAlerts
                        ? 'Show fewer'
                        : `Show all alerts (${data.alerts.length - 3} more)`}
                    </span>
                    <ChevronDown
                      size={14}
                      strokeWidth={1.5}
                      className={`transition-transform duration-150 ${
                        showAllAlerts ? 'rotate-180' : ''
                      }`}
                    />
                  </button>
                )}
              </div>
            )}
          </section>

          {/* Quick actions */}
          <section className="space-y-3">
            <h2 className="text-sm font-medium text-[#171717]">Quick actions</h2>
            <div className="grid grid-cols-3 gap-3">
              <button
                type="button"
                onClick={() => router.push('/staff/waste')}
                className="flex flex-col items-start gap-3 p-4 surface-card-interactive rounded-2xl text-left"
              >
                <div className="w-9 h-9 rounded-lg bg-[#f4f4f5] border border-neutral-900/[0.06] flex items-center justify-center text-[#525252]">
                  <Trash2 size={16} strokeWidth={1.5} />
                </div>
                <span className="text-sm font-medium text-[#171717]">Log waste</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  const el = document.getElementById('restock-form-container')
                  el?.scrollIntoView({ behavior: 'smooth' })
                }}
                className="flex flex-col items-start gap-3 p-4 surface-card-interactive rounded-2xl text-left"
              >
                <div className="w-9 h-9 rounded-lg bg-[#f4f4f5] border border-neutral-900/[0.06] flex items-center justify-center text-[#525252]">
                  <PackagePlus size={16} strokeWidth={1.5} />
                </div>
                <span className="text-sm font-medium text-[#171717]">Manual restock</span>
              </button>

              <button
                type="button"
                onClick={() => router.push('/staff/cycle-count')}
                className="flex flex-col items-start gap-3 p-4 surface-card-interactive rounded-2xl text-left"
              >
                <div className="w-9 h-9 rounded-lg bg-[#f4f4f5] border border-neutral-900/[0.06] flex items-center justify-center text-[#525252]">
                  <ClipboardCheck size={16} strokeWidth={1.5} />
                </div>
                <span className="text-sm font-medium text-[#171717]">Cycle count</span>
              </button>
            </div>
          </section>

          {/* Today's Cycle Count */}
          <section className="surface-card rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <h2 className="text-base font-medium text-[#171717]">Today&apos;s cycle count</h2>
                <span className="batch-stamp">
                  {data.cycleCountSummary.countedCount} / {data.cycleCountSummary.totalCount}
                </span>
              </div>
              <Link
                href="/manager/reports"
                className="text-xs font-medium text-[#c2410c] hover:text-[#9a3412] inline-flex items-center gap-1 shrink-0"
              >
                <span>Audit logs</span>
                <ArrowRight size={14} strokeWidth={1.5} />
              </Link>
            </div>

            <div className="w-full bg-[#f4f4f5] rounded-full h-1.5 overflow-hidden">
              <div
                className="bg-[#15803d] h-1.5 rounded-full transition-[width] duration-300"
                style={{ width: `${data.cycleCountSummary.progressPct}%` }}
              />
            </div>

            <div className="divide-y divide-neutral-900/[0.06]">
              {data.cycleCountSummary.items.map((item) => (
                <div
                  key={item.ingredientId}
                  className="py-3 flex items-center justify-between gap-3 first:pt-1 last:pb-0"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span
                      className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                        item.status === 'counted'
                          ? 'bg-[#15803d]'
                          : item.priorityReason === 'critical'
                          ? 'bg-[#b91c1c]'
                          : item.priorityReason === 'warning'
                          ? 'bg-[#b45309]'
                          : 'bg-[#a3a3a3]'
                      }`}
                    />
                    <span className="text-sm text-[#171717] truncate">{item.name}</span>
                    {item.status === 'pending' && item.priorityReason === 'critical' && (
                      <span className="text-xs text-[#b91c1c] shrink-0">Critical</span>
                    )}
                    {item.status === 'pending' && item.priorityReason === 'warning' && (
                      <span className="text-xs text-[#b45309] shrink-0">At risk</span>
                    )}
                    {item.status === 'pending' && item.priorityReason === 'high_value' && (
                      <span className="text-xs text-[#737373] shrink-0">High value</span>
                    )}
                  </div>
                  {item.status === 'counted' ? (
                    <span className="font-mono text-xs tabular-nums text-[#15803d] shrink-0">
                      {item.countedQty} {item.unit}
                    </span>
                  ) : (
                    <span className="font-mono text-xs text-[#737373] shrink-0">Pending</span>
                  )}
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* Right Column */}
        <div id="restock-form-container" className="lg:col-span-5 space-y-6">
          <div className="surface-card rounded-2xl p-6 space-y-5">
            <div>
              <h2 className="text-base font-medium text-[#171717]">Manual restock</h2>
              <p className="text-xs text-[#737373] mt-0.5">Log a delivery as it arrives</p>
            </div>

            {submitSuccess && (
              <div className="p-3 bg-[#f0fdf4] border border-[#bbf7d0] rounded-xl text-[#15803d] text-xs font-medium flex items-center gap-2">
                <Check size={14} strokeWidth={1.5} />
                <span>Restock logged</span>
              </div>
            )}

            {submitError && (
              <div className="p-3 bg-[#fef2f2] border border-[#fecaca] rounded-xl text-[#b91c1c] text-xs font-medium">
                {submitError}
              </div>
            )}

            <form onSubmit={handleRestockSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-[#525252]">
                  Ingredient
                </label>
                <select
                  value={selectedIngredientId}
                  onChange={(e) => setSelectedIngredientId(e.target.value)}
                  className="w-full h-10 bg-white border border-neutral-900/[0.14] hover:border-neutral-900/[0.24] rounded-xl px-3 text-sm text-[#171717] focus:outline-none focus:ring-2 focus:ring-[#c2410c] focus:border-transparent transition-colors"
                  required
                >
                  <option value="">Select ingredient</option>
                  {data.ingredients.map((ing) => (
                    <option key={ing.id} value={ing.id}>
                      {ing.name} ({ing.unit})
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-[#525252]">
                  Quantity received{selectedIngredient ? ` (${selectedIngredient.unit})` : ''}
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  placeholder="0"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  className="w-full h-10 bg-white border border-neutral-900/[0.14] rounded-xl px-3 text-sm font-mono tabular-nums text-[#171717] placeholder-[#a3a3a3] focus:outline-none focus:ring-2 focus:ring-[#c2410c]"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-[#525252]">
                  Expiration date
                </label>
                <input
                  type="date"
                  value={expirationDate}
                  onChange={(e) => setExpirationDate(e.target.value)}
                  className="w-full h-10 bg-white border border-neutral-900/[0.14] rounded-xl px-3 text-sm font-mono tabular-nums text-[#171717] focus:outline-none focus:ring-2 focus:ring-[#c2410c]"
                />
                <p className="text-xs text-[#737373]">
                  {selectedIngredient
                    ? `Defaults to +${selectedIngredient.spoiled_time_limit_days} days (${selectedIngredient.name} shelf life)`
                    : 'Defaults to ingredient shelf life if left blank'}
                </p>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full h-10 btn-primary rounded-xl text-sm font-medium disabled:opacity-50"
              >
                {isSubmitting ? 'Submitting…' : 'Submit restock'}
              </button>
            </form>
          </div>

          <div className="surface-card rounded-2xl p-5 space-y-3">
            <h3 className="text-sm font-medium text-[#171717]">Shortcuts</h3>
            <p className="text-xs text-[#737373] leading-relaxed">
              Manage Clover POS recipe mappings or adjust low-stock thresholds
            </p>
            <div className="grid grid-cols-2 gap-2 pt-1">
              <Link
                href="/manager/recipes"
                className="h-9 btn-secondary rounded-xl text-xs font-medium inline-flex items-center justify-center gap-1.5"
              >
                <span>Recipes</span>
                <ArrowRight size={14} strokeWidth={1.5} />
              </Link>
              <Link
                href="/manager/thresholds"
                className="h-9 btn-secondary rounded-xl text-xs font-medium inline-flex items-center justify-center gap-1.5"
              >
                <span>Thresholds</span>
                <ArrowRight size={14} strokeWidth={1.5} />
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Activity & Audit Logs */}
      <section className="surface-card rounded-2xl p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-neutral-900/[0.08]">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-medium text-[#171717]">
                Recent activity
              </h2>
              <span className="batch-stamp">{data.recentLogs.length}</span>
            </div>
            <p className="text-xs text-[#737373] mt-0.5">
              Deliveries, spoilage discards, cycle counts, and Clover deductions
            </p>
          </div>

          <Link
            href="/manager/reports"
            className="h-9 px-3 btn-secondary rounded-xl text-xs font-medium inline-flex items-center gap-1.5 shrink-0 self-start sm:self-auto"
          >
            <span>Open full ledger</span>
            <ArrowRight size={14} strokeWidth={1.5} />
          </Link>
        </div>

        {/* Quiet monochrome filter tabs */}
        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar bg-[#f4f4f5] p-1 rounded-xl w-fit max-w-full">
          {(
            [
              { id: 'ALL', label: 'All', count: logCounts.ALL },
              { id: 'RESTOCK', label: 'Restocks', count: logCounts.RESTOCK },
              { id: 'WASTE', label: 'Waste', count: logCounts.WASTE },
              { id: 'CYCLE_COUNT', label: 'Audits', count: logCounts.CYCLE_COUNT },
              { id: 'SALE', label: 'Clover', count: logCounts.SALE },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setLogTypeFilter(tab.id)}
              className={`h-8 px-3 rounded-lg text-xs font-medium transition-colors whitespace-nowrap flex items-center gap-1.5 ${
                logTypeFilter === tab.id
                  ? 'bg-white text-[#171717] border border-neutral-900/[0.08] shadow-[0_1px_2px_rgba(0,0,0,0.04)]'
                  : 'text-[#525252] hover:text-[#171717] border border-transparent'
              }`}
            >
              <span>{tab.label}</span>
              <span className="font-mono text-xs tabular-nums text-[#737373]">
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        {filteredLogs.length === 0 ? (
          <div className="py-8 text-center bg-[#fafafa] border border-dashed border-neutral-900/[0.12] rounded-xl">
            <p className="text-xs text-[#737373]">No logs for this filter</p>
          </div>
        ) : (
          <div className="divide-y divide-neutral-900/[0.06] border border-neutral-900/[0.08] rounded-xl overflow-hidden">
            {filteredLogs.slice(0, 4).map((log) => {
              const date = new Date(log.created_at)
              const storeTz = getStoreTimezone()
              const formattedDate = date.toLocaleDateString('en-US', {
                timeZone: storeTz,
                month: 'short',
                day: 'numeric',
              })
              const formattedTime = date.toLocaleTimeString('en-US', {
                timeZone: storeTz,
                hour: '2-digit',
                minute: '2-digit',
              })

              return (
                <div
                  key={log.id}
                  onClick={() => router.push('/manager/reports')}
                  className="px-4 py-3 hover:bg-[#fafafa] transition-colors cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="flex items-start sm:items-center gap-3 min-w-0">
                    <span className="batch-stamp shrink-0 w-18 text-center">
                      {LOG_TYPE_LABEL[log.transaction_type] || log.transaction_type}
                    </span>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm text-[#171717]">
                          {log.ingredientName}
                        </span>
                        <span
                          suppressHydrationWarning
                          className="font-mono text-xs tabular-nums text-[#737373]"
                        >
                          {formattedDate} · {formattedTime}
                        </span>
                      </div>
                      <p className="text-xs text-[#737373] mt-0.5 truncate">
                        {log.reason ||
                          (log.transaction_type === 'RESTOCK'
                            ? 'Delivery received'
                            : 'Stock balance updated')}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-4 shrink-0">
                    <div className="text-left sm:text-right font-mono tabular-nums">
                      <div className="text-xs font-medium">
                        {log.transaction_type === 'RESTOCK' ? (
                          <span className="text-[#15803d]">
                            +{log.quantity_change} {log.unit}
                          </span>
                        ) : log.transaction_type === 'WASTE' ||
                          log.transaction_type === 'SALE' ? (
                          <span className="text-[#b91c1c]">
                            -{log.quantity_change} {log.unit}
                          </span>
                        ) : (
                          <span className="text-[#171717]">
                            {log.new_stock !== null ? log.new_stock : log.quantity_change}{' '}
                            {log.unit}
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-[#737373]">
                        {log.previous_stock !== null && log.new_stock !== null
                          ? `${log.previous_stock} → ${log.new_stock} ${log.unit}`
                          : 'Logged'}
                      </div>
                    </div>
                    <ArrowRight size={14} strokeWidth={1.5} className="text-[#737373]" />
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}
