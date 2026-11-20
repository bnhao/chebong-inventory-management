import { describe, expect, it } from 'vitest'
import { buildDailyCycleCountSummary } from '@/lib/cycle-count'
import { AlertItem } from '@/lib/types'

describe('buildDailyCycleCountSummary', () => {
  const ingredients = [
    { id: '1', name: 'Apple Puree', unit: 'kg', cost_per_unit: 2.0 },
    { id: '2', name: 'Brown Sugar', unit: 'kg', cost_per_unit: 2.4 },
    { id: '3', name: 'Durian Pulp', unit: 'kg', cost_per_unit: 14.0 },
    { id: '4', name: 'Pandan Jelly', unit: 'kg', cost_per_unit: 6.8 },
    { id: '5', name: 'Whole Milk', unit: 'L', cost_per_unit: 1.9 },
    { id: '6', name: 'Coconut Milk', unit: 'L', cost_per_unit: 3.1 },
  ]

  const alerts: AlertItem[] = [
    {
      id: 'low-5',
      ingredientId: '5',
      ingredientName: 'Whole Milk',
      type: 'low_stock',
      message: 'Whole Milk is low',
      severity: 'critical',
    },
    {
      id: 'exp-4',
      ingredientId: '4',
      ingredientName: 'Pandan Jelly',
      type: 'expiring_soon',
      message: 'Pandan Jelly expiring soon',
      severity: 'warning',
    },
  ]

  it('tracks total daily progress and prioritizes uncounted critical -> warning -> high value -> counted', () => {
    const todayTxs = [
      {
        ingredient_id: '1',
        new_stock: 5,
        quantity_change: 0,
        created_at: '2026-11-19T18:00:00.000Z',
      },
      {
        ingredient_id: '6',
        new_stock: 9,
        quantity_change: 1,
        created_at: '2026-11-19T19:00:00.000Z',
      },
    ]

    const summary = buildDailyCycleCountSummary(
      ingredients,
      alerts,
      todayTxs,
      '2026-11-19',
      5
    )

    expect(summary.countedCount).toBe(2)
    expect(summary.totalCount).toBe(6)
    expect(summary.progressPct).toBe(33)
    expect(summary.todayDateStr).toBe('2026-11-19')

    expect(summary.items.map((i) => i.name)).toEqual([
      'Whole Milk', // uncounted + critical alert
      'Pandan Jelly', // uncounted + warning alert
      'Durian Pulp', // uncounted + highest cost ($14)
      'Brown Sugar', // uncounted + remaining
      'Coconut Milk', // counted most recently (19:00 > 18:00)
    ])

    expect(summary.items[0].priorityReason).toBe('critical')
    expect(summary.items[1].priorityReason).toBe('warning')
    expect(summary.items[2].priorityReason).toBe('high_value')
    expect(summary.items[4].status).toBe('counted')
    expect(summary.items[4].countedQty).toBe(9)
  })
})
