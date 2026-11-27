'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Check, ClipboardCheck, PackagePlus, Trash2 } from 'lucide-react'
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

function DiscrepancyBadge({ discrepancy, unit }: { discrepancy: number; unit: string }) {
  if (discrepancy === 0) {
    return (
      <span className="inline-flex items-center gap-1 font-mono text-xs tabular-nums text-[#15803d] bg-[#f0fdf4] px-2 py-0.5 rounded-md border border-[#bbf7d0]">
        <Check size={12} strokeWidth={1.75} />
        <span>Match</span>
      </span>
    )
  }
  const isPositive = discrepancy > 0
  return (
    <span
      className={`font-mono text-xs tabular-nums px-2 py-0.5 rounded-md border ${
        isPositive
          ? 'text-[#525252] bg-[#f4f4f5] border-neutral-900/[0.08]'
          : 'text-[#b91c1c] bg-[#fef2f2] border-[#fecaca]'
      }`}
    >
      {isPositive ? '+' : ''}
      {discrepancy.toFixed(2)} {unit}
    </span>
  )
}

export default function CycleCountForm({ ingredients }: Props) {
  const router = useRouter()

  const [counts, setCounts] = useState<CountEntry[]>(
    ingredients.map((ing) => ({ ingredientId: ing.id, actualCount: '' }))
  )

  useEffect(() => {
    setCounts((prev) => {
      const existing = new Map(prev.map((c) => [c.ingredientId, c.actualCount]))
      return ingredients.map((ing) => ({
        ingredientId: ing.id,
        actualCount: existing.get(ing.id) ?? '',
      }))
    })
  }, [ingredients])

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

  const filledCount = counts.filter((c) => c.actualCount !== '').length
  const totalCount = ingredients.length
  const progressPct = totalCount > 0 ? Math.round((filledCount / totalCount) * 100) : 0

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
      setError('Enter at least one physical count')
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
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <p className="text-xs text-[#737373]">Staff operations</p>
          <h1 className="text-2xl sm:text-[28px] leading-[1.15] font-medium text-[#171717] tracking-[-0.015em] mt-1">
            Physical cycle count
          </h1>
          <p className="text-sm text-[#525252] mt-1">
            Enter actual on-hand quantities to calculate variance and sync stock
          </p>
        </div>
        <StaffDesktopNav />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-7 space-y-6">
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
                onClick={() => router.push('/staff/restock')}
                className="flex flex-col items-start gap-3 p-4 surface-card-interactive rounded-2xl text-left"
              >
                <div className="w-9 h-9 rounded-lg bg-[#f4f4f5] border border-neutral-900/[0.06] flex items-center justify-center text-[#525252]">
                  <PackagePlus size={16} strokeWidth={1.5} />
                </div>
                <span className="text-sm font-medium text-[#171717]">Manual restock</span>
              </button>

              <button
                type="button"
                className="flex flex-col items-start gap-3 p-4 bg-[#fff7ed] border border-[#fed7aa] rounded-2xl text-left"
              >
                <div className="w-9 h-9 rounded-lg bg-white border border-[#fed7aa] flex items-center justify-center text-[#c2410c]">
                  <ClipboardCheck size={16} strokeWidth={1.5} />
                </div>
                <span className="text-sm font-medium text-[#c2410c]">Cycle count</span>
              </button>
            </div>
          </section>

          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-medium text-[#171717]">
                Ingredients checklist
              </h2>
              <span className="font-mono text-xs tabular-nums text-[#737373]">
                {filledCount} / {totalCount} counted
              </span>
            </div>

            {ingredients.length === 0 ? (
              <div className="surface-card rounded-2xl p-8 text-center text-xs text-[#737373]">
                No ingredients to audit
              </div>
            ) : (
              <div className="space-y-3">
                {ingredients.map((ingredient) => {
                  const disc = getDiscrepancy(ingredient)
                  const isFilled = getActualCount(ingredient.id) !== ''

                  return (
                    <div
                      key={ingredient.id}
                      className={`surface-card rounded-2xl p-4 sm:p-5 transition-colors ${
                        isFilled
                          ? disc === 0
                            ? 'border-[#bbf7d0] bg-[#f0fdf4]/40'
                            : 'border-[#fed7aa] bg-[#fff7ed]/40'
                          : ''
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div>
                          <h3 className="text-sm font-medium text-[#171717]">
                            {ingredient.name}
                          </h3>
                          <p className="text-xs text-[#737373] mt-0.5 font-mono tabular-nums">
                            System: {ingredient.systemStock} {ingredient.unit}
                          </p>
                        </div>

                        {disc !== null && (
                          <DiscrepancyBadge discrepancy={disc} unit={ingredient.unit} />
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        <div className="relative flex-1">
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            placeholder="0"
                            value={getActualCount(ingredient.id)}
                            onChange={(e) => updateCount(ingredient.id, e.target.value)}
                            className="w-full h-10 bg-white border border-neutral-900/[0.14] rounded-xl px-3 pr-12 text-sm font-mono tabular-nums text-[#171717] placeholder-[#a3a3a3] focus:outline-none focus:ring-2 focus:ring-[#c2410c] focus:border-transparent"
                          />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-mono text-[#737373]">
                            {ingredient.unit}
                          </span>
                        </div>

                        <button
                          type="button"
                          onClick={() =>
                            updateCount(ingredient.id, ingredient.systemStock.toString())
                          }
                          className="h-10 px-3 btn-secondary rounded-xl text-xs font-medium inline-flex items-center gap-1.5 shrink-0"
                        >
                          <Check size={14} strokeWidth={1.5} />
                          <span>Match</span>
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </section>
        </div>

        <div className="lg:col-span-5">
          <div className="surface-card rounded-2xl p-6 space-y-5 sticky top-20">
            <div>
              <h2 className="text-base font-medium text-[#171717]">Audit summary</h2>
              <p className="text-xs text-[#737373] mt-0.5">
                Review counts before syncing inventory
              </p>
            </div>

            {success && (
              <div className="p-3 bg-[#f0fdf4] border border-[#bbf7d0] rounded-xl text-[#15803d] text-xs font-medium flex items-center gap-2">
                <Check size={14} strokeWidth={1.5} />
                <span>Cycle count saved and inventory synced</span>
              </div>
            )}

            {error && (
              <div className="p-3 bg-[#fef2f2] border border-[#fecaca] rounded-xl text-[#b91c1c] text-xs font-medium">
                {error}
              </div>
            )}

            <div className="bg-[#fafafa] border border-neutral-900/[0.08] rounded-xl p-4 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-[#525252] font-medium">Progress</span>
                <span className="font-mono tabular-nums text-[#171717]">
                  {filledCount} / {totalCount} ({progressPct}%)
                </span>
              </div>
              <div className="w-full bg-[#e5e5e5] rounded-full h-1.5 overflow-hidden">
                <div
                  className="bg-[#15803d] h-1.5 rounded-full transition-[width] duration-300"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="bg-[#fafafa] rounded-xl p-3 border border-neutral-900/[0.08]">
                <span className="text-xs text-[#737373] block">Counted</span>
                <span className="text-2xl font-medium font-mono tabular-nums text-[#171717] mt-1 block">
                  {filledCount}
                </span>
              </div>
              <div className="bg-[#fafafa] rounded-xl p-3 border border-neutral-900/[0.08]">
                <span className="text-xs text-[#737373] block">Discrepancies</span>
                <span
                  className={`text-2xl font-medium font-mono tabular-nums mt-1 block ${
                    discrepanciesCount > 0 ? 'text-[#c2410c]' : 'text-[#171717]'
                  }`}
                >
                  {discrepanciesCount}
                </span>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-[#525252]">
                Shift notes
              </label>
              <textarea
                rows={3}
                placeholder="Morning shift count"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full bg-white border border-neutral-900/[0.14] rounded-xl px-3 py-2.5 text-sm text-[#171717] placeholder-[#a3a3a3] focus:outline-none focus:ring-2 focus:ring-[#c2410c] resize-none"
              />
            </div>

            <button
              type="button"
              onClick={handleSubmitAll}
              disabled={loading || filledCount === 0}
              className="w-full h-10 btn-primary rounded-xl text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Submitting…' : `Submit cycle count (${filledCount})`}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
