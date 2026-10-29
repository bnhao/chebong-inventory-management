import { createClient } from '@/lib/supabase/server'
import { fetchAllIngredientsWithBatches } from '@/lib/data'
import RecipesClient from './RecipesClient'
import { CloverItem } from '@/lib/types'

export const dynamic = 'force-dynamic'

async function getRecipesData() {
  const supabase = await createClient()

  // 1. Fetch Clover Items with mapped recipe ingredients
  const { data: cloverItemsRaw } = await supabase
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
    .order('clover_id', { ascending: true })

  // 2. Fetch all ingredients with batches for deficit engine
  const ingredientsWithBatches = await fetchAllIngredientsWithBatches()

  const ingredientsWithStock = ingredientsWithBatches.map((ing) => ({
    id: ing.id,
    name: ing.name,
    unit: ing.unit,
    category: ing.category || '',
    cost_per_unit: Number(ing.cost_per_unit) || 0,
    low_stock_threshold: Number(ing.low_stock_threshold) || 0,
    daily_usage_rate: Number(ing.daily_usage_rate) || 0,
    currentStock: ing.currentStock || 0,
  }))

  // Normalize clover items
  const cloverItems: CloverItem[] = ((cloverItemsRaw || []) as unknown as CloverItem[]).map((item) => ({
    ...item,
    price: Number(item.price) || 0,
  }))

  return {
    cloverItems,
    ingredientsWithStock,
  }
}

export default async function RecipesPage() {
  const { cloverItems, ingredientsWithStock } = await getRecipesData()
  return (
    <RecipesClient
      initialCloverItems={cloverItems}
      ingredients={ingredientsWithStock}
    />
  )
}
