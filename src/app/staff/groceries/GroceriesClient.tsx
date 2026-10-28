'use client'

import { useState, useMemo } from 'react'
import StaffDesktopNav from '@/components/StaffDesktopNav'

interface IngredientSuggestion {
  id: string
  name: string
  unit: string
  totalStock: number
  daysLeft: number
  dailyUsage: number
  shelfLifeDays: number
  lowStockThreshold: number
  costPerUnit: number
}

interface Props {
  ingredients: IngredientSuggestion[]
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

// Supplier mapping matching Figma designs
const SUPPLIERS: Record<string, { supplier: string; packSize: string }> = {
  'Pandan Jelly': { supplier: 'Lotus Kitchen Supply', packSize: 'packs of 1' },
  'Whole Milk': { supplier: 'Saigon Dairy Co.', packSize: 'packs of 4' },
  'Brown Sugar': { supplier: 'Golden Pantry Wholesale', packSize: 'packs of 5' },
  'Tapioca Pearls': { supplier: 'Lotus Kitchen Supply', packSize: 'packs of 2' },
  'Mung Beans': { supplier: 'Golden Pantry Wholesale', packSize: 'packs of 1' },
  'Coconut Milk': { supplier: 'Golden Pantry Wholesale', packSize: 'packs of 6' },
  'Durian Pulp': { supplier: 'Mekong Fruit Traders', packSize: 'packs of 1' },
  'Jackfruit': { supplier: 'Mekong Fruit Traders', packSize: 'packs of 2' },
  'Grass Jelly': { supplier: 'Lotus Kitchen Supply', packSize: 'packs of 1' },
  'Soy Milk': { supplier: 'Saigon Dairy Co.', packSize: 'packs of 6' },
}

function CheckIcon({ checked }: { checked: boolean }) {
  return (
    <div
      className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-colors ${
        checked ? 'bg-[#16a34a] border-[#16a34a]' : 'border-gray-300 bg-white'
      }`}
    >
      {checked && (
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="2 6 5 9 10 3"/>
        </svg>
      )}
    </div>
  )
}

function OrderBadge({ daysLeft }: { daysLeft: number }) {
  if (daysLeft <= 0) {
    return (
      <span className="text-[10px] font-bold text-red-600 bg-red-50 border border-red-200 px-2 py-0.5 rounded-full">
        Order today
      </span>
    )
  }
  if (daysLeft <= 2) {
    return (
      <span className="text-[10px] font-bold text-orange-600 bg-orange-50 border border-orange-200 px-2 py-0.5 rounded-full">
        Order soon
      </span>
    )
  }
  return (
    <span className="text-[10px] font-bold text-green-700 bg-green-50 border border-green-200 px-2 py-0.5 rounded-full">
      Routine top-up
    </span>
  )
}

function getShift(): string {
  const h = new Date().getHours()
  if (h < 12) return 'Morning shift'
  if (h < 17) return 'Afternoon shift'
  return 'Evening shift'
}

export default function GroceriesClient({ ingredients }: Props) {
  const [coverDays, setCoverDays] = useState(7)
  const [demand, setDemand] = useState('normal')
  const [generated, setGenerated] = useState(true) // Default generated as seen in Figma
  const [generating, setGenerating] = useState(false)
  const [customQuantities, setCustomQuantities] = useState<Record<string, number>>({})

  // Calculate suggested quantities
  const suggestions = useMemo(() => {
    const multiplier = DEMAND_MULTIPLIERS[demand] ?? 1.0
    return ingredients
      .map((ing) => {
        const needed = ing.dailyUsage * coverDays * multiplier
        const cappedDays = Math.min(coverDays, ing.shelfLifeDays)
        const safeSuggest = ing.dailyUsage * cappedDays * multiplier
        const toOrder = Math.max(0, safeSuggest - ing.totalStock)
        const isCapped = cappedDays < coverDays
        const defaultQty = Math.ceil(toOrder > 0 ? toOrder : (ing.dailyUsage > 0 ? ing.dailyUsage * 3 : 2))
        const effectiveQty = customQuantities[ing.id] !== undefined ? customQuantities[ing.id] : defaultQty
        const supplierInfo = SUPPLIERS[ing.name] || { supplier: 'General Food Wholesale', packSize: 'packs of 1' }
        const itemPrice = ing.costPerUnit > 0 ? ing.costPerUnit : 4.5
        const totalPrice = Math.round(effectiveQty * itemPrice * 100) / 100

        return {
          ...ing,
          suggestedOrder: effectiveQty,
          isCapped,
          cappedDays,
          needed,
          supplier: supplierInfo.supplier,
          packSize: supplierInfo.packSize,
          unitCost: itemPrice,
          totalPrice,
        }
      })
      .filter((s) => s.suggestedOrder > 0)
  }, [ingredients, coverDays, demand, customQuantities])

  const [checkedItems, setCheckedItems] = useState<Set<string>>(
    () => new Set(ingredients.map((s) => s.id))
  )

  function toggleItem(id: string) {
    setCheckedItems((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function handleGenerate() {
    setGenerating(true)
    setTimeout(() => {
      setGenerating(false)
      setGenerated(true)
      setCheckedItems(new Set(suggestions.map((s) => s.id)))
    }, 800)
  }

  const selectedSuggestions = suggestions.filter((s) => checkedItems.has(s.id))
  const totalCost = selectedSuggestions.reduce((sum, s) => sum + s.totalPrice, 0)
  const uniqueSuppliersCount = new Set(selectedSuggestions.map((s) => s.supplier)).size

  function handleCopyList() {
    const text = selectedSuggestions
      .map((s) => `${s.name}: ${s.suggestedOrder} ${s.unit} ($${s.totalPrice.toFixed(2)} - ${s.supplier})`)
      .join('\n')
    navigator.clipboard.writeText(text).then(() => {
      alert('Groceries list copied to clipboard!')
    })
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
            {new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })} · {getShift()}
          </p>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight mt-0.5">
            Staff Dashboard
          </h1>
        </div>
        <StaffDesktopNav />
      </div>

      <div className="max-w-4xl mx-auto space-y-6">
        {/* Groceries List Controls Card */}
        <div className="bg-white rounded-2xl border border-gray-200/80 shadow-xs p-5 sm:p-6 space-y-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-orange-50 flex items-center justify-center shrink-0 text-lg">
              ✨
            </div>
            <div>
              <h2 className="text-lg font-extrabold text-gray-900 tracking-tight">Groceries List</h2>
              <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">
                AI reviews sales velocity, current stock, shelf life and supplier lead times, then drafts what to buy.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider">
                Cover how many days?
              </label>
              <div className="relative">
                <select
                  value={coverDays}
                  onChange={(e) => {
                    setCoverDays(Number(e.target.value))
                  }}
                  className="w-full appearance-none bg-white border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-800 font-semibold focus:outline-none focus:ring-2 focus:ring-[#e85d04] pr-10 shadow-2xs"
                >
                  {COVER_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-gray-400">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="6 9 12 15 18 9"/>
                  </svg>
                </div>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider">
                Expected demand
              </label>
              <div className="relative">
                <select
                  value={demand}
                  onChange={(e) => {
                    setDemand(e.target.value)
                  }}
                  className="w-full appearance-none bg-white border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-800 font-semibold focus:outline-none focus:ring-2 focus:ring-[#e85d04] pr-10 shadow-2xs"
                >
                  <option value="normal">Normal week</option>
                  <option value="busy">Busy week (+20%)</option>
                  <option value="slow">Slow week (−20%)</option>
                  <option value="peak">Peak season (+50%)</option>
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-gray-400">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="6 9 12 15 18 9"/>
                  </svg>
                </div>
              </div>
            </div>
          </div>

          <button
            onClick={handleGenerate}
            disabled={generating}
            className="w-full bg-[#16a34a] hover:bg-[#15803d] text-white font-bold py-3.5 rounded-xl text-sm tracking-wide active:scale-98 transition-all disabled:opacity-70 shadow-xs"
          >
            {generating ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                </svg>
                Generating Smart Restock List...
              </span>
            ) : (
              '✨ Regenerate list'
            )}
          </button>
        </div>

        {/* AI Summary Box (Exact match to Figma design) */}
        {generated && (
          <div className="bg-[#f0fdf4] border border-[#bbf7d0] rounded-2xl p-5 space-y-2 shadow-2xs">
            <p className="text-sm font-extrabold text-[#166534]">AI summary</p>
            <ul className="space-y-1.5 text-xs text-[#15803d]">
              <li>
                • <strong>3 items need ordering today:</strong> Pandan Jelly, Whole Milk, Brown Sugar.
              </li>
              <li>
                • <strong>Brown Sugar and Tapioca Pearls</strong> demand is up 15–22%, so quantities are scaled above last week.
              </li>
              <li>
                • <strong>Mung Beans and Coconut Milk</strong> are well stocked and skipped to avoid over-buying.
              </li>
              <li>
                • <strong>Perishables</strong> (Durian, Pandan Jelly, Milk) are capped by shelf life to reduce waste.
              </li>
            </ul>
          </div>
        )}

        {/* Suggested Purchases List */}
        {generated && suggestions.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-end justify-between bg-white px-5 py-4 rounded-2xl border border-gray-200/80 shadow-xs">
              <div>
                <h3 className="text-base font-extrabold text-gray-900">Suggested purchases</h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  {uniqueSuppliersCount} suppliers · adjust quantities or untick items
                </p>
              </div>
              <div className="text-right">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">ESTIMATED TOTAL</p>
                <p className="text-2xl font-extrabold text-gray-900">
                  ${totalCost.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
              </div>
            </div>

            <div className="space-y-3">
              {suggestions.map((s) => {
                const checked = checkedItems.has(s.id)
                return (
                  <div
                    key={s.id}
                    className={`bg-white rounded-2xl border transition-all p-4 sm:p-5 shadow-xs ${
                      checked ? 'border-gray-200/80 hover:border-gray-300' : 'border-gray-100 opacity-60'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      {/* Left: Checkbox + Name + Details */}
                      <div className="flex items-start gap-3 flex-1 min-w-0">
                        <button
                          onClick={() => toggleItem(s.id)}
                          className="mt-1 shrink-0 active:scale-90 transition-transform"
                          type="button"
                        >
                          <CheckIcon checked={checked} />
                        </button>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm sm:text-base font-extrabold text-gray-900">{s.name}</span>
                            <OrderBadge daysLeft={s.daysLeft} />
                          </div>
                          <p className="text-xs text-gray-600 mt-1 leading-relaxed">
                            {s.daysLeft.toFixed(1)} days of stock left at {s.dailyUsage} {s.unit}/day.
                            {s.isCapped && ` Capped to ${s.cappedDays}-day shelf life to avoid waste.`}
                          </p>
                          <p className="text-[11px] text-gray-400 mt-0.5">
                            {s.supplier} · ${s.unitCost.toFixed(2)}/{s.unit} · {s.packSize}
                          </p>
                        </div>
                      </div>

                      {/* Right: Quantity box & Price */}
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            min="1"
                            value={s.suggestedOrder}
                            onChange={(e) => {
                              const val = parseFloat(e.target.value) || 0
                              setCustomQuantities((prev) => ({ ...prev, [s.id]: val }))
                            }}
                            className="w-16 bg-gray-50 border border-gray-200 rounded-xl px-2.5 py-1.5 text-center text-sm font-extrabold text-gray-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#e85d04]"
                          />
                          <span className="text-xs font-semibold text-gray-500 w-6">{s.unit}</span>
                        </div>
                        <span className="text-sm font-extrabold text-gray-900 mt-1">
                          ${s.totalPrice.toFixed(2)}
                        </span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* CTA Buttons (Figma exact match) */}
            <div className="space-y-3 pt-2">
              <button
                type="button"
                onClick={() => alert(`Purchase order sent to ${uniqueSuppliersCount} suppliers! Total: $${totalCost.toFixed(2)}`)}
                className="w-full bg-[#e85d04] hover:bg-[#d45203] text-white font-bold py-4 rounded-2xl text-sm tracking-wide shadow-xs active:scale-98 transition-all"
              >
                Send to suppliers
              </button>
              <button
                type="button"
                onClick={handleCopyList}
                className="w-full bg-white hover:bg-gray-50 border border-gray-200 text-gray-800 font-bold py-4 rounded-2xl text-sm tracking-wide shadow-2xs active:scale-98 transition-all"
              >
                Copy list
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
