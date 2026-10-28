'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import StaffDesktopNav from '@/components/StaffDesktopNav'
import { submitCycleCountAction } from '@/app/actions/inventory'
import { IngredientForCycleCount } from './page'

interface Props {
  ingredients: IngredientForCycleCount[]
}

interface CountEntry {
  ingredientId: string
  actualCount: string
}

function TrashIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#e85d04" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6"/>
      <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/>
      <path d="M10 11v6"/><path d="M14 11v6"/>
      <path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/>
    </svg>
  )
}

function PlusIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#e85d04" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="5" x2="12" y2="19"/>
      <line x1="5" y1="12" x2="19" y2="12"/>
    </svg>
  )
}

function CheckSquareIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 11 12 14 22 4"/>
      <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/>
    </svg>
  )
}

function DiscrepancyBadge({ discrepancy, unit }: { discrepancy: number; unit: string }) {
  if (discrepancy === 0) {
    return (
      <span className="text-xs font-bold text-green-700 bg-green-50 px-2.5 py-1 rounded-full border border-green-200">
        ✓ Match
      </span>
    )
  }
  const isPositive = discrepancy > 0
  return (
    <span
      className={`text-xs font-bold px-2.5 py-1 rounded-full border ${
        isPositive
          ? 'text-blue-700 bg-blue-50 border-blue-200'
          : 'text-red-700 bg-red-50 border-red-200'
      }`}
    >
      {isPositive ? '+' : ''}{discrepancy.toFixed(2)} {unit}
    </span>
  )
}

export default function CycleCountForm({ ingredients }: Props) {
  const router = useRouter()

  const [counts, setCounts] = useState<CountEntry[]>(
    ingredients.map((ing) => ({ ingredientId: ing.id, actualCount: '' }))
  )
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')

  function updateCount(ingredientId: string, value: string) {
    setCounts((prev) =>
      prev.map((c) => (c.ingredientId === ingredientId ? { ...c, actualCount: value } : c))
    )
  }

  function getActualCount(ingredientId: string): string {
    return counts.find((c) => c.ingredientId === ingredientId)?.actualCount ?? ''
  }

  function getDiscrepancy(ingredient: IngredientForCycleCount): number | null {
    const actual = parseFloat(getActualCount(ingredient.id))
    if (isNaN(actual)) return null
    return actual - ingredient.systemStock
  }

  // Count progress
  const filledCount = counts.filter((c) => c.actualCount !== '').length
  const totalCount = ingredients.length
  const progressPct = totalCount > 0 ? Math.round((filledCount / totalCount) * 100) : 0

  // Count discrepancies
  const discrepanciesCount = ingredients.filter((ing) => {
    const disc = getDiscrepancy(ing)
    return disc !== null && disc !== 0
  }).length

  async function handleSubmitAll(e: React.FormEvent) {
    e.preventDefault()

    const entriesToSubmit = counts
      .filter((c) => c.actualCount !== '')
      .map((c) => ({
        ingredientId: c.ingredientId,
        actualCount: parseFloat(c.actualCount),
        notes: notes || 'Physical inventory cycle count audit',
      }))

    if (entriesToSubmit.length === 0) {
      setError('Please enter at least one actual physical count.')
      return
    }

    setLoading(true)
    setError('')

    const res = await submitCycleCountAction(entriesToSubmit)

    setLoading(false)

    if (!res.success) {
      setError(res.error || 'Failed to submit cycle count')
      return
    }

    setSuccess(true)
    setTimeout(() => {
      setSuccess(false)
      setCounts(ingredients.map((ing) => ({ ingredientId: ing.id, actualCount: '' })))
      setNotes('')
      router.refresh()
    }, 3000)
  }

  return (
    <div className="space-y-6">
      {/* Subheader: Responsive header matching Dashboard */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
            Inventory Operations
          </p>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight mt-0.5">
            Physical Cycle Count
          </h1>
          <p className="text-xs sm:text-sm text-gray-500 mt-1">
            Enter the physical count for each ingredient. The system automatically calculates discrepancy and updates records.
          </p>
        </div>
        <StaffDesktopNav />
      </div>

      {/* 12-Column Responsive Grid matching Dashboard 7/5 ratio */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column (7 cols): Quick Actions & Ingredient Checklist */}
        <div className="lg:col-span-7 space-y-6">
          {/* Quick Actions Bar */}
          <div className="space-y-3">
            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider block">
              QUICK ACTIONS
            </span>
            <div className="grid grid-cols-3 gap-3">
              {/* Log Waste */}
              <button
                type="button"
                onClick={() => router.push('/staff/waste')}
                className="flex flex-col items-center justify-center gap-2 bg-white border border-gray-200/80 rounded-2xl p-4 shadow-xs active:scale-95 transition-all hover:border-gray-300"
              >
                <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-red-50">
                  <TrashIcon />
                </div>
                <span className="text-xs font-medium text-gray-700 text-center">Log Waste</span>
              </button>

              {/* Manual Restock */}
              <button
                type="button"
                onClick={() => router.push('/staff/restock')}
                className="flex flex-col items-center justify-center gap-2 bg-white border border-gray-200/80 rounded-2xl p-4 shadow-xs active:scale-95 transition-all hover:border-gray-300"
              >
                <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-orange-50">
                  <PlusIcon />
                </div>
                <span className="text-xs font-medium text-gray-700 text-center">Manual Restock</span>
              </button>

              {/* Perform Cycle Count (Active) */}
              <button
                type="button"
                className="flex flex-col items-center justify-center gap-2 bg-white border-2 border-[#16a34a] rounded-2xl p-4 shadow-xs"
              >
                <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-green-50">
                  <CheckSquareIcon />
                </div>
                <span className="text-xs font-bold text-[#16a34a] text-center">Perform Cycle Count</span>
              </button>
            </div>
          </div>

          {/* Ingredient Audit Checklist */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                Ingredients Checklist ({filledCount} of {totalCount} counted)
              </span>
              <span className="text-xs font-semibold text-gray-400">
                Live Discrepancy Preview
              </span>
            </div>

            {ingredients.length === 0 ? (
              <div className="bg-white rounded-2xl border border-gray-200/80 p-8 text-center text-gray-400 text-xs">
                No ingredients found to audit.
              </div>
            ) : (
              ingredients.map((ingredient) => {
                const disc = getDiscrepancy(ingredient)
                const isFilled = getActualCount(ingredient.id) !== ''

                return (
                  <div
                    key={ingredient.id}
                    className={`bg-white rounded-2xl border p-4 sm:p-5 transition-all shadow-xs ${
                      isFilled
                        ? disc === 0
                          ? 'border-green-200 bg-green-50/20'
                          : 'border-orange-200 bg-orange-50/15'
                        : 'border-gray-200/80 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div>
                        <h3 className="font-extrabold text-gray-900 text-sm sm:text-base">
                          {ingredient.name}
                        </h3>
                        <p className="text-xs text-gray-400 mt-0.5">
                          System Recorded Stock: <span className="font-bold text-gray-700">{ingredient.systemStock} {ingredient.unit}</span>
                        </p>
                      </div>

                      {disc !== null && (
                        <DiscrepancyBadge discrepancy={disc} unit={ingredient.unit} />
                      )}
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="relative flex-1">
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder={`Enter actual ${ingredient.unit}...`}
                          value={getActualCount(ingredient.id)}
                          onChange={(e) => updateCount(ingredient.id, e.target.value)}
                          className="w-full bg-gray-50/80 hover:bg-white focus:bg-white border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-900 font-semibold focus:outline-none focus:ring-2 focus:ring-[#16a34a] shadow-2xs"
                        />
                        <span className="absolute right-3.5 top-2.5 text-xs text-gray-400 font-medium">
                          {ingredient.unit}
                        </span>
                      </div>

                      {/* Quick match shortcut */}
                      <button
                        type="button"
                        onClick={() => updateCount(ingredient.id, ingredient.systemStock.toString())}
                        className="px-3 py-2.5 rounded-xl border border-gray-200 bg-gray-50 hover:bg-gray-100 text-xs font-bold text-gray-600 active:scale-95 transition-all shrink-0"
                      >
                        ✓ Match System
                      </button>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>

        {/* Right Column (5 cols): Audit Session Overview & Submission Card */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-white rounded-2xl border border-gray-200/80 shadow-xs p-5 sm:p-6 space-y-5 sticky top-20">
            <div>
              <h2 className="text-lg font-extrabold text-gray-900 tracking-tight">Audit Session Summary</h2>
              <p className="text-xs text-gray-500 mt-0.5">Review and submit physical count audit.</p>
            </div>

            {success && (
              <div className="p-3.5 bg-green-50 border border-green-200 rounded-xl text-green-700 text-xs font-medium flex items-center gap-2">
                <span>✓</span> Cycle count successfully saved! Inventory levels synced.
              </div>
            )}

            {error && (
              <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl text-red-600 text-xs font-medium">
                {error}
              </div>
            )}

            {/* Progress Bar Card */}
            <div className="bg-gray-50/70 border border-gray-100 rounded-xl p-4 space-y-2">
              <div className="flex items-center justify-between text-xs font-bold">
                <span className="text-gray-700">Audit Progress</span>
                <span className="text-[#16a34a]">{filledCount} of {totalCount} Counted ({progressPct}%)</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2.5 overflow-hidden">
                <div
                  className="bg-[#16a34a] h-2.5 rounded-full transition-all duration-300"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
            </div>

            {/* Quick Metrics */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-gray-50/80 rounded-xl p-3 border border-gray-100">
                <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block">Counted</span>
                <span className="text-xl font-extrabold text-gray-900">{filledCount}</span>
                <span className="text-[11px] text-gray-400 block">items</span>
              </div>
              <div className="bg-gray-50/80 rounded-xl p-3 border border-gray-100">
                <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block">Discrepancies</span>
                <span className={`text-xl font-extrabold ${discrepanciesCount > 0 ? 'text-[#e85d04]' : 'text-gray-900'}`}>
                  {discrepanciesCount}
                </span>
                <span className="text-[11px] text-gray-400 block">variance found</span>
              </div>
            </div>

            {/* Notes */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider">
                Audit Notes / Shift Info
              </label>
              <textarea
                rows={3}
                placeholder="e.g. End of morning shift routine physical inventory count."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#16a34a] shadow-2xs resize-none"
              />
            </div>

            {/* Submit Button */}
            <button
              type="button"
              onClick={handleSubmitAll}
              disabled={loading || filledCount === 0}
              className="w-full bg-[#16a34a] hover:bg-[#15803d] text-white font-bold py-3.5 rounded-xl text-sm transition-all duration-150 active:scale-98 disabled:opacity-50 disabled:cursor-not-allowed shadow-xs"
            >
              {loading ? 'Submitting Audit...' : `Submit Cycle Count (${filledCount} items)`}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
