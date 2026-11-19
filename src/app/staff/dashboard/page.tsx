import { createClient } from '@/lib/supabase/server'
import { AlertItem, Ingredient } from '@/lib/types'
import { fetchAllIngredientsWithBatches, computeAlerts } from '@/lib/data'
import {
  buildDailyCycleCountSummary,
  DailyCycleCountSummary,
  TodayCycleCountTx,
} from '@/lib/cycle-count'
import {
  getStoreDateString,
  getStoreDayBoundsUtc,
  getStoreHeaderContext,
  StoreHeaderContext,
} from '@/lib/timezone'
import DashboardClient from './DashboardClient'

export const dynamic = 'force-dynamic'

export interface StaffDashboardData {
  alerts: AlertItem[]
  ingredients: Ingredient[]
  cycleCountSummary: DailyCycleCountSummary
  headerContext: StoreHeaderContext
}

async function getStaffDashboardData(): Promise<StaffDashboardData> {
  const supabase = await createClient()
  const now = new Date()
  const headerContext = getStoreHeaderContext(now)
  const todayStr = getStoreDateString(now)
  const { startIso, endIso } = getStoreDayBoundsUtc(todayStr)

  const [ingredientsWithBatches, { data: todayTxs }] = await Promise.all([
    fetchAllIngredientsWithBatches(),
    supabase
      .from('inventory_transactions')
      .select('ingredient_id, new_stock, quantity_change, created_at')
      .eq('transaction_type', 'CYCLE_COUNT')
      .gte('created_at', startIso)
      .lt('created_at', endIso)
      .order('created_at', { ascending: false })
      .limit(200),
  ])

  const alerts = computeAlerts(ingredientsWithBatches, now)
  const cycleCountSummary = buildDailyCycleCountSummary(
    ingredientsWithBatches,
    alerts,
    (todayTxs || []) as TodayCycleCountTx[],
    todayStr,
    5
  )

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
    cycleCountSummary,
    headerContext,
  }
}

export default async function StaffDashboardPage() {
  const data = await getStaffDashboardData()
  return <DashboardClient data={data} />
}
