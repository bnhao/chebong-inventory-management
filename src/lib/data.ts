import { createClient } from '@/lib/supabase/server'
import { AlertItem, Ingredient } from '@/lib/types'

export interface IngredientWithBatches extends Ingredient {
  currentStock: number
  batches: Array<{
    id: string
    batchCode: string | null
    quantityReceived: number
    quantityRemaining: number
    expirationDate: string | null
    status: string
    createdAt: string
  }>
}

export async function fetchAllIngredientsWithBatches(): Promise<IngredientWithBatches[]> {
  try {
    const supabase = await createClient()

    // 1. Fetch ingredients
    const { data: rawIngredients, error: ingErr } = await supabase
      .from('ingredients')
      .select('*')
      .order('name', { ascending: true })

    if (ingErr || !rawIngredients) {
      console.error('Error fetching ingredients:', ingErr)
      return []
    }

    // 2. Fetch active inventory batches
    const { data: rawBatches } = await supabase
      .from('inventory_batches')
      .select('*')
      .gt('quantity_remaining', 0)
      .order('expiration_date', { ascending: true })

    interface DbIngredient {
      id: string
      name: string
      unit: string
      low_stock_threshold: number
      spoiled_time_limit_days: number
      daily_usage_rate: number
      cost_per_unit?: number
      description?: string | null
      created_at: string
      current_stock?: number
    }

    interface DbBatch {
      id: string
      ingredient_id: string
      batch_code: string | null
      quantity_received: number
      quantity_remaining: number
      expiration_date: string | null
      status: string
      created_at: string
    }

    const batchesList: DbBatch[] = (rawBatches || []) as unknown as DbBatch[]
    const ingredientsList: DbIngredient[] = (rawIngredients || []) as unknown as DbIngredient[]

    return ingredientsList.map((ing: DbIngredient) => {
      const ingredientBatches = batchesList
        .filter((b: DbBatch) => b.ingredient_id === ing.id)
        .map((b: DbBatch) => ({
          id: b.id,
          batchCode: b.batch_code,
          quantityReceived: Number(b.quantity_received) || 0,
          quantityRemaining: Number(b.quantity_remaining) || 0,
          expirationDate: b.expiration_date,
          status: b.status || 'ACTIVE',
          createdAt: b.created_at,
        }))

      // current_stock is maintained by DB trigger, or fallback to sum of batches
      const stock = Number(ing.current_stock) >= 0
        ? Number(ing.current_stock)
        : ingredientBatches.reduce((sum: number, b) => sum + b.quantityRemaining, 0)

      return {
        id: ing.id,
        name: ing.name,
        unit: ing.unit || 'kg',
        low_stock_threshold: Number(ing.low_stock_threshold) || 0,
        spoiled_time_limit_days: Number(ing.spoiled_time_limit_days) || 7,
        daily_usage_rate: Number(ing.daily_usage_rate) || 0,
        cost_per_unit: Number(ing.cost_per_unit) || 0,
        description: ing.description || null,
        created_at: ing.created_at,
        currentStock: stock,
        batches: ingredientBatches,
      }
    })
  } catch (err: unknown) {
    console.error('fetchAllIngredientsWithBatches error:', err)
    return []
  }
}

export function computeAlerts(ingredients: IngredientWithBatches[]): AlertItem[] {
  const alerts: AlertItem[] = []
  const now = new Date()

  for (const ing of ingredients) {
    const minThreshold = ing.low_stock_threshold || 0
    const currentStock = ing.currentStock

    // 1. Low stock alert
    if (currentStock <= minThreshold) {
      alerts.push({
        id: `low-${ing.id}`,
        ingredientName: ing.name,
        type: 'low_stock',
        message: `${ing.name} is low`,
        subMessage: `${currentStock} ${ing.unit} left · min ${minThreshold} ${ing.unit}`,
        severity: currentStock === 0 ? 'critical' : 'warning',
        currentStock,
        threshold: minThreshold,
        unit: ing.unit,
      })
    }

    // 2. Batch expiration / spoiled alerts
    for (const batch of ing.batches) {
      if (!batch.expirationDate || batch.quantityRemaining <= 0) continue

      const expDate = new Date(batch.expirationDate)
      const diffHours = (expDate.getTime() - now.getTime()) / (1000 * 60 * 60)
      const daysLeft = Math.ceil(diffHours / 24)

      if (diffHours < 0) {
        alerts.push({
          id: `spoiled-${batch.id}`,
          ingredientName: ing.name,
          type: 'spoiled',
          message: `${ing.name} is spoiled — discard`,
          subMessage: `Batch passed expiration limit (${expDate.toLocaleDateString()})`,
          severity: 'critical',
          daysLeft,
          unit: ing.unit,
        })
      } else if (diffHours <= 24) {
        alerts.push({
          id: `exp24-${batch.id}`,
          ingredientName: ing.name,
          type: 'expiring_soon',
          message: `${batch.quantityRemaining} ${ing.unit} of ${ing.name} expiring in 24 hrs`,
          subMessage: 'Use first · Walk-in fridge',
          severity: 'warning',
          daysLeft: 1,
          unit: ing.unit,
        })
      } else if (daysLeft <= ing.spoiled_time_limit_days && daysLeft <= 3) {
        alerts.push({
          id: `exp-${batch.id}`,
          ingredientName: ing.name,
          type: 'expiring_soon',
          message: `${ing.name} expiring soon`,
          subMessage: `${batch.quantityRemaining} ${ing.unit} at risk · expires in ${daysLeft} days`,
          severity: 'warning',
          daysLeft,
          unit: ing.unit,
        })
      }
    }
  }

  return alerts.sort((a, b) => {
    if (a.severity === 'critical' && b.severity !== 'critical') return -1
    if (b.severity === 'critical' && a.severity !== 'critical') return 1
    return 0
  })
}
