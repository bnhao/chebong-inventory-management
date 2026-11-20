import { createClient } from '@/lib/supabase/server'
import { computeAlerts, fetchAllIngredientsWithBatches } from '@/lib/data'
import { getStoreDateString, getStoreDayBoundsUtc } from '@/lib/timezone'
import CycleCountForm from './CycleCountForm'

export const dynamic = 'force-dynamic'

export interface IngredientForCycleCount {
  id: string
  name: string
  unit: string
  systemStock: number
  countedTodayQty: number | null
  countedTodayAt: string | null
  priorityReason?: 'critical' | 'warning' | 'high_value'
}

async function getIngredientsForCycleCount(): Promise<IngredientForCycleCount[]> {
  const supabase = await createClient()
  const now = new Date()
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
  const severityByIng = new Map<string, 'critical' | 'warning'>()
  for (const alert of alerts) {
    if (!alert.ingredientId) continue
    const prev = severityByIng.get(alert.ingredientId)
    if (prev !== 'critical') {
      severityByIng.set(alert.ingredientId, alert.severity)
    }
  }

  const latestTodayByIng = new Map<string, { qty: number; at: string }>()
  for (const tx of todayTxs || []) {
    const ingId = tx.ingredient_id as string
    if (latestTodayByIng.has(ingId)) continue
    const qty =
      tx.new_stock !== null && tx.new_stock !== undefined
        ? Number(tx.new_stock)
        : Number(tx.quantity_change || 0)
    latestTodayByIng.set(ingId, { qty, at: tx.created_at as string })
  }

  const rows: IngredientForCycleCount[] = ingredientsWithBatches.map((ing) => {
    const counted = latestTodayByIng.get(ing.id)
    const sev = severityByIng.get(ing.id)
    const cost = Number(ing.cost_per_unit) || 0
    let priorityReason: IngredientForCycleCount['priorityReason']
    if (sev === 'critical') priorityReason = 'critical'
    else if (sev === 'warning') priorityReason = 'warning'
    else if (cost >= 5) priorityReason = 'high_value'

    return {
      id: ing.id,
      name: ing.name,
      unit: ing.unit,
      systemStock: Number(ing.currentStock) || 0,
      countedTodayQty: counted ? counted.qty : null,
      countedTodayAt: counted ? counted.at : null,
      priorityReason,
    }
  })

  // Sort: uncounted first (critical -> warning -> high_value -> other), then already counted today
  const rank = (r: IngredientForCycleCount) => {
    if (r.countedTodayAt) return 10
    if (r.priorityReason === 'critical') return 0
    if (r.priorityReason === 'warning') return 1
    if (r.priorityReason === 'high_value') return 2
    return 3
  }

  rows.sort((a, b) => {
    const ra = rank(a)
    const rb = rank(b)
    if (ra !== rb) return ra - rb
    return a.name.localeCompare(b.name)
  })

  return rows
}

export default async function CycleCountPage() {
  const ingredients = await getIngredientsForCycleCount()
  return <CycleCountForm ingredients={ingredients} />
}
