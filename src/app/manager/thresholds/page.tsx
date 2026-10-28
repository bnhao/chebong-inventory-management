import { fetchAllIngredientsWithBatches } from '@/lib/data'
import ThresholdsClient from './ThresholdsClient'
import { Ingredient } from '@/lib/types'

export const dynamic = 'force-dynamic'

export interface IngredientThresholdRow extends Ingredient {
  currentStock: number
  totalValue: number
  activeBatchesCount: number
}

async function getThresholdsData(): Promise<IngredientThresholdRow[]> {
  const ingredientsWithBatches = await fetchAllIngredientsWithBatches()

  return ingredientsWithBatches.map((ing) => {
    const currentStock = ing.currentStock || 0
    const unitCost = Number(ing.cost_per_unit) || 0
    const totalValue = currentStock * unitCost
    const activeBatchesCount = (ing.batches || []).filter((b) => b.quantityRemaining > 0).length

    return {
      id: ing.id,
      name: ing.name,
      unit: ing.unit,
      low_stock_threshold: ing.low_stock_threshold,
      spoiled_time_limit_days: ing.spoiled_time_limit_days,
      daily_usage_rate: ing.daily_usage_rate,
      cost_per_unit: ing.cost_per_unit,
      description: ing.description,
      created_at: ing.created_at,
      currentStock,
      totalValue,
      activeBatchesCount,
    }
  })
}

export default async function ThresholdsPage() {
  const ingredients = await getThresholdsData()
  return <ThresholdsClient initialIngredients={ingredients} />
}
