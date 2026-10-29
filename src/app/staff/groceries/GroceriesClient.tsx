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
  totalStock: number
  daysLeft: number
  dailyUsage: number
  shelfLifeDays: number
  lowStockThreshold: number
  parLevel: number
  suggestedQty: number
  isBelowThreshold: boolean
  costPerUnit: number
}

interface Props {
  ingredients: GroceryItem[]
  isManagerView?: boolean
}

const DEPARTMENTS = [
  'All',
  'Dairy & Milk',
  'Produce & Fruits',
  'Jellies & Beans',
  'Dry Goods & Packaging',
] as const

export default function GroceriesClient({ ingredients, isManagerView = false }: Props) {
  const router = useRouter()

  // Checklist state: Set of checked ingredient IDs
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set())

  // Custom adjusted quantities per ingredient
  const [quantities, setQuantities] = useState<Record<string, number>>(() => {
    const init: Record<string, number> = {}
    for (const item of ingredients) {
      init[item.id] = item.suggestedQty
    }
    return init
  })

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
        {/* Shopping Overview & Basket Valuation Card */}
        <div className="bg-white rounded-2xl border border-gray-200/80 shadow-xs p-5 sm:p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="w-12 h-12 rounded-2xl bg-orange-50 border border-orange-200/60 flex items-center justify-center shrink-0 text-2xl">
                🛒
              </div>
              <div>
                <h2 className="text-lg font-extrabold text-gray-900 tracking-tight">
                  &apos;To-Buy&apos; Grocery Checklist
                </h2>
                <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">
                  Optimized for manual purchasing runs at Costco, Restaurant Depot & Asian Supermarkets.
                </p>
              </div>
            </div>

            <div className="text-left sm:text-right bg-orange-50/50 sm:bg-transparent p-3 sm:p-0 rounded-xl border border-orange-100 sm:border-0">
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
                <div className="flex items-center gap-2">
                  <span className="text-base">
                    {dept === 'Dairy & Milk'
                      ? '🥛'
                      : dept === 'Produce & Fruits'
                      ? '🥑'
                      : dept === 'Jellies & Beans'
                      ? '🧋'
                      : '📦'}
                  </span>
                  <h3 className="text-xs font-bold text-gray-700 uppercase tracking-wider">
                    {dept} ({items.length})
                  </h3>
                </div>
                <span className="text-[11px] text-gray-400">
                  {items.filter((i) => checkedIds.has(i.id)).length}/{items.length} bought
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
                              Min Par: <strong className="text-gray-800">{item.parLevel} {item.unit}</strong>
                            </span>
                            <span>·</span>
                            <span className="text-[11px] text-gray-400 font-medium">
                              ~${(item.costPerUnit > 0 ? item.costPerUnit : 4.5).toFixed(2)}/{item.unit}
                            </span>
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
