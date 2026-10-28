'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import StaffDesktopNav from '@/components/StaffDesktopNav'
import { submitRestockAction } from '@/app/actions/inventory'
import { StaffDashboardData } from './page'

interface Props {
  data: StaffDashboardData
}

function TrashIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#e85d04" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/>
      <path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/>
    </svg>
  )
}

function PlusIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#e85d04" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
    </svg>
  )
}

function CheckSquareIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#2e7d32" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 11 12 14 22 4"/>
      <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/>
    </svg>
  )
}

function UserIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#4b5563" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
      <circle cx="12" cy="7" r="4"/>
    </svg>
  )
}

function getShiftLabel(): string {
  const hour = new Date().getHours()
  if (hour < 12) return 'Morning shift'
  if (hour < 17) return 'Afternoon shift'
  return 'Evening shift'
}

function getFormattedDate(): string {
  return new Date().toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })
}

export default function DashboardClient({ data }: Props) {
  const router = useRouter()

  // Manual restock form state (for desktop right column & mobile quick restock)
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
      {/* Subheader: Responsive header with Shift/Date on left and Desktop Nav on right */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
            {getFormattedDate()} · {getShiftLabel()}
          </p>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight mt-0.5">
            Staff Dashboard
          </h1>
        </div>

        {/* Desktop Navigation (visible on >= md, hidden on mobile) */}
        <StaffDesktopNav />

        {/* Mobile Profile Icon (only visible on mobile) */}
        <div className="md:hidden self-end -mt-10">
          <button className="w-10 h-10 rounded-full border border-gray-200 bg-white flex items-center justify-center shadow-2xs">
            <UserIcon />
          </button>
        </div>
      </div>

      {/* Responsive Grid: 1 column on mobile, 12-column split on desktop (Figma layout) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column (7 cols on lg:) - ALERTS, QUICK ACTIONS, CYCLE COUNT */}
        <div className="lg:col-span-7 space-y-6">
          {/* ALERTS Section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                ALERTS
              </span>
              <span className="text-xs text-gray-500 font-medium">
                {data.alerts.length} notifications
              </span>
            </div>

            {data.alerts.length === 0 ? (
              <div className="bg-green-50 border border-green-200/80 rounded-2xl p-4 flex items-center gap-3">
                <span className="text-xl">✅</span>
                <div>
                  <p className="text-sm font-bold text-green-900">All stocked & fresh</p>
                  <p className="text-xs text-green-700">No ingredients below minimum threshold or nearing expiration.</p>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {data.alerts.map((alert) => {
                  if (alert.type === 'expiring_soon') {
                    // Yellow Card (Figma style)
                    return (
                      <div
                        key={alert.id}
                        className="bg-[#fffbeb] border border-[#fef08a] rounded-2xl p-4.5 flex items-start gap-3.5 shadow-xs transition-all hover:border-amber-300"
                      >
                        <div className="text-amber-500 text-lg shrink-0 mt-0.5">⚠️</div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm sm:text-base font-bold text-[#78350f]">
                            {alert.message}
                          </p>
                          <p className="text-xs text-[#92400e]/85 mt-0.5">
                            {alert.subMessage || 'Use first · Walk-in fridge, shelf B'}
                          </p>
                        </div>
                      </div>
                    )
                  }

                  // Red Alert Card (Figma style: with bright red circle indicator)
                  return (
                    <div
                      key={alert.id}
                      className="bg-[#fef2f2] border border-[#fecaca] rounded-2xl p-4.5 flex items-start gap-3.5 shadow-xs transition-all hover:border-red-300"
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
              </div>
            )}
          </div>

          {/* QUICK ACTIONS Section */}
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
                  <TrashIcon />
                </div>
                <span className="text-xs font-bold text-gray-800">Log Waste</span>
              </button>

              {/* Manual Restock */}
              <button
                onClick={() => {
                  const el = document.getElementById('staff-restock-panel')
                  if (el && window.innerWidth >= 1024) {
                    el.scrollIntoView({ behavior: 'smooth' })
                  } else {
                    router.push('/staff/restock')
                  }
                }}
                className="flex flex-col items-center justify-center p-4 bg-white border border-gray-200/80 rounded-2xl shadow-xs hover:border-gray-300 hover:shadow-sm active:scale-98 transition-all group"
              >
                <div className="w-12 h-12 rounded-xl bg-orange-50 flex items-center justify-center text-[#e85d04] mb-2 group-hover:scale-105 transition-transform">
                  <PlusIcon />
                </div>
                <span className="text-xs font-bold text-gray-800">Manual Restock</span>
              </button>

              {/* Perform Cycle Count */}
              <button
                onClick={() => router.push('/staff/cycle-count')}
                className="flex flex-col items-center justify-center p-4 bg-white border border-gray-200/80 rounded-2xl shadow-xs hover:border-gray-300 hover:shadow-sm active:scale-98 transition-all group"
              >
                <div className="w-12 h-12 rounded-xl bg-green-50 flex items-center justify-center text-[#2e7d32] mb-2 group-hover:scale-105 transition-transform">
                  <CheckSquareIcon />
                </div>
                <span className="text-xs font-bold text-gray-800 text-center">Perform Cycle Count</span>
              </button>
            </div>
          </div>

          {/* CYCLE COUNT Section (Figma exact match) */}
          <div className="bg-white rounded-2xl border border-gray-200/80 shadow-xs p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-gray-900">Cycle Count</h3>
              <Link
                href="/staff/cycle-count"
                className="text-xs font-semibold text-[#e85d04] hover:underline"
              >
                Start Audit →
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

        {/* Right Column (5 cols on lg:) - Manual Restock Card (Figma exact match) */}
        <div id="staff-restock-panel" className="lg:col-span-5 space-y-6">
          <div className="bg-white rounded-2xl border border-gray-200/80 shadow-xs p-5 sm:p-6 space-y-5">
            <div>
              <h2 className="text-lg font-extrabold text-gray-900 tracking-tight">Manual Restock</h2>
              <p className="text-xs text-gray-500 mt-0.5">Log a delivery as it arrives.</p>
            </div>

            {submitSuccess && (
              <div className="p-3 bg-green-50 border border-green-200 rounded-xl text-green-700 text-xs font-medium flex items-center gap-2">
                <span>✓</span> Restock logged successfully into system!
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
                <p className="text-[11px] text-gray-400">Enforces spoiled time limit and automated warnings.</p>
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
        </div>
      </div>
    </div>
  )
}
