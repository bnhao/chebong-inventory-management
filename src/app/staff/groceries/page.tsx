import { fetchAllIngredientsWithBatches } from '@/lib/data'
import GroceriesClient from './GroceriesClient'

export const dynamic = 'force-dynamic'

async function getSuggestedPurchases() {
  const ingredientsWithBatches = await fetchAllIngredientsWithBatches()

  return ingredientsWithBatches.map((ing) => {
    const totalStock = ing.currentStock || 0
    const dailyUsage = Number(ing.daily_usage_rate) || 0
    const daysLeft = dailyUsage > 0 ? totalStock / dailyUsage : 99

    return {
      id: ing.id,
      name: ing.name,
      unit: ing.unit,
      totalStock,
      daysLeft,
      dailyUsage,
      shelfLifeDays: Number(ing.spoiled_time_limit_days) || 7,
      lowStockThreshold: Number(ing.low_stock_threshold) || 0,
      costPerUnit: Number(ing.cost_per_unit) || 0,
    }
  })
}

export default async function GroceriesPage() {
  const ingredients = await getSuggestedPurchases()
  return <GroceriesClient ingredients={ingredients} />
}
