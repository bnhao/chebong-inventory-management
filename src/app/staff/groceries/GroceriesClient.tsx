'use client'

import { useState, useMemo } from 'react'
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

export default function GroceriesClient({ ingredients, isManagerView = false }: Props) {
  const router = useRouter()

  // AI Demand Planner state
  const [coverDays, setCoverDays] = useState<number>(7)
  const [demand, setDemand] = useState<string>('normal')
  const [generating, setGenerating] = useState<boolean>(false)

  // Checklist state: Set of checked ingredient IDs
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set())

  // Custom adjusted quantities per ingredient (initialized with 7-day normal AI suggestion)
  const [quantities, setQuantities] = useState<Record<string, number>>(() => {
    const init: Record<string, number> = {}
    for (const item of ingredients) {
      init[item.id] = computeSmartOrderQty(item, 7, 'normal')
    }
    return init
  })

  // Recalculate quantities when user changes coverDays / demand or clicks Regenerate
  function applyAiSuggestions(nextCoverDays: number, nextDemand: string) {
    const updated: Record<string, number> = {}
    for (const item of ingredients) {
      updated[item.id] = computeSmartOrderQty(item, nextCoverDays, nextDemand)
    }
    setQuantities(updated)
  }

  function handleRegenerateAi() {
    setGenerating(true)
    setTimeout(() => {
      applyAiSuggestions(coverDays, demand)
      setGenerating(false)
    }, 450)
  }

  // Live AI Summary bullets powered by real stock, shelf-life, hand-cooked jellies, and waste data
  const aiSummaryBullets = useMemo(() => {
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

    // Bullet 1: Urgent store-bought items needing order today
    if (urgentStoreItems.length > 0) {
      bullets.push({
        key: 'urgent-store',
        content: (
          <>
            <strong>
              {urgentStoreItems.length} store-bought {urgentStoreItems.length === 1 ? 'item needs' : 'items need'} ordering today:
            </strong>{' '}
            {urgentStoreItems.map((i) => `${i.name} (${i.totalStock} ${i.unit} left)`).join(', ')}.
          </>
        ),
      })
    } else {
      bullets.push({
        key: 'urgent-store-ok',
        content: (
          <>
            <strong>All store-bought staples are above critical threshold today</strong> — routine replenishment only.
          </>
        ),
      })
    }

    // Bullet 2: Hand-cooked jellies (in-house kitchen prep)
    if (urgentJellies.length > 0) {
      bullets.push({
        key: 'jellies-prep',
        content: (
          <>
            <strong>
              🍳 {urgentJellies.length} hand-cooked {urgentJellies.length === 1 ? 'jelly needs' : 'jellies need'} in-house kitchen prep today:
            </strong>{' '}
            {urgentJellies.map((j) => `${j.name} (${j.totalStock} ${j.unit})`).join(', ')} — cooked in-house, not bought pre-made.
          </>
        ),
      })
    } else {
      bullets.push({
        key: 'jellies-ok',
        content: (
          <>
            <strong>🍳 Hand-Cooked Jellies</strong> are sufficiently prepped in the walk-in cooler for current burn rates.
          </>
        ),
      })
    }

    // Bullet 3: Demand scaling & well-stocked items
    const highVelocity = [...ingredients]
      .sort((a, b) => (b.dailyUsage || 0) - (a.dailyUsage || 0))
      .slice(0, 2)
    const highVelNames = highVelocity.map((i) => i.name).join(' and ')
    if (demand !== 'normal') {
      bullets.push({
        key: 'demand-scale',
        content: (
          <>
            <strong>{DEMAND_LABELS[demand]} active:</strong> high-velocity items ({highVelNames}) are scaled for a{' '}
            <strong>{coverDays}-day</strong> coverage window.
            {wellStockedItems.length > 0 && (
              <>
                {' '}Well-stocked items (<strong>{wellStockedItems.slice(0, 3).map((i) => i.name).join(', ')}</strong>) are kept at minimal top-up.
              </>
            )}
          </>
        ),
      })
    } else if (wellStockedItems.length > 0) {
      bullets.push({
        key: 'well-stocked',
        content: (
          <>
            <strong>{wellStockedItems.map((i) => i.name).join(', ')}</strong>{' '}
            {wellStockedItems.length === 1 ? 'is' : 'are'} well stocked ({wellStockedItems.map((i) => `${i.totalStock} ${i.unit}`).join(', ')}) to avoid over-buying.
          </>
        ),
      })
    }

    // Bullet 4: Perishables shelf-life cap & real waste protection
    if (cappedPerishables.length > 0 || wastedItems.length > 0) {
      bullets.push({
        key: 'waste-cap',
        content: (
          <>
            {cappedPerishables.length > 0 && (
              <>
                <strong>Perishables</strong> ({cappedPerishables.slice(0, 4).map((i) => `${i.name} · ${i.shelfLifeDays}d limit`).join(', ')}) are capped below the {coverDays}-day window by shelf life to prevent spoilage.{' '}
              </>
            )}
            {wastedItems.length > 0 && (
              <>
                <strong>Live waste alert:</strong> recent spoilage logged on{' '}
                <strong>
                  {wastedItems.map((w) => `${w.name} (${w.recentWasteQty} ${w.unit})`).join(', ')}
                </strong>{' '}
                — order conservatively.
              </>
            )}
          </>
        ),
      })
    } else {
      bullets.push({
        key: 'waste-clean',
        content: (
          <>
            <strong>Zero recent spoilage logged</strong> and all perishables fit safely within the {coverDays}-day shelf-life window.
          </>
        ),
      })
    }

    return bullets
  }, [ingredients, coverDays, demand])

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

  // Toggle item check state
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

  // Adjust quantity
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

  // Filtered ingredients list
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

  // Group items by department
  const groupedItems = useMemo(() => {
    const groups: Record<string, GroceryItem[]> = {}
    for (const item of filteredItems) {
      const dept = item.department || 'Dry Goods & Packaging'
      if (!groups[dept]) groups[dept] = []
      groups[dept].push(item)
    }
    return groups
  }, [filteredItems])

  // Total shopping basket valuation
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

  // Items currently selected/checked for restock
  const checkedItemsList = useMemo(() => {
    return ingredients
      .filter((item) => checkedIds.has(item.id))
      .map((item) => ({
        ...item,
        buyQty: quantities[item.id] ?? item.suggestedQty,
        totalCost: (quantities[item.id] ?? item.suggestedQty) * (item.costPerUnit > 0 ? item.costPerUnit : 4.5),
      }))
  }, [ingredients, checkedIds, quantities])

  // Submit batch restock to Supabase
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

      setRestockSuccess(`Successfully logged ${itemsToRestock.length} items into inventory!`)
      setIsRestockModalOpen(false)
      setCheckedIds(new Set())
      router.refresh()
    } catch (err: unknown) {
      setRestockError(err instanceof Error ? err.message : 'Failed to restock items')
    } finally {
      setIsSubmittingRestock(false)
    }
  }

  // Copy shopping list to clipboard
  function handleCopyList() {
    let text = `🛒 CHÈ BÔNG GROCERY SHOPPING LIST\n`
    text += `Date: ${new Date().toLocaleDateString()}\n`
    text += `Est. Total: $${basketValuation.total.toFixed(2)}\n\n`

    for (const [dept, items] of Object.entries(groupedItems)) {
      text += `📍 ${dept.toUpperCase()}:\n`
      for (const item of items) {
        const qty = quantities[item.id] ?? item.suggestedQty
        const checkedMark = checkedIds.has(item.id) ? '✅' : '⬜'
        text += `${checkedMark} ${item.name}: ${qty} ${item.unit} (Stock: ${item.totalStock} ${item.unit})\n`
      }
      text += '\n'
    }

    navigator.clipboard.writeText(text).then(() => {
      alert('Shopping checklist copied to clipboard! Ready to paste into iMessage or Notes.')
    })
  }

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
            {new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })} · Grocery Shopping Run
          </p>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight mt-0.5">
            {isManagerView ? 'Manager Grocery Buying Checklist' : 'Staff Shopping Checklist'}
          </h1>
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
        <div className="p-4 bg-green-50 border border-green-200 rounded-2xl flex items-center justify-between gap-3 text-green-900 text-xs font-bold animate-in fade-in duration-300">
          <div className="flex items-center gap-2">
            <span className="text-lg">🎉</span>
            <span>{restockSuccess}</span>
          </div>
          <button
            onClick={() => setRestockSuccess(null)}
            className="text-green-700 hover:text-green-900 p-1"
          >
            ✕
          </button>
        </div>
      )}

      {/* Main Container */}
      <div className="max-w-4xl mx-auto space-y-5">
        {/* AI Demand Planner & Smart Restock Controls Card */}
        <div className="bg-white rounded-2xl border border-gray-200/80 shadow-xs p-5 sm:p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="w-11 h-11 rounded-2xl bg-orange-50 border border-orange-200/60 flex items-center justify-center shrink-0 text-xl">
                ✨
              </div>
              <div>
                <h2 className="text-lg font-extrabold text-gray-900 tracking-tight">
                  AI Demand Planner &amp; &apos;To-Buy&apos; Grocery Checklist
                </h2>
                <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">
                  AI reviews sales velocity, live stock, shelf life, and waste history to draft your categorized market run.
                </p>
              </div>
            </div>

            <div className="text-left sm:text-right bg-orange-50/50 sm:bg-transparent p-3 sm:p-0 rounded-xl border border-orange-100 sm:border-0 shrink-0">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                ESTIMATED BASKET TOTAL
              </p>
              <p className="text-2xl sm:text-3xl font-black text-gray-900">
                ${basketValuation.total.toFixed(2)}
              </p>
              <p className="text-[11px] text-gray-500 mt-0.5">
                {checkedIds.size} of {ingredients.length} items checked off (${basketValuation.checkedTotal.toFixed(2)})
              </p>
            </div>
          </div>

          {/* Cover Days + Expected Demand Selector Row */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
            <div className="space-y-1">
              <label className="block text-[11px] font-bold text-gray-700 uppercase tracking-wider">
                Cover how many days?
              </label>
              <div className="relative">
                <select
                  value={coverDays}
                  onChange={(e) => {
                    const nextDays = Number(e.target.value)
                    setCoverDays(nextDays)
                    applyAiSuggestions(nextDays, demand)
                  }}
                  className="w-full appearance-none bg-gray-50 hover:bg-white border border-gray-200 rounded-xl px-3.5 py-2.5 text-xs text-gray-800 font-bold focus:outline-none focus:ring-2 focus:ring-[#e85d04] pr-9 shadow-2xs transition-colors"
                >
                  {COVER_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-gray-400">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </div>
              </div>
            </div>

            <div className="space-y-1">
              <label className="block text-[11px] font-bold text-gray-700 uppercase tracking-wider">
                Expected demand
              </label>
              <div className="relative">
                <select
                  value={demand}
                  onChange={(e) => {
                    const nextDemand = e.target.value
                    setDemand(nextDemand)
                    applyAiSuggestions(coverDays, nextDemand)
                  }}
                  className="w-full appearance-none bg-gray-50 hover:bg-white border border-gray-200 rounded-xl px-3.5 py-2.5 text-xs text-gray-800 font-bold focus:outline-none focus:ring-2 focus:ring-[#e85d04] pr-9 shadow-2xs transition-colors"
                >
                  <option value="normal">Normal week (1.0x)</option>
                  <option value="busy">Busy week (+20%)</option>
                  <option value="slow">Slow week (−20%)</option>
                  <option value="peak">Peak season (+50%)</option>
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-gray-400">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </div>
              </div>
            </div>

            <div className="flex items-end">
              <button
                type="button"
                onClick={handleRegenerateAi}
                disabled={generating}
                className="w-full bg-[#16a34a] hover:bg-[#15803d] text-white font-bold py-2.5 px-4 rounded-xl text-xs tracking-wide active:scale-98 transition-all disabled:opacity-70 shadow-xs flex items-center justify-center gap-1.5"
              >
                {generating ? (
                  <>
                    <svg className="animate-spin h-3.5 w-3.5" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    <span>Recalculating AI Plan...</span>
                  </>
                ) : (
                  <span>✨ Regenerate AI Quantities</span>
                )}
              </button>
            </div>
          </div>

          {/* Embedded Live AI Summary Box */}
          <div className="bg-[#f0fdf4] border border-[#bbf7d0] rounded-2xl p-4 sm:p-5 space-y-2 shadow-2xs">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs sm:text-sm font-extrabold text-[#166534] flex items-center gap-1.5">
                <span>🤖</span>
                <span>AI Summary · Live Stock, Shelf-Life &amp; Waste Intelligence</span>
              </p>
              <span className="text-[10px] font-bold bg-white/80 text-[#166534] border border-[#bbf7d0] px-2 py-0.5 rounded-full">
                {coverDays}d cover · {DEMAND_LABELS[demand]}
              </span>
            </div>
            <ul className="space-y-1.5 text-xs text-[#15803d] leading-relaxed">
              {aiSummaryBullets.map((b) => (
                <li key={b.key}>• {b.content}</li>
              ))}
            </ul>
          </div>

          {/* Progress Bar */}
          <div className="w-full bg-gray-100 rounded-full h-2.5 overflow-hidden">
            <div
              className="bg-emerald-500 h-2.5 rounded-full transition-all duration-300"
              style={{
                width: `${ingredients.length > 0 ? (checkedIds.size / ingredients.length) * 100 : 0}%`,
              }}
            />
          </div>

          {/* Actions & Filters Toolbar */}
          <div className="space-y-3 pt-1">
            {/* Department Filter Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1">
              {DEPARTMENTS.map((dept) => {
                const isActive = selectedDept === dept
                return (
                  <button
                    key={dept}
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

            {/* Search & Low Stock Toggle */}
            <div className="flex flex-col sm:flex-row items-center gap-3">
              <div className="relative flex-1 w-full">
                <input
                  type="text"
                  placeholder="Search ingredient by name or aisle..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-xs text-gray-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#e85d04]"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-3 top-2.5 text-xs text-gray-400"
                  >
                    ✕
                  </button>
                )}
              </div>

              <div className="flex items-center justify-between w-full sm:w-auto gap-2">
                <button
                  type="button"
                  onClick={() => setLowStockOnly(!lowStockOnly)}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold border transition-all ${
                    lowStockOnly
                      ? 'bg-red-50 text-red-700 border-red-200 shadow-2xs'
                      : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  <span className={`w-2 h-2 rounded-full ${lowStockOnly ? 'bg-red-500' : 'bg-gray-300'}`} />
                  <span>Below Threshold Only</span>
                </button>

                <button
                  type="button"
                  onClick={handleCopyList}
                  className="bg-white hover:bg-gray-50 border border-gray-200 text-gray-700 text-xs font-bold px-3 py-2 rounded-xl transition-all shadow-2xs shrink-0"
                  title="Copy formatted shopping list to clipboard"
                >
                  📋 Copy List
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Categorized Department Sections */}
        {Object.keys(groupedItems).length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-200 p-8 text-center text-xs text-gray-400">
            No ingredients match your selected filter criteria.
          </div>
        ) : (
          Object.entries(groupedItems).map(([dept, items]) => (
            <div key={dept} className="space-y-3">
              {/* Department Section Header */}
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
                      Cooked In-House · Log Fresh Kitchen Batch
                    </span>
                  )}
                </div>
                <span className="text-[11px] text-gray-400">
                  {items.filter((i) => checkedIds.has(i.id)).length}/{items.length} {dept === 'Hand-Cooked Jellies' ? 'prepped' : 'bought'}
                </span>
              </div>

              {/* Checklist Cards in this Department */}
              <div className="space-y-2.5">
                {items.map((item) => {
                  const isChecked = checkedIds.has(item.id)
                  const buyQty = quantities[item.id] ?? item.suggestedQty
                  const itemCost = buyQty * (item.costPerUnit > 0 ? item.costPerUnit : 4.5)

                  return (
                    <div
                      key={item.id}
                      className={`bg-white rounded-2xl border transition-all p-3.5 sm:p-4 shadow-xs flex items-center justify-between gap-3 ${
                        isChecked
                          ? 'border-emerald-200 bg-emerald-50/20'
                          : item.isBelowThreshold
                          ? 'border-red-200 hover:border-red-300'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      {/* Left: Checkbox & Name with Strike-through */}
                      <div
                        onClick={() => toggleItem(item.id)}
                        className="flex items-center gap-3.5 flex-1 min-w-0 cursor-pointer select-none"
                      >
                        {/* Interactive Checkbox */}
                        <div
                          className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-colors shrink-0 ${
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

                        {/* Item Info */}
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span
                              className={`text-sm sm:text-base font-extrabold transition-all ${
                                isChecked
                                  ? 'line-through text-gray-400'
                                  : 'text-gray-900'
                              }`}
                            >
                              {item.name}
                            </span>

                            {item.isHandCooked && (
                              <span className="text-[10px] font-bold text-amber-800 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full shrink-0">
                                🍳 Hand-Cooked (In-House)
                              </span>
                            )}

                            {item.isBelowThreshold && (
                              <span className="text-[10px] font-bold text-red-700 bg-red-50 border border-red-200 px-2 py-0.5 rounded-full shrink-0">
                                Low Stock
                              </span>
                            )}
                          </div>

                          <div className="text-xs text-gray-500 mt-0.5 flex items-center gap-2 flex-wrap">
                            <span>
                              On Hand: <strong className="text-gray-800">{item.totalStock} {item.unit}</strong>
                            </span>
                            <span>·</span>
                            <span>
                              {item.daysLeft.toFixed(1)}d left ({item.dailyUsage} {item.unit}/d)
                            </span>
                            <span>·</span>
                            <span className="text-[11px] text-gray-400 font-medium">
                              ~${(item.costPerUnit > 0 ? item.costPerUnit : 4.5).toFixed(2)}/{item.unit}
                            </span>
                            {item.shelfLifeDays < coverDays && (
                              <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded-md">
                                Capped to {item.shelfLifeDays}d shelf life
                              </span>
                            )}
                            {(item.recentWasteQty || 0) > 0 && (
                              <span className="text-[10px] font-semibold text-amber-800 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-md">
                                ⚠️ {item.recentWasteQty} {item.unit} recent waste
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Right: Quantity Stepper & Cost */}
                      <div className="flex items-center gap-3 shrink-0">
                        {/* Interactive Quantity Adjuster */}
                        <div className="flex items-center bg-gray-50 border border-gray-200 rounded-xl p-0.5">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              adjustQty(item.id, -1)
                            }}
                            className="w-7 h-7 flex items-center justify-center text-gray-600 hover:text-gray-900 font-black rounded-lg hover:bg-gray-200/70 active:scale-95 transition-all text-xs"
                          >
                            −
                          </button>
                          <input
                            type="number"
                            min="1"
                            value={buyQty}
                            onChange={(e) => {
                              setDirectQty(item.id, parseFloat(e.target.value))
                            }}
                            onClick={(e) => e.stopPropagation()}
                            className="w-12 text-center text-xs font-black text-gray-900 bg-transparent focus:outline-none"
                          />
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              adjustQty(item.id, 1)
                            }}
                            className="w-7 h-7 flex items-center justify-center text-gray-600 hover:text-gray-900 font-black rounded-lg hover:bg-gray-200/70 active:scale-95 transition-all text-xs"
                          >
                            +
                          </button>
                        </div>

                        {/* Price */}
                        <div className="text-right min-w-[55px]">
                          <span className={`text-xs font-black block ${isChecked ? 'text-gray-400 line-through' : 'text-gray-900'}`}>
                            ${itemCost.toFixed(2)}
                          </span>
                          <span className="text-[10px] text-gray-400">
                            {item.unit}
                          </span>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ))
        )}

        {/* BOTTOM ACTION BAR: 'Restock Checked' shortcut */}
        <div className="sticky bottom-20 md:bottom-6 z-40 bg-white/95 backdrop-blur-md rounded-2xl border border-gray-200 p-4 shadow-xl flex items-center justify-between gap-4">
          <div>
            <p className="text-xs font-bold text-gray-800">
              {checkedIds.size} items checked off
            </p>
            <p className="text-[11px] text-gray-500">
              Ready to log groceries into live inventory?
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={checkedIds.size === 0}
              onClick={() => setIsRestockModalOpen(true)}
              className="bg-[#e85d04] hover:bg-[#d45203] disabled:opacity-50 text-white text-xs font-bold px-4 py-2.5 rounded-xl shadow-xs transition-all active:scale-95 shrink-0 flex items-center gap-1.5"
            >
              <span>📦</span>
              <span>Restock Checked ({checkedIds.size})</span>
            </button>
          </div>
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
                  Confirm Restock Batch
                </span>
                <h3 className="text-lg font-black text-gray-900 mt-0.5">
                  Receive Grocery Items
                </h3>
              </div>
              <button
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
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider">
                  Store / Supplier Run
                </label>
                <input
                  type="text"
                  value={shoppingLocation}
                  onChange={(e) => setShoppingLocation(e.target.value)}
                  placeholder="e.g. Costco, Restaurant Depot, 99 Ranch"
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-xs text-gray-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#e85d04]"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider">
                  Items to Restock ({checkedItemsList.length})
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
                <span className="font-bold text-orange-950">Total Restock Valuation:</span>
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
                {isSubmittingRestock ? 'Logging Batches...' : 'Confirm & Add to Stock'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
