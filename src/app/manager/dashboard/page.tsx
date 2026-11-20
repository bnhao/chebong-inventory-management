import { createClient } from '@/lib/supabase/server'
import { AlertItem, Ingredient } from '@/lib/types'
import { fetchAllIngredientsWithBatches, computeAlerts } from '@/lib/data'
import {
  buildDailyCycleCountSummary,
  DailyCycleCountSummary,
  TodayCycleCountTx,
} from '@/lib/cycle-count'
import { getStoreDateString, getStoreDayBoundsUtc } from '@/lib/timezone'
import ManagerDashboardClient from './ManagerDashboardClient'

export const dynamic = 'force-dynamic'

export interface InventoryLogItem {
  id: string
  ingredient_id: string
  ingredientName: string
  unit: string
  cost_per_unit: number
  transaction_type: 'RESTOCK' | 'WASTE' | 'CYCLE_COUNT' | 'SALE'
  quantity_change: number
  previous_stock: number | null
  new_stock: number | null
  reason: string | null
  reference_id: string | null
  performed_by: string | null
  created_at: string
}

export interface ManagerDashboardData {
  alerts: AlertItem[]
  ingredients: Ingredient[]
  totalValuation: number
  totalItems: number
  lowStockCount: number
  expiringCount: number
  spoiledCount: number
  cycleCountSummary: DailyCycleCountSummary
  recentAudits: Array<{
    id: string
    ingredientName: string
    quantity: number
    discrepancy: number | null
    created_at: string
  }>
  recentLogs: InventoryLogItem[]
}

async function getManagerDashboardData(): Promise<ManagerDashboardData> {
  const supabase = await createClient()
  const now = new Date()
  const todayStr = getStoreDateString(now)
  const { startIso, endIso } = getStoreDayBoundsUtc(todayStr)

  const [ingredientsWithBatches, { data: todayCycleTxs }, { data: recentTxs }] =
    await Promise.all([
      fetchAllIngredientsWithBatches(),
      supabase
        .from('inventory_transactions')
        .select('ingredient_id, new_stock, quantity_change, created_at')
        .eq('transaction_type', 'CYCLE_COUNT')
        .gte('created_at', startIso)
        .lt('created_at', endIso)
        .order('created_at', { ascending: false })
        .limit(200),
      supabase
        .from('inventory_transactions')
        .select(`
          id,
          ingredient_id,
          transaction_type,
          new_stock,
          quantity_change,
          previous_stock,
          reason,
          reference_id,
          performed_by,
          created_at,
          ingredient:ingredients ( name, unit, cost_per_unit )
        `)
        .order('created_at', { ascending: false })
        .limit(80),
    ])

  const alerts = computeAlerts(ingredientsWithBatches, now)

  let totalValuation = 0
  let lowStockCount = 0

  for (const ing of ingredientsWithBatches) {
    totalValuation += (ing.currentStock || 0) * (ing.cost_per_unit || 0)
    if ((ing.currentStock || 0) <= (ing.low_stock_threshold || 0)) {
      lowStockCount++
    }
  }

  const expiringCount = alerts.filter((a) => a.type === 'expiring_soon').length
  const spoiledCount = alerts.filter((a) => a.type === 'spoiled').length

  const cycleCountSummary = buildDailyCycleCountSummary(
    ingredientsWithBatches,
    alerts,
    (todayCycleTxs || []) as TodayCycleCountTx[],
    todayStr,
    5
  )

  type TxWithIng = {
    id: string
    ingredient_id: string
    transaction_type: 'RESTOCK' | 'WASTE' | 'CYCLE_COUNT' | 'SALE'
    new_stock: number | null
    quantity_change: number
    previous_stock: number | null
    reason: string | null
    reference_id: string | null
    performed_by: string | null
    created_at: string
    ingredient:
      | { name: string; unit: string; cost_per_unit: number | null }[]
      | { name: string; unit: string; cost_per_unit: number | null }
      | null
  }

  const txList = (recentTxs || []) as unknown as TxWithIng[]
  const cycleCountTxs = txList.filter((t) => t.transaction_type === 'CYCLE_COUNT')

  const recentAudits = cycleCountTxs.slice(0, 6).map((tx) => {
    const ingData = Array.isArray(tx.ingredient) ? tx.ingredient[0] : tx.ingredient
    const actual =
      tx.new_stock !== null && tx.new_stock !== undefined
        ? Number(tx.new_stock)
        : Number(tx.quantity_change)
    const prev =
      tx.previous_stock !== null && tx.previous_stock !== undefined
        ? Number(tx.previous_stock)
        : actual
    const discrepancy = actual - prev
    return {
      id: tx.id,
      ingredientName: ingData?.name || 'Unknown',
      quantity: actual,
      discrepancy,
      created_at: tx.created_at,
    }
  })

  const recentLogs: InventoryLogItem[] = txList.map((tx) => {
    const ingData = Array.isArray(tx.ingredient) ? tx.ingredient[0] : tx.ingredient
    return {
      id: tx.id,
      ingredient_id: tx.ingredient_id,
      ingredientName: ingData?.name || 'Unknown Item',
      unit: ingData?.unit || 'units',
      cost_per_unit: Number(ingData?.cost_per_unit) || 0,
      transaction_type: tx.transaction_type,
      quantity_change: Number(tx.quantity_change) || 0,
      previous_stock: tx.previous_stock !== null ? Number(tx.previous_stock) : null,
      new_stock: tx.new_stock !== null ? Number(tx.new_stock) : null,
      reason: tx.reason,
      reference_id: tx.reference_id,
      performed_by: tx.performed_by,
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
    cycleCountSummary,
    recentAudits,
    recentLogs,
  }
}

export default async function ManagerDashboardPage() {
  const data = await getManagerDashboardData()
  return <ManagerDashboardClient data={data} />
}
