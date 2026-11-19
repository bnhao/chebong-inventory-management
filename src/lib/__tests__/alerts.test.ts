import { describe, expect, it } from 'vitest'
import { computeAlerts, IngredientWithBatches } from '@/lib/data'

function makeIngredient(overrides: Partial<IngredientWithBatches>): IngredientWithBatches {
  return {
    id: 'ing-1',
    name: 'Coconut Milk',
    unit: 'L',
    category: 'Dairy & Milk',
    low_stock_threshold: 3,
    spoiled_time_limit_days: 4,
    daily_usage_rate: 1.5,
    cost_per_unit: 3.1,
    description: null,
    created_at: '2026-11-01T00:00:00.000Z',
    currentStock: 8,
    batches: [],
    ...overrides,
  }
}

describe('computeAlerts', () => {
  const now = new Date('2026-11-19T18:00:00.000Z')

  it('flags zero stock as critical and low stock above zero as warning with ingredientId', () => {
    const alerts = computeAlerts(
      [
        makeIngredient({ id: 'ing-low', name: 'Whole Milk', currentStock: 3, low_stock_threshold: 5 }),
        makeIngredient({ id: 'ing-zero', name: 'Pandan Jelly', currentStock: 0, low_stock_threshold: 2 }),
      ],
      now,
      'America/Edmonton'
    )

    expect(alerts).toHaveLength(2)
    // Critical sorted before warning
    expect(alerts[0].ingredientId).toBe('ing-zero')
    expect(alerts[0].severity).toBe('critical')
    expect(alerts[0].type).toBe('low_stock')

    expect(alerts[1].ingredientId).toBe('ing-low')
    expect(alerts[1].severity).toBe('warning')
    expect(alerts[1].type).toBe('low_stock')
  })

  it('flags spoiled, <=24h, and <=3d batches while ignoring non-expiring or empty batches', () => {
    const alerts = computeAlerts(
      [
        makeIngredient({
          id: 'ing-batches',
          name: 'Durian Pulp',
          unit: 'kg',
          currentStock: 10,
          low_stock_threshold: 2,
          spoiled_time_limit_days: 4,
          batches: [
            {
              id: 'b-spoiled',
              batchCode: 'B1',
              quantityReceived: 3,
              quantityRemaining: 2,
              expirationDate: '2026-11-19T12:00:00.000Z', // 6h past
              status: 'ACTIVE',
              createdAt: '2026-11-15T00:00:00.000Z',
            },
            {
              id: 'b-24h',
              batchCode: 'B2',
              quantityReceived: 3,
              quantityRemaining: 1.5,
              expirationDate: '2026-11-20T10:00:00.000Z', // 16h left
              status: 'ACTIVE',
              createdAt: '2026-11-16T00:00:00.000Z',
            },
            {
              id: 'b-2d',
              batchCode: 'B3',
              quantityReceived: 4,
              quantityRemaining: 4,
              expirationDate: '2026-11-21T18:00:00.000Z', // 48h left
              status: 'ACTIVE',
              createdAt: '2026-11-17T00:00:00.000Z',
            },
            {
              id: 'b-fresh',
              batchCode: 'B4',
              quantityReceived: 5,
              quantityRemaining: 2.5,
              expirationDate: '2026-11-25T18:00:00.000Z', // 6 days left -> ignored
              status: 'ACTIVE',
              createdAt: '2026-11-18T00:00:00.000Z',
            },
            {
              id: 'b-empty',
              batchCode: 'B5',
              quantityReceived: 5,
              quantityRemaining: 0, // empty -> ignored
              expirationDate: '2026-11-10T00:00:00.000Z',
              status: 'DEPLETED',
              createdAt: '2026-11-05T00:00:00.000Z',
            },
          ],
        }),
      ],
      now,
      'America/Edmonton'
    )

    expect(alerts.map((a) => a.id)).toEqual([
      'spoiled-b-spoiled',
      'exp24-b-24h',
      'exp-b-2d',
    ])
    expect(alerts[0].severity).toBe('critical')
    expect(alerts[0].type).toBe('spoiled')
    expect(alerts[1].message).toContain('expiring in 24 hrs')
    expect(alerts[2].daysLeft).toBe(2)
  })
})
