'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import RecipeEditModal from '@/components/RecipeEditModal'
import { createCloverItemAction } from '@/app/actions/recipes'
import { RecipeIngredientOption } from '@/lib/recipes-data'
import { CloverItem } from '@/lib/types'

interface Props {
  initialCloverItems: CloverItem[]
  ingredients: RecipeIngredientOption[]
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

  const [cloverItems, setCloverItems] = useState<CloverItem[]>(initialCloverItems)
  const [selectedItemForRecipe, setSelectedItemForRecipe] = useState<CloverItem | null>(null)

  useEffect(() => {
    setCloverItems(initialCloverItems)
    setSelectedItemForRecipe((prev) =>
      prev ? initialCloverItems.find((item) => item.id === prev.id) || null : null
    )
  }, [initialCloverItems])

  const [selectedCategory, setSelectedCategory] = useState<string>('All')
  const [searchQuery, setSearchQuery] = useState('')
  const [mappingFilter, setMappingFilter] = useState<'ALL' | 'UNMAPPED' | 'MAPPED'>('ALL')

  const [showAddItemModal, setShowAddItemModal] = useState(false)
  const [newItemName, setNewItemName] = useState('')
  const [newItemCloverId, setNewItemCloverId] = useState('')
  const [newItemPrice, setNewItemPrice] = useState('')
  const [newItemCategory, setNewItemCategory] = useState('Chè (Desserts)')
  const [isSavingItem, setIsSavingItem] = useState(false)
  const [itemModalError, setItemModalError] = useState('')

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

  async function handleCreateCloverItem(e: React.FormEvent) {
    e.preventDefault()
    if (!newItemName.trim()) return

    setIsSavingItem(true)
    setItemModalError('')
    try {
      const res = await createCloverItemAction({
        name: newItemName,
        cloverId: newItemCloverId,
        price: parseFloat(newItemPrice) || 0,
        category: newItemCategory,
      })

      if (!res.success || !res.data) {
        setItemModalError(res.error || 'Could not add menu item')
        return
      }

      setCloverItems((prev) => [...prev, res.data as CloverItem])
      setShowAddItemModal(false)
      setNewItemName('')
      setNewItemCloverId('')
      setNewItemPrice('')
      router.refresh()
    } finally {
      setIsSavingItem(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Link Banner to Close Day */}
      <Link
        href="/manager/close-day"
        className="block bg-linear-to-r from-orange-50 via-amber-50/70 to-orange-50 border border-orange-200/90 rounded-2xl p-4 hover:border-[#e85d04] transition-all shadow-2xs group"
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="text-2xl">📷</span>
            <div>
              <p className="text-sm font-extrabold text-gray-900 group-hover:text-[#e85d04] transition-colors">
                Closing out today&apos;s register? Use Close Day instead
              </p>
              <p className="text-xs text-gray-600">
                Snap a photo of your Clover sales report to subtract ingredients automatically.
              </p>
            </div>
          </div>
          <span className="text-xs sm:text-sm font-extrabold text-[#e85d04] shrink-0">
            Close Day →
          </span>
        </div>
      </Link>

      {/* Top Controls & Header */}
      <div className="bg-white p-5 rounded-2xl border border-gray-200/80 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-extrabold text-gray-900 tracking-tight">
              Menu &amp; Recipes
            </h2>
            <p className="text-xs text-gray-500 mt-1 max-w-2xl">
              Set which raw ingredients go into each of your {cloverItems.length} menu items so daily sales subtract the right amounts.
            </p>
          </div>

          <button
            type="button"
            onClick={() => {
              setItemModalError('')
              setShowAddItemModal(true)
            }}
            className="inline-flex items-center gap-2 bg-[#e85d04] hover:bg-[#d45203] text-white text-xs sm:text-sm font-bold px-4 py-2.5 rounded-xl shadow-xs transition-all active:scale-98 shrink-0"
          >
            <span>＋</span> Add Menu Item
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

        {/* Search & Filter Bar */}
        <div className="flex flex-col sm:flex-row items-center gap-3">
          <div className="relative flex-1 w-full">
            <input
              type="text"
              placeholder="Search menu item (e.g. Chè Thai, Matcha, B1)..."
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
                  : 'Ready'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Mobile Cards */}
      <div className="block md:hidden space-y-3">
        <div className="flex items-center justify-between px-1">
          <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">
            Menu Items ({filteredCloverItems.length})
          </h3>
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
                  {item.category} · {item.clover_id || 'No code'}
                </p>
              </div>
              <span className="text-sm font-extrabold text-gray-900">
                ${item.price.toFixed(2)}
              </span>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {item.recipe_ingredients && item.recipe_ingredients.length > 0 ? (
                item.recipe_ingredients.map((rec) => (
                  <span
                    key={rec.id}
                    className="inline-flex items-center gap-1 text-[11px] font-medium bg-orange-50 text-orange-800 border border-orange-200/60 px-2 py-0.5 rounded-md"
                  >
                    <span>{rec.ingredient?.name || 'Item'}:</span>
                    <strong className="font-bold">
                      {rec.quantity_required} {rec.ingredient?.unit || ''}
                    </strong>
                  </span>
                ))
              ) : (
                <span className="text-xs text-gray-400 italic">No recipe set yet</span>
              )}
            </div>

            <button
              type="button"
              onClick={() => setSelectedItemForRecipe(item)}
              className="w-full py-2.5 rounded-xl border border-orange-200 bg-orange-50/70 text-[#e85d04] hover:bg-orange-100 font-bold text-xs"
            >
              Edit Recipe
            </button>
          </div>
        ))}
      </div>

      {/* Desktop Table */}
      <div className="hidden md:block bg-white rounded-2xl border border-gray-200/80 shadow-xs overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wider">
            Menu Items ({filteredCloverItems.length} of {cloverItems.length})
          </h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50/70 text-gray-600 text-xs font-bold uppercase tracking-wider border-b border-gray-100">
                <th className="py-3 px-5">Item Name</th>
                <th className="py-3 px-4">Code</th>
                <th className="py-3 px-4">Category</th>
                <th className="py-3 px-4">Price</th>
                <th className="py-3 px-5">Ingredients Per Serving</th>
                <th className="py-3 px-5 text-right">Edit</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-sm">
              {filteredCloverItems.map((item) => (
                <tr key={item.id} className="hover:bg-gray-50/60 transition-colors">
                  <td className="py-3.5 px-5 font-bold text-gray-900">{item.name}</td>
                  <td className="py-3.5 px-4 font-mono text-xs text-gray-500">
                    <span className="bg-gray-100 px-2 py-0.5 rounded-md font-semibold text-gray-700">
                      {item.clover_id || 'N/A'}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 text-xs font-semibold text-gray-600">{item.category}</td>
                  <td className="py-3.5 px-4 font-bold text-gray-800">${item.price.toFixed(2)}</td>
                  <td className="py-3.5 px-5">
                    <div className="flex flex-wrap gap-1.5 max-w-md">
                      {item.recipe_ingredients && item.recipe_ingredients.length > 0 ? (
                        item.recipe_ingredients.map((rec) => (
                          <span
                            key={rec.id}
                            className="inline-flex items-center gap-1 text-[11px] font-medium bg-orange-50 text-orange-800 border border-orange-200/60 px-2 py-0.5 rounded-md"
                          >
                            <span>{rec.ingredient?.name || 'Item'}:</span>
                            <strong className="font-bold">
                              {rec.quantity_required} {rec.ingredient?.unit || ''}
                            </strong>
                          </span>
                        ))
                      ) : (
                        <span className="text-xs text-gray-400 italic">No recipe set yet</span>
                      )}
                    </div>
                  </td>
                  <td className="py-3.5 px-5 text-right">
                    <button
                      type="button"
                      onClick={() => setSelectedItemForRecipe(item)}
                      className="inline-flex items-center gap-1.5 text-xs font-bold text-[#e85d04] hover:text-[#c44f04] bg-orange-50/70 hover:bg-orange-100 border border-orange-200/80 px-3 py-1.5 rounded-xl transition-all"
                    >
                      Edit Recipe
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Shared Recipe Editor Modal */}
      {selectedItemForRecipe && (
        <RecipeEditModal
          item={selectedItemForRecipe}
          ingredients={ingredients}
          onClose={() => setSelectedItemForRecipe(null)}
          onItemUpdated={(updated) => {
            setSelectedItemForRecipe(updated)
            setCloverItems((prev) =>
              prev.map((item) => (item.id === updated.id ? updated : item))
            )
          }}
        />
      )}

      {/* Modal: Add New Menu Item */}
      {showAddItemModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-gray-100 space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <h3 className="text-base font-bold text-gray-900">Add Menu Item</h3>
              <button
                type="button"
                onClick={() => setShowAddItemModal(false)}
                className="text-gray-400 hover:text-gray-600 text-lg font-bold"
              >
                ✕
              </button>
            </div>

            {itemModalError && (
              <div className="p-2.5 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 font-medium">
                {itemModalError}
              </div>
            )}

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
                  Menu Code (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. CHE-8"
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
