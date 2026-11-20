import { describe, expect, it } from 'vitest'
import {
  computeEodIngredientDeductions,
  normalizeMenuName,
  reconcileScannedLines,
} from '@/lib/eod-sales'
import { CloverItem } from '@/lib/types'

const catalog: CloverItem[] = [
  {
    id: 'item-che-thai',
    name: '2A. Chè Thai',
    clover_id: 'CHE-2A',
    price: 9.3,
    category: 'Chè (Desserts)',
    is_active: true,
    created_at: '2026-11-01T00:00:00.000Z',
    recipe_ingredients: [
      {
        id: 'rec-1',
        clover_item_id: 'item-che-thai',
        ingredient_id: 'ing-coco-milk',
        quantity_required: 0.12,
      },
      {
        id: 'rec-2',
        clover_item_id: 'item-che-thai',
        ingredient_id: 'ing-jackfruit',
        quantity_required: 0.05,
      },
    ],
  },
  {
    id: 'item-durian-che',
    name: '2C. Chè Thai with Durian',
    clover_id: 'CHE-2C',
    price: 10.4,
    category: 'Chè (Desserts)',
    is_active: true,
    created_at: '2026-11-01T00:00:00.000Z',
    recipe_ingredients: [
      {
        id: 'rec-3',
        clover_item_id: 'item-durian-che',
        ingredient_id: 'ing-coco-milk',
        quantity_required: 0.12,
      },
      {
        id: 'rec-4',
        clover_item_id: 'item-durian-che',
        ingredient_id: 'ing-durian',
        quantity_required: 0.15,
      },
    ],
  },
  {
    id: 'item-matcha-unmapped',
    name: 'Matcha Latte',
    clover_id: 'MT-03',
    price: 7.0,
    category: 'Matcha Series',
    is_active: true,
    created_at: '2026-11-01T00:00:00.000Z',
    recipe_ingredients: [],
  },
]

describe('eod-sales helpers', () => {
  it('normalizes Vietnamese diacritics and menu numbering prefixes', () => {
    expect(normalizeMenuName('2A. Chè Thái')).toBe('che thai')
    expect(normalizeMenuName('1A. Creamy Pandan Coco')).toBe('creamy pandan coco')
    expect(normalizeMenuName('B1. Sate Chicken')).toBe('sate chicken')
    expect(normalizeMenuName('CHE-2C: Che Thai with Durian!')).toBe('che thai with durian')
  })

  it('reconciles Gemini lines, rejects hallucinated UUIDs, falls back deterministically, and flags missing recipes', () => {
    const lines = reconcileScannedLines(
      [
        {
          raw_name: '2A Che Thai',
          quantity: 12,
          matched_clover_item_id: 'item-che-thai',
          confidence: 'high',
        },
        {
          raw_name: 'Matcha Latte',
          quantity: 5,
          matched_clover_item_id: 'not-a-real-uuid', // hallucinated ID -> fallback by normalized name
        },
        {
          raw_name: 'Unknown Promo Item',
          quantity: 3,
          matched_clover_item_id: null,
        },
        {
          raw_name: 'Voided Drink',
          quantity: 0, // dropped
          matched_clover_item_id: 'item-che-thai',
        },
      ],
      catalog
    )

    expect(lines).toHaveLength(3)

    expect(lines[0].matchedCloverItemId).toBe('item-che-thai')
    expect(lines[0].confidence).toBe('high')
    expect(lines[0].hasRecipe).toBe(true)

    expect(lines[1].matchedCloverItemId).toBe('item-matcha-unmapped')
    expect(lines[1].confidence).toBe('medium')
    expect(lines[1].hasRecipe).toBe(false)

    expect(lines[2].matchedCloverItemId).toBeNull()
    expect(lines[2].confidence).toBe('unmatched')
  })

  it('aggregates multi-item recipe deductions, preserves small decimals, tracks shortfalls and unmapped items', () => {
    const ingredients = [
      { id: 'ing-coco-milk', name: 'Coconut Milk', unit: 'L', cost_per_unit: 3.1, currentStock: 5 },
      { id: 'ing-jackfruit', name: 'Jackfruit', unit: 'kg', cost_per_unit: 5.2, currentStock: 2 },
      { id: 'ing-durian', name: 'Durian Pulp', unit: 'kg', cost_per_unit: 14.0, currentStock: 1 },
    ]

    const { deductions, unmappedSoldItems, totalItemsSold } = computeEodIngredientDeductions(
      {
        'item-che-thai': 10, // 1.2 L coco milk + 0.5 kg jackfruit
        'item-durian-che': 10, // 1.2 L coco milk + 1.5 kg durian
        'item-matcha-unmapped': 4,
      },
      catalog,
      ingredients
    )

    expect(totalItemsSold).toBe(24)
    expect(unmappedSoldItems).toEqual([
      { cloverItemId: 'item-matcha-unmapped', name: 'Matcha Latte', quantity: 4 },
    ])

    // Shortfall items sorted first
    expect(deductions[0].name).toBe('Durian Pulp')
    expect(deductions[0].totalRequired).toBe(1.5)
    expect(deductions[0].isDeficit).toBe(true)
    expect(deductions[0].deficitAmount).toBe(0.5)
    expect(deductions[0].projectedAfterClamp).toBe(0)
    expect(deductions[0].estimatedCost).toBe(7.0)

    const coco = deductions.find((d) => d.ingredientId === 'ing-coco-milk')!
    expect(coco.totalRequired).toBe(2.4)
    expect(coco.projectedAfterClamp).toBe(2.6)
    expect(coco.isDeficit).toBe(false)
  })

  it('preserves 4-decimal recipe quantities without premature 2-decimal rounding', () => {
    const tinyCatalog: CloverItem[] = [
      {
        id: 'tiny-1',
        name: 'Tiny Spice Drink',
        clover_id: 'T-1',
        price: 5,
        category: 'Drinks',
        is_active: true,
        created_at: '2026-11-01T00:00:00.000Z',
        recipe_ingredients: [
          {
            id: 'r-tiny',
            clover_item_id: 'tiny-1',
            ingredient_id: 'ing-saffron',
            quantity_required: 0.004,
          },
        ],
      },
    ]

    const { deductions } = computeEodIngredientDeductions(
      { 'tiny-1': 1 },
      tinyCatalog,
      [{ id: 'ing-saffron', name: 'Saffron', unit: 'kg', cost_per_unit: 100, currentStock: 1 }]
    )

    expect(deductions[0].totalRequired).toBe(0.004)
    expect(deductions[0].projectedAfterClamp).toBe(0.996)
  })
})
