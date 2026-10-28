'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createIngredientAction } from '@/app/actions/ingredients'
import { updateIngredientAction, UpdateIngredientInput } from '@/app/actions/inventory'
import { IngredientThresholdRow } from './page'

interface Props {
  initialIngredients: IngredientThresholdRow[]
}

function PencilIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 20h9"/>
      <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
    </svg>
  )
}

export default function ThresholdsClient({ initialIngredients }: Props) {
  const router = useRouter()

  const [ingredients, setIngredients] = useState<IngredientThresholdRow[]>(initialIngredients)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterStatus, setFilterStatus] = useState<'all' | 'low' | 'normal'>('all')

  // Edit Ingredient Modal state
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

  // Add new ingredient modal state
  const [showAddModal, setShowAddModal] = useState(false)
  const [newName, setNewName] = useState('')
  const [newUnit, setNewUnit] = useState('kg')
  const [newLowStock, setNewLowStock] = useState('2')
  const [newSpoiledDays, setNewSpoiledDays] = useState('5')
  const [newDailyUsage, setNewDailyUsage] = useState('0.8')
  const [newCost, setNewCost] = useState('4.50')
  const [isCreating, setIsCreating] = useState(false)
  const [modalError, setModalError] = useState('')

  // Global success message
  const [successBanner, setSuccessBanner] = useState('')

  function openEditModal(item: IngredientThresholdRow) {
    setEditingItem(item)
    setEditName(item.name)
    setEditUnit(item.unit)
    setEditLowStock(item.low_stock_threshold.toString())
    setEditSpoiledDays(item.spoiled_time_limit_days.toString())
    setEditDailyUsage(item.daily_usage_rate.toString())
    setEditCost((item.cost_per_unit || 0).toString())
    setEditDescription('')
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

    // Update local state optimistically
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
              totalValue: item.currentStock * (payload.cost_per_unit || 0),
            }
          : item
      )
    )

    setEditingItem(null)
    setSuccessBanner(`Updated "${payload.name}" successfully!`)
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
        setSuccessBanner(`Added "${res.data.name}" successfully!`)
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

  const lowStockCount = ingredients.filter((i) => i.currentStock <= i.low_stock_threshold).length
  const totalValuation = ingredients.reduce((sum, i) => sum + i.totalValue, 0)

  return (
    <div className="space-y-6">
      {/* Top Banner and Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
        <div className="bg-white rounded-2xl border border-gray-200/80 shadow-xs p-4 sm:p-5">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Total Stock Value</p>
          <p className="text-2xl sm:text-3xl font-extrabold text-gray-900 mt-1">
            ${totalValuation.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
          <p className="text-xs text-gray-400 mt-1">Calculated via Cost per Unit</p>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200/80 shadow-xs p-4 sm:p-5">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Below Threshold</p>
          <p className={`text-2xl sm:text-3xl font-extrabold mt-1 ${lowStockCount > 0 ? 'text-[#e85d04]' : 'text-gray-900'}`}>
            {lowStockCount}
          </p>
          <p className="text-xs text-orange-600 mt-1 font-semibold">Triggers automated low-stock badges</p>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200/80 shadow-xs p-4 sm:p-5">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Spoiled Limit Policy</p>
          <p className="text-2xl sm:text-3xl font-extrabold text-[#16a34a] mt-1">
            Active
          </p>
          <p className="text-xs text-green-700 mt-1 font-semibold">Batches tracked against configured days</p>
        </div>
      </div>

      {successBanner && (
        <div className="p-3.5 bg-green-50 border border-green-200 rounded-xl text-green-700 text-xs font-bold flex items-center gap-2">
          <span>✓</span> {successBanner}
        </div>
      )}

      {/* Table Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-gray-200/80 shadow-xs">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3 flex-1 max-w-lg">
          <div className="relative flex-1">
            <input
              type="text"
              placeholder="Search ingredient..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-xs text-gray-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#e85d04]"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-2.5 text-xs text-gray-400"
              >
                ✕
              </button>
            )}
          </div>

          <div className="flex items-center bg-gray-100 rounded-xl p-1 text-xs">
            <button
              onClick={() => setFilterStatus('all')}
              className={`flex-1 sm:flex-initial px-3 py-1.5 rounded-lg font-bold transition-all ${
                filterStatus === 'all' ? 'bg-white text-gray-900 shadow-2xs' : 'text-gray-500'
              }`}
            >
              All ({ingredients.length})
            </button>
            <button
              onClick={() => setFilterStatus('low')}
              className={`flex-1 sm:flex-initial px-3 py-1.5 rounded-lg font-bold transition-all ${
                filterStatus === 'low' ? 'bg-white text-orange-600 shadow-2xs' : 'text-gray-500'
              }`}
            >
              Low ({lowStockCount})
            </button>
          </div>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="inline-flex items-center justify-center gap-1.5 bg-[#e85d04] hover:bg-[#d45203] text-white text-xs font-bold px-4 py-2.5 rounded-xl shadow-xs transition-all active:scale-98 shrink-0"
        >
          <span>＋</span> New Ingredient
        </button>
      </div>

      {/* MOBILE CARD VIEW: Proper mobile phone ratio and touch targets */}
      <div className="block md:hidden space-y-3">
        {filtered.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-200 p-6 text-center text-xs text-gray-400">
            No ingredients match your criteria.
          </div>
        ) : (
          filtered.map((item) => {
            const isLow = item.currentStock <= item.low_stock_threshold
            const isCritical = item.currentStock === 0

            return (
              <div
                key={item.id}
                className="bg-white rounded-2xl border border-gray-200/80 shadow-xs p-4 space-y-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="font-extrabold text-gray-900 text-sm">{item.name}</h3>
                    <p className="text-[11px] text-gray-400">Unit: {item.unit} · Cost: ${(item.cost_per_unit || 0).toFixed(2)}/{item.unit}</p>
                  </div>
                  <div>
                    {isCritical ? (
                      <span className="text-[10px] font-extrabold text-red-700 bg-red-100 px-2 py-0.5 rounded-full">
                        Out of Stock
                      </span>
                    ) : isLow ? (
                      <span className="text-[10px] font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">
                        Low Stock
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold text-green-700 bg-green-100 px-2 py-0.5 rounded-full">
                        Normal
                      </span>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 bg-gray-50/80 rounded-xl p-3 text-xs">
                  <div>
                    <span className="text-gray-400 text-[10px] uppercase font-bold block">Current Stock</span>
                    <span className="font-extrabold text-gray-900">{item.currentStock} {item.unit}</span>
                  </div>
                  <div>
                    <span className="text-gray-400 text-[10px] uppercase font-bold block">Low Stock Min</span>
                    <span className="font-bold text-gray-700">{item.low_stock_threshold} {item.unit}</span>
                  </div>
                  <div>
                    <span className="text-gray-400 text-[10px] uppercase font-bold block">Spoiled Limit</span>
                    <span className="font-bold text-gray-700">{item.spoiled_time_limit_days} days</span>
                  </div>
                  <div>
                    <span className="text-gray-400 text-[10px] uppercase font-bold block">Stock Value</span>
                    <span className="font-extrabold text-gray-900">${(item.currentStock * (item.cost_per_unit || 0)).toFixed(2)}</span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => openEditModal(item)}
                  className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl border border-orange-200 bg-orange-50/70 text-[#e85d04] hover:bg-orange-100 font-bold text-xs transition-all active:scale-98"
                >
                  <PencilIcon />
                  Edit Ingredient
                </button>
              </div>
            )
          })
        )}
      </div>

      {/* DESKTOP DATA TABLE: Wide screen optimized */}
      <div className="hidden md:block bg-white rounded-2xl border border-gray-200/80 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50/70 text-gray-600 text-xs font-bold uppercase tracking-wider border-b border-gray-100">
                <th className="py-3 px-5">Ingredient</th>
                <th className="py-3 px-4">Current Stock</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Low Stock Min</th>
                <th className="py-3 px-4">Spoiled Limit</th>
                <th className="py-3 px-4">Daily Usage</th>
                <th className="py-3 px-4">Unit Cost</th>
                <th className="py-3 px-4">Stock Value</th>
                <th className="py-3 px-5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-sm">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-xs text-gray-400">
                    No ingredients match the search or filter criteria.
                  </td>
                </tr>
              ) : (
                filtered.map((item) => {
                  const isLow = item.currentStock <= item.low_stock_threshold
                  const isCritical = item.currentStock === 0

                  return (
                    <tr key={item.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="py-3 px-5">
                        <span className="font-bold text-gray-900 block">{item.name}</span>
                        <span className="text-[11px] text-gray-400">Unit: {item.unit}</span>
                      </td>

                      <td className="py-3 px-4 font-extrabold text-gray-900">
                        {item.currentStock} {item.unit}
                      </td>

                      <td className="py-3 px-4">
                        {isCritical ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-extrabold text-red-700 bg-red-100 px-2.5 py-0.5 rounded-full">
                            <span className="w-1.5 h-1.5 rounded-full bg-red-600 animate-pulse" />
                            Out of Stock
                          </span>
                        ) : isLow ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-700 bg-amber-100 px-2.5 py-0.5 rounded-full">
                            Low Stock
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-green-700 bg-green-100 px-2.5 py-0.5 rounded-full">
                            Normal
                          </span>
                        )}
                      </td>

                      <td className="py-3 px-4 font-bold text-gray-700">
                        {item.low_stock_threshold} <span className="text-xs text-gray-400 font-normal">{item.unit}</span>
                      </td>

                      <td className="py-3 px-4 font-bold text-gray-700">
                        {item.spoiled_time_limit_days} <span className="text-xs text-gray-400 font-normal">days</span>
                      </td>

                      <td className="py-3 px-4 font-bold text-gray-700">
                        {item.daily_usage_rate} <span className="text-xs text-gray-400 font-normal">{item.unit}/d</span>
                      </td>

                      <td className="py-3 px-4 font-bold text-gray-700">
                        ${(item.cost_per_unit || 0).toFixed(2)}
                      </td>

                      <td className="py-3 px-4 font-extrabold text-gray-900">
                        ${(item.currentStock * (item.cost_per_unit || 0)).toFixed(2)}
                      </td>

                      <td className="py-3 px-5 text-right">
                        <button
                          type="button"
                          onClick={() => openEditModal(item)}
                          className="inline-flex items-center gap-1.5 text-xs font-bold text-[#e85d04] hover:text-[#c44f04] bg-orange-50/70 hover:bg-orange-100 border border-orange-200/80 px-3 py-1.5 rounded-xl transition-all active:scale-95"
                        >
                          <PencilIcon />
                          Edit
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

      {/* FULL EDIT INGREDIENT MODAL */}
      {editingItem && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-gray-100 space-y-5 animate-in fade-in zoom-in-95 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div>
                <h3 className="text-lg font-extrabold text-gray-900">Edit Ingredient</h3>
                <p className="text-xs text-gray-400">Update configuration, thresholds, and costs</p>
              </div>
              <button
                type="button"
                onClick={() => setEditingItem(null)}
                className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 hover:bg-gray-200"
              >
                ✕
              </button>
            </div>

            {updateError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-600 text-xs font-medium">
                {updateError}
              </div>
            )}

            <form onSubmit={handleUpdateIngredient} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1 sm:col-span-2">
                  <label className="text-xs font-bold text-gray-700 uppercase">Ingredient Name</label>
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm font-semibold focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#e85d04]"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-700 uppercase">Unit of Measure</label>
                  <input
                    type="text"
                    value={editUnit}
                    onChange={(e) => setEditUnit(e.target.value)}
                    placeholder="kg, L, pack, bottle, g"
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm font-semibold focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#e85d04]"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-700 uppercase">Cost Per Unit ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={editCost}
                    onChange={(e) => setEditCost(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm font-semibold focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#e85d04]"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-700 uppercase">Low Stock Min ({editUnit || 'units'})</label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    value={editLowStock}
                    onChange={(e) => setEditLowStock(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm font-semibold focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#e85d04]"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-700 uppercase">Spoiled Limit (Days)</label>
                  <input
                    type="number"
                    step="1"
                    min="1"
                    value={editSpoiledDays}
                    onChange={(e) => setEditSpoiledDays(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm font-semibold focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#e85d04]"
                  />
                </div>

                <div className="space-y-1 sm:col-span-2">
                  <label className="text-xs font-bold text-gray-700 uppercase">Daily Usage Rate ({editUnit || 'unit'}/day)</label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    value={editDailyUsage}
                    onChange={(e) => setEditDailyUsage(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm font-semibold focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#e85d04]"
                  />
                </div>

                <div className="space-y-1 sm:col-span-2">
                  <label className="text-xs font-bold text-gray-700 uppercase">Description / Storage Note</label>
                  <input
                    type="text"
                    placeholder="e.g. Keep refrigerated on Shelf B"
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm font-semibold focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#e85d04]"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setEditingItem(null)}
                  className="px-4 py-2.5 rounded-xl border border-gray-200 text-xs font-bold text-gray-600 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isUpdating}
                  className="px-5 py-2.5 rounded-xl bg-[#e85d04] hover:bg-[#d45203] text-white text-xs font-bold shadow-xs active:scale-98 disabled:opacity-50"
                >
                  {isUpdating ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ADD NEW INGREDIENT MODAL */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-gray-100 space-y-5 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div>
                <h3 className="text-lg font-extrabold text-gray-900">Add New Ingredient</h3>
                <p className="text-xs text-gray-400">Configure new tracking profile</p>
              </div>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 hover:bg-gray-200"
              >
                ✕
              </button>
            </div>

            {modalError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-600 text-xs font-medium">
                {modalError}
              </div>
            )}

            <form onSubmit={handleCreateIngredient} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-700 uppercase">Ingredient Name</label>
                <input
                  type="text"
                  placeholder="e.g. Pandan Leaves, Coconut Jelly"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm font-semibold focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#e85d04]"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-700 uppercase">Unit</label>
                  <input
                    type="text"
                    placeholder="kg, L, pack"
                    value={newUnit}
                    onChange={(e) => setNewUnit(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm font-semibold focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#e85d04]"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-700 uppercase">Cost Per Unit ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="5.00"
                    value={newCost}
                    onChange={(e) => setNewCost(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm font-semibold focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#e85d04]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-gray-700 uppercase">Low Stock Min</label>
                  <input
                    type="number"
                    step="0.1"
                    value={newLowStock}
                    onChange={(e) => setNewLowStock(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-2.5 py-2 text-xs font-semibold focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#e85d04]"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-gray-700 uppercase">Spoiled (Days)</label>
                  <input
                    type="number"
                    step="1"
                    value={newSpoiledDays}
                    onChange={(e) => setNewSpoiledDays(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-2.5 py-2 text-xs font-semibold focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#e85d04]"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-gray-700 uppercase">Daily Usage</label>
                  <input
                    type="number"
                    step="0.1"
                    value={newDailyUsage}
                    onChange={(e) => setNewDailyUsage(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-2.5 py-2 text-xs font-semibold focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#e85d04]"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2.5 rounded-xl border border-gray-200 text-xs font-bold text-gray-600 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCreating}
                  className="px-5 py-2.5 rounded-xl bg-[#e85d04] hover:bg-[#d45203] text-white text-xs font-bold shadow-xs active:scale-98 disabled:opacity-50"
                >
                  {isCreating ? 'Creating...' : 'Create Ingredient'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
