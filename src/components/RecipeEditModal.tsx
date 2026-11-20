'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  removeRecipeIngredientAction,
  upsertRecipeIngredientAction,
} from '@/app/actions/recipes'
import { RecipeIngredientOption } from '@/lib/recipes-data'
import { CloverItem, RecipeIngredient } from '@/lib/types'

interface Props {
  item: CloverItem
  ingredients: RecipeIngredientOption[]
  onClose: () => void
  onItemUpdated: (updated: CloverItem) => void
}

export default function RecipeEditModal({
  item,
  ingredients,
  onClose,
  onItemUpdated,
}: Props) {
  const router = useRouter()
  const [selectedIngredientId, setSelectedIngredientId] = useState('')
  const [qtyToAdd, setQtyToAdd] = useState('')
  const [isAdding, setIsAdding] = useState(false)
  const [error, setError] = useState('')

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedIngredientId || !qtyToAdd) return

    setIsAdding(true)
    setError('')
    try {
      const qty = parseFloat(qtyToAdd)
      const res = await upsertRecipeIngredientAction({
        cloverItemId: item.id,
        ingredientId: selectedIngredientId,
        quantityRequired: qty,
      })

      if (!res.success || !res.data) {
        setError(res.error || 'Could not add ingredient')
        return
      }

      const savedRow = res.data as unknown as RecipeIngredient
      const updatedRecipes = [
        ...(item.recipe_ingredients?.filter((r) => r.ingredient_id !== selectedIngredientId) || []),
        savedRow,
      ]

      onItemUpdated({ ...item, recipe_ingredients: updatedRecipes })
      setSelectedIngredientId('')
      setQtyToAdd('')
      router.refresh()
    } finally {
      setIsAdding(false)
    }
  }

  async function handleRemove(recipeIngredientId: string) {
    setError('')
    const res = await removeRecipeIngredientAction(recipeIngredientId)
    if (!res.success) {
      setError(res.error || 'Could not remove ingredient')
      return
    }

    const updatedRecipes =
      item.recipe_ingredients?.filter((r) => r.id !== recipeIngredientId) || []

    onItemUpdated({ ...item, recipe_ingredients: updatedRecipes })
    router.refresh()
  }

  const selectedIng = ingredients.find((i) => i.id === selectedIngredientId)

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-gray-100 space-y-5 animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-gray-100 pb-3">
          <div>
            <h3 className="text-base font-extrabold text-gray-900">
              Recipe: {item.name}
            </h3>
            <p className="text-xs text-gray-500">
              How much of each ingredient goes into 1 serving ({item.clover_id || 'Menu item'})
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-500 text-sm font-bold"
          >
            ✕
          </button>
        </div>

        {error && (
          <div className="p-2.5 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 font-medium">
            {error}
          </div>
        )}

        <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
          {item.recipe_ingredients && item.recipe_ingredients.length > 0 ? (
            item.recipe_ingredients.map((rec) => (
              <div
                key={rec.id}
                className="flex items-center justify-between bg-gray-50 px-3.5 py-2.5 rounded-xl border border-gray-200/70"
              >
                <div>
                  <span className="text-xs font-bold text-gray-800">
                    {rec.ingredient?.name || 'Ingredient'}
                  </span>
                  <p className="text-[11px] text-gray-500">
                    {rec.quantity_required} {rec.ingredient?.unit || 'units'} per serving
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleRemove(rec.id)}
                  className="text-red-500 hover:text-red-700 text-xs font-semibold px-2.5 py-1 rounded-lg hover:bg-red-50 transition-colors"
                >
                  Remove
                </button>
              </div>
            ))
          ) : (
            <p className="text-xs text-gray-400 py-4 text-center bg-gray-50 rounded-xl border border-dashed border-gray-200">
              No ingredients added yet. Pick one below.
            </p>
          )}
        </div>

        <form onSubmit={handleAdd} className="border-t border-gray-100 pt-4 space-y-3">
          <span className="text-xs font-bold text-gray-700 uppercase tracking-wider block">
            Add Ingredient to Serving
          </span>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <select
              value={selectedIngredientId}
              onChange={(e) => setSelectedIngredientId(e.target.value)}
              className="bg-white border border-gray-200 rounded-xl px-3 py-2.5 text-xs text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#e85d04]"
              required
            >
              <option value="">Choose ingredient...</option>
              {ingredients.map((ing) => {
                const isJelly =
                  ing.name.toLowerCase().includes('jelly') ||
                  ing.category === 'Hand-Cooked Jellies'
                return (
                  <option key={ing.id} value={ing.id}>
                    {ing.name} ({ing.unit}){isJelly ? ' · 🍳 In-House' : ''}
                  </option>
                )
              })}
            </select>

            <div className="flex gap-2">
              <input
                type="number"
                step="0.001"
                min="0.001"
                placeholder={selectedIng ? `Amt (${selectedIng.unit})` : 'Amount'}
                value={qtyToAdd}
                onChange={(e) => setQtyToAdd(e.target.value)}
                className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2.5 text-xs text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#e85d04]"
                required
              />
              <button
                type="submit"
                disabled={isAdding}
                className="bg-[#e85d04] hover:bg-[#d45203] text-white text-xs font-bold px-4 py-2.5 rounded-xl shrink-0 disabled:opacity-50"
              >
                {isAdding ? '...' : 'Add'}
              </button>
            </div>
          </div>
        </form>

        <div className="pt-1 text-right">
          <button
            type="button"
            onClick={onClose}
            className="bg-gray-900 hover:bg-black text-white text-xs font-bold px-5 py-2.5 rounded-xl transition-all"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  )
}
