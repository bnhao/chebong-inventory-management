'use client'

import { useState } from 'react'
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
  ShoppingBasket,
  Trash2,
} from 'lucide-react'
import StaffDesktopNav from '@/components/StaffDesktopNav'
import { submitRestockAction } from '@/app/actions/inventory'
import { StaffDashboardData } from './page'

interface Props {
  data: StaffDashboardData
}

export default function DashboardClient({ data }: Props) {
  const router = useRouter()

  const [showAllAlerts, setShowAllAlerts] = useState(false)

  const lowStockCount = data.alerts.filter((a) => a.type === 'low_stock').length
  const expiringCount = data.alerts.filter(
    (a) => a.type === 'expiring_soon' || a.type === 'spoiled'
  ).length

  const [selectedIngredientId, setSelectedIngredientId] = useState('')
  const [quantity, setQuantity] = useState('')
  const [expirationDate, setExpirationDate] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitSuccess, setSubmitSuccess] = useState(false)
  const [submitError, setSubmitError] = useState('')

  const selectedIngredient = data.ingredients.find((i) => i.id === selectedIngredientId)

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

      setTimeout(() => setSubmitSuccess(false), 3500)
    } catch (err: unknown) {
      setSubmitError(err instanceof Error ? err.message : 'Failed to submit restock')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header row */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <p className="text-xs text-[#737373] font-mono tabular-nums">
            {data.headerContext.formattedDate} · {data.headerContext.shiftLabel}
          </p>
          <h1 className="text-2xl sm:text-[28px] leading-[1.15] font-medium text-[#171717] tracking-[-0.015em] mt-1">
            Staff dashboard
          </h1>
        </div>
        <StaffDesktopNav />
      </div>

      {/* Freshness & restock status summary */}
      <div className="surface-card rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div
            className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${
              data.alerts.length === 0
                ? 'bg-[#f0fdf4] border-[#bbf7d0] text-[#15803d]'
                : 'bg-[#fff7ed] border-[#fed7aa] text-[#c2410c]'
            }`}
          >
            {data.alerts.length === 0 ? (
              <CheckCircle2 size={18} strokeWidth={1.5} />
            ) : (
              <ShoppingBasket size={18} strokeWidth={1.5} />
            )}
          </div>
          <div>
            <p className="text-base font-medium text-[#171717] tabular-nums">
              {data.alerts.length === 0
                ? 'All ingredients stocked and fresh'
                : `${data.alerts.length} ${data.alerts.length === 1 ? 'item needs' : 'items need'} attention`}
            </p>
            <p className="text-sm text-[#525252] mt-0.5 tabular-nums">
              {data.alerts.length === 0
                ? 'No items below par or nearing expiration'
                : `${lowStockCount} low stock · ${expiringCount} expiring or spoiled`}
            </p>
          </div>
        </div>
        <Link
          href={data.alerts.length === 0 ? '/staff/cycle-count' : '/staff/groceries'}
          className="btn-primary h-10 px-4 rounded-xl text-sm font-medium inline-flex items-center justify-center gap-2 shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c2410c] focus-visible:ring-offset-1"
        >
          <span>{data.alerts.length === 0 ? "Start today's count" : 'Review grocery list'}</span>
          <ArrowRight size={16} strokeWidth={1.5} />
        </Link>
      </div>

      {/* Main 12-col split */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column */}
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
                  : `${lowStockCount} low · ${expiringCount} expiry`}
              </span>
            </div>

            {data.alerts.length === 0 ? (
              <div className="surface-card rounded-2xl p-4 flex items-center gap-3">
                <CheckCircle2 size={18} strokeWidth={1.5} className="text-[#15803d] shrink-0" />
                <div>
                  <p className="text-sm font-medium text-[#171717]">All stocked and fresh</p>
                  <p className="text-xs text-[#737373] mt-0.5">
                    No ingredients below threshold or nearing expiration
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                {(showAllAlerts ? data.alerts : data.alerts.slice(0, 3)).map((alert) => {
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
                            {alert.subMessage || 'Use first · Walk-in fridge'}
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
                className="flex flex-col items-start gap-3 p-4 surface-card-interactive rounded-2xl text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c2410c]"
              >
                <div className="w-9 h-9 rounded-lg bg-[#f4f4f5] border border-neutral-900/[0.06] flex items-center justify-center text-[#525252]">
                  <Trash2 size={16} strokeWidth={1.5} />
                </div>
                <span className="text-sm font-medium text-[#171717]">Log waste</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  const el = document.getElementById('staff-restock-panel')
                  if (el && window.innerWidth >= 1024) {
                    el.scrollIntoView({ behavior: 'smooth' })
                  } else {
                    router.push('/staff/restock')
                  }
                }}
                className="flex flex-col items-start gap-3 p-4 surface-card-interactive rounded-2xl text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c2410c]"
              >
                <div className="w-9 h-9 rounded-lg bg-[#f4f4f5] border border-neutral-900/[0.06] flex items-center justify-center text-[#525252]">
                  <PackagePlus size={16} strokeWidth={1.5} />
                </div>
                <span className="text-sm font-medium text-[#171717]">Manual restock</span>
              </button>

              <button
                type="button"
                onClick={() => router.push('/staff/cycle-count')}
                className="flex flex-col items-start gap-3 p-4 surface-card-interactive rounded-2xl text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c2410c]"
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
                href="/staff/cycle-count"
                className="text-xs font-medium text-[#c2410c] hover:text-[#9a3412] inline-flex items-center gap-1 shrink-0"
              >
                <span>Start audit</span>
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

        {/* Right Column: Manual Restock */}
        <div id="staff-restock-panel" className="lg:col-span-5">
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
                  className="w-full h-10 bg-white border border-neutral-900/[0.14] hover:border-neutral-900/[0.24] rounded-xl px-3 text-sm font-mono tabular-nums text-[#171717] placeholder-[#a3a3a3] focus:outline-none focus:ring-2 focus:ring-[#c2410c] focus:border-transparent transition-colors"
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
                  className="w-full h-10 bg-white border border-neutral-900/[0.14] hover:border-neutral-900/[0.24] rounded-xl px-3 text-sm font-mono tabular-nums text-[#171717] focus:outline-none focus:ring-2 focus:ring-[#c2410c] focus:border-transparent transition-colors"
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
        </div>
      </div>
    </div>
  )
}
