import { fetchAllIngredientsWithBatches } from '@/lib/data'
import { createClient } from '@/lib/supabase/server'
import GroceriesClient, { GroceryItem } from './GroceriesClient'

export const dynamic = 'force-dynamic'

async function getSuggestedPurchases(): Promise<GroceryItem[]> {
  const supabase = await createClient()
  const [ingredientsWithBatches, { data: recentTx }] = await Promise.all([
    fetchAllIngredientsWithBatches(),
    supabase
      .from('inventory_transactions')
      .select('ingredient_id, transaction_type, quantity_change, created_at')
      .order('created_at', { ascending: false })
      .limit(200),
  ])

  const wasteByIngredient: Record<string, number> = {}
  const usageByIngredient: Record<string, number> = {}

  for (const tx of recentTx || []) {
    const ingId = tx.ingredient_id as string
    const qty = Math.abs(Number(tx.quantity_change) || 0)
    if (tx.transaction_type === 'WASTE') {
      wasteByIngredient[ingId] = (wasteByIngredient[ingId] || 0) + qty
    } else if (tx.transaction_type === 'SALE' || tx.transaction_type === 'USAGE') {
      usageByIngredient[ingId] = (usageByIngredient[ingId] || 0) + qty
    }
  }

  return ingredientsWithBatches.map((ing) => {
    const totalStock = Number(ing.currentStock) || 0
    const dailyUsage = Number(ing.daily_usage_rate) || 0
    const daysLeft = dailyUsage > 0 ? totalStock / dailyUsage : totalStock > 0 ? 14 : 0
    const minThreshold = Number(ing.low_stock_threshold) || 0
    const shelfLifeDays = Number(ing.spoiled_time_limit_days) || 7
    const parLevel = Math.max(minThreshold * 2, dailyUsage * Math.min(7, shelfLifeDays), 3)
    const suggestedQty = Math.max(0, Math.ceil(parLevel - totalStock))
    const isBelowThreshold = totalStock <= minThreshold

    // Department grouping fallback
    const n = ing.name.toLowerCase()
    const isJelly = n.includes('jelly')
    let department = ing.category
    if (!department || (isJelly && department === 'Jellies & Beans')) {
      if (isJelly) {
        department = 'Hand-Cooked Jellies'
      } else if (n.includes('milk') || n.includes('cream') || n.includes('condensed')) {
        department = 'Dairy & Milk'
      } else if (n.includes('durian') || n.includes('jackfruit') || n.includes('avocado') || n.includes('fruit')) {
        department = 'Produce & Fruits'
      } else if (n.includes('bean') || n.includes('tapioca') || n.includes('pearl') || n.includes('sago')) {
        department = 'Beans & Pearls'
      } else {
        department = 'Dry Goods & Packaging'
      }
    }

    const isHandCooked = isJelly || department === 'Hand-Cooked Jellies'

    return {
      id: ing.id,
      name: ing.name,
      unit: ing.unit,
      department,
      isHandCooked,
      totalStock,
      daysLeft,
      dailyUsage,
      shelfLifeDays,
      lowStockThreshold: minThreshold,
      parLevel: Math.round(parLevel * 10) / 10,
      suggestedQty: suggestedQty > 0 ? suggestedQty : 1,
      isBelowThreshold,
      costPerUnit: Number(ing.cost_per_unit) || 0,
      recentWasteQty: Math.round((wasteByIngredient[ing.id] || 0) * 100) / 100,
      recentUsageQty: Math.round((usageByIngredient[ing.id] || 0) * 100) / 100,
    }
  })
}

export default async function GroceriesPage() {
  const ingredients = await getSuggestedPurchases()
  return <GroceriesClient ingredients={ingredients} />
}
