import { createClient } from '@/lib/supabase/server'
import { AlertItem, Ingredient } from '@/lib/types'
import { fetchAllIngredientsWithBatches, computeAlerts } from '@/lib/data'
import DashboardClient from './DashboardClient'

export const dynamic = 'force-dynamic'

export interface StaffDashboardData {
  alerts: AlertItem[]
  ingredients: Ingredient[]
  cycleCountStatus: Array<{
    name: string
    unit: string
    status: 'counted' | 'pending'
    countedQty?: number
  }>
}

async function getStaffDashboardData(): Promise<StaffDashboardData> {
  const supabase = await createClient()

  // 1. Fetch all ingredients with batches and calculate real stock
  const ingredientsWithBatches = await fetchAllIngredientsWithBatches()

  // 2. Compute alerts (low stock & expiration warnings)
  const alerts = computeAlerts(ingredientsWithBatches)

  // 3. Fetch recent cycle count transactions
  const { data: recentTxs } = await supabase
    .from('inventory_transactions')
    .select('ingredient_id, transaction_type, new_stock, quantity_change, created_at')
    .eq('transaction_type', 'CYCLE_COUNT')
    .order('created_at', { ascending: false })
    .limit(20)

  type TxRow = { ingredient_id: string; new_stock?: number; quantity_change?: number }
  const cycleTxs = (recentTxs || []) as unknown as TxRow[]

  const cycleCountStatus = ingredientsWithBatches.slice(0, 4).map((ing) => {
    const counted = cycleTxs.find((tx) => tx.ingredient_id === ing.id)
    if (counted) {
      const qty = counted.new_stock !== undefined && counted.new_stock !== null
        ? Number(counted.new_stock)
        : Number(counted.quantity_change || 0)
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
    cycleCountStatus,
  }
}

export default async function StaffDashboardPage() {
  const data = await getStaffDashboardData()
  return <DashboardClient data={data} />
}
