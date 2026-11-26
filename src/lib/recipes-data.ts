import { createClient } from '@/lib/supabase/server'
import { fetchAllIngredientsWithBatches } from '@/lib/data'
import { CloverItem } from '@/lib/types'

export interface RecipeIngredientOption {
  id: string
  name: string
  unit: string
  category?: string
  cost_per_unit: number
  low_stock_threshold: number
  daily_usage_rate: number
  currentStock: number
}

export async function getRecipesAndIngredientsData(): Promise<{
  cloverItems: CloverItem[]
  ingredientsWithStock: RecipeIngredientOption[]
}> {
  const supabase = await createClient()

  const [{ data: cloverItemsRaw }, ingredientsWithBatches] = await Promise.all([
    supabase
      .from('clover_items')
      .select(`
        id,
        name,
        clover_id,
        price,
        category,
        is_active,
        created_at,
        recipe_ingredients (
          id,
          clover_item_id,
          ingredient_id,
          quantity_required,
          ingredient:ingredients (
            id,
            name,
            unit,
            cost_per_unit,
            low_stock_threshold
          )
        )
      `)
      .eq('is_active', true)
      .order('clover_id', { ascending: true }),
    fetchAllIngredientsWithBatches(),
  ])

  const ingredientsWithStock: RecipeIngredientOption[] = ingredientsWithBatches.map((ing) => ({
    id: ing.id,
    name: ing.name,
    unit: ing.unit,
    category: ing.category || '',
    cost_per_unit: Number(ing.cost_per_unit) || 0,
    low_stock_threshold: Number(ing.low_stock_threshold) || 0,
    daily_usage_rate: Number(ing.daily_usage_rate) || 0,
    currentStock: ing.currentStock || 0,
  }))

  const cloverItems: CloverItem[] = ((cloverItemsRaw || []) as unknown as CloverItem[]).map(
    (item) => ({
      ...item,
      price: Number(item.price) || 0,
    })
  )

  return {
    cloverItems,
    ingredientsWithStock,
  }
}
