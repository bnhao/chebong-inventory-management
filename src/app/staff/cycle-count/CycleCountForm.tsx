'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import StaffDesktopNav from '@/components/StaffDesktopNav'
import { submitCycleCountAction } from '@/app/actions/inventory'
import { IngredientForCycleCount } from './page'

interface Props {
  ingredients: IngredientForCycleCount[]
}

function supportsHalfStep(unit: string): boolean {
  const u = unit.trim().toLowerCase()
  return u === 'kg' || u === 'l' || u === 'g' || u === 'ml' || u === 'lb' || u === 'oz'
}

function DiscrepancyBadge({ discrepancy, unit }: { discrepancy: number; unit: string }) {
  const rounded = Math.round(discrepancy * 100) / 100
  if (rounded === 0) {
    return (
      <span className="text-xs font-bold text-green-700 bg-green-50 px-2.5 py-1 rounded-full border border-green-200">
        ✓ Same
      </span>
    )
  }
  const isPositive = rounded > 0
  return (
    <span
      className={`text-xs font-bold px-2.5 py-1 rounded-full border ${
        isPositive
          ? 'text-blue-700 bg-blue-50 border-blue-200'
          : 'text-red-700 bg-red-50 border-red-200'
      }`}
    >
      {isPositive ? '+' : ''}
      {rounded} {unit}
    </span>
  )
}

export default function CycleCountForm({ ingredients }: Props) {
  const router = useRouter()

  const [countsMap, setCountsMap] = useState<Record<string, string>>({})
  const [filterMode, setFilterMode] = useState<'needs' | 'all'>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    setCountsMap((prev) => {
      const next: Record<string, string> = {}
      for (const ing of ingredients) {
        if (prev[ing.id] !== undefined) {
          next[ing.id] = prev[ing.id]
        }
      }
      return next
    })
  }, [ingredients])

  function updateCount(ingredientId: string, value: string) {
    setCountsMap((prev) => ({ ...prev, [ingredientId]: value }))
  }

  function stepCount(ing: IngredientForCycleCount, delta: number) {
    const raw = countsMap[ing.id]
    const base = raw !== undefined && raw !== '' ? parseFloat(raw) : ing.systemStock
    const next = Math.max(0, Math.round(((Number.isFinite(base) ? base : 0) + delta) * 100) / 100)
    updateCount(ing.id, String(next))
  }

  const needsCountCount = useMemo(
    () => ingredients.filter((i) => !i.countedTodayAt).length,
    [ingredients]
  )

  const filteredIngredients = useMemo(() => {
    return ingredients.filter((ing) => {
      if (filterMode === 'needs' && ing.countedTodayAt) return false
      if (searchQuery.trim() && !ing.name.toLowerCase().includes(searchQuery.trim().toLowerCase())) {
        return false
      }
      return true
    })
  }, [ingredients, filterMode, searchQuery])

  const filledEntries = useMemo(() => {
    return ingredients
      .map((ing) => {
        const val = countsMap[ing.id]
        if (val === undefined || val === '') return null
        const actual = parseFloat(val)
        if (!Number.isFinite(actual) || actual < 0) return null
        return {
          ingredientId: ing.id,
          actualCount: actual,
          diff: actual - ing.systemStock,
        }
      })
      .filter((e): e is NonNullable<typeof e> => e !== null)
  }, [ingredients, countsMap])

  const discrepanciesCount = filledEntries.filter((e) => Math.round(e.diff * 100) / 100 !== 0).length
  const totalCount = ingredients.length
  const doneTodayCount = totalCount - needsCountCount
  const progressPct = totalCount > 0 ? Math.round((doneTodayCount / totalCount) * 100) : 0

  async function handleSubmitAll() {
    if (filledEntries.length === 0) {
      setError('Tap "Same" or enter a count on at least one item first.')
      return
    }

    setLoading(true)
    setError('')
    setSuccess('')

    const res = await submitCycleCountAction(
      filledEntries.map((e) => ({
        ingredientId: e.ingredientId,
        actualCount: e.actualCount,
        notes: notes.trim() || 'Physical stock count',
      }))
    )

    setLoading(false)

    if (!res.success) {
      setError(res.error || 'Could not save counts.')
      return
    }

    setSuccess(`Saved ${filledEntries.length} stock count${filledEntries.length === 1 ? '' : 's'}!`)
    setCountsMap({})
    setNotes('')
    router.refresh()
    setTimeout(() => setSuccess(''), 3500)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
            Shift Check · {doneTodayCount} of {totalCount} done today
          </p>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight mt-0.5">
            Count Stock
          </h1>
          <p className="text-xs sm:text-sm text-gray-500 mt-1">
            Tap <strong>✓ Same</strong> if the shelf matches, or tap <strong>+ / −</strong> to fix the amount.
          </p>
        </div>
        <StaffDesktopNav />
      </div>

      {success && (
        <div className="p-3.5 bg-green-50 border border-green-200 rounded-2xl text-green-800 text-xs font-bold flex items-center gap-2">
          <span>✓</span> {success}
        </div>
      )}

      {error && (
        <div className="p-3.5 bg-red-50 border border-red-200 rounded-2xl text-red-700 text-xs font-bold">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: Checklist */}
        <div className="lg:col-span-7 space-y-4">
          {/* Filter + Search */}
          <div className="bg-white rounded-2xl border border-gray-200/80 p-3.5 shadow-xs space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 bg-gray-100 p-1 rounded-xl">
                <button
                  type="button"
                  onClick={() => setFilterMode('all')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    filterMode === 'all' ? 'bg-white text-gray-900 shadow-2xs' : 'text-gray-600'
                  }`}
                >
                  All Items ({totalCount})
                </button>
                <button
                  type="button"
                  onClick={() => setFilterMode('needs')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    filterMode === 'needs' ? 'bg-white text-[#e85d04] shadow-2xs' : 'text-gray-600'
                  }`}
                >
                  Needs Count ({needsCountCount})
                </button>
              </div>
              <span className="text-xs font-bold text-[#16a34a]">
                {progressPct}% today
              </span>
            </div>

            <input
              type="text"
              placeholder="Search ingredient..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2 text-xs text-gray-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#16a34a]"
            />
          </div>

          {filteredIngredients.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-200/80 p-8 text-center text-gray-500 text-xs font-semibold">
              {filterMode === 'needs' && needsCountCount === 0
                ? 'All ingredients have been counted today!'
                : 'No ingredients match your search.'}
            </div>
          ) : (
            filteredIngredients.map((ingredient) => {
              const rawVal = countsMap[ingredient.id] ?? ''
              const parsed = parseFloat(rawVal)
              const isFilled = rawVal !== '' && Number.isFinite(parsed)
              const disc = isFilled ? parsed - ingredient.systemStock : null
              const halfStep = supportsHalfStep(ingredient.unit)

              return (
                <div
                  key={ingredient.id}
                  className={`bg-white rounded-2xl border p-4 sm:p-5 transition-all shadow-xs space-y-3 ${
                    isFilled
                      ? disc === 0
                        ? 'border-green-300 bg-green-50/20'
                        : 'border-orange-300 bg-orange-50/15'
                      : 'border-gray-200/80'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-extrabold text-gray-900 text-sm sm:text-base">
                          {ingredient.name}
                        </h3>
                        {ingredient.countedTodayAt && (
                          <span className="text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full">
                            Done today ✓ ({ingredient.countedTodayQty} {ingredient.unit})
                          </span>
                        )}
                        {!ingredient.countedTodayAt && ingredient.priorityReason === 'critical' && (
                          <span className="text-[10px] font-bold bg-red-50 text-red-700 border border-red-200 px-2 py-0.5 rounded-full">
                            Urgent
                          </span>
                        )}
                        {!ingredient.countedTodayAt && ingredient.priorityReason === 'warning' && (
                          <span className="text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200 px-2 py-0.5 rounded-full">
                            Check Today
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5">
                        Expected on shelf: <strong className="text-gray-800">{ingredient.systemStock} {ingredient.unit}</strong>
                      </p>
                    </div>

                    {disc !== null && (
                      <DiscrepancyBadge discrepancy={disc} unit={ingredient.unit} />
                    )}
                  </div>

                  {/* Stepper + Same Shortcut */}
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
                    <div className="flex items-center bg-gray-50 border border-gray-200 rounded-xl p-1 gap-1 flex-1">
                      <button
                        type="button"
                        onClick={() => stepCount(ingredient, -1)}
                        className="w-10 h-10 rounded-lg bg-white border border-gray-200/80 hover:bg-gray-100 text-gray-800 font-black text-sm active:scale-95 shrink-0"
                      >
                        −1
                      </button>
                      {halfStep && (
                        <button
                          type="button"
                          onClick={() => stepCount(ingredient, -0.5)}
                          className="w-9 h-10 rounded-lg hover:bg-gray-200/70 text-gray-700 font-bold text-xs active:scale-95 shrink-0"
                        >
                          −.5
                        </button>
                      )}
                      <input
                        type="number"
                        inputMode="decimal"
                        step="0.01"
                        min="0"
                        placeholder={String(ingredient.systemStock)}
                        value={rawVal}
                        onChange={(e) => updateCount(ingredient.id, e.target.value)}
                        className="flex-1 min-w-0 text-center bg-transparent text-base font-black text-gray-900 focus:outline-none"
                      />
                      <span className="text-[11px] font-bold text-gray-400 pr-1">{ingredient.unit}</span>
                      {halfStep && (
                        <button
                          type="button"
                          onClick={() => stepCount(ingredient, 0.5)}
                          className="w-9 h-10 rounded-lg hover:bg-gray-200/70 text-gray-700 font-bold text-xs active:scale-95 shrink-0"
                        >
                          +.5
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => stepCount(ingredient, 1)}
                        className="w-10 h-10 rounded-lg bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 text-[#16a34a] font-black text-sm active:scale-95 shrink-0"
                      >
                        +1
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() => updateCount(ingredient.id, ingredient.systemStock.toString())}
                      className="px-4 py-2.5 rounded-xl border border-emerald-200 bg-emerald-50/70 hover:bg-emerald-100 text-xs font-extrabold text-[#16a34a] active:scale-95 transition-all shrink-0"
                    >
                      ✓ Same ({ingredient.systemStock} {ingredient.unit})
                    </button>
                  </div>
                </div>
              )
            })
          )}
        </div>

        {/* Right: Desktop Summary Card */}
        <div className="hidden lg:block lg:col-span-5">
          <div className="bg-white rounded-2xl border border-gray-200/80 shadow-xs p-6 space-y-5 sticky top-20">
            <div>
              <h2 className="text-lg font-extrabold text-gray-900 tracking-tight">Count Summary</h2>
              <p className="text-xs text-gray-500 mt-0.5">Save your counts when finished.</p>
            </div>

            <div className="bg-gray-50/80 border border-gray-100 rounded-xl p-4 space-y-2">
              <div className="flex items-center justify-between text-xs font-bold">
                <span className="text-gray-700">Today&apos;s Store Progress</span>
                <span className="text-[#16a34a]">{doneTodayCount} of {totalCount} ({progressPct}%)</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2.5 overflow-hidden">
                <div
                  className="bg-[#16a34a] h-2.5 rounded-full transition-all duration-300"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="bg-gray-50/80 rounded-xl p-3 border border-gray-100">
                <span className="text-[11px] font-bold text-gray-400 uppercase block">Ready to Save</span>
                <span className="text-xl font-extrabold text-gray-900">{filledEntries.length}</span>
                <span className="text-[11px] text-gray-400 block">items entered</span>
              </div>
              <div className="bg-gray-50/80 rounded-xl p-3 border border-gray-100">
                <span className="text-[11px] font-bold text-gray-400 uppercase block">Differences</span>
                <span className={`text-xl font-extrabold ${discrepanciesCount > 0 ? 'text-[#e85d04]' : 'text-gray-900'}`}>
                  {discrepanciesCount}
                </span>
                <span className="text-[11px] text-gray-400 block">changed amounts</span>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider">
                Shift Note (Optional)
              </label>
              <textarea
                rows={2}
                placeholder="e.g. Closing fridge count"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full bg-white border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#16a34a] resize-none"
              />
            </div>

            <button
              type="button"
              onClick={handleSubmitAll}
              disabled={loading || filledEntries.length === 0}
              className="w-full bg-[#16a34a] hover:bg-[#15803d] text-white font-extrabold py-3.5 rounded-xl text-sm transition-all active:scale-98 disabled:opacity-50"
            >
              {loading ? 'Saving Counts...' : `Save Counts (${filledEntries.length})`}
            </button>
          </div>
        </div>
      </div>

      {/* Sticky Mobile Save Bar */}
      <div className="lg:hidden sticky bottom-20 z-40 bg-white/95 backdrop-blur-md rounded-2xl border border-gray-200 p-3.5 shadow-xl flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-extrabold text-gray-900">
            {filledEntries.length} item{filledEntries.length === 1 ? '' : 's'} ready
          </p>
          <p className="text-[11px] text-gray-500">
            {discrepanciesCount} with different amount
          </p>
        </div>
        <button
          type="button"
          onClick={handleSubmitAll}
          disabled={loading || filledEntries.length === 0}
          className="bg-[#16a34a] hover:bg-[#15803d] disabled:opacity-50 text-white text-xs font-extrabold px-5 py-3 rounded-xl shadow-xs active:scale-95 shrink-0"
        >
          {loading ? 'Saving...' : `Save Counts (${filledEntries.length})`}
        </button>
      </div>
    </div>
  )
}
