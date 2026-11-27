'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Check,
  ClipboardCheck,
  PackagePlus,
  Plus,
  Trash2,
  X,
} from 'lucide-react'
import StaffDesktopNav from '@/components/StaffDesktopNav'
import { submitRestockAction } from '@/app/actions/inventory'
import { createIngredientAction } from '@/app/actions/ingredients'
import { Ingredient } from '@/lib/types'
import { RecentDelivery } from './page'

interface Props {
  ingredients: Ingredient[]
  recentDeliveries: RecentDelivery[]
}

export default function RestockForm({ ingredients, recentDeliveries }: Props) {
  const router = useRouter()

  const [ingredientList, setIngredientList] = useState<Ingredient[]>(ingredients)

  useEffect(() => {
    setIngredientList(ingredients)
  }, [ingredients])

  const [ingredientId, setIngredientId] = useState('')
  const [quantity, setQuantity] = useState('')
  const [expirationDate, setExpirationDate] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')

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
      setError('Select an ingredient and enter a quantity')
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
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <p className="text-xs text-[#737373]">Staff operations</p>
          <h1 className="text-2xl sm:text-[28px] leading-[1.15] font-medium text-[#171717] tracking-[-0.015em] mt-1">
            Manual restock
          </h1>
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
                className="flex flex-col items-start gap-3 p-4 bg-[#fff7ed] border border-[#fed7aa] rounded-2xl text-left"
              >
                <div className="w-9 h-9 rounded-lg bg-white border border-[#fed7aa] flex items-center justify-center text-[#c2410c]">
                  <PackagePlus size={16} strokeWidth={1.5} />
                </div>
                <span className="text-sm font-medium text-[#c2410c]">Manual restock</span>
              </button>

              <button
                type="button"
                onClick={() => router.push('/staff/cycle-count')}
                className="flex flex-col items-start gap-3 p-4 surface-card-interactive rounded-2xl text-left"
              >
                <div className="w-9 h-9 rounded-lg bg-[#f4f4f5] border border-neutral-900/[0.06] flex items-center justify-center text-[#525252]">
                  <ClipboardCheck size={16} strokeWidth={1.5} />
                </div>
                <span className="text-sm font-medium text-[#171717]">Cycle count</span>
              </button>
            </div>
          </section>

          <section className="surface-card rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-medium text-[#171717]">Recent deliveries</h2>
                <p className="text-xs text-[#737373] mt-0.5">Active inbound batches received</p>
              </div>
              <span className="font-mono text-xs tabular-nums text-[#737373]">
                {recentDeliveries.length} recorded
              </span>
            </div>

            {recentDeliveries.length === 0 ? (
              <p className="text-xs text-[#737373] py-6 text-center">
                No deliveries recorded yet
              </p>
            ) : (
              <div className="divide-y divide-neutral-900/[0.06]">
                {recentDeliveries.map((del) => {
                  const expStr = del.expirationDate
                    ? new Date(del.expirationDate).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                      })
                    : 'No expiry'
                  return (
                    <div
                      key={del.id}
                      className="py-3 flex items-center justify-between gap-3 first:pt-0 last:pb-0"
                    >
                      <div className="min-w-0">
                        <span className="text-sm font-medium text-[#171717] block truncate">
                          {del.ingredientName}
                        </span>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="batch-stamp">
                            {del.batchCode || 'Batch'} · Exp {expStr}
                          </span>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="font-mono text-sm font-medium tabular-nums text-[#15803d] block">
                          +{del.quantityReceived} {del.unit}
                        </span>
                        <span className="text-xs text-[#737373] capitalize">{del.status}</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </section>
        </div>

        <div className="lg:col-span-5">
          <div className="surface-card rounded-2xl p-6 space-y-5">
            <div>
              <h2 className="text-base font-medium text-[#171717]">Log delivery</h2>
              <p className="text-xs text-[#737373] mt-0.5">Record stock as it arrives</p>
            </div>

            {success && (
              <div className="flex items-center gap-2 bg-[#f0fdf4] border border-[#bbf7d0] rounded-xl px-4 py-3 text-xs font-medium text-[#15803d]">
                <Check size={14} strokeWidth={1.5} />
                <span>Restock logged</span>
              </div>
            )}

            {error && (
              <div className="bg-[#fef2f2] border border-[#fecaca] rounded-xl px-4 py-3 text-xs text-[#b91c1c] font-medium">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-medium text-[#525252]">
                    Ingredient
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowAddModal(true)}
                    className="inline-flex items-center gap-1 text-xs font-medium text-[#c2410c] hover:text-[#9a3412]"
                  >
                    <Plus size={14} strokeWidth={1.5} />
                    <span>Add new</span>
                  </button>
                </div>
                <select
                  value={ingredientId}
                  onChange={(e) => setIngredientId(e.target.value)}
                  className="w-full h-10 bg-white border border-neutral-900/[0.14] hover:border-neutral-900/[0.24] rounded-xl px-3 text-sm text-[#171717] focus:outline-none focus:ring-2 focus:ring-[#c2410c] focus:border-transparent transition-colors"
                  required
                >
                  <option value="">Select ingredient</option>
                  {ingredientList.map((ing) => (
                    <option key={ing.id} value={ing.id}>
                      {ing.name} ({ing.unit})
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-[#525252]">
                  Quantity received{selectedIngredient ? ` (${selectedIngredient.unit})` : ''}
                </label>
                <input
                  type="number"
                  inputMode="decimal"
                  min="0.01"
                  step="0.01"
                  placeholder="0"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  className="w-full h-10 bg-white border border-neutral-900/[0.14] hover:border-neutral-900/[0.24] rounded-xl px-3 text-sm font-mono tabular-nums text-[#171717] placeholder-[#a3a3a3] focus:outline-none focus:ring-2 focus:ring-[#c2410c] focus:border-transparent transition-colors"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-[#525252]">
                  Expiration date
                </label>
                <input
                  type="date"
                  value={expirationDate}
                  onChange={(e) => setExpirationDate(e.target.value)}
                  className="w-full h-10 bg-white border border-neutral-900/[0.14] hover:border-neutral-900/[0.24] rounded-xl px-3 text-sm font-mono tabular-nums text-[#171717] focus:outline-none focus:ring-2 focus:ring-[#c2410c] focus:border-transparent transition-colors"
                />
                <p className="text-xs text-[#737373]">
                  {selectedIngredient
                    ? `Defaults to +${selectedIngredient.spoiled_time_limit_days} days (${selectedIngredient.name} shelf life)`
                    : 'Defaults to ingredient shelf life if left blank'}
                </p>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full h-10 btn-primary rounded-xl text-sm font-medium disabled:opacity-50"
              >
                {loading ? 'Submitting…' : 'Submit restock'}
              </button>
            </form>
          </div>
        </div>
      </div>

      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-[2px] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-[0_8px_24px_rgba(0,0,0,0.08)] border border-neutral-900/[0.08] space-y-4">
            <div className="flex items-center justify-between border-b border-neutral-900/[0.08] pb-3">
              <h3 className="text-base font-medium text-[#171717]">Add ingredient</h3>
              <button
                type="button"
                onClick={() => {
                  setShowAddModal(false)
                  setModalError('')
                }}
                aria-label="Close"
                className="w-8 h-8 rounded-lg flex items-center justify-center text-[#737373] hover:text-[#171717] hover:bg-[#f4f4f5] transition-colors"
              >
                <X size={16} strokeWidth={1.5} />
              </button>
            </div>

            {modalError && (
              <div className="p-3 bg-[#fef2f2] border border-[#fecaca] rounded-xl text-xs text-[#b91c1c]">
                {modalError}
              </div>
            )}

            <form onSubmit={handleCreateNewIngredient} className="space-y-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-[#525252]">
                  Ingredient name
                </label>
                <input
                  type="text"
                  placeholder="Avocado"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full h-10 bg-white border border-neutral-900/[0.14] rounded-xl px-3 text-sm text-[#171717] focus:outline-none focus:ring-2 focus:ring-[#c2410c]"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="block text-xs font-medium text-[#525252]">Unit</label>
                  <input
                    type="text"
                    placeholder="kg or L"
                    value={newUnit}
                    onChange={(e) => setNewUnit(e.target.value)}
                    className="w-full h-10 bg-white border border-neutral-900/[0.14] rounded-xl px-3 text-sm text-[#171717] focus:outline-none focus:ring-2 focus:ring-[#c2410c]"
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="block text-xs font-medium text-[#525252]">
                    Min stock
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={newLowStock}
                    onChange={(e) => setNewLowStock(e.target.value)}
                    className="w-full h-10 bg-white border border-neutral-900/[0.14] rounded-xl px-3 text-sm font-mono tabular-nums text-[#171717] focus:outline-none focus:ring-2 focus:ring-[#c2410c]"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-[#525252]">
                  Cost per unit ($)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={newCost}
                  onChange={(e) => setNewCost(e.target.value)}
                  className="w-full h-10 bg-white border border-neutral-900/[0.14] rounded-xl px-3 text-sm font-mono tabular-nums text-[#171717] focus:outline-none focus:ring-2 focus:ring-[#c2410c]"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddModal(false)
                    setModalError('')
                  }}
                  className="flex-1 h-9 btn-secondary rounded-xl text-xs font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCreatingIng}
                  className="flex-1 h-9 btn-primary rounded-xl text-xs font-medium disabled:opacity-50"
                >
                  {isCreatingIng ? 'Adding…' : 'Add and select'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
