import { fetchAllIngredientsWithBatches } from '@/lib/data'
import GroceriesClient, { GroceryItem } from '@/app/staff/groceries/GroceriesClient'

export const dynamic = 'force-dynamic'

async function getSuggestedPurchases(): Promise<GroceryItem[]> {
  const ingredientsWithBatches = await fetchAllIngredientsWithBatches()

  return ingredientsWithBatches.map((ing) => {
    const totalStock = Number(ing.currentStock) || 0
    const dailyUsage = Number(ing.daily_usage_rate) || 0
    const daysLeft = dailyUsage > 0 ? totalStock / dailyUsage : 99
    const minThreshold = Number(ing.low_stock_threshold) || 0
    const parLevel = Math.max(minThreshold * 2, dailyUsage * 7, 3)
    const suggestedQty = Math.max(0, Math.ceil(parLevel - totalStock))
    const isBelowThreshold = totalStock <= minThreshold

    let department = ing.category
    if (!department) {
      const n = ing.name.toLowerCase()
      if (n.includes('milk') || n.includes('cream') || n.includes('condensed')) {
        department = 'Dairy & Milk'
      } else if (n.includes('durian') || n.includes('jackfruit') || n.includes('avocado') || n.includes('fruit')) {
        department = 'Produce & Fruits'
      } else if (n.includes('jelly') || n.includes('bean') || n.includes('tapioca') || n.includes('pearl')) {
        department = 'Jellies & Beans'
      } else {
        department = 'Dry Goods & Packaging'
      }
    }

    return {
      id: ing.id,
      name: ing.name,
      unit: ing.unit,
      department,
      totalStock,
      daysLeft,
      dailyUsage,
      shelfLifeDays: Number(ing.spoiled_time_limit_days) || 7,
      lowStockThreshold: minThreshold,
      parLevel,
      suggestedQty: suggestedQty > 0 ? suggestedQty : 1,
      isBelowThreshold,
      costPerUnit: Number(ing.cost_per_unit) || 0,
    }
  })
}

export default async function ManagerGroceriesPage() {
  const ingredients = await getSuggestedPurchases()
  return <GroceriesClient ingredients={ingredients} isManagerView={true} />
}
