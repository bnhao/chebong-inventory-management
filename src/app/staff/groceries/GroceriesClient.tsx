'use client'

import { useEffect, useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import {
  AlertTriangle,
  Check,
  ChefHat,
  Copy,
  Minus,
  PackagePlus,
  Plus,
  RefreshCw,
  Search,
  X,
} from 'lucide-react'
import StaffDesktopNav from '@/components/StaffDesktopNav'
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
  normal: 'Normal week (1.0x)',
  busy: 'Busy week (+20%)',
  slow: 'Slow week (−20%)',
  peak: 'Peak season (+50%)',
}

const DEPARTMENTS = [
  'All',
  'Dairy & Milk',
  'Produce & Fruits',
  'Beans & Pearls',
  'Dry Goods & Packaging',
  'Hand-Cooked Jellies',
] as const

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

  const [coverDays, setCoverDays] = useState<number>(7)
  const [demand, setDemand] = useState<string>('normal')
  const [generating, setGenerating] = useState<boolean>(false)
  const [copiedNotice, setCopiedNotice] = useState<boolean>(false)

  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set())

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
    const wellStockedItems = ingredients.filter(
      (i) => !i.isBelowThreshold && i.totalStock >= i.parLevel * 0.9
    )
    const cappedPerishables = ingredients.filter(
      (i) => (i.shelfLifeDays || 7) < coverDays
    )
    const wastedItems = ingredients.filter((i) => (i.recentWasteQty || 0) > 0)

    const bullets: Array<{ key: string; content: React.ReactNode }> = []

    if (urgentStoreItems.length > 0) {
      bullets.push({
        key: 'urgent-store',
        content: (
          <>
            <span className="font-medium text-[#171717]">
              {urgentStoreItems.length} store-bought{' '}
              {urgentStoreItems.length === 1 ? 'item needs' : 'items need'} ordering today:
            </span>{' '}
            {urgentStoreItems.map((i) => `${i.name} (${i.totalStock} ${i.unit} left)`).join(', ')}
          </>
        ),
      })
    } else {
      bullets.push({
        key: 'urgent-store-ok',
        content: 'All store-bought staples are above threshold today — routine top-up only',
      })
    }

    if (urgentJellies.length > 0) {
      bullets.push({
        key: 'jellies-prep',
        content: (
          <>
            <span className="font-medium text-[#171717]">
              {urgentJellies.length} hand-cooked{' '}
              {urgentJellies.length === 1 ? 'jelly needs' : 'jellies need'} kitchen prep:
            </span>{' '}
            {urgentJellies.map((j) => `${j.name} (${j.totalStock} ${j.unit})`).join(', ')}
          </>
        ),
      })
    } else {
      bullets.push({
        key: 'jellies-ok',
        content: 'Hand-cooked jellies are prepped for current daily burn',
      })
    }

    const highVelocity = [...ingredients]
      .sort((a, b) => (b.dailyUsage || 0) - (a.dailyUsage || 0))
      .slice(0, 2)
    const highVelNames = highVelocity.map((i) => i.name).join(' and ')
    if (demand !== 'normal') {
      bullets.push({
        key: 'demand-scale',
        content: (
          <>
            <span className="font-medium text-[#171717]">{DEMAND_LABELS[demand]}:</span>{' '}
            {highVelNames} scaled for a {coverDays}-day window
            {wellStockedItems.length > 0 &&
              `; well-stocked items (${wellStockedItems
                .slice(0, 3)
                .map((i) => i.name)
                .join(', ')}) kept at minimal top-up`}
          </>
        ),
      })
    } else if (wellStockedItems.length > 0) {
      bullets.push({
        key: 'well-stocked',
        content: `${wellStockedItems.map((i) => i.name).join(', ')} already near par to avoid over-buying`,
      })
    }

    if (cappedPerishables.length > 0 || wastedItems.length > 0) {
      bullets.push({
        key: 'waste-cap',
        content: (
          <>
            {cappedPerishables.length > 0 && (
              <>
                Perishables (
                {cappedPerishables
                  .slice(0, 4)
                  .map((i) => `${i.name} · ${i.shelfLifeDays}d`)
                  .join(', ')}
                ) capped by shelf life.{' '}
              </>
            )}
            {wastedItems.length > 0 && (
              <>
                Recent spoilage on{' '}
                {wastedItems.map((w) => `${w.name} (${w.recentWasteQty} ${w.unit})`).join(', ')} —
                order conservatively
              </>
            )}
          </>
        ),
      })
    } else {
      bullets.push({
        key: 'waste-clean',
        content: `No recent spoilage logged and all perishables fit the ${coverDays}-day window`,
      })
    }

    return bullets
  }, [ingredients, coverDays, demand])

  const [selectedDept, setSelectedDept] = useState<string>('All')
  const [lowStockOnly, setLowStockOnly] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

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

  function adjustQty(id: string, delta: number) {
    setQuantities((prev) => {
      const current = prev[id] ?? 1
      const updated = Math.max(1, current + delta)
      return { ...prev, [id]: updated }
    })
  }

  function setDirectQty(id: string, val: number) {
    setQuantities((prev) => ({
      ...prev,
      [id]: Math.max(1, isNaN(val) ? 1 : val),
    }))
  }

  const filteredItems = useMemo(() => {
    return ingredients.filter((item) => {
      if (selectedDept !== 'All' && item.department !== selectedDept) return false
      if (lowStockOnly && !item.isBelowThreshold) return false
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase()
        if (
          !item.name.toLowerCase().includes(q) &&
          !item.department.toLowerCase().includes(q)
        ) {
          return false
        }
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
      const qty = quantities[item.id] ?? item.suggestedQty
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
  }, [filteredItems, quantities, checkedIds])

  const checkedItemsList = useMemo(() => {
    return ingredients
      .filter((item) => checkedIds.has(item.id))
      .map((item) => ({
        ...item,
        buyQty: quantities[item.id] ?? item.suggestedQty,
        totalCost:
          (quantities[item.id] ?? item.suggestedQty) *
          (item.costPerUnit > 0 ? item.costPerUnit : 4.5),
      }))
  }, [ingredients, checkedIds, quantities])

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

      const note = `Grocery restock run: ${shoppingLocation}`
      const res = await submitBatchRestockAction(itemsToRestock, note)

      if (!res.success) {
        setRestockError(res.error || 'Failed to submit batch restock')
        return
      }

      setRestockSuccess(`Logged ${itemsToRestock.length} items into inventory`)
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
    let text = `Chè Bông Grocery List\n`
    text += `Date: ${new Date().toLocaleDateString()}\n`
    text += `Estimated total: $${basketValuation.total.toFixed(2)}\n\n`

    for (const [dept, items] of Object.entries(groupedItems)) {
      text += `${dept}\n`
      for (const item of items) {
        const qty = quantities[item.id] ?? item.suggestedQty
        const mark = checkedIds.has(item.id) ? '[x]' : '[ ]'
        text += `${mark} ${item.name}: ${qty} ${item.unit} (on hand: ${item.totalStock} ${item.unit})\n`
      }
      text += '\n'
    }

    navigator.clipboard.writeText(text).then(() => {
      setCopiedNotice(true)
      setTimeout(() => setCopiedNotice(false), 2500)
    })
  }

  return (
    <div className="space-y-6">
      {!isManagerView && (
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <p className="text-xs text-[#737373] font-mono tabular-nums">
              {dateLabel || 'Today'} · Market run
            </p>
            <h1 className="text-2xl sm:text-[28px] leading-[1.15] font-medium text-[#171717] tracking-[-0.015em] mt-1">
              Shopping checklist
            </h1>
          </div>
          <StaffDesktopNav />
        </div>
      )}

      {restockSuccess && (
        <div className="p-4 bg-[#f0fdf4] border border-[#bbf7d0] rounded-2xl flex items-center justify-between gap-3 text-[#15803d] text-xs font-medium">
          <div className="flex items-center gap-2">
            <Check size={16} strokeWidth={1.5} />
            <span>{restockSuccess}</span>
          </div>
          <button
            type="button"
            onClick={() => setRestockSuccess(null)}
            aria-label="Dismiss"
            className="text-[#15803d] hover:text-[#14532d] p-1"
          >
            <X size={14} strokeWidth={1.5} />
          </button>
        </div>
      )}

      <div className="max-w-4xl mx-auto space-y-6">
        {/* Planner controls card */}
        <div className="surface-card rounded-2xl p-6 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
            <div>
              <h2 className="text-base font-medium text-[#171717]">
                Demand planner and grocery list
              </h2>
              <p className="text-xs text-[#737373] mt-0.5">
                Quantities calculated from daily burn, current stock, shelf life, and recent waste
              </p>
            </div>

            <div className="text-left sm:text-right shrink-0">
              <p className="text-xs text-[#737373]">Estimated basket</p>
              <p className="text-2xl font-medium font-mono tabular-nums text-[#171717] mt-0.5">
                ${basketValuation.total.toFixed(2)}
              </p>
              <p className="text-xs text-[#737373] font-mono tabular-nums mt-0.5">
                {checkedIds.size} / {ingredients.length} checked ($
                {basketValuation.checkedTotal.toFixed(2)})
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-[#525252]">
                Coverage window
              </label>
              <select
                value={coverDays}
                onChange={(e) => {
                  const nextDays = Number(e.target.value)
                  setCoverDays(nextDays)
                  applySuggestions(nextDays, demand)
                }}
                className="w-full h-10 bg-white border border-neutral-900/[0.14] rounded-xl px-3 text-sm text-[#171717] focus:outline-none focus:ring-2 focus:ring-[#c2410c]"
              >
                {COVER_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-[#525252]">
                Expected demand
              </label>
              <select
                value={demand}
                onChange={(e) => {
                  const nextDemand = e.target.value
                  setDemand(nextDemand)
                  applySuggestions(coverDays, nextDemand)
                }}
                className="w-full h-10 bg-white border border-neutral-900/[0.14] rounded-xl px-3 text-sm text-[#171717] focus:outline-none focus:ring-2 focus:ring-[#c2410c]"
              >
                <option value="normal">Normal week (1.0x)</option>
                <option value="busy">Busy week (+20%)</option>
                <option value="slow">Slow week (−20%)</option>
                <option value="peak">Peak season (+50%)</option>
              </select>
            </div>

            <div className="flex items-end">
              <button
                type="button"
                onClick={handleRecalculate}
                disabled={generating}
                className="w-full h-10 btn-secondary rounded-xl text-sm font-medium inline-flex items-center justify-center gap-2 disabled:opacity-60"
              >
                <RefreshCw
                  size={15}
                  strokeWidth={1.5}
                  className={generating ? 'animate-spin' : ''}
                />
                <span>{generating ? 'Recalculating…' : 'Recalculate'}</span>
              </button>
            </div>
          </div>

          {/* Plan summary */}
          <div className="bg-[#fafafa] border border-neutral-900/[0.08] rounded-xl p-4 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-medium text-[#171717]">Plan summary</p>
              <span className="batch-stamp">
                {coverDays}d · {DEMAND_LABELS[demand]}
              </span>
            </div>
            <ul className="space-y-1.5 text-xs text-[#525252] leading-relaxed">
              {summaryBullets.map((b) => (
                <li key={b.key} className="flex items-start gap-2">
                  <span className="text-[#a3a3a3] select-none">–</span>
                  <span>{b.content}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="w-full bg-[#f4f4f5] rounded-full h-1.5 overflow-hidden">
            <div
              className="bg-[#15803d] h-1.5 rounded-full transition-[width] duration-300"
              style={{
                width: `${
                  ingredients.length > 0 ? (checkedIds.size / ingredients.length) * 100 : 0
                }%`,
              }}
            />
          </div>

          {/* Filters */}
          <div className="space-y-3">
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
              {DEPARTMENTS.map((dept) => {
                const isActive = selectedDept === dept
                return (
                  <button
                    key={dept}
                    type="button"
                    onClick={() => setSelectedDept(dept)}
                    className={`h-8 px-3 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                      isActive
                        ? 'bg-[#171717] text-white'
                        : 'bg-[#f4f4f5] text-[#525252] hover:text-[#171717]'
                    }`}
                  >
                    {dept === 'All' ? 'All aisles' : dept}
                  </button>
                )
              })}
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-3">
              <div className="relative flex-1 w-full">
                <Search
                  size={15}
                  strokeWidth={1.5}
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#737373]"
                />
                <input
                  type="text"
                  placeholder="Search ingredients"
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

              <div className="flex items-center justify-between w-full sm:w-auto gap-2">
                <button
                  type="button"
                  onClick={() => setLowStockOnly(!lowStockOnly)}
                  className={`h-9 flex items-center gap-2 px-3 rounded-xl text-xs font-medium border transition-colors ${
                    lowStockOnly
                      ? 'bg-[#fef2f2] text-[#b91c1c] border-[#fecaca]'
                      : 'bg-white text-[#525252] border-neutral-900/[0.14] hover:bg-[#f4f4f5]'
                  }`}
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      lowStockOnly ? 'bg-[#b91c1c]' : 'bg-[#a3a3a3]'
                    }`}
                  />
                  <span>Low stock only</span>
                </button>

                <button
                  type="button"
                  onClick={handleCopyList}
                  className="h-9 btn-secondary px-3 rounded-xl text-xs font-medium inline-flex items-center gap-1.5 shrink-0"
                >
                  {copiedNotice ? (
                    <>
                      <Check size={14} strokeWidth={1.5} className="text-[#15803d]" />
                      <span>Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy size={14} strokeWidth={1.5} />
                      <span>Copy list</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Department sections */}
        {Object.keys(groupedItems).length === 0 ? (
          <div className="surface-card rounded-2xl p-8 text-center text-xs text-[#737373]">
            No ingredients match your filters
          </div>
        ) : (
          Object.entries(groupedItems).map(([dept, items]) => (
            <section key={dept} className="space-y-3">
              <div className="flex items-center justify-between px-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-sm font-medium text-[#171717]">{dept}</h3>
                  <span className="font-mono text-xs tabular-nums text-[#737373]">
                    {items.length}
                  </span>
                  {dept === 'Hand-Cooked Jellies' && (
                    <span className="batch-stamp inline-flex items-center gap-1">
                      <ChefHat size={12} strokeWidth={1.5} />
                      <span>Kitchen prep</span>
                    </span>
                  )}
                </div>
                <span className="font-mono text-xs tabular-nums text-[#737373]">
                  {items.filter((i) => checkedIds.has(i.id)).length}/{items.length}{' '}
                  {dept === 'Hand-Cooked Jellies' ? 'prepped' : 'bought'}
                </span>
              </div>

              <div className="surface-card rounded-2xl divide-y divide-neutral-900/[0.06] overflow-hidden">
                {items.map((item) => {
                  const isChecked = checkedIds.has(item.id)
                  const buyQty = quantities[item.id] ?? item.suggestedQty
                  const itemCost = buyQty * (item.costPerUnit > 0 ? item.costPerUnit : 4.5)

                  return (
                    <div
                      key={item.id}
                      className={`px-4 py-3.5 flex items-center justify-between gap-4 transition-colors ${
                        isChecked ? 'bg-[#fafafa]' : 'hover:bg-[#fafafa]/60'
                      }`}
                    >
                      <div
                        onClick={() => toggleItem(item.id)}
                        className="flex items-start gap-3 flex-1 min-w-0 cursor-pointer select-none"
                      >
                        <div
                          className={`w-5 h-5 mt-0.5 rounded-md border flex items-center justify-center transition-colors shrink-0 ${
                            isChecked
                              ? 'bg-[#15803d] border-[#15803d] text-white'
                              : 'border-neutral-900/[0.22] bg-white'
                          }`}
                        >
                          {isChecked && <Check size={13} strokeWidth={2} />}
                        </div>

                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span
                              className={`text-sm font-medium ${
                                isChecked ? 'line-through text-[#737373]' : 'text-[#171717]'
                              }`}
                            >
                              {item.name}
                            </span>

                            {item.isHandCooked && (
                              <span className="batch-stamp">In-house</span>
                            )}

                            {item.isBelowThreshold && (
                              <span className="font-mono text-xs text-[#b91c1c] bg-[#fef2f2] border border-[#fecaca] px-2 py-0.5 rounded-md">
                                Low
                              </span>
                            )}
                          </div>

                          <div className="text-xs text-[#737373] mt-1 flex items-center gap-2 flex-wrap font-mono tabular-nums">
                            <span>
                              On hand {item.totalStock} {item.unit}
                            </span>
                            <span>·</span>
                            <span>
                              {item.daysLeft.toFixed(1)}d left ({item.dailyUsage}/d)
                            </span>
                            <span>·</span>
                            <span>
                              ${(item.costPerUnit > 0 ? item.costPerUnit : 4.5).toFixed(2)}/{item.unit}
                            </span>
                            {item.shelfLifeDays < coverDays && (
                              <span className="batch-stamp">
                                Cap {item.shelfLifeDays}d
                              </span>
                            )}
                            {(item.recentWasteQty || 0) > 0 && (
                              <span className="inline-flex items-center gap-1 text-[#b45309]">
                                <AlertTriangle size={12} strokeWidth={1.5} />
                                {item.recentWasteQty} {item.unit} waste
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        <div className="flex items-center bg-[#f4f4f5] border border-neutral-900/[0.08] rounded-lg p-0.5">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              adjustQty(item.id, -1)
                            }}
                            aria-label="Decrease quantity"
                            className="w-7 h-7 flex items-center justify-center text-[#525252] hover:text-[#171717] rounded-md hover:bg-white transition-colors"
                          >
                            <Minus size={14} strokeWidth={1.5} />
                          </button>
                          <input
                            type="number"
                            min="1"
                            value={buyQty}
                            onChange={(e) =>
                              setDirectQty(item.id, parseFloat(e.target.value))
                            }
                            onClick={(e) => e.stopPropagation()}
                            className="w-12 text-center text-xs font-mono font-medium tabular-nums text-[#171717] bg-transparent focus:outline-none"
                          />
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              adjustQty(item.id, 1)
                            }}
                            aria-label="Increase quantity"
                            className="w-7 h-7 flex items-center justify-center text-[#525252] hover:text-[#171717] rounded-md hover:bg-white transition-colors"
                          >
                            <Plus size={14} strokeWidth={1.5} />
                          </button>
                        </div>

                        <div className="text-right min-w-16 font-mono tabular-nums">
                          <span
                            className={`text-xs font-medium block ${
                              isChecked ? 'text-[#737373] line-through' : 'text-[#171717]'
                            }`}
                          >
                            ${itemCost.toFixed(2)}
                          </span>
                          <span className="text-xs text-[#737373]">{item.unit}</span>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </section>
          ))
        )}

        {/* Bottom action bar */}
        <div className="sticky bottom-20 md:bottom-6 z-40 bg-white border border-neutral-900/[0.12] rounded-2xl p-4 shadow-[0_8px_24px_rgba(0,0,0,0.06)] flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-[#171717] tabular-nums">
              {checkedIds.size} {checkedIds.size === 1 ? 'item' : 'items'} checked
            </p>
            <p className="text-xs text-[#737373]">Log checked groceries into stock</p>
          </div>

          <button
            type="button"
            disabled={checkedIds.size === 0}
            onClick={() => setIsRestockModalOpen(true)}
            className="h-10 btn-primary disabled:opacity-50 px-4 rounded-xl text-sm font-medium inline-flex items-center gap-2 shrink-0"
          >
            <PackagePlus size={16} strokeWidth={1.5} />
            <span>Restock checked ({checkedIds.size})</span>
          </button>
        </div>
      </div>

      {isRestockModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/40 backdrop-blur-[2px] flex items-center justify-center p-4"
          onClick={() => setIsRestockModalOpen(false)}
        >
          <div
            className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-[0_8px_24px_rgba(0,0,0,0.08)] border border-neutral-900/[0.08] space-y-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between pb-3 border-b border-neutral-900/[0.08]">
              <div>
                <p className="text-xs text-[#737373]">Confirm batch</p>
                <h3 className="text-base font-medium text-[#171717] mt-0.5">
                  Receive grocery items
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsRestockModalOpen(false)}
                aria-label="Close"
                className="w-8 h-8 rounded-lg flex items-center justify-center text-[#737373] hover:text-[#171717] hover:bg-[#f4f4f5]"
              >
                <X size={16} strokeWidth={1.5} />
              </button>
            </div>

            {restockError && (
              <div className="p-3 bg-[#fef2f2] border border-[#fecaca] rounded-xl text-[#b91c1c] text-xs font-medium">
                {restockError}
              </div>
            )}

            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-[#525252]">
                  Store or supplier
                </label>
                <input
                  type="text"
                  value={shoppingLocation}
                  onChange={(e) => setShoppingLocation(e.target.value)}
                  placeholder="Costco, 99 Ranch"
                  className="w-full h-10 bg-white border border-neutral-900/[0.14] rounded-xl px-3 text-sm text-[#171717] focus:outline-none focus:ring-2 focus:ring-[#c2410c]"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-[#525252]">
                  Items to restock ({checkedItemsList.length})
                </label>
                <div className="max-h-56 overflow-y-auto divide-y divide-neutral-900/[0.06] bg-[#fafafa] rounded-xl p-3 border border-neutral-900/[0.08] text-xs">
                  {checkedItemsList.map((item) => (
                    <div
                      key={item.id}
                      className="py-2 flex items-center justify-between first:pt-0 last:pb-0"
                    >
                      <div>
                        <span className="font-medium text-[#171717] block">{item.name}</span>
                        <span className="text-[#737373]">{item.department}</span>
                      </div>
                      <div className="text-right font-mono tabular-nums">
                        <span className="font-medium text-[#15803d] block">
                          +{item.buyQty} {item.unit}
                        </span>
                        <span className="text-[#737373]">${item.totalCost.toFixed(2)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-[#fafafa] border border-neutral-900/[0.08] rounded-xl p-3 flex items-center justify-between text-xs">
                <span className="font-medium text-[#525252]">Total restock value</span>
                <span className="font-mono tabular-nums font-medium text-[#171717] text-sm">
                  ${checkedItemsList.reduce((sum, i) => sum + i.totalCost, 0).toFixed(2)}
                </span>
              </div>
            </div>

            <div className="pt-2 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsRestockModalOpen(false)}
                className="h-9 px-4 btn-secondary rounded-xl text-xs font-medium"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isSubmittingRestock}
                onClick={handleConfirmRestock}
                className="h-9 px-4 btn-primary rounded-xl text-xs font-medium disabled:opacity-50"
              >
                {isSubmittingRestock ? 'Logging…' : 'Confirm and add to stock'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
