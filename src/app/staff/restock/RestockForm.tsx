'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import StaffDesktopNav from '@/components/StaffDesktopNav'
import { submitRestockAction } from '@/app/actions/inventory'
import { createIngredientAction } from '@/app/actions/ingredients'
import { Ingredient } from '@/lib/types'
import { RecentDelivery } from './page'

interface Props {
  ingredients: Ingredient[]
  recentDeliveries: RecentDelivery[]
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

export default function RestockForm({ ingredients, recentDeliveries }: Props) {
  const router = useRouter()

  const [ingredientList, setIngredientList] = useState<Ingredient[]>(ingredients)
  const [ingredientId, setIngredientId] = useState('')
  const [quantity, setQuantity] = useState('')
  const [expirationDate, setExpirationDate] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')

  // Quick Add Ingredient state
  const [showAddModal, setShowAddModal] = useState(false)
  const [newName, setNewName] = useState('')
  const [newUnit, setNewUnit] = useState('kg')
  const [newLowStock, setNewLowStock] = useState('2')
  const [newCost, setNewCost] = useState('5.00')
  const [isCreatingIng, setIsCreatingIng] = useState(false)
  const [modalError, setModalError] = useState('')

  const selectedIngredient = ingredientList.find((i) => i.id === ingredientId)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!ingredientId || !quantity) {
      setError('Please select an ingredient and enter a quantity.')
      return
    }

    setLoading(true)
    setError('')

    const res = await submitRestockAction({
      ingredientId,
      quantity: parseFloat(quantity),
      expirationDate: expirationDate || null,
      costPerUnit: selectedIngredient?.cost_per_unit || 0,
    })

    setLoading(false)

    if (!res.success) {
      setError(res.error || 'Failed to submit restock')
      return
    }

    setSuccess(true)
    setQuantity('')
    setExpirationDate('')
    router.refresh()
    setTimeout(() => setSuccess(false), 3500)
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
      setModalError(res.error || 'Failed to create ingredient')
      return
    }

    const newIng: Ingredient = {
      id: res.data.id,
      name: res.data.name,
      unit: res.data.unit,
      low_stock_threshold: Number(res.data.low_stock_threshold) || 0,
      spoiled_time_limit_days: Number(res.data.spoiled_time_limit_days) || 7,
      daily_usage_rate: Number(res.data.daily_usage_rate) || 0,
      cost_per_unit: Number(res.data.cost_per_unit) || 0,
      created_at: res.data.created_at,
    }

    setIngredientList((prev) => [...prev, newIng])
    setIngredientId(newIng.id)
    setShowAddModal(false)
    setNewName('')
    setModalError('')
    router.refresh()
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
            Manual Restock
          </h1>
        </div>
        <StaffDesktopNav />
      </div>

      {/* 12-Column Responsive Grid matching Dashboard 7/5 ratio */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column (7 cols): Quick Actions & Recent Deliveries */}
        <div className="lg:col-span-7 space-y-6">
          {/* Quick Actions Bar */}
          <div className="space-y-3">
            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider block">
              QUICK ACTIONS
            </span>
            <div className="grid grid-cols-3 gap-3">
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

              <button
                type="button"
                className="flex flex-col items-center justify-center gap-2 bg-white border-2 border-[#e85d04] rounded-2xl p-4 shadow-xs"
              >
                <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-orange-50">
                  <PlusIcon />
                </div>
                <span className="text-xs font-bold text-[#e85d04] text-center">Manual Restock</span>
              </button>

              <button
                type="button"
                onClick={() => router.push('/staff/cycle-count')}
                className="flex flex-col items-center justify-center gap-2 bg-white border border-gray-200/80 rounded-2xl p-4 shadow-xs active:scale-95 transition-all hover:border-gray-300"
              >
                <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-green-50">
                  <CheckSquareIcon />
                </div>
                <span className="text-xs font-medium text-gray-700 text-center">Perform Cycle Count</span>
              </button>
            </div>
          </div>

          {/* Recent Deliveries Table */}
          <div className="bg-white rounded-2xl border border-gray-200/80 shadow-xs p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-gray-900">Recent Deliveries Log</h3>
                <p className="text-xs text-gray-400 mt-0.5">Active inbound batches received</p>
              </div>
              <span className="text-xs font-semibold text-[#e85d04]">
                {recentDeliveries.length} recorded
              </span>
            </div>

            {recentDeliveries.length === 0 ? (
              <p className="text-xs text-gray-400 py-6 text-center">
                No recent deliveries recorded yet. Log your first shipment on the right.
              </p>
            ) : (
              <div className="divide-y divide-gray-100 text-xs">
                {recentDeliveries.map((del) => {
                  const expStr = del.expirationDate
                    ? new Date(del.expirationDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                    : 'N/A'
                  return (
                    <div key={del.id} className="py-3 flex items-center justify-between first:pt-0 last:pb-0">
                      <div>
                        <span className="font-bold text-gray-900 text-sm block">{del.ingredientName}</span>
                        <span className="text-[11px] text-gray-400 font-mono">
                          {del.batchCode || 'Batch'} · Exp: {expStr}
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="font-extrabold text-gray-800 text-sm block">
                          +{del.quantityReceived} {del.unit}
                        </span>
                        <span className="inline-flex items-center text-[10px] font-bold text-green-700 bg-green-50 px-2 py-0.5 rounded-full">
                          {del.status}
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right Column (5 cols): The Manual Restock Form */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-white rounded-2xl border border-gray-200/80 shadow-xs p-5 sm:p-6 space-y-5">
            <div>
              <h2 className="text-lg font-extrabold text-gray-900 tracking-tight">Manual Restock</h2>
              <p className="text-xs text-gray-500 mt-0.5">Log a delivery as it arrives.</p>
            </div>

            {success && (
              <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-xl px-4 py-3">
                <span className="text-green-600 font-bold">✓</span>
                <p className="text-xs font-semibold text-green-700">Restock logged successfully into Supabase!</p>
              </div>
            )}

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-xs text-red-600 font-medium">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Ingredient Select */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider">
                    Ingredient Name
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowAddModal(true)}
                    className="text-xs font-bold text-[#e85d04] hover:underline"
                  >
                    ＋ Add New
                  </button>
                </div>
                <div className="relative">
                  <select
                    value={ingredientId}
                    onChange={(e) => setIngredientId(e.target.value)}
                    className="w-full appearance-none bg-white border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#e85d04] focus:border-transparent pr-10 shadow-2xs"
                    required
                  >
                    <option value="">Select ingredient...</option>
                    {ingredientList.map((ing) => (
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

              {/* Quantity */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider">
                  Quantity Received {selectedIngredient && `(${selectedIngredient.unit})`}
                </label>
                <input
                  type="number"
                  inputMode="decimal"
                  min="0.01"
                  step="0.01"
                  placeholder="0"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#e85d04] focus:border-transparent shadow-2xs"
                  required
                />
              </div>

              {/* Expiration Date */}
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
                <p className="text-[11px] text-gray-400">Optional — defaults to 7 days if left blank</p>
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-[#e85d04] hover:bg-[#d45203] text-white font-bold py-3.5 rounded-xl text-sm shadow-sm active:scale-98 transition-all disabled:opacity-50"
              >
                {loading ? 'Submitting...' : 'Submit Restock'}
              </button>
            </form>
          </div>
        </div>
      </div>

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
                    placeholder="kg or L"
                    value={newUnit}
                    onChange={(e) => setNewUnit(e.target.value)}
                    className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-xs text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#e85d04]"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    Min Stock
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
