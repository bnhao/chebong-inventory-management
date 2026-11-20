'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import StaffDesktopNav from '@/components/StaffDesktopNav'
import ManagerNav from '@/components/ManagerNav'
import { submitBatchRestockAction } from '@/app/actions/inventory'

export interface GroceryItem {
  id: string
  name: string
  unit: string
  department: string
  isHandCooked?: boolean
  totalStock: number
  daysLeft: number
  dailyUsage: number
  shelfLifeDays: number
  lowStockThreshold: number
  parLevel: number
  suggestedQty: number
  isBelowThreshold: boolean
  costPerUnit: number
  recentWasteQty?: number
  recentUsageQty?: number
}

interface Props {
  ingredients: GroceryItem[]
  isManagerView?: boolean
  dateLabel?: string
}

const COVER_OPTIONS = [
  { value: 3, label: '3 days' },
  { value: 5, label: '5 days' },
  { value: 7, label: '7 days' },
  { value: 14, label: '14 days' },
]

const DEMAND_MULTIPLIERS: Record<string, number> = {
  normal: 1.0,
  busy: 1.2,
  slow: 0.8,
  peak: 1.5,
}

const DEMAND_LABELS: Record<string, string> = {
  normal: 'Normal week',
  busy: 'Busy week (+20%)',
  slow: 'Slow week (−20%)',
  peak: 'Peak week (+50%)',
}

const DEPARTMENTS = [
  'All',
  'Dairy & Milk',
  'Produce & Fruits',
  'Beans & Pearls',
  'Dry Goods & Packaging',
  'Hand-Cooked Jellies',
] as const

const STORE_PRESETS = ['Costco & Asian Market', 'Costco', 'Asian Market', 'In-House Kitchen Prep']

function supportsHalfStep(unit: string): boolean {
  const u = unit.trim().toLowerCase()
  return u === 'kg' || u === 'l' || u === 'g' || u === 'ml' || u === 'lb' || u === 'oz'
}

function computeSmartOrderQty(item: GroceryItem, coverDays: number, demandKey: string): number {
  const multiplier = DEMAND_MULTIPLIERS[demandKey] ?? 1.0
  const cappedDays = Math.min(coverDays, item.shelfLifeDays || 7)
  const dailyRate = item.dailyUsage > 0 ? item.dailyUsage : Math.max(0.5, item.lowStockThreshold * 0.4)
  const targetNeed = dailyRate * cappedDays * multiplier
  const shortfall = targetNeed - item.totalStock
  if (shortfall > 0) {
    return Math.max(1, Math.ceil(shortfall))
  }
  return item.isBelowThreshold
    ? Math.max(1, Math.ceil(item.parLevel - item.totalStock))
    : Math.max(1, Math.ceil(dailyRate * 2 * multiplier))
}

export default function GroceriesClient({ ingredients, isManagerView = false, dateLabel }: Props) {
  const router = useRouter()

  // Plan Settings (collapsed by default so checklist is first)
  const [showPlanSettings, setShowPlanSettings] = useState(false)
  const [coverDays, setCoverDays] = useState<number>(7)
  const [demand, setDemand] = useState<string>('normal')
  const [generating, setGenerating] = useState<boolean>(false)

  // Checklist state: Set of checked ingredient IDs
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set())

  // Recommended baseline for current coverDays/demand + custom adjusted quantities
  const recommendedById = useMemo(() => {
    const map: Record<string, number> = {}
    for (const item of ingredients) {
      map[item.id] = computeSmartOrderQty(item, coverDays, demand)
    }
    return map
  }, [ingredients, coverDays, demand])

  const [quantities, setQuantities] = useState<Record<string, number>>(() => {
    const init: Record<string, number> = {}
    for (const item of ingredients) {
      init[item.id] = computeSmartOrderQty(item, 7, 'normal')
    }
    return init
  })

  useEffect(() => {
    setQuantities((prev) => {
      const next = { ...prev }
      let changed = false
      for (const item of ingredients) {
        if (next[item.id] === undefined) {
          next[item.id] = computeSmartOrderQty(item, coverDays, demand)
          changed = true
        }
      }
      return changed ? next : prev
    })
  }, [ingredients, coverDays, demand])

  function applySuggestions(nextCoverDays: number, nextDemand: string) {
    const updated: Record<string, number> = {}
    for (const item of ingredients) {
      updated[item.id] = computeSmartOrderQty(item, nextCoverDays, nextDemand)
    }
    setQuantities(updated)
  }

  function handleRecalculate() {
    setGenerating(true)
    setTimeout(() => {
      applySuggestions(coverDays, demand)
      setGenerating(false)
    }, 300)
  }

  const summaryBullets = useMemo(() => {
    const urgentStoreItems = ingredients.filter(
      (i) => !i.isHandCooked && (i.isBelowThreshold || i.daysLeft <= 1.5)
    )
    const urgentJellies = ingredients.filter(
      (i) => i.isHandCooked && (i.isBelowThreshold || i.daysLeft <= 1.5)
    )
    const wastedItems = ingredients.filter((i) => (i.recentWasteQty || 0) > 0)

    const bullets: Array<{ key: string; content: React.ReactNode }> = []
    if (urgentStoreItems.length > 0) {
      bullets.push({
        key: 'urgent-buy',
        content: (
          <>
            <strong>Buy soon:</strong> {urgentStoreItems.map((i) => i.name).join(', ')}
          </>
        ),
      })
    } else {
      bullets.push({
        key: 'store-ok',
        content: <>Store-bought ingredients have enough stock for now.</>,
      })
    }

    if (urgentJellies.length > 0) {
      bullets.push({
        key: 'jellies-prep',
        content: (
          <>
            <strong>Kitchen prep needed:</strong> cook fresh{' '}
            {urgentJellies.map((i) => i.name).join(', ')}
          </>
        ),
      })
    }

    if (wastedItems.length > 0) {
      bullets.push({
        key: 'waste-note',
        content: (
          <>
            <strong>Recent spoilage:</strong>{' '}
            {wastedItems.map((w) => `${w.name} (${w.recentWasteQty} ${w.unit})`).join(', ')} — buy conservatively.
          </>
        ),
      })
    }

    return bullets
  }, [ingredients])

  // Filters
  const [selectedDept, setSelectedDept] = useState<string>('All')
  const [lowStockOnly, setLowStockOnly] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  // Restock modal state
  const [isRestockModalOpen, setIsRestockModalOpen] = useState(false)
  const [shoppingLocation, setShoppingLocation] = useState('Costco & Asian Market')
  const [isSubmittingRestock, setIsSubmittingRestock] = useState(false)
  const [restockSuccess, setRestockSuccess] = useState<string | null>(null)
  const [restockError, setRestockError] = useState<string | null>(null)

  function toggleItem(id: string) {
    setCheckedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  function adjustQty(item: GroceryItem, delta: number) {
    const minVal = supportsHalfStep(item.unit) ? 0.5 : 1
    setQuantities((prev) => {
      const current = prev[item.id] ?? recommendedById[item.id] ?? item.suggestedQty
      const updated = Math.max(minVal, Math.round((current + delta) * 100) / 100)
      return { ...prev, [item.id]: updated }
    })
  }

  function setDirectQty(item: GroceryItem, val: number) {
    const minVal = supportsHalfStep(item.unit) ? 0.1 : 1
    setQuantities((prev) => ({
      ...prev,
      [item.id]: Number.isFinite(val) && val > 0 ? Math.round(val * 100) / 100 : minVal,
    }))
  }

  const filteredItems = useMemo(() => {
    return ingredients.filter((item) => {
      if (selectedDept !== 'All' && item.department !== selectedDept) {
        return false
      }
      if (lowStockOnly && !item.isBelowThreshold) {
        return false
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase()
        const matchesName = item.name.toLowerCase().includes(q)
        const matchesDept = item.department.toLowerCase().includes(q)
        if (!matchesName && !matchesDept) return false
      }
      return true
    })
  }, [ingredients, selectedDept, lowStockOnly, searchQuery])

  const groupedItems = useMemo(() => {
    const groups: Record<string, GroceryItem[]> = {}
    for (const item of filteredItems) {
      const dept = item.department || 'Dry Goods & Packaging'
      if (!groups[dept]) groups[dept] = []
      groups[dept].push(item)
    }
    return groups
  }, [filteredItems])

  const basketValuation = useMemo(() => {
    let total = 0
    let checkedTotal = 0
    for (const item of filteredItems) {
      const qty = quantities[item.id] ?? recommendedById[item.id] ?? item.suggestedQty
      const cost = qty * (item.costPerUnit > 0 ? item.costPerUnit : 4.5)
      total += cost
      if (checkedIds.has(item.id)) {
        checkedTotal += cost
      }
    }
    return {
      total: Math.round(total * 100) / 100,
      checkedTotal: Math.round(checkedTotal * 100) / 100,
    }
  }, [filteredItems, quantities, recommendedById, checkedIds])

  const checkedItemsList = useMemo(() => {
    return ingredients
      .filter((item) => checkedIds.has(item.id))
      .map((item) => {
        const buyQty = quantities[item.id] ?? recommendedById[item.id] ?? item.suggestedQty
        return {
          ...item,
          buyQty,
          totalCost: buyQty * (item.costPerUnit > 0 ? item.costPerUnit : 4.5),
        }
      })
  }, [ingredients, checkedIds, quantities, recommendedById])

  async function handleConfirmRestock() {
    if (checkedItemsList.length === 0) return

    setIsSubmittingRestock(true)
    setRestockError(null)

    try {
      const itemsToRestock = checkedItemsList.map((item) => ({
        ingredientId: item.id,
        quantity: item.buyQty,
        unitCost: item.costPerUnit,
      }))

      const note = `Grocery run: ${shoppingLocation}`
      const res = await submitBatchRestockAction(itemsToRestock, note)

      if (!res.success) {
        setRestockError(res.error || 'Could not add items to stock.')
        return
      }

      setRestockSuccess(`Added ${itemsToRestock.length} checked items into stock!`)
      setIsRestockModalOpen(false)
      setCheckedIds(new Set())
      router.refresh()
    } catch (err: unknown) {
      setRestockError(err instanceof Error ? err.message : 'Failed to restock items')
    } finally {
      setIsSubmittingRestock(false)
    }
  }

  function handleCopyList() {
    let text = `🛒 CHÈ BÔNG BUY LIST\n`
    text += `Date: ${dateLabel || 'Today'}\n`
    text += `Est. Total: $${basketValuation.total.toFixed(2)}\n\n`

    for (const [dept, items] of Object.entries(groupedItems)) {
      text += `📍 ${dept.toUpperCase()}:\n`
      for (const item of items) {
        const qty = quantities[item.id] ?? recommendedById[item.id] ?? item.suggestedQty
        const checkedMark = checkedIds.has(item.id) ? '✅' : '⬜'
        text += `${checkedMark} ${item.name}: ${qty} ${item.unit} (On hand: ${item.totalStock} ${item.unit})\n`
      }
      text += '\n'
    }

    navigator.clipboard.writeText(text).then(() => {
      alert('Buy list copied! Ready to paste into Messages or Notes.')
    })
  }

  return (
    <div className="space-y-5">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
            {dateLabel || 'Today'} · Store Run &amp; Kitchen Prep
          </p>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight mt-0.5">
            Buy List
          </h1>
          <p className="text-xs sm:text-sm text-gray-500 mt-1">
            Check off items as you shop, tap + / − to adjust amounts, then add to stock.
          </p>
        </div>
        {isManagerView ? (
          <div className="hidden md:block">
            <ManagerNav />
          </div>
        ) : (
          <StaffDesktopNav />
        )}
      </div>

      {restockSuccess && (
        <div className="p-4 bg-green-50 border border-green-200 rounded-2xl flex items-center justify-between gap-3 text-green-900 text-xs font-bold">
          <div className="flex items-center gap-2">
            <span className="text-lg">🎉</span>
            <span>{restockSuccess}</span>
          </div>
          <button
            type="button"
            onClick={() => setRestockSuccess(null)}
            className="text-green-700 hover:text-green-900 p-1"
          >
            ✕
          </button>
        </div>
      )}

      <div className="max-w-4xl mx-auto space-y-4">
        {/* Compact Toolbar Card */}
        <div className="bg-white rounded-2xl border border-gray-200/80 shadow-xs p-4 space-y-3.5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-xl">
                <span className="text-xs font-extrabold text-emerald-800">
                  {checkedIds.size} / {ingredients.length} checked
                </span>
              </div>
              <div className="text-xs text-gray-600 font-semibold">
                Est. Total: <strong className="text-gray-900">${basketValuation.total.toFixed(2)}</strong>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowPlanSettings((v) => !v)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${
                  showPlanSettings
                    ? 'bg-orange-50 text-[#e85d04] border-orange-200'
                    : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100'
                }`}
              >
                {showPlanSettings ? 'Hide Plan Settings ▲' : `Plan: ${coverDays}d · ${DEMAND_LABELS[demand]} ▼`}
              </button>
              <button
                type="button"
                onClick={handleCopyList}
                className="bg-white hover:bg-gray-50 border border-gray-200 text-gray-700 text-xs font-bold px-3 py-1.5 rounded-xl shadow-2xs"
              >
                📋 Copy
              </button>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
            <div
              className="bg-emerald-500 h-2 rounded-full transition-all duration-300"
              style={{
                width: `${ingredients.length > 0 ? (checkedIds.size / ingredients.length) * 100 : 0}%`,
              }}
            />
          </div>

          {/* Collapsible Plan Settings & Notes */}
          {showPlanSettings && (
            <div className="pt-2 border-t border-gray-100 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="block text-[11px] font-bold text-gray-600 uppercase">
                    Cover how many days?
                  </label>
                  <select
                    value={coverDays}
                    onChange={(e) => {
                      const nextDays = Number(e.target.value)
                      setCoverDays(nextDays)
                      applySuggestions(nextDays, demand)
                    }}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs font-bold text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#e85d04]"
                  >
                    {COVER_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="block text-[11px] font-bold text-gray-600 uppercase">
                    How busy is this week?
                  </label>
                  <select
                    value={demand}
                    onChange={(e) => {
                      const nextDemand = e.target.value
                      setDemand(nextDemand)
                      applySuggestions(coverDays, nextDemand)
                    }}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs font-bold text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#e85d04]"
                  >
                    <option value="normal">Normal week</option>
                    <option value="busy">Busy week (+20%)</option>
                    <option value="slow">Slow week (−20%)</option>
                    <option value="peak">Peak week (+50%)</option>
                  </select>
                </div>

                <div className="flex items-end">
                  <button
                    type="button"
                    onClick={handleRecalculate}
                    disabled={generating}
                    className="w-full bg-[#16a34a] hover:bg-[#15803d] text-white font-bold py-2 px-3 rounded-xl text-xs"
                  >
                    {generating ? 'Updating...' : 'Reset to Recommended'}
                  </button>
                </div>
              </div>

              <div className="bg-emerald-50/70 border border-emerald-200 rounded-xl p-3 text-xs text-emerald-900 space-y-1">
                {summaryBullets.map((b) => (
                  <p key={b.key}>• {b.content}</p>
                ))}
              </div>
            </div>
          )}

          {/* Aisle Filter Pills & Search */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pt-1">
            {DEPARTMENTS.map((dept) => {
              const isActive = selectedDept === dept
              return (
                <button
                  key={dept}
                  type="button"
                  onClick={() => setSelectedDept(dept)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                    isActive
                      ? 'bg-gray-900 text-white shadow-xs'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200/80 hover:text-gray-900'
                  }`}
                >
                  {dept === 'All' ? 'All Aisles' : dept}
                </button>
              )
            })}
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-2.5">
            <div className="relative flex-1 w-full">
              <input
                type="text"
                placeholder="Search item..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2 text-xs text-gray-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#e85d04]"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-2 text-xs text-gray-400"
                >
                  ✕
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={() => setLowStockOnly(!lowStockOnly)}
              className={`w-full sm:w-auto flex items-center justify-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold border transition-all ${
                lowStockOnly
                  ? 'bg-red-50 text-red-700 border-red-200 shadow-2xs'
                  : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${lowStockOnly ? 'bg-red-500' : 'bg-gray-300'}`} />
              <span>Low Stock Only</span>
            </button>
          </div>
        </div>

        {/* Categorized Checklist */}
        {Object.keys(groupedItems).length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-200 p-8 text-center text-xs text-gray-400">
            No items match your filter.
          </div>
        ) : (
          Object.entries(groupedItems).map(([dept, items]) => (
            <div key={dept} className="space-y-2.5">
              <div className="flex items-center justify-between px-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-base">
                    {dept === 'Dairy & Milk'
                      ? '🥛'
                      : dept === 'Produce & Fruits'
                      ? '🥑'
                      : dept === 'Hand-Cooked Jellies'
                      ? '🍳'
                      : dept === 'Beans & Pearls' || dept === 'Jellies & Beans'
                      ? '🧋'
                      : '📦'}
                  </span>
                  <h3 className="text-xs font-bold text-gray-700 uppercase tracking-wider">
                    {dept} ({items.length})
                  </h3>
                  {dept === 'Hand-Cooked Jellies' && (
                    <span className="text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200 px-2 py-0.5 rounded-full">
                      Made In-House
                    </span>
                  )}
                </div>
                <span className="text-[11px] font-semibold text-gray-500">
                  {items.filter((i) => checkedIds.has(i.id)).length}/{items.length}{' '}
                  {dept === 'Hand-Cooked Jellies' ? 'prepped' : 'checked'}
                </span>
              </div>

              <div className="space-y-2.5">
                {items.map((item) => {
                  const isChecked = checkedIds.has(item.id)
                  const recQty = recommendedById[item.id] ?? item.suggestedQty
                  const buyQty = quantities[item.id] ?? recQty
                  const deltaFromRec = Math.round((buyQty - recQty) * 100) / 100
                  const itemCost = buyQty * (item.costPerUnit > 0 ? item.costPerUnit : 4.5)
                  const halfStep = supportsHalfStep(item.unit)

                  return (
                    <div
                      key={item.id}
                      className={`bg-white rounded-2xl border transition-all p-3.5 sm:p-4 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                        isChecked
                          ? 'border-emerald-300 bg-emerald-50/25'
                          : item.isBelowThreshold
                          ? 'border-red-200'
                          : 'border-gray-200'
                      }`}
                    >
                      {/* Tap Checkbox + Name */}
                      <div
                        onClick={() => toggleItem(item.id)}
                        className="flex items-start sm:items-center gap-3.5 flex-1 min-w-0 cursor-pointer select-none"
                      >
                        <div
                          className={`w-7 h-7 rounded-xl border-2 flex items-center justify-center transition-colors shrink-0 mt-0.5 sm:mt-0 ${
                            isChecked
                              ? 'bg-emerald-600 border-emerald-600 text-white'
                              : 'border-gray-300 bg-white hover:border-gray-400'
                          }`}
                        >
                          {isChecked && (
                            <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
                              <path
                                fillRule="evenodd"
                                d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                                clipRule="evenodd"
                              />
                            </svg>
                          )}
                        </div>

                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span
                              className={`text-sm sm:text-base font-extrabold ${
                                isChecked ? 'line-through text-gray-400' : 'text-gray-900'
                              }`}
                            >
                              {item.name}
                            </span>

                            {item.isBelowThreshold && (
                              <span className="text-[10px] font-bold text-red-700 bg-red-50 border border-red-200 px-2 py-0.5 rounded-full">
                                Low Stock
                              </span>
                            )}

                            {deltaFromRec > 0 && (
                              <span className="text-[10px] font-bold text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-full">
                                +{deltaFromRec} extra
                              </span>
                            )}
                            {deltaFromRec < 0 && (
                              <span className="text-[10px] font-bold text-gray-600 bg-gray-100 border border-gray-200 px-2 py-0.5 rounded-full">
                                {deltaFromRec} vs rec.
                              </span>
                            )}
                          </div>

                          <div className="text-xs text-gray-500 mt-0.5 flex items-center gap-2 flex-wrap">
                            <span>
                              On hand: <strong className="text-gray-800">{item.totalStock} {item.unit}</strong>
                            </span>
                            <span>·</span>
                            <span>
                              Recommended: <strong className="text-emerald-700">{recQty} {item.unit}</strong>
                            </span>
                            <span>·</span>
                            <span className="text-[11px] text-gray-400">
                              ~${itemCost.toFixed(2)}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Right: Big Thumb-Friendly Quantity Stepper */}
                      <div className="flex items-center justify-between sm:justify-end gap-2 shrink-0 pl-10 sm:pl-0">
                        <div className="flex items-center bg-gray-50 border border-gray-200 rounded-xl p-1 gap-1">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              adjustQty(item, -1)
                            }}
                            aria-label={`Decrease ${item.name} by 1`}
                            className="w-10 h-10 flex items-center justify-center text-gray-700 hover:text-gray-900 font-black rounded-lg bg-white border border-gray-200/70 hover:bg-gray-100 active:scale-95 text-sm"
                          >
                            −1
                          </button>
                          {halfStep && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation()
                                adjustQty(item, -0.5)
                              }}
                              aria-label={`Decrease ${item.name} by 0.5`}
                              className="w-9 h-10 flex items-center justify-center text-gray-600 hover:text-gray-900 font-bold rounded-lg hover:bg-gray-200/70 active:scale-95 text-xs"
                            >
                              −.5
                            </button>
                          )}
                          <div className="flex flex-col items-center px-1">
                            <input
                              type="number"
                              inputMode="decimal"
                              step={halfStep ? '0.1' : '1'}
                              min={halfStep ? '0.1' : '1'}
                              value={buyQty}
                              onChange={(e) => setDirectQty(item, parseFloat(e.target.value))}
                              onClick={(e) => e.stopPropagation()}
                              className="w-12 text-center text-sm font-black text-gray-900 bg-transparent focus:outline-none"
                            />
                            <span className="text-[10px] text-gray-400 -mt-1">{item.unit}</span>
                          </div>
                          {halfStep && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation()
                                adjustQty(item, 0.5)
                              }}
                              aria-label={`Increase ${item.name} by 0.5`}
                              className="w-9 h-10 flex items-center justify-center text-gray-600 hover:text-gray-900 font-bold rounded-lg hover:bg-gray-200/70 active:scale-95 text-xs"
                            >
                              +.5
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              adjustQty(item, 1)
                            }}
                            aria-label={`Increase ${item.name} by 1`}
                            className="w-10 h-10 flex items-center justify-center text-[#e85d04] font-black rounded-lg bg-orange-50 border border-orange-200 hover:bg-orange-100 active:scale-95 text-sm"
                          >
                            +1
                          </button>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ))
        )}

        {/* Sticky Bottom Action Bar */}
        <div className="sticky bottom-20 md:bottom-6 z-40 bg-white/95 backdrop-blur-md rounded-2xl border border-gray-200 p-4 shadow-xl flex items-center justify-between gap-4">
          <div>
            <p className="text-xs sm:text-sm font-extrabold text-gray-900">
              {checkedIds.size} item{checkedIds.size === 1 ? '' : 's'} checked
            </p>
            <p className="text-[11px] text-gray-500">
              Est. ${basketValuation.checkedTotal.toFixed(2)} · Tap to add into stock
            </p>
          </div>

          <button
            type="button"
            disabled={checkedIds.size === 0}
            onClick={() => setIsRestockModalOpen(true)}
            className="bg-[#e85d04] hover:bg-[#d45203] disabled:opacity-50 text-white text-xs sm:text-sm font-extrabold px-5 py-3 rounded-xl shadow-xs transition-all active:scale-95 shrink-0"
          >
            Add Checked to Stock ({checkedIds.size})
          </button>
        </div>
      </div>

      {/* RESTOCK CONFIRMATION MODAL */}
      {isRestockModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200"
          onClick={() => setIsRestockModalOpen(false)}
        >
          <div
            className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-gray-100 space-y-5 animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between pb-3 border-b border-gray-100">
              <div>
                <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                  Confirm Store Run
                </span>
                <h3 className="text-lg font-black text-gray-900 mt-0.5">
                  Add Checked Items to Stock
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsRestockModalOpen(false)}
                className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-600 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            {restockError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-600 text-xs font-medium">
                {restockError}
              </div>
            )}

            <div className="space-y-3">
              <div className="space-y-2">
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider">
                  Where did you get these?
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {STORE_PRESETS.map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setShoppingLocation(preset)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${
                        shoppingLocation === preset
                          ? 'bg-orange-50 text-[#e85d04] border-[#e85d04]'
                          : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100'
                      }`}
                    >
                      {preset}
                    </button>
                  ))}
                </div>
                <input
                  type="text"
                  value={shoppingLocation}
                  onChange={(e) => setShoppingLocation(e.target.value)}
                  placeholder="Or type store name..."
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-xs text-gray-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#e85d04]"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider">
                  Items Being Added ({checkedItemsList.length})
                </label>
                <div className="max-h-56 overflow-y-auto divide-y divide-gray-100 bg-gray-50 rounded-2xl p-3 border border-gray-200 text-xs">
                  {checkedItemsList.map((item) => (
                    <div key={item.id} className="py-2 flex items-center justify-between first:pt-0 last:pb-0">
                      <div>
                        <span className="font-extrabold text-gray-900">{item.name}</span>
                        <span className="text-gray-400 text-[11px] block">{item.department}</span>
                      </div>
                      <div className="text-right">
                        <span className="font-black text-emerald-700">+{item.buyQty} {item.unit}</span>
                        <span className="text-gray-400 text-[11px] block">${item.totalCost.toFixed(2)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-orange-50/60 border border-orange-200/60 rounded-xl p-3 flex items-center justify-between text-xs">
                <span className="font-bold text-orange-950">Estimated Total Cost:</span>
                <span className="font-black text-orange-950 text-sm">
                  ${checkedItemsList.reduce((sum, i) => sum + i.totalCost, 0).toFixed(2)}
                </span>
              </div>
            </div>

            <div className="pt-2 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsRestockModalOpen(false)}
                className="px-4 py-2.5 rounded-xl border border-gray-200 text-xs font-bold text-gray-600 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isSubmittingRestock}
                onClick={handleConfirmRestock}
                className="bg-[#e85d04] hover:bg-[#d45203] text-white text-xs font-bold px-5 py-2.5 rounded-xl transition-all shadow-xs disabled:opacity-50 active:scale-95"
              >
                {isSubmittingRestock ? 'Adding to Stock...' : 'Confirm & Add to Stock'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
