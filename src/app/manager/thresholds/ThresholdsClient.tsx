'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Check, Pencil, Plus, Search, X } from 'lucide-react'
import { createIngredientAction } from '@/app/actions/ingredients'
import { updateIngredientAction, UpdateIngredientInput } from '@/app/actions/inventory'
import { IngredientThresholdRow } from './page'

interface Props {
  initialIngredients: IngredientThresholdRow[]
}

export default function ThresholdsClient({ initialIngredients }: Props) {
  const router = useRouter()

  const [ingredients, setIngredients] =
    useState<IngredientThresholdRow[]>(initialIngredients)

  useEffect(() => {
    setIngredients(initialIngredients)
  }, [initialIngredients])

  const [searchTerm, setSearchTerm] = useState('')
  const [filterStatus, setFilterStatus] = useState<'all' | 'low' | 'normal'>('all')

  const [editingItem, setEditingItem] = useState<IngredientThresholdRow | null>(null)
  const [editName, setEditName] = useState('')
  const [editUnit, setEditUnit] = useState('')
  const [editLowStock, setEditLowStock] = useState('')
  const [editSpoiledDays, setEditSpoiledDays] = useState('')
  const [editDailyUsage, setEditDailyUsage] = useState('')
  const [editCost, setEditCost] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [isUpdating, setIsUpdating] = useState(false)
  const [updateError, setUpdateError] = useState('')

  const [showAddModal, setShowAddModal] = useState(false)
  const [newName, setNewName] = useState('')
  const [newUnit, setNewUnit] = useState('kg')
  const [newLowStock, setNewLowStock] = useState('2')
  const [newSpoiledDays, setNewSpoiledDays] = useState('5')
  const [newDailyUsage, setNewDailyUsage] = useState('0.8')
  const [newCost, setNewCost] = useState('4.50')
  const [isCreating, setIsCreating] = useState(false)
  const [modalError, setModalError] = useState('')

  const [successBanner, setSuccessBanner] = useState('')

  function openEditModal(item: IngredientThresholdRow) {
    setEditingItem(item)
    setEditName(item.name)
    setEditUnit(item.unit)
    setEditLowStock(item.low_stock_threshold.toString())
    setEditSpoiledDays(item.spoiled_time_limit_days.toString())
    setEditDailyUsage(item.daily_usage_rate.toString())
    setEditCost((item.cost_per_unit || 0).toString())
    setEditDescription(item.description || '')
    setUpdateError('')
  }

  async function handleUpdateIngredient(e: React.FormEvent) {
    e.preventDefault()
    if (!editingItem) return
    if (!editName.trim()) {
      setUpdateError('Ingredient name cannot be empty')
      return
    }

    setIsUpdating(true)
    setUpdateError('')

    const payload: UpdateIngredientInput = {
      id: editingItem.id,
      name: editName.trim(),
      unit: editUnit.trim() || 'kg',
      low_stock_threshold: parseFloat(editLowStock) || 0,
      spoiled_time_limit_days: parseInt(editSpoiledDays) || 7,
      daily_usage_rate: parseFloat(editDailyUsage) || 0,
      cost_per_unit: parseFloat(editCost) || 0,
      description: editDescription.trim() || null,
    }

    const res = await updateIngredientAction(payload)
    setIsUpdating(false)

    if (!res.success) {
      setUpdateError(res.error || 'Failed to update ingredient')
      return
    }

    setIngredients((prev) =>
      prev.map((item) =>
        item.id === editingItem.id
          ? {
              ...item,
              name: payload.name,
              unit: payload.unit,
              low_stock_threshold: payload.low_stock_threshold,
              spoiled_time_limit_days: payload.spoiled_time_limit_days,
              daily_usage_rate: payload.daily_usage_rate,
              cost_per_unit: payload.cost_per_unit,
              description: payload.description,
              totalValue: item.currentStock * (payload.cost_per_unit || 0),
            }
          : item
      )
    )

    setEditingItem(null)
    setSuccessBanner(`Updated ${payload.name}`)
    setTimeout(() => setSuccessBanner(''), 3500)
    router.refresh()
  }

  async function handleCreateIngredient(e: React.FormEvent) {
    e.preventDefault()
    if (!newName.trim()) return

    setIsCreating(true)
    setModalError('')

    try {
      const res = await createIngredientAction({
        name: newName.trim(),
        unit: newUnit.trim() || 'kg',
        low_stock_threshold: parseFloat(newLowStock) || 0,
        spoiled_time_limit_days: parseInt(newSpoiledDays) || 7,
        daily_usage_rate: parseFloat(newDailyUsage) || 0,
        cost_per_unit: parseFloat(newCost) || 0,
      })

      if (!res.success) {
        setModalError(res.error || 'Failed to create ingredient')
        return
      }

      if (res.data) {
        setIngredients((prev) => [
          ...prev,
          {
            id: res.data.id,
            name: res.data.name,
            unit: res.data.unit,
            low_stock_threshold: Number(res.data.low_stock_threshold) || 0,
            spoiled_time_limit_days: Number(res.data.spoiled_time_limit_days) || 7,
            daily_usage_rate: Number(res.data.daily_usage_rate) || 0,
            cost_per_unit: Number(res.data.cost_per_unit) || 0,
            created_at: res.data.created_at,
            currentStock: 0,
            totalValue: 0,
            activeBatchesCount: 0,
          },
        ])
        setShowAddModal(false)
        setNewName('')
        setModalError('')
        setSuccessBanner(`Added ${res.data.name}`)
        setTimeout(() => setSuccessBanner(''), 3500)
        router.refresh()
      }
    } catch (err: unknown) {
      setModalError(err instanceof Error ? err.message : 'Failed to create ingredient')
    } finally {
      setIsCreating(false)
    }
  }

  const filtered = ingredients.filter((ing) => {
    const matchesSearch = ing.name.toLowerCase().includes(searchTerm.toLowerCase())
    const isLow = ing.currentStock <= ing.low_stock_threshold
    if (filterStatus === 'low') return matchesSearch && isLow
    if (filterStatus === 'normal') return matchesSearch && !isLow
    return matchesSearch
  })

  const lowStockCount = ingredients.filter(
    (i) => i.currentStock <= i.low_stock_threshold
  ).length
  const totalValuation = ingredients.reduce((sum, i) => sum + i.totalValue, 0)

  return (
    <div className="space-y-6">
      {/* KPI row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="surface-card rounded-2xl p-5">
          <p className="text-xs text-[#737373]">Total stock value</p>
          <p className="text-2xl sm:text-[28px] leading-none font-medium font-mono tabular-nums text-[#171717] mt-2">
            $
            {totalValuation.toLocaleString('en-US', {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </p>
          <p className="text-xs text-[#737373] mt-2">Based on unit cost</p>
        </div>

        <div className="surface-card rounded-2xl p-5">
          <p className="text-xs text-[#737373]">Below threshold</p>
          <p
            className={`text-2xl sm:text-[28px] leading-none font-medium font-mono tabular-nums mt-2 ${
              lowStockCount > 0 ? 'text-[#c2410c]' : 'text-[#171717]'
            }`}
          >
            {lowStockCount}
          </p>
          <p className="text-xs text-[#737373] mt-2">Triggers low-stock alerts</p>
        </div>

        <div className="surface-card rounded-2xl p-5">
          <p className="text-xs text-[#737373]">Tracked ingredients</p>
          <p className="text-2xl sm:text-[28px] leading-none font-medium font-mono tabular-nums text-[#171717] mt-2">
            {ingredients.length}
          </p>
          <p className="text-xs text-[#737373] mt-2">Shelf-life policy active</p>
        </div>
      </div>

      {successBanner && (
        <div className="p-3 bg-[#f0fdf4] border border-[#bbf7d0] rounded-xl text-[#15803d] text-xs font-medium flex items-center gap-2">
          <Check size={14} strokeWidth={1.5} />
          <span>{successBanner}</span>
        </div>
      )}

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 surface-card p-4 rounded-2xl">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 flex-1 max-w-lg">
          <div className="relative flex-1">
            <Search
              size={15}
              strokeWidth={1.5}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#737373]"
            />
            <input
              type="text"
              placeholder="Search ingredients"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full h-9 bg-white border border-neutral-900/[0.14] rounded-xl pl-9 pr-8 text-xs text-[#171717] placeholder-[#a3a3a3] focus:outline-none focus:ring-2 focus:ring-[#c2410c]"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                aria-label="Clear search"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#737373] hover:text-[#171717]"
              >
                <X size={14} strokeWidth={1.5} />
              </button>
            )}
          </div>

          <div className="flex items-center bg-[#f4f4f5] rounded-xl p-1 text-xs">
            <button
              type="button"
              onClick={() => setFilterStatus('all')}
              className={`h-7 flex-1 sm:flex-initial px-3 rounded-lg font-medium transition-colors ${
                filterStatus === 'all'
                  ? 'bg-white text-[#171717] shadow-[0_1px_2px_rgba(0,0,0,0.04)]'
                  : 'text-[#525252] hover:text-[#171717]'
              }`}
            >
              All ({ingredients.length})
            </button>
            <button
              type="button"
              onClick={() => setFilterStatus('low')}
              className={`h-7 flex-1 sm:flex-initial px-3 rounded-lg font-medium transition-colors ${
                filterStatus === 'low'
                  ? 'bg-white text-[#c2410c] shadow-[0_1px_2px_rgba(0,0,0,0.04)]'
                  : 'text-[#525252] hover:text-[#171717]'
              }`}
            >
              Low ({lowStockCount})
            </button>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setShowAddModal(true)}
          className="h-9 px-4 btn-primary rounded-xl text-xs font-medium inline-flex items-center justify-center gap-1.5 shrink-0"
        >
          <Plus size={15} strokeWidth={1.5} />
          <span>New ingredient</span>
        </button>
      </div>

      {/* Mobile card view */}
      <div className="block md:hidden space-y-3">
        {filtered.length === 0 ? (
          <div className="surface-card rounded-2xl p-6 text-center text-xs text-[#737373]">
            No ingredients match your filters
          </div>
        ) : (
          filtered.map((item) => {
            const isLow = item.currentStock <= item.low_stock_threshold
            const isCritical = item.currentStock === 0

            return (
              <div key={item.id} className="surface-card rounded-2xl p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="font-medium text-[#171717] text-sm">{item.name}</h3>
                    <p className="text-xs text-[#737373] font-mono tabular-nums mt-0.5">
                      ${(item.cost_per_unit || 0).toFixed(2)}/{item.unit}
                    </p>
                  </div>
                  <span
                    className={`font-mono text-xs px-2 py-0.5 rounded-md border ${
                      isCritical
                        ? 'text-[#b91c1c] bg-[#fef2f2] border-[#fecaca]'
                        : isLow
                        ? 'text-[#b45309] bg-[#fffbeb] border-[#fde68a]'
                        : 'text-[#15803d] bg-[#f0fdf4] border-[#bbf7d0]'
                    }`}
                  >
                    {isCritical ? 'Out' : isLow ? 'Low' : 'Normal'}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3 bg-[#fafafa] rounded-xl p-3 text-xs border border-neutral-900/[0.06]">
                  <div>
                    <span className="text-[#737373] block">Current stock</span>
                    <span className="font-mono tabular-nums font-medium text-[#171717]">
                      {item.currentStock} {item.unit}
                    </span>
                  </div>
                  <div>
                    <span className="text-[#737373] block">Min threshold</span>
                    <span className="font-mono tabular-nums text-[#525252]">
                      {item.low_stock_threshold} {item.unit}
                    </span>
                  </div>
                  <div>
                    <span className="text-[#737373] block">Shelf life</span>
                    <span className="font-mono tabular-nums text-[#525252]">
                      {item.spoiled_time_limit_days}d
                    </span>
                  </div>
                  <div>
                    <span className="text-[#737373] block">Stock value</span>
                    <span className="font-mono tabular-nums font-medium text-[#171717]">
                      ${(item.currentStock * (item.cost_per_unit || 0)).toFixed(2)}
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => openEditModal(item)}
                  className="w-full h-9 btn-secondary rounded-xl text-xs font-medium inline-flex items-center justify-center gap-1.5"
                >
                  <Pencil size={14} strokeWidth={1.5} />
                  <span>Edit ingredient</span>
                </button>
              </div>
            )
          })
        )}
      </div>

      {/* Desktop table */}
      <div className="hidden md:block surface-card rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#fafafa] text-[#737373] text-xs font-medium border-b border-neutral-900/[0.08]">
                <th className="py-3 px-5 font-medium">Ingredient</th>
                <th className="py-3 px-4 font-medium text-right">Stock</th>
                <th className="py-3 px-4 font-medium">Status</th>
                <th className="py-3 px-4 font-medium text-right">Min stock</th>
                <th className="py-3 px-4 font-medium text-right">Shelf life</th>
                <th className="py-3 px-4 font-medium text-right">Daily burn</th>
                <th className="py-3 px-4 font-medium text-right">Unit cost</th>
                <th className="py-3 px-4 font-medium text-right">Value</th>
                <th className="py-3 px-5 font-medium text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-900/[0.06] text-sm">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-xs text-[#737373]">
                    No ingredients match your filters
                  </td>
                </tr>
              ) : (
                filtered.map((item) => {
                  const isLow = item.currentStock <= item.low_stock_threshold
                  const isCritical = item.currentStock === 0

                  return (
                    <tr
                      key={item.id}
                      className="hover:bg-[#fafafa] transition-colors"
                    >
                      <td className="py-3 px-5">
                        <span className="font-medium text-[#171717] block">{item.name}</span>
                        <span className="text-xs text-[#737373] font-mono">{item.unit}</span>
                      </td>

                      <td className="py-3 px-4 text-right font-mono tabular-nums font-medium text-[#171717]">
                        {item.currentStock} {item.unit}
                      </td>

                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex items-center gap-1.5 font-mono text-xs px-2 py-0.5 rounded-md border ${
                            isCritical
                              ? 'text-[#b91c1c] bg-[#fef2f2] border-[#fecaca]'
                              : isLow
                              ? 'text-[#b45309] bg-[#fffbeb] border-[#fde68a]'
                              : 'text-[#15803d] bg-[#f0fdf4] border-[#bbf7d0]'
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              isCritical
                                ? 'bg-[#b91c1c]'
                                : isLow
                                ? 'bg-[#b45309]'
                                : 'bg-[#15803d]'
                            }`}
                          />
                          {isCritical ? 'Out of stock' : isLow ? 'Low stock' : 'Normal'}
                        </span>
                      </td>

                      <td className="py-3 px-4 text-right font-mono tabular-nums text-[#525252]">
                        {item.low_stock_threshold}{' '}
                        <span className="text-xs text-[#737373]">{item.unit}</span>
                      </td>

                      <td className="py-3 px-4 text-right font-mono tabular-nums text-[#525252]">
                        {item.spoiled_time_limit_days}d
                      </td>

                      <td className="py-3 px-4 text-right font-mono tabular-nums text-[#525252]">
                        {item.daily_usage_rate}{' '}
                        <span className="text-xs text-[#737373]">{item.unit}/d</span>
                      </td>

                      <td className="py-3 px-4 text-right font-mono tabular-nums text-[#525252]">
                        ${(item.cost_per_unit || 0).toFixed(2)}
                      </td>

                      <td className="py-3 px-4 text-right font-mono tabular-nums font-medium text-[#171717]">
                        ${(item.currentStock * (item.cost_per_unit || 0)).toFixed(2)}
                      </td>

                      <td className="py-3 px-5 text-right">
                        <button
                          type="button"
                          onClick={() => openEditModal(item)}
                          className="h-8 px-3 btn-secondary rounded-lg text-xs font-medium inline-flex items-center gap-1.5"
                        >
                          <Pencil size={13} strokeWidth={1.5} />
                          <span>Edit</span>
                        </button>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit modal */}
      {editingItem && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-[2px] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-[0_8px_24px_rgba(0,0,0,0.08)] border border-neutral-900/[0.08] space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-neutral-900/[0.08] pb-3">
              <div>
                <h3 className="text-base font-medium text-[#171717]">Edit ingredient</h3>
                <p className="text-xs text-[#737373]">Update thresholds, shelf life, and cost</p>
              </div>
              <button
                type="button"
                onClick={() => setEditingItem(null)}
                aria-label="Close"
                className="w-8 h-8 rounded-lg flex items-center justify-center text-[#737373] hover:text-[#171717] hover:bg-[#f4f4f5]"
              >
                <X size={16} strokeWidth={1.5} />
              </button>
            </div>

            {updateError && (
              <div className="p-3 bg-[#fef2f2] border border-[#fecaca] rounded-xl text-[#b91c1c] text-xs font-medium">
                {updateError}
              </div>
            )}

            <form onSubmit={handleUpdateIngredient} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5 sm:col-span-2">
                  <label className="text-xs font-medium text-[#525252]">Ingredient name</label>
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full h-10 bg-white border border-neutral-900/[0.14] rounded-xl px-3 text-sm text-[#171717] focus:outline-none focus:ring-2 focus:ring-[#c2410c]"
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-[#525252]">Unit</label>
                  <input
                    type="text"
                    value={editUnit}
                    onChange={(e) => setEditUnit(e.target.value)}
                    placeholder="kg, L, pack"
                    className="w-full h-10 bg-white border border-neutral-900/[0.14] rounded-xl px-3 text-sm text-[#171717] focus:outline-none focus:ring-2 focus:ring-[#c2410c]"
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-[#525252]">Cost per unit ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={editCost}
                    onChange={(e) => setEditCost(e.target.value)}
                    className="w-full h-10 bg-white border border-neutral-900/[0.14] rounded-xl px-3 text-sm font-mono tabular-nums text-[#171717] focus:outline-none focus:ring-2 focus:ring-[#c2410c]"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-[#525252]">
                    Low stock min ({editUnit || 'units'})
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    value={editLowStock}
                    onChange={(e) => setEditLowStock(e.target.value)}
                    className="w-full h-10 bg-white border border-neutral-900/[0.14] rounded-xl px-3 text-sm font-mono tabular-nums text-[#171717] focus:outline-none focus:ring-2 focus:ring-[#c2410c]"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-[#525252]">Shelf life (days)</label>
                  <input
                    type="number"
                    step="1"
                    min="1"
                    value={editSpoiledDays}
                    onChange={(e) => setEditSpoiledDays(e.target.value)}
                    className="w-full h-10 bg-white border border-neutral-900/[0.14] rounded-xl px-3 text-sm font-mono tabular-nums text-[#171717] focus:outline-none focus:ring-2 focus:ring-[#c2410c]"
                  />
                </div>

                <div className="space-y-1.5 sm:col-span-2">
                  <label className="text-xs font-medium text-[#525252]">
                    Daily usage ({editUnit || 'unit'}/day)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    value={editDailyUsage}
                    onChange={(e) => setEditDailyUsage(e.target.value)}
                    className="w-full h-10 bg-white border border-neutral-900/[0.14] rounded-xl px-3 text-sm font-mono tabular-nums text-[#171717] focus:outline-none focus:ring-2 focus:ring-[#c2410c]"
                  />
                </div>

                <div className="space-y-1.5 sm:col-span-2">
                  <label className="text-xs font-medium text-[#525252]">Storage note</label>
                  <input
                    type="text"
                    placeholder="Keep refrigerated on shelf B"
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value)}
                    className="w-full h-10 bg-white border border-neutral-900/[0.14] rounded-xl px-3 text-sm text-[#171717] focus:outline-none focus:ring-2 focus:ring-[#c2410c]"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-neutral-900/[0.08]">
                <button
                  type="button"
                  onClick={() => setEditingItem(null)}
                  className="h-9 px-4 btn-secondary rounded-xl text-xs font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isUpdating}
                  className="h-9 px-4 btn-primary rounded-xl text-xs font-medium disabled:opacity-50"
                >
                  {isUpdating ? 'Saving…' : 'Save changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-[2px] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-[0_8px_24px_rgba(0,0,0,0.08)] border border-neutral-900/[0.08] space-y-5">
            <div className="flex items-center justify-between border-b border-neutral-900/[0.08] pb-3">
              <div>
                <h3 className="text-base font-medium text-[#171717]">New ingredient</h3>
                <p className="text-xs text-[#737373]">Set tracking thresholds and unit cost</p>
              </div>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                aria-label="Close"
                className="w-8 h-8 rounded-lg flex items-center justify-center text-[#737373] hover:text-[#171717] hover:bg-[#f4f4f5]"
              >
                <X size={16} strokeWidth={1.5} />
              </button>
            </div>

            {modalError && (
              <div className="p-3 bg-[#fef2f2] border border-[#fecaca] rounded-xl text-[#b91c1c] text-xs font-medium">
                {modalError}
              </div>
            )}

            <form onSubmit={handleCreateIngredient} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-[#525252]">Ingredient name</label>
                <input
                  type="text"
                  placeholder="Pandan leaves"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full h-10 bg-white border border-neutral-900/[0.14] rounded-xl px-3 text-sm text-[#171717] focus:outline-none focus:ring-2 focus:ring-[#c2410c]"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-[#525252]">Unit</label>
                  <input
                    type="text"
                    placeholder="kg, L, pack"
                    value={newUnit}
                    onChange={(e) => setNewUnit(e.target.value)}
                    className="w-full h-10 bg-white border border-neutral-900/[0.14] rounded-xl px-3 text-sm text-[#171717] focus:outline-none focus:ring-2 focus:ring-[#c2410c]"
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-[#525252]">Cost per unit ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="5.00"
                    value={newCost}
                    onChange={(e) => setNewCost(e.target.value)}
                    className="w-full h-10 bg-white border border-neutral-900/[0.14] rounded-xl px-3 text-sm font-mono tabular-nums text-[#171717] focus:outline-none focus:ring-2 focus:ring-[#c2410c]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-[#525252]">Min stock</label>
                  <input
                    type="number"
                    step="0.1"
                    value={newLowStock}
                    onChange={(e) => setNewLowStock(e.target.value)}
                    className="w-full h-9 bg-white border border-neutral-900/[0.14] rounded-xl px-2.5 text-xs font-mono tabular-nums text-[#171717] focus:outline-none focus:ring-2 focus:ring-[#c2410c]"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-[#525252]">Shelf life (d)</label>
                  <input
                    type="number"
                    step="1"
                    value={newSpoiledDays}
                    onChange={(e) => setNewSpoiledDays(e.target.value)}
                    className="w-full h-9 bg-white border border-neutral-900/[0.14] rounded-xl px-2.5 text-xs font-mono tabular-nums text-[#171717] focus:outline-none focus:ring-2 focus:ring-[#c2410c]"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-[#525252]">Daily usage</label>
                  <input
                    type="number"
                    step="0.1"
                    value={newDailyUsage}
                    onChange={(e) => setNewDailyUsage(e.target.value)}
                    className="w-full h-9 bg-white border border-neutral-900/[0.14] rounded-xl px-2.5 text-xs font-mono tabular-nums text-[#171717] focus:outline-none focus:ring-2 focus:ring-[#c2410c]"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-neutral-900/[0.08]">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="h-9 px-4 btn-secondary rounded-xl text-xs font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCreating}
                  className="h-9 px-4 btn-primary rounded-xl text-xs font-medium disabled:opacity-50"
                >
                  {isCreating ? 'Creating…' : 'Create ingredient'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
