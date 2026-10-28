import { createClient } from '@/lib/supabase/server'
import { AlertItem, Ingredient } from '@/lib/types'
import { fetchAllIngredientsWithBatches, computeAlerts } from '@/lib/data'
import ManagerDashboardClient from './ManagerDashboardClient'

export const dynamic = 'force-dynamic'

export interface ManagerDashboardData {
  alerts: AlertItem[]
  ingredients: Ingredient[]
  totalValuation: number
  totalItems: number
  lowStockCount: number
  expiringCount: number
  spoiledCount: number
  cycleCountStatus: Array<{
    name: string
    unit: string
    status: 'counted' | 'pending'
    countedQty?: number
  }>
  recentAudits: Array<{
    id: string
    ingredientName: string
    quantity: number
    discrepancy: number | null
    created_at: string
  }>
}

async function getManagerDashboardData(): Promise<ManagerDashboardData> {
  const supabase = await createClient()

  // 1. Fetch ingredients with batches and real stock
  const ingredientsWithBatches = await fetchAllIngredientsWithBatches()

  // 2. Compute alerts (low stock & expiring)
  const alerts = computeAlerts(ingredientsWithBatches)

  // 3. Compute stats
  let totalValuation = 0
  let lowStockCount = 0
  let expiringCount = 0
  let spoiledCount = 0

  for (const ing of ingredientsWithBatches) {
    totalValuation += (ing.currentStock || 0) * (ing.cost_per_unit || 0)
    if ((ing.currentStock || 0) <= (ing.low_stock_threshold || 0)) {
      lowStockCount++
    }
  }

  expiringCount = alerts.filter((a) => a.type === 'expiring_soon').length
  spoiledCount = alerts.filter((a) => a.type === 'spoiled').length

  // 4. Fetch recent transactions for audit & cycle count tracking
  const { data: recentTxs } = await supabase
    .from('inventory_transactions')
    .select(`
      id,
      ingredient_id,
      transaction_type,
      new_stock,
      quantity_change,
      previous_stock,
      created_at,
      ingredient:ingredients ( name, unit )
    `)
    .order('created_at', { ascending: false })
    .limit(20)

  type TxWithIng = {
    id: string
    ingredient_id: string
    transaction_type: string
    new_stock: number | null
    quantity_change: number
    previous_stock: number | null
    created_at: string
    ingredient: { name: string; unit: string }[] | { name: string; unit: string } | null
  }

  const txList = (recentTxs || []) as unknown as TxWithIng[]
  const cycleCountTxs = txList.filter((t) => t.transaction_type === 'CYCLE_COUNT')

  const cycleCountStatus = ingredientsWithBatches.slice(0, 5).map((ing) => {
    const countedTx = cycleCountTxs.find((tx) => tx.ingredient_id === ing.id)
    if (countedTx) {
      const qty = countedTx.new_stock !== null && countedTx.new_stock !== undefined
        ? Number(countedTx.new_stock)
        : Number(countedTx.quantity_change || 0)
      return {
        name: ing.name,
        unit: ing.unit,
        status: 'counted' as const,
        countedQty: qty,
      }
    }
    return {
      name: ing.name,
      unit: ing.unit,
      status: 'pending' as const,
    }
  })

  const recentAudits = cycleCountTxs.slice(0, 6).map((tx) => {
    const ingData = Array.isArray(tx.ingredient) ? tx.ingredient[0] : tx.ingredient
    const actual = tx.new_stock !== null && tx.new_stock !== undefined ? Number(tx.new_stock) : Number(tx.quantity_change)
    const prev = tx.previous_stock !== null && tx.previous_stock !== undefined ? Number(tx.previous_stock) : actual
    const discrepancy = actual - prev
    return {
      id: tx.id,
      ingredientName: ingData?.name || 'Unknown',
      quantity: actual,
      discrepancy,
      created_at: tx.created_at,
    }
  })

  return {
    alerts,
    ingredients: ingredientsWithBatches.map((i) => ({
      id: i.id,
      name: i.name,
      unit: i.unit,
      low_stock_threshold: i.low_stock_threshold,
      spoiled_time_limit_days: i.spoiled_time_limit_days,
      daily_usage_rate: i.daily_usage_rate,
      cost_per_unit: i.cost_per_unit,
      description: i.description,
      created_at: i.created_at,
    })),
    totalValuation: Math.round(totalValuation * 100) / 100,
    totalItems: ingredientsWithBatches.length,
    lowStockCount,
    expiringCount,
    spoiledCount,
    cycleCountStatus,
    recentAudits,
  }
}

export default async function ManagerDashboardPage() {
  const data = await getManagerDashboardData()
  return <ManagerDashboardClient data={data} />
}
