import { AlertItem, Ingredient } from './types'

export interface TodayCycleCountTx {
  ingredient_id: string
  new_stock?: number | null
  quantity_change?: number | null
  created_at: string
}

export interface DailyCycleCountItem {
  ingredientId: string
  name: string
  unit: string
  status: 'counted' | 'pending'
  countedQty?: number
  countedAt?: string
  priorityReason?: 'critical' | 'warning' | 'high_value'
}

export interface DailyCycleCountSummary {
  countedCount: number
  totalCount: number
  progressPct: number
  todayDateStr: string
  items: DailyCycleCountItem[]
}

export function buildDailyCycleCountSummary(
  ingredients: Array<Pick<Ingredient, 'id' | 'name' | 'unit' | 'cost_per_unit'>>,
  alerts: AlertItem[],
  todayCycleCountTxs: TodayCycleCountTx[],
  todayDateStr: string,
  maxItems: number = 5
): DailyCycleCountSummary {
  const latestByIngredient = new Map<string, TodayCycleCountTx>()
  for (const tx of todayCycleCountTxs) {
    const existing = latestByIngredient.get(tx.ingredient_id)
    if (!existing || new Date(tx.created_at).getTime() > new Date(existing.created_at).getTime()) {
      latestByIngredient.set(tx.ingredient_id, tx)
    }
  }

  const severityByIngredientId = new Map<string, 'critical' | 'warning'>()
  const severityByIngredientName = new Map<string, 'critical' | 'warning'>()

  for (const alert of alerts) {
    const sev = alert.severity === 'critical' ? 'critical' : 'warning'
    if (alert.ingredientId) {
      const prev = severityByIngredientId.get(alert.ingredientId)
      if (prev !== 'critical') {
        severityByIngredientId.set(alert.ingredientId, sev)
      }
    }
    const prevByName = severityByIngredientName.get(alert.ingredientName)
    if (prevByName !== 'critical') {
      severityByIngredientName.set(alert.ingredientName, sev)
    }
  }

  let countedCount = 0

  type RankedItem = {
    item: DailyCycleCountItem
    isCounted: boolean
    severityRank: number
    costPerUnit: number
    countedTime: number
  }

  const ranked: RankedItem[] = ingredients.map((ing) => {
    const tx = latestByIngredient.get(ing.id)
    const alertSeverity =
      severityByIngredientId.get(ing.id) || severityByIngredientName.get(ing.name) || null
    const costPerUnit = Number(ing.cost_per_unit) || 0

    if (tx) {
      countedCount++
      const qty =
        tx.new_stock !== null && tx.new_stock !== undefined
          ? Number(tx.new_stock)
          : Number(tx.quantity_change || 0)
      return {
        item: {
          ingredientId: ing.id,
          name: ing.name,
          unit: ing.unit,
          status: 'counted',
          countedQty: qty,
          countedAt: tx.created_at,
        },
        isCounted: true,
        severityRank: 99,
        costPerUnit,
        countedTime: new Date(tx.created_at).getTime() || 0,
      }
    }

    const severityRank = alertSeverity === 'critical' ? 0 : alertSeverity === 'warning' ? 1 : 2
    let priorityReason: DailyCycleCountItem['priorityReason']
    if (alertSeverity === 'critical') {
      priorityReason = 'critical'
    } else if (alertSeverity === 'warning') {
      priorityReason = 'warning'
    } else if (costPerUnit >= 5) {
      priorityReason = 'high_value'
    }

    return {
      item: {
        ingredientId: ing.id,
        name: ing.name,
        unit: ing.unit,
        status: 'pending',
        priorityReason,
      },
      isCounted: false,
      severityRank,
      costPerUnit,
      countedTime: 0,
    }
  })

  ranked.sort((a, b) => {
    if (a.isCounted !== b.isCounted) {
      return a.isCounted ? 1 : -1
    }
    if (!a.isCounted) {
      if (a.severityRank !== b.severityRank) {
        return a.severityRank - b.severityRank
      }
      if (a.costPerUnit !== b.costPerUnit) {
        return b.costPerUnit - a.costPerUnit
      }
      return a.item.name.localeCompare(b.item.name)
    }
    if (a.countedTime !== b.countedTime) {
      return b.countedTime - a.countedTime
    }
    return a.item.name.localeCompare(b.item.name)
  })

  const totalCount = ingredients.length
  const progressPct = totalCount > 0 ? Math.round((countedCount / totalCount) * 100) : 0

  return {
    countedCount,
    totalCount,
    progressPct,
    todayDateStr,
    items: ranked.slice(0, Math.max(1, maxItems)).map((r) => r.item),
  }
}
