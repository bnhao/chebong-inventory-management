'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import StaffDesktopNav from '@/components/StaffDesktopNav'
import { createIngredientAction } from '@/app/actions/ingredients'
import { logWasteAction, submitRestockAction } from '@/app/actions/inventory'
import {
  IngredientForStock,
  RecentDelivery,
  RecentWasteRecord,
  WasteBatchOption,
} from '@/lib/stock-data'
import { getStoreTimezone } from '@/lib/timezone'

interface Props {
  initialMode: 'in' | 'out'
  ingredients: IngredientForStock[]
  recentDeliveries: RecentDelivery[]
  activeBatches: WasteBatchOption[]
  recentWaste: RecentWasteRecord[]
}

const WASTE_REASONS = ['Expired / Old', 'Spilled / Dropped', 'Bad Quality', 'Opened & Unused']

function supportsHalfStep(unit: string): boolean {
  const u = unit.trim().toLowerCase()
  return u === 'kg' || u === 'l' || u === 'g' || u === 'ml' || u === 'lb' || u === 'oz'
}

export default function StockInOutClient({
  initialMode,
  ingredients,
  recentDeliveries,
  activeBatches,
  recentWaste,
}: Props) {
  const router = useRouter()
  const storeTimeZone = getStoreTimezone()
  const [mode, setMode] = useState<'in' | 'out'>(initialMode)

  useEffect(() => {
    setMode(initialMode)
  }, [initialMode])

  // Sync ingredients list
  const [ingredientList, setIngredientList] = useState<IngredientForStock[]>(ingredients)
  useEffect(() => {
    setIngredientList(ingredients)
  }, [ingredients])

  // --- ADD STOCK (IN) STATE ---
  const [inSearch, setInSearch] = useState('')
  const [selectedIngredientId, setSelectedIngredientId] = useState('')
  const [inQuantity, setInQuantity] = useState<string>('')
  const [expirationDate, setExpirationDate] = useState('')
  const [inLoading, setInLoading] = useState(false)
  const [inSuccess, setInSuccess] = useState('')
  const [inError, setInError] = useState('')

  // Quick Add Ingredient Modal
  const [showAddModal, setShowAddModal] = useState(false)
  const [newName, setNewName] = useState('')
  const [newUnit, setNewUnit] = useState('kg')
  const [newLowStock, setNewLowStock] = useState('2')
  const [newCost, setNewCost] = useState('5.00')
  const [isCreatingIng, setIsCreatingIng] = useState(false)
  const [modalError, setModalError] = useState('')

  // --- TOSS SPOILED (OUT) STATE ---
  const [outSearch, setOutSearch] = useState('')
  const [selectedBatchId, setSelectedBatchId] = useState('')
  const [outQuantity, setOutQuantity] = useState<string>('')
  const [wasteReason, setWasteReason] = useState('Expired / Old')
  const [outLoading, setOutLoading] = useState(false)
  const [outSuccess, setOutSuccess] = useState('')
  const [outError, setOutError] = useState('')

  const selectedIngredient = ingredientList.find((i) => i.id === selectedIngredientId)
  const selectedBatch = activeBatches.find((b) => b.id === selectedBatchId)

  const filteredIngredients = useMemo(() => {
    const q = inSearch.trim().toLowerCase()
    if (!q) return ingredientList
    return ingredientList.filter((i) => i.name.toLowerCase().includes(q))
  }, [ingredientList, inSearch])

  const filteredBatches = useMemo(() => {
    const q = outSearch.trim().toLowerCase()
    if (!q) return activeBatches
    return activeBatches.filter(
      (b) =>
        b.ingredientName.toLowerCase().includes(q) ||
        (b.batchCode || '').toLowerCase().includes(q)
    )
  }, [activeBatches, outSearch])

  function stepInQty(delta: number) {
    const current = parseFloat(inQuantity) || 0
    const next = Math.max(0, Math.round((current + delta) * 100) / 100)
    setInQuantity(next > 0 ? String(next) : '')
  }

  function stepOutQty(delta: number) {
    if (!selectedBatch) return
    const current = parseFloat(outQuantity) || 0
    const next = Math.min(
      selectedBatch.quantityRemaining,
      Math.max(0, Math.round((current + delta) * 100) / 100)
    )
    setOutQuantity(next > 0 ? String(next) : '')
  }

  function formatShortDate(dateStr: string | null): string {
    if (!dateStr) return 'No expiry'
    return new Date(dateStr).toLocaleDateString('en-US', {
      timeZone: storeTimeZone,
      month: 'short',
      day: 'numeric',
    })
  }

  function formatTimestamp(dateStr: string): string {
    return new Date(dateStr).toLocaleString('en-US', {
      timeZone: storeTimeZone,
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    })
  }

  async function handleSubmitRestock(e: React.FormEvent) {
    e.preventDefault()
    const qty = parseFloat(inQuantity)
    if (!selectedIngredientId || !qty || qty <= 0) {
      setInError('Tap an ingredient and choose how much arrived.')
      return
    }

    setInLoading(true)
    setInError('')
    setInSuccess('')

    const res = await submitRestockAction({
      ingredientId: selectedIngredientId,
      quantity: qty,
      expirationDate: expirationDate || null,
      costPerUnit: selectedIngredient?.cost_per_unit || 0,
    })

    setInLoading(false)

    if (!res.success) {
      setInError(res.error || 'Could not add delivery.')
      return
    }

    setInSuccess(
      `Added +${qty} ${selectedIngredient?.unit || ''} of ${selectedIngredient?.name || 'item'}!`
    )
    setInQuantity('')
    setExpirationDate('')
    router.refresh()
    setTimeout(() => setInSuccess(''), 3500)
  }

  async function handleCreateNewIngredient(e: React.FormEvent) {
    e.preventDefault()
    if (!newName.trim()) return

    setIsCreatingIng(true)
    setModalError('')

    const res = await createIngredientAction({
      name: newName.trim(),
      unit: newUnit.trim() || 'kg',
      low_stock_threshold: parseFloat(newLowStock) || 0,
      cost_per_unit: parseFloat(newCost) || 0,
      spoiled_time_limit_days: 7,
    })

    setIsCreatingIng(false)

    if (!res.success || !res.data) {
      setModalError(res.error || 'Failed to add ingredient')
      return
    }

    const newIng: IngredientForStock = {
      id: res.data.id,
      name: res.data.name,
      unit: res.data.unit,
      low_stock_threshold: Number(res.data.low_stock_threshold) || 0,
      spoiled_time_limit_days: Number(res.data.spoiled_time_limit_days) || 7,
      daily_usage_rate: Number(res.data.daily_usage_rate) || 0,
      cost_per_unit: Number(res.data.cost_per_unit) || 0,
      created_at: res.data.created_at,
      currentStock: 0,
    }

    setIngredientList((prev) => [...prev, newIng])
    setSelectedIngredientId(newIng.id)
    setShowAddModal(false)
    setNewName('')
    setModalError('')
    router.refresh()
  }

  async function handleSubmitWaste(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedBatch || !outQuantity) {
      setOutError('Tap the batch you are tossing and enter how much.')
      return
    }

    const qty = parseFloat(outQuantity)
    if (!qty || qty <= 0) {
      setOutError('Enter an amount greater than 0.')
      return
    }

    if (qty > selectedBatch.quantityRemaining) {
      setOutError(
        `Only ${selectedBatch.quantityRemaining} ${selectedBatch.unit} left in this batch.`
      )
      return
    }

    setOutLoading(true)
    setOutError('')
    setOutSuccess('')

    const res = await logWasteAction({
      batchId: selectedBatch.id,
      ingredientId: selectedBatch.ingredientId,
      quantity: qty,
      reason: wasteReason.trim() || 'Spoiled / Discarded by staff',
    })

    setOutLoading(false)

    if (!res.success) {
      setOutError(res.error || 'Could not remove stock.')
      return
    }

    setOutSuccess(`Removed ${qty} ${selectedBatch.unit} of ${selectedBatch.ingredientName}.`)
    setSelectedBatchId('')
    setOutQuantity('')
    router.refresh()
    setTimeout(() => setOutSuccess(''), 3500)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
            Daily Kitchen &amp; Fridge Updates
          </p>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight mt-0.5">
            Stock In / Out
          </h1>
          <p className="text-xs sm:text-sm text-gray-500 mt-1">
            Tap to add a new delivery or remove spoiled ingredients.
          </p>
        </div>
        <StaffDesktopNav />
      </div>

      {/* Big Segmented Mode Switch */}
      <div className="bg-gray-100/90 border border-gray-200/80 p-1.5 rounded-2xl grid grid-cols-2 gap-2 max-w-md">
        <button
          type="button"
          onClick={() => setMode('in')}
          className={`py-3 px-4 rounded-xl text-sm font-extrabold transition-all flex items-center justify-center gap-2 ${
            mode === 'in'
              ? 'bg-white text-[#e85d04] shadow-sm ring-1 ring-orange-200'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          <span className="text-base">＋</span>
          <span>Add Delivery</span>
        </button>
        <button
          type="button"
          onClick={() => setMode('out')}
          className={`py-3 px-4 rounded-xl text-sm font-extrabold transition-all flex items-center justify-center gap-2 ${
            mode === 'out'
              ? 'bg-white text-red-600 shadow-sm ring-1 ring-red-200'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          <span className="text-base">−</span>
          <span>Toss Spoiled</span>
        </button>
      </div>

      {mode === 'in' ? (
        <div className="space-y-6">
          {/* Quick Shortcut to Buy List */}
          <Link
            href="/staff/groceries"
            className="block bg-linear-to-r from-orange-50 via-amber-50/70 to-orange-50 border border-orange-200/90 rounded-2xl p-4 hover:border-[#e85d04] transition-all shadow-2xs group"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-white border border-orange-200 flex items-center justify-center text-xl shrink-0">
                  🛒
                </div>
                <div>
                  <p className="text-sm font-extrabold text-gray-900 group-hover:text-[#e85d04] transition-colors">
                    Back from a grocery run? Check off the Buy List
                  </p>
                  <p className="text-xs text-gray-600 mt-0.5">
                    Tap checkboxes &amp; + / − to add multiple items at once.
                  </p>
                </div>
              </div>
              <span className="text-sm font-extrabold text-[#e85d04] shrink-0">
                Open →
              </span>
            </div>
          </Link>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left: Tap Ingredient + Step Amount */}
            <form
              onSubmit={handleSubmitRestock}
              className="lg:col-span-7 bg-white rounded-2xl border border-gray-200/80 shadow-xs p-5 sm:p-6 space-y-5"
            >
              <div className="flex items-center justify-between gap-2">
                <div>
                  <h2 className="text-lg font-extrabold text-gray-900">1. Tap What Arrived</h2>
                  <p className="text-xs text-gray-500">Pick one ingredient or create a new one.</p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowAddModal(true)}
                  className="text-xs font-bold text-[#e85d04] bg-orange-50 hover:bg-orange-100 border border-orange-200 px-3 py-2 rounded-xl shrink-0"
                >
                  ＋ New Item
                </button>
              </div>

              {inSuccess && (
                <div className="p-3.5 bg-green-50 border border-green-200 rounded-xl text-green-800 text-xs font-bold">
                  ✓ {inSuccess}
                </div>
              )}
              {inError && (
                <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs font-bold">
                  {inError}
                </div>
              )}

              <input
                type="text"
                placeholder="Search ingredient..."
                value={inSearch}
                onChange={(e) => setInSearch(e.target.value)}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#e85d04]"
              />

              {/* Tappable Ingredient Pills */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 max-h-72 overflow-y-auto pr-1">
                {filteredIngredients.map((ing) => {
                  const selected = ing.id === selectedIngredientId
                  return (
                    <button
                      key={ing.id}
                      type="button"
                      onClick={() => {
                        setSelectedIngredientId(ing.id)
                        setInError('')
                      }}
                      className={`text-left p-3 rounded-xl border transition-all active:scale-98 ${
                        selected
                          ? 'bg-orange-50 border-[#e85d04] ring-2 ring-[#e85d04]/25'
                          : 'bg-gray-50/70 border-gray-200 hover:bg-white hover:border-gray-300'
                      }`}
                    >
                      <span className={`text-xs sm:text-sm font-extrabold block truncate ${selected ? 'text-[#e85d04]' : 'text-gray-900'}`}>
                        {ing.name}
                      </span>
                      <span className="text-[11px] text-gray-500 font-medium block mt-0.5">
                        Now: {ing.currentStock} {ing.unit}
                      </span>
                    </button>
                  )
                })}
              </div>

              {/* Step 2: How much arrived? */}
              <div className="border-t border-gray-100 pt-5 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-extrabold text-gray-900">
                    2. How much arrived? {selectedIngredient ? `(${selectedIngredient.unit})` : ''}
                  </h3>
                  {selectedIngredient && (
                    <span className="text-xs font-bold text-[#e85d04]">
                      {selectedIngredient.name}
                    </span>
                  )}
                </div>

                {/* Big +/- Stepper Row */}
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => stepInQty(-1)}
                    className="w-11 h-11 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-800 font-black text-base flex items-center justify-center active:scale-95 shrink-0"
                  >
                    −1
                  </button>
                  {selectedIngredient && supportsHalfStep(selectedIngredient.unit) && (
                    <button
                      type="button"
                      onClick={() => stepInQty(-0.5)}
                      className="w-11 h-11 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-xs flex items-center justify-center active:scale-95 shrink-0"
                    >
                      −.5
                    </button>
                  )}
                  <input
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    min="0.01"
                    placeholder="0"
                    value={inQuantity}
                    onChange={(e) => setInQuantity(e.target.value)}
                    className="flex-1 min-w-0 text-center bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-lg font-black text-gray-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#e85d04]"
                    required
                  />
                  {selectedIngredient && supportsHalfStep(selectedIngredient.unit) && (
                    <button
                      type="button"
                      onClick={() => stepInQty(0.5)}
                      className="w-11 h-11 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-xs flex items-center justify-center active:scale-95 shrink-0"
                    >
                      +.5
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => stepInQty(1)}
                    className="w-11 h-11 rounded-xl bg-orange-50 hover:bg-orange-100 text-[#e85d04] border border-orange-200 font-black text-base flex items-center justify-center active:scale-95 shrink-0"
                  >
                    +1
                  </button>
                </div>

                {/* Quick Preset Chips */}
                <div className="flex flex-wrap gap-2">
                  {[1, 2, 5, 10].map((amt) => (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => stepInQty(amt)}
                      className="px-3.5 py-2 rounded-xl bg-gray-50 hover:bg-orange-50 border border-gray-200 hover:border-orange-200 text-xs font-extrabold text-gray-700 hover:text-[#e85d04] active:scale-95"
                    >
                      +{amt} {selectedIngredient?.unit || ''}
                    </button>
                  ))}
                </div>
              </div>

              {/* Step 3: Expiry Date */}
              <div className="border-t border-gray-100 pt-4 space-y-1.5">
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider">
                  3. Expiry Date (Optional)
                </label>
                <input
                  type="date"
                  value={expirationDate}
                  onChange={(e) => setExpirationDate(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#e85d04]"
                />
                <p className="text-[11px] text-gray-400">
                  {selectedIngredient
                    ? `Auto-sets to +${selectedIngredient.spoiled_time_limit_days} days (${selectedIngredient.name} shelf life) if left blank.`
                    : 'Auto-sets based on ingredient shelf life if left blank.'}
                </p>
              </div>

              <button
                type="submit"
                disabled={inLoading || !selectedIngredientId}
                className="w-full btn-tactile-primary text-white font-extrabold py-3.5 rounded-xl text-sm disabled:opacity-50"
              >
                {inLoading ? 'Adding to Stock...' : 'Add Delivery to Stock'}
              </button>
            </form>

            {/* Right: Recent Deliveries */}
            <div className="lg:col-span-5 bg-white rounded-2xl border border-gray-200/80 shadow-xs p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-gray-900">Recent Stock Added</h3>
                  <p className="text-xs text-gray-400">Latest deliveries &amp; batches</p>
                </div>
                <span className="text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-full">
                  {recentDeliveries.length} recent
                </span>
              </div>

              {recentDeliveries.length === 0 ? (
                <p className="text-xs text-gray-400 py-6 text-center">No deliveries logged yet.</p>
              ) : (
                <div className="divide-y divide-gray-100 text-xs">
                  {recentDeliveries.map((del) => (
                    <div key={del.id} className="py-3 flex items-center justify-between gap-2 first:pt-0 last:pb-0">
                      <div className="min-w-0">
                        <span className="font-bold text-gray-900 block truncate">{del.ingredientName}</span>
                        <span className="text-[11px] text-gray-400">
                          {formatTimestamp(del.createdAt)} · Exp {formatShortDate(del.expirationDate)}
                        </span>
                      </div>
                      <span className="font-extrabold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-lg shrink-0">
                        +{del.quantityReceived} {del.unit}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left: Toss Spoiled Form */}
          <form
            onSubmit={handleSubmitWaste}
            className="lg:col-span-7 bg-white rounded-2xl border border-gray-200/80 shadow-xs p-5 sm:p-6 space-y-5"
          >
            <div>
              <h2 className="text-lg font-extrabold text-gray-900">1. Tap the Spoiled / Damaged Batch</h2>
              <p className="text-xs text-gray-500">Oldest &amp; expired batches are shown first.</p>
            </div>

            {outSuccess && (
              <div className="p-3.5 bg-green-50 border border-green-200 rounded-xl text-green-800 text-xs font-bold">
                ✓ {outSuccess}
              </div>
            )}
            {outError && (
              <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs font-bold">
                {outError}
              </div>
            )}

            {activeBatches.length === 0 ? (
              <div className="text-center py-8 bg-gray-50 rounded-xl border border-dashed border-gray-200 text-xs text-gray-500">
                No active batches with stock remaining right now.
              </div>
            ) : (
              <>
                <input
                  type="text"
                  placeholder="Search ingredient or batch..."
                  value={outSearch}
                  onChange={(e) => setOutSearch(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-500"
                />

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-72 overflow-y-auto pr-1">
                  {filteredBatches.map((batch) => {
                    const selected = batch.id === selectedBatchId
                    const isExpired =
                      batch.expirationDate && new Date(batch.expirationDate).getTime() < Date.now()
                    return (
                      <button
                        key={batch.id}
                        type="button"
                        onClick={() => {
                          setSelectedBatchId(batch.id)
                          setOutQuantity('')
                          setOutError('')
                        }}
                        className={`text-left p-3.5 rounded-xl border transition-all active:scale-98 ${
                          selected
                            ? 'bg-red-50 border-red-500 ring-2 ring-red-500/20'
                            : isExpired
                            ? 'bg-red-50/40 border-red-200 hover:border-red-300'
                            : 'bg-gray-50/70 border-gray-200 hover:bg-white hover:border-gray-300'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className={`text-xs sm:text-sm font-extrabold truncate ${selected ? 'text-red-700' : 'text-gray-900'}`}>
                            {batch.ingredientName}
                          </span>
                          {isExpired && (
                            <span className="text-[10px] font-bold bg-red-100 text-red-700 px-1.5 py-0.5 rounded-md shrink-0">
                              Expired
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-gray-600 mt-1">
                          <strong>{batch.quantityRemaining} {batch.unit}</strong> left · Exp {formatShortDate(batch.expirationDate)}
                        </p>
                      </button>
                    )
                  })}
                </div>

                {/* Step 2: How much to toss? */}
                <div className="border-t border-gray-100 pt-5 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-sm font-extrabold text-gray-900">
                      2. How much are you tossing? {selectedBatch ? `(${selectedBatch.unit})` : ''}
                    </h3>
                    {selectedBatch && (
                      <button
                        type="button"
                        onClick={() => setOutQuantity(String(selectedBatch.quantityRemaining))}
                        className="text-xs font-bold text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 px-3 py-1.5 rounded-xl"
                      >
                        Toss Whole Batch ({selectedBatch.quantityRemaining} {selectedBatch.unit})
                      </button>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => stepOutQty(-1)}
                      disabled={!selectedBatch}
                      className="w-11 h-11 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-800 font-black text-base flex items-center justify-center active:scale-95 disabled:opacity-40 shrink-0"
                    >
                      −1
                    </button>
                    {selectedBatch && supportsHalfStep(selectedBatch.unit) && (
                      <button
                        type="button"
                        onClick={() => stepOutQty(-0.5)}
                        className="w-11 h-11 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-xs flex items-center justify-center active:scale-95 shrink-0"
                      >
                        −.5
                      </button>
                    )}
                    <input
                      type="number"
                      inputMode="decimal"
                      step="0.01"
                      min="0.01"
                      max={selectedBatch?.quantityRemaining}
                      placeholder="0"
                      value={outQuantity}
                      onChange={(e) => setOutQuantity(e.target.value)}
                      className="flex-1 min-w-0 text-center bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-lg font-black text-gray-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-500"
                      required
                    />
                    {selectedBatch && supportsHalfStep(selectedBatch.unit) && (
                      <button
                        type="button"
                        onClick={() => stepOutQty(0.5)}
                        className="w-11 h-11 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-xs flex items-center justify-center active:scale-95 shrink-0"
                      >
                        +.5
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => stepOutQty(1)}
                      disabled={!selectedBatch}
                      className="w-11 h-11 rounded-xl bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 font-black text-base flex items-center justify-center active:scale-95 disabled:opacity-40 shrink-0"
                    >
                      +1
                    </button>
                  </div>
                </div>

                {/* Step 3: Reason */}
                <div className="border-t border-gray-100 pt-4 space-y-2.5">
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider">
                    3. Why was it tossed?
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {WASTE_REASONS.map((preset) => {
                      const active = wasteReason === preset
                      return (
                        <button
                          key={preset}
                          type="button"
                          onClick={() => setWasteReason(preset)}
                          className={`px-3 py-2 rounded-xl text-xs font-bold border transition-all ${
                            active
                              ? 'bg-red-600 text-white border-red-600 shadow-2xs'
                              : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100'
                          }`}
                        >
                          {preset}
                        </button>
                      )
                    })}
                  </div>
                  <input
                    type="text"
                    placeholder="Or type a custom note..."
                    value={wasteReason}
                    onChange={(e) => setWasteReason(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-xs text-gray-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-500"
                  />
                </div>

                <button
                  type="submit"
                  disabled={outLoading || !selectedBatchId}
                  className="w-full bg-red-600 hover:bg-red-700 text-white font-extrabold py-3.5 rounded-xl text-sm shadow-xs active:scale-98 transition-all disabled:opacity-50"
                >
                  {outLoading ? 'Removing from Stock...' : 'Remove from Stock'}
                </button>
              </>
            )}
          </form>

          {/* Right: Recent Tossed Items */}
          <div className="lg:col-span-5 bg-white rounded-2xl border border-gray-200/80 shadow-xs p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-gray-900">Recently Tossed</h3>
                <p className="text-xs text-gray-400">Latest discarded batches</p>
              </div>
              <span className="text-xs font-bold text-red-700 bg-red-50 border border-red-200 px-2.5 py-1 rounded-full">
                {recentWaste.length} logged
              </span>
            </div>

            {recentWaste.length === 0 ? (
              <p className="text-xs text-gray-400 py-6 text-center">
                Nothing tossed recently. Great job!
              </p>
            ) : (
              <div className="divide-y divide-gray-100 text-xs">
                {recentWaste.map((rec) => (
                  <div key={rec.id} className="py-3 flex items-center justify-between gap-2 first:pt-0 last:pb-0">
                    <div className="min-w-0">
                      <span className="font-bold text-gray-900 block truncate">{rec.ingredientName}</span>
                      <span className="text-[11px] text-gray-400">
                        {rec.reason} · {formatTimestamp(rec.createdAt)}
                      </span>
                    </div>
                    <span className="font-extrabold text-red-600 bg-red-50 border border-red-100 px-2.5 py-1 rounded-lg shrink-0">
                      −{rec.quantity} {rec.unit}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Quick Add Ingredient Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-5 shadow-xl border border-gray-100 space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 pb-2.5">
              <h3 className="text-sm font-bold text-gray-900">Add New Ingredient</h3>
              <button
                type="button"
                onClick={() => {
                  setShowAddModal(false)
                  setModalError('')
                }}
                className="text-gray-400 hover:text-gray-600 text-base font-bold"
              >
                ✕
              </button>
            </div>

            {modalError && (
              <div className="p-2.5 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700">
                {modalError}
              </div>
            )}

            <form onSubmit={handleCreateNewIngredient} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Ingredient Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Avocado"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-xs text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#e85d04]"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    Unit
                  </label>
                  <input
                    type="text"
                    placeholder="kg, L, pack"
                    value={newUnit}
                    onChange={(e) => setNewUnit(e.target.value)}
                    className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-xs text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#e85d04]"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    Min Stock Alert
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={newLowStock}
                    onChange={(e) => setNewLowStock(e.target.value)}
                    className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-xs text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#e85d04]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Cost per Unit ($)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={newCost}
                  onChange={(e) => setNewCost(e.target.value)}
                  className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-xs text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#e85d04]"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddModal(false)
                    setModalError('')
                  }}
                  className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold py-2 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCreatingIng}
                  className="flex-1 bg-[#e85d04] hover:bg-[#d45203] text-white text-xs font-bold py-2 rounded-xl shadow-xs disabled:opacity-50"
                >
                  {isCreatingIng ? 'Adding...' : 'Add & Select'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
