'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { CloverItem, RecipeIngredient } from '@/lib/types'

interface IngredientWithStock {
  id: string
  name: string
  unit: string
  category?: string
  cost_per_unit: number
  low_stock_threshold: number
  daily_usage_rate: number
  currentStock: number
}

interface Props {
  initialCloverItems: CloverItem[]
  ingredients: IngredientWithStock[]
}

const MENU_CATEGORIES = [
  'All',
  'Chè (Desserts)',
  'Bánh Mì (Subs)',
  'Giải Khát (Drinks)',
  'Viet Coffee',
  'Bubble Tea & Milk Tea',
  'Matcha Series',
] as const

export default function RecipesClient({ initialCloverItems, ingredients }: Props) {
  const router = useRouter()
  const supabase = createClient()

  const [cloverItems, setCloverItems] = useState<CloverItem[]>(initialCloverItems)
  const [selectedItemForRecipe, setSelectedItemForRecipe] = useState<CloverItem | null>(null)

  // Menu Filtering & Search state
  const [selectedCategory, setSelectedCategory] = useState<string>('All')
  const [searchQuery, setSearchQuery] = useState('')
  const [mappingFilter, setMappingFilter] = useState<'ALL' | 'UNMAPPED' | 'MAPPED'>('ALL')

  // New Clover Item Modal state
  const [showAddItemModal, setShowAddItemModal] = useState(false)
  const [newItemName, setNewItemName] = useState('')
  const [newItemCloverId, setNewItemCloverId] = useState('')
  const [newItemPrice, setNewItemPrice] = useState('')
  const [newItemCategory, setNewItemCategory] = useState('Chè (Desserts)')
  const [isSavingItem, setIsSavingItem] = useState(false)

  // Recipe editing state inside modal
  const [selectedIngredientToAdd, setSelectedIngredientToAdd] = useState('')
  const [qtyToAdd, setQtyToAdd] = useState('')
  const [isAddingIngredient, setIsAddingIngredient] = useState(false)

  // Deficit Calculator State
  const [salesInputs, setSalesInputs] = useState<Record<string, number>>({})
  const [isCommittingSales, setIsCommittingSales] = useState(false)
  const [salesSuccessMsg, setSalesSuccessMsg] = useState('')
  const [salesErrorMsg, setSalesErrorMsg] = useState('')

  // Filtered Clover Items for Menu & Recipe Mapping
  const filteredCloverItems = useMemo(() => {
    return cloverItems.filter((item) => {
      if (selectedCategory !== 'All' && item.category !== selectedCategory) {
        return false
      }
      const hasIngredients = item.recipe_ingredients && item.recipe_ingredients.length > 0
      if (mappingFilter === 'MAPPED' && !hasIngredients) return false
      if (mappingFilter === 'UNMAPPED' && hasIngredients) return false
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase()
        const matchesName = item.name.toLowerCase().includes(q)
        const matchesId = (item.clover_id || '').toLowerCase().includes(q)
        const matchesCat = (item.category || '').toLowerCase().includes(q)
        if (!matchesName && !matchesId && !matchesCat) return false
      }
      return true
    })
  }, [cloverItems, selectedCategory, mappingFilter, searchQuery])

  // Compute live ingredient deficits based on sales inputs
  const deficitAnalysis = useMemo(() => {
    const requiredTotals: Record<string, number> = {}

    // Calculate sum of required ingredients across all items sold
    Object.entries(salesInputs).forEach(([cloverItemId, unitsSold]) => {
      if (!unitsSold || unitsSold <= 0) return
      const item = cloverItems.find((c) => c.id === cloverItemId)
      if (!item || !item.recipe_ingredients) return

      item.recipe_ingredients.forEach((rec) => {
        const requiredForBatch = (rec.quantity_required || 0) * unitsSold
        requiredTotals[rec.ingredient_id] = (requiredTotals[rec.ingredient_id] || 0) + requiredForBatch
      })
    })

    // Compare with current stock
    return Object.entries(requiredTotals).map(([ingId, totalRequired]) => {
      const ing = ingredients.find((i) => i.id === ingId)
      const currentStock = ing ? ing.currentStock : 0
      const balance = currentStock - totalRequired
      const isDeficit = balance < 0
      const deficitAmount = isDeficit ? Math.abs(balance) : 0
      const estimatedCost = deficitAmount * (ing?.cost_per_unit || 0)

      return {
        ingredientId: ingId,
        name: ing ? ing.name : 'Unknown',
        unit: ing ? ing.unit : '',
        currentStock,
        totalRequired: Math.round(totalRequired * 100) / 100,
        balance: Math.round(balance * 100) / 100,
        isDeficit,
        deficitAmount: Math.round(deficitAmount * 100) / 100,
        estimatedCost: Math.round(estimatedCost * 100) / 100,
      }
    })
  }, [salesInputs, cloverItems, ingredients])

  // Create new Clover Item in Supabase
  async function handleCreateCloverItem(e: React.FormEvent) {
    e.preventDefault()
    if (!newItemName) return

    setIsSavingItem(true)
    try {
      const { data, error } = await supabase
        .from('clover_items')
        .insert({
          name: newItemName,
          clover_id: newItemCloverId || `CLV-${Date.now().toString().slice(-4)}`,
          price: parseFloat(newItemPrice) || 0,
          category: newItemCategory,
        })
        .select()
        .single()

      if (error) throw error

      setCloverItems((prev) => [...prev, { ...data, recipe_ingredients: [] }])
      setShowAddItemModal(false)
      setNewItemName('')
      setNewItemCloverId('')
      setNewItemPrice('')
      router.refresh()
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to create item')
    } finally {
      setIsSavingItem(false)
    }
  }

  // Add Ingredient to Active Recipe
  async function handleAddIngredientToRecipe(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedItemForRecipe || !selectedIngredientToAdd || !qtyToAdd) return

    setIsAddingIngredient(true)
    try {
      const qty = parseFloat(qtyToAdd)
      const { data, error } = await supabase
        .from('recipe_ingredients')
        .upsert(
          {
            clover_item_id: selectedItemForRecipe.id,
            ingredient_id: selectedIngredientToAdd,
            quantity_required: qty,
          },
          { onConflict: 'clover_item_id,ingredient_id' }
        )
        .select(`
          id,
          clover_item_id,
          ingredient_id,
          quantity_required,
          ingredient:ingredients (
            id,
            name,
            unit,
            cost_per_unit
          )
        `)
        .single()

      if (error) throw error

      // Update state
      const updatedRecipeList = [
        ...(selectedItemForRecipe.recipe_ingredients?.filter(
          (r) => r.ingredient_id !== selectedIngredientToAdd
        ) || []),
        data as unknown as RecipeIngredient,
      ]

      const updatedItem = {
        ...selectedItemForRecipe,
        recipe_ingredients: updatedRecipeList,
      }

      setSelectedItemForRecipe(updatedItem)
      setCloverItems((prev) =>
        prev.map((item) => (item.id === selectedItemForRecipe.id ? updatedItem : item))
      )

      setSelectedIngredientToAdd('')
      setQtyToAdd('')
      router.refresh()
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to add ingredient')
    } finally {
      setIsAddingIngredient(false)
    }
  }

  // Remove Ingredient from Recipe
  async function handleRemoveIngredient(recipeIngredientId: string) {
    if (!selectedItemForRecipe) return

    try {
      const { error } = await supabase
        .from('recipe_ingredients')
        .delete()
        .eq('id', recipeIngredientId)

      if (error) throw error

      const updatedRecipeList =
        selectedItemForRecipe.recipe_ingredients?.filter(
          (r) => r.id !== recipeIngredientId
        ) || []

      const updatedItem = {
        ...selectedItemForRecipe,
        recipe_ingredients: updatedRecipeList,
      }

      setSelectedItemForRecipe(updatedItem)
      setCloverItems((prev) =>
        prev.map((item) => (item.id === selectedItemForRecipe.id ? updatedItem : item))
      )
      router.refresh()
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to remove ingredient')
    }
  }

  // Commit Clover sales & log transactions in Supabase
  async function handleCommitSalesDeduction() {
    if (deficitAnalysis.length === 0) return

    setIsCommittingSales(true)
    setSalesSuccessMsg('')
    setSalesErrorMsg('')

    try {
      for (const item of deficitAnalysis) {
        // Log transaction as SALE
        const { error: txErr } = await supabase
          .from('inventory_transactions')
          .insert({
            ingredient_id: item.ingredientId,
            transaction_type: 'SALE',
            quantity_change: item.totalRequired,
            reason: `Clover POS sales deduction (${Object.values(salesInputs).reduce((a, b) => a + b, 0)} items sold)`,
          })

        if (txErr) throw txErr
      }

      setSalesSuccessMsg('Sales usage successfully committed to inventory logs!')
      setSalesInputs({})
      setTimeout(() => setSalesSuccessMsg(''), 4000)
      router.refresh()
    } catch (err: unknown) {
      setSalesErrorMsg(err instanceof Error ? err.message : 'Failed to commit sales')
    } finally {
      setIsCommittingSales(false)
    }
  }

  return (
    <div className="space-y-8">
      {/* Top Controls & Header */}
      <div className="bg-white p-5 rounded-2xl border border-gray-200/80 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-extrabold text-gray-900 tracking-tight">
              Official Chè Bông Menu & Clover POS Recipe Mapping
            </h2>
            <p className="text-xs text-gray-500 mt-1 max-w-2xl">
              All {cloverItems.length} menu items ready for Clover webhook connection. Click <strong>Edit Recipe</strong> on any item to map raw ingredients or hand-cooked jellies per serving.
            </p>
          </div>

          <button
            onClick={() => setShowAddItemModal(true)}
            className="inline-flex items-center gap-2 bg-[#e85d04] hover:bg-[#d45203] text-white text-xs sm:text-sm font-bold px-4 py-2.5 rounded-xl shadow-xs transition-all active:scale-98 shrink-0"
          >
            <span>＋</span> Add Clover Item
          </button>
        </div>

        {/* Category Filter Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pt-1">
          {MENU_CATEGORIES.map((cat) => {
            const isActive = selectedCategory === cat
            const count =
              cat === 'All'
                ? cloverItems.length
                : cloverItems.filter((i) => i.category === cat).length
            return (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 ${
                  isActive
                    ? 'bg-gray-900 text-white shadow-xs'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200/80 hover:text-gray-900'
                }`}
              >
                <span>{cat}</span>
                <span
                  className={`px-1.5 py-0.5 rounded-md text-[10px] ${
                    isActive ? 'bg-white/20 text-white' : 'bg-white text-gray-600'
                  }`}
                >
                  {count}
                </span>
              </button>
            )
          })}
        </div>

        {/* Search & Mapping Filter Bar */}
        <div className="flex flex-col sm:flex-row items-center gap-3">
          <div className="relative flex-1 w-full">
            <input
              type="text"
              placeholder="Search menu item (e.g. Chè Thai, Matcha, B1, CHE-1A)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2 text-xs text-gray-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#e85d04]"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-2 text-xs text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            )}
          </div>

          <div className="flex items-center gap-1.5 w-full sm:w-auto">
            {(['ALL', 'UNMAPPED', 'MAPPED'] as const).map((status) => (
              <button
                key={status}
                type="button"
                onClick={() => setMappingFilter(status)}
                className={`px-3 py-2 rounded-xl text-xs font-bold border transition-all ${
                  mappingFilter === status
                    ? 'bg-orange-50 text-[#e85d04] border-orange-200'
                    : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                }`}
              >
                {status === 'ALL'
                  ? 'All Items'
                  : status === 'UNMAPPED'
                  ? 'Needs Recipe'
                  : 'Mapped'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* MOBILE CARD VIEW: Clover Items for phones */}
      <div className="block md:hidden space-y-3">
        <div className="flex items-center justify-between px-1">
          <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">
            Menu Items ({filteredCloverItems.length})
          </h3>
          <span className="text-[11px] text-gray-400">Mobile View</span>
        </div>
        {filteredCloverItems.map((item) => (
          <div
            key={item.id}
            className="bg-white rounded-2xl border border-gray-200/80 shadow-xs p-4 space-y-3"
          >
            <div className="flex items-start justify-between">
              <div>
                <h4 className="font-extrabold text-gray-900 text-sm">{item.name}</h4>
                <p className="text-[11px] text-gray-400 mt-0.5">
                  ID: <span className="font-mono font-semibold text-gray-600">{item.clover_id || 'N/A'}</span> · {item.category}
                </p>
              </div>
              <span className="text-sm font-extrabold text-gray-900">
                ${item.price.toFixed(2)}
              </span>
            </div>

            <div>
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1.5">
                Recipe Ingredients
              </span>
              <div className="flex flex-wrap gap-1.5">
                {item.recipe_ingredients && item.recipe_ingredients.length > 0 ? (
                  item.recipe_ingredients.map((rec) => {
                    const ingName = rec.ingredient?.name || 'Item'
                    const unit = rec.ingredient?.unit || ''
                    return (
                      <span
                        key={rec.id}
                        className="inline-flex items-center gap-1 text-[11px] font-medium bg-orange-50 text-orange-800 border border-orange-200/60 px-2 py-0.5 rounded-md"
                      >
                        <span>{ingName}:</span>
                        <strong className="font-bold">{rec.quantity_required} {unit}</strong>
                      </span>
                    )
                  })
                ) : (
                  <span className="text-xs text-gray-400 italic">No ingredients mapped yet</span>
                )}
              </div>
            </div>

            <button
              type="button"
              onClick={() => setSelectedItemForRecipe(item)}
              className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl border border-orange-200 bg-orange-50/70 text-[#e85d04] hover:bg-orange-100 font-bold text-xs transition-all active:scale-98"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 20h9"/>
                <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
              </svg>
              Edit Recipe
            </button>
          </div>
        ))}
      </div>

      {/* Wide Desktop Data Table */}
      <div className="hidden md:block bg-white rounded-2xl border border-gray-200/80 shadow-xs overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wider">
            Active Menu Items ({filteredCloverItems.length} of {cloverItems.length})
          </h3>
          <span className="text-xs text-gray-400 font-medium">Clover Webhook Ready · Desktop Data Grid</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50/70 text-gray-600 text-xs font-bold uppercase tracking-wider border-b border-gray-100">
                <th className="py-3 px-5">Item Name</th>
                <th className="py-3 px-4">Clover ID</th>
                <th className="py-3 px-4">Category</th>
                <th className="py-3 px-4">Price</th>
                <th className="py-3 px-5">Mapped Recipe Ingredients</th>
                <th className="py-3 px-5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-sm">
              {filteredCloverItems.map((item) => (
                <tr key={item.id} className="hover:bg-gray-50/60 transition-colors">
                  <td className="py-3.5 px-5 font-bold text-gray-900">
                    {item.name}
                  </td>
                  <td className="py-3.5 px-4 font-mono text-xs text-gray-500">
                    <span className="bg-gray-100 px-2 py-0.5 rounded-md font-semibold text-gray-700">
                      {item.clover_id || 'N/A'}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 text-xs font-semibold text-gray-600">
                    {item.category}
                  </td>
                  <td className="py-3.5 px-4 font-bold text-gray-800">
                    ${item.price.toFixed(2)}
                  </td>
                  <td className="py-3.5 px-5">
                    <div className="flex flex-wrap gap-1.5 max-w-md">
                      {item.recipe_ingredients && item.recipe_ingredients.length > 0 ? (
                        item.recipe_ingredients.map((rec) => {
                          const ingName = rec.ingredient?.name || 'Item'
                          const unit = rec.ingredient?.unit || ''
                          return (
                            <span
                              key={rec.id}
                              className="inline-flex items-center gap-1 text-[11px] font-medium bg-orange-50 text-orange-800 border border-orange-200/60 px-2 py-0.5 rounded-md"
                            >
                              <span>{ingName}:</span>
                              <strong className="font-bold">{rec.quantity_required} {unit}</strong>
                            </span>
                          )
                        })
                      ) : (
                        <span className="text-xs text-gray-400 italic">
                          No ingredients mapped yet
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="py-3.5 px-5 text-right">
                    <button
                      onClick={() => setSelectedItemForRecipe(item)}
                      className="inline-flex items-center gap-1.5 text-xs font-bold text-[#e85d04] hover:text-[#c44f04] bg-orange-50/70 hover:bg-orange-100 border border-orange-200/80 px-3 py-1.5 rounded-xl transition-all"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 20h9"/>
                        <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
                      </svg>
                      Edit Recipe
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Direct Ingredient Deficit Engine (Clover Sales Simulator & Calculator) */}
      <div className="bg-white rounded-2xl border border-gray-200/80 shadow-xs p-6 space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 border-b border-gray-100 pb-4">
          <div>
            <h3 className="text-lg font-extrabold text-gray-900 tracking-tight flex items-center gap-2">
              <span>⚡</span> Clover Sales Deficit & Depletion Calculator
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">
              Simulate or record POS item sales count to instantly calculate raw ingredient depletion and identify deficit bottlenecks.
            </p>
          </div>

          {deficitAnalysis.length > 0 && (
            <button
              onClick={handleCommitSalesDeduction}
              disabled={isCommittingSales}
              className="bg-[#2e7d32] hover:bg-[#256829] text-white text-xs font-bold px-4 py-2.5 rounded-xl shadow-xs active:scale-98 transition-all disabled:opacity-50 shrink-0"
            >
              {isCommittingSales ? 'Deducting Inventory...' : 'Deduct Sales From Inventory'}
            </button>
          )}
        </div>

        {salesSuccessMsg && (
          <div className="p-3 bg-green-50 border border-green-200 rounded-xl text-green-800 text-xs font-medium">
            ✓ {salesSuccessMsg}
          </div>
        )}

        {salesErrorMsg && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-600 text-xs font-medium">
            {salesErrorMsg}
          </div>
        )}

        {/* Inputs Grid for Clover Items Sales Volume */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {cloverItems.map((item) => (
            <div key={item.id} className="bg-gray-50 border border-gray-200/80 rounded-xl p-3 space-y-1.5">
              <span className="text-xs font-bold text-gray-800 line-clamp-1" title={item.name}>
                {item.name}
              </span>
              <div className="flex items-center gap-1.5">
                <input
                  type="number"
                  min="0"
                  placeholder="0 sold"
                  value={salesInputs[item.id] || ''}
                  onChange={(e) => {
                    const val = parseInt(e.target.value) || 0
                    setSalesInputs((prev) => ({ ...prev, [item.id]: val }))
                  }}
                  className="w-full bg-white border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs text-gray-900 font-bold focus:outline-none focus:ring-2 focus:ring-[#e85d04]"
                />
                <span className="text-[11px] text-gray-500 font-medium">units</span>
              </div>
            </div>
          ))}
        </div>

        {/* Deficit Calculation Results Grid */}
        {deficitAnalysis.length > 0 ? (
          <div className="space-y-3 pt-2">
            <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider">
              Projected Deficit & Inventory Balance
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {deficitAnalysis.map((item) => (
                <div
                  key={item.ingredientId}
                  className={`p-4 rounded-xl border transition-all ${
                    item.isDeficit
                      ? 'bg-red-50/70 border-red-200 shadow-2xs'
                      : 'bg-green-50/50 border-green-200'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h5 className="text-sm font-bold text-gray-900">{item.name}</h5>
                      <p className="text-xs text-gray-500 mt-0.5">
                        Current: <strong>{item.currentStock} {item.unit}</strong> · Need: <strong>{item.totalRequired} {item.unit}</strong>
                      </p>
                    </div>
                    {item.isDeficit ? (
                      <span className="bg-red-100 text-red-700 text-[10px] font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider">
                        Deficit
                      </span>
                    ) : (
                      <span className="bg-green-100 text-green-700 text-[10px] font-bold px-2 py-0.5 rounded-full">
                        Covered
                      </span>
                    )}
                  </div>

                  <div className="mt-3 pt-2 border-t border-gray-200/60 flex items-center justify-between text-xs">
                    <span className="text-gray-600">Remaining Balance:</span>
                    <span className={`font-extrabold ${item.isDeficit ? 'text-red-600' : 'text-[#2e7d32]'}`}>
                      {item.balance} {item.unit}
                    </span>
                  </div>

                  {item.isDeficit && (
                    <div className="mt-1 text-[11px] text-red-600 font-semibold">
                      Shortfall: {item.deficitAmount} {item.unit} (~${item.estimatedCost} replenishment)
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="text-center py-4 bg-gray-50/50 rounded-xl border border-dashed border-gray-200">
            <p className="text-xs text-gray-500">
              Enter sales quantities above to calculate live ingredient deficits and test inventory sufficiency.
            </p>
          </div>
        )}
      </div>

      {/* Modal: Edit Recipe Ingredients */}
      {selectedItemForRecipe && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-gray-100 space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-gray-900">
                  Recipe for: {selectedItemForRecipe.name}
                </h3>
                <p className="text-xs text-gray-500">
                  Required ingredients per serving ({selectedItemForRecipe.clover_id})
                </p>
              </div>
              <button
                onClick={() => setSelectedItemForRecipe(null)}
                className="text-gray-400 hover:text-gray-600 p-1 text-lg font-bold"
              >
                ✕
              </button>
            </div>

            {/* List of currently mapped ingredients */}
            <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
              {selectedItemForRecipe.recipe_ingredients && selectedItemForRecipe.recipe_ingredients.length > 0 ? (
                selectedItemForRecipe.recipe_ingredients.map((rec) => (
                  <div
                    key={rec.id}
                    className="flex items-center justify-between bg-gray-50 px-3.5 py-2.5 rounded-xl border border-gray-200/70"
                  >
                    <div>
                      <span className="text-xs font-bold text-gray-800">
                        {rec.ingredient?.name || 'Ingredient'}
                      </span>
                      <p className="text-[11px] text-gray-500">
                        {rec.quantity_required} {rec.ingredient?.unit || 'units'} per order
                      </p>
                    </div>
                    <button
                      onClick={() => handleRemoveIngredient(rec.id)}
                      className="text-red-500 hover:text-red-700 text-xs font-semibold px-2 py-1 rounded-lg hover:bg-red-50 transition-colors"
                    >
                      Remove
                    </button>
                  </div>
                ))
              ) : (
                <p className="text-xs text-gray-400 py-3 text-center">No ingredients mapped yet.</p>
              )}
            </div>

            {/* Form to attach a new ingredient */}
            <form onSubmit={handleAddIngredientToRecipe} className="border-t border-gray-100 pt-4 space-y-3">
              <span className="text-xs font-bold text-gray-700 uppercase tracking-wider block">
                Add Ingredient to Recipe
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <select
                  value={selectedIngredientToAdd}
                  onChange={(e) => setSelectedIngredientToAdd(e.target.value)}
                  className="bg-white border border-gray-200 rounded-xl px-3 py-2 text-xs text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#e85d04]"
                  required
                >
                  <option value="">Select ingredient...</option>
                  {ingredients.map((ing) => {
                    const isJelly = ing.name.toLowerCase().includes('jelly') || ing.category === 'Hand-Cooked Jellies'
                    return (
                      <option key={ing.id} value={ing.id}>
                        {ing.name} ({ing.unit}){isJelly ? ' · 🍳 Hand-Cooked' : ''}
                      </option>
                    )
                  })}
                </select>

                <div className="flex gap-2">
                  <input
                    type="number"
                    step="0.01"
                    min="0.001"
                    placeholder="Qty req"
                    value={qtyToAdd}
                    onChange={(e) => setQtyToAdd(e.target.value)}
                    className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-xs text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#e85d04]"
                    required
                  />
                  <button
                    type="submit"
                    disabled={isAddingIngredient}
                    className="bg-[#e85d04] hover:bg-[#d45203] text-white text-xs font-bold px-3 py-2 rounded-xl shrink-0"
                  >
                    Add
                  </button>
                </div>
              </div>
            </form>

            <div className="pt-2 text-right">
              <button
                onClick={() => setSelectedItemForRecipe(null)}
                className="bg-gray-100 hover:bg-gray-200 text-gray-800 text-xs font-bold px-4 py-2 rounded-xl transition-all"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Add New Clover Item */}
      {showAddItemModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-gray-100 space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <h3 className="text-base font-bold text-gray-900">Add Clover POS Item</h3>
              <button
                onClick={() => setShowAddItemModal(false)}
                className="text-gray-400 hover:text-gray-600 text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateCloverItem} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                  Item Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Chè Thái Đặc Biệt"
                  value={newItemName}
                  onChange={(e) => setNewItemName(e.target.value)}
                  className="w-full bg-white border border-gray-200 rounded-xl px-3.5 py-2.5 text-xs text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#e85d04]"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                  Clover Item ID
                </label>
                <input
                  type="text"
                  placeholder="e.g. CLV-006"
                  value={newItemCloverId}
                  onChange={(e) => setNewItemCloverId(e.target.value)}
                  className="w-full bg-white border border-gray-200 rounded-xl px-3.5 py-2.5 text-xs text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#e85d04]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                    Price ($)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="7.50"
                    value={newItemPrice}
                    onChange={(e) => setNewItemPrice(e.target.value)}
                    className="w-full bg-white border border-gray-200 rounded-xl px-3.5 py-2.5 text-xs text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#e85d04]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                    Category
                  </label>
                  <select
                    value={newItemCategory}
                    onChange={(e) => setNewItemCategory(e.target.value)}
                    className="w-full bg-white border border-gray-200 rounded-xl px-3.5 py-2.5 text-xs text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#e85d04]"
                  >
                    {MENU_CATEGORIES.filter((c) => c !== 'All').map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowAddItemModal(false)}
                  className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold py-2.5 rounded-xl transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingItem}
                  className="flex-1 bg-[#e85d04] hover:bg-[#d45203] text-white text-xs font-bold py-2.5 rounded-xl shadow-xs transition-all disabled:opacity-50"
                >
                  {isSavingItem ? 'Saving...' : 'Save Item'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
