import { CloverItem } from './types'

export type ScannedLineConfidence = 'high' | 'medium' | 'low' | 'unmatched'

export interface RawGeminiReceiptLine {
  raw_name: string
  quantity: number
  matched_clover_item_id: string | null
  confidence?: ScannedLineConfidence
  notes?: string
}

export interface ScannedReceiptLine {
  id: string
  rawName: string
  quantity: number
  matchedCloverItemId: string | null
  matchedCloverItemName: string | null
  matchedCloverCode: string | null
  confidence: ScannedLineConfidence
  hasRecipe: boolean
  notes?: string
}

export interface EodIngredientInput {
  id: string
  name: string
  unit: string
  cost_per_unit: number
  currentStock: number
}

export interface EodIngredientDeduction {
  ingredientId: string
  name: string
  unit: string
  currentStock: number
  totalRequired: number
  balance: number
  projectedAfterClamp: number
  isDeficit: boolean
  deficitAmount: number
  estimatedCost: number
}

export interface UnmappedSoldItem {
  cloverItemId: string
  name: string
  quantity: number
}

export function normalizeMenuName(input: string): string {
  const stripped = input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .trim()

  // Strip common Clover/menu prefixes like "1A.", "B1.", "N1.", "CHE-1A:"
  const withoutPrefix = stripped
    .replace(/^(?:[a-z]{2,4}-\d+[a-z]?|\d+[a-z]?|[a-z]\d+)\s*[.:)\-]\s*/i, '')

  return withoutPrefix
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function tokenize(normalized: string): string[] {
  return normalized.split(' ').filter((t) => t.length >= 2)
}

function findDeterministicMatch(
  rawName: string,
  cloverItems: CloverItem[]
): { item: CloverItem; confidence: 'medium' | 'low' } | null {
  const rawTrimmedLower = rawName.trim().toLowerCase()
  if (!rawTrimmedLower) return null

  // 1. Exact clover_id match
  for (const item of cloverItems) {
    if (item.clover_id && item.clover_id.trim().toLowerCase() === rawTrimmedLower) {
      return { item, confidence: 'medium' }
    }
  }

  const normalizedRaw = normalizeMenuName(rawName)
  if (!normalizedRaw) return null

  // 2. Exact normalized name match
  for (const item of cloverItems) {
    if (normalizeMenuName(item.name) === normalizedRaw) {
      return { item, confidence: 'medium' }
    }
  }

  // 3. Token overlap / containment match
  const rawTokens = tokenize(normalizedRaw)
  if (rawTokens.length === 0) return null
  const rawSet = new Set(rawTokens)

  let bestItem: CloverItem | null = null
  let bestScore = 0

  for (const item of cloverItems) {
    const itemTokens = tokenize(normalizeMenuName(item.name))
    if (itemTokens.length === 0) continue
    const itemSet = new Set(itemTokens)

    let overlap = 0
    for (const token of rawSet) {
      if (itemSet.has(token)) overlap++
    }
    if (overlap === 0) continue

    const union = new Set([...rawSet, ...itemSet]).size
    const jaccard = overlap / union
    const minLen = Math.min(rawSet.size, itemSet.size)
    const containment = minLen >= 2 ? overlap / minLen : 0
    const score = Math.max(jaccard, containment * 0.85)

    if (score >= 0.55 && score > bestScore) {
      bestScore = score
      bestItem = item
    }
  }

  if (bestItem) {
    return { item: bestItem, confidence: 'low' }
  }

  return null
}

export function reconcileScannedLines(
  rawLines: RawGeminiReceiptLine[],
  cloverItems: CloverItem[]
): ScannedReceiptLine[] {
  const catalogById = new Map<string, CloverItem>()
  for (const item of cloverItems) {
    catalogById.set(item.id, item)
  }

  const result: ScannedReceiptLine[] = []

  rawLines.forEach((raw, idx) => {
    const qty = Number(raw.quantity)
    if (!Number.isFinite(qty) || qty <= 0) return

    const roundedQty = Math.round(qty * 100) / 100
    const rawName = (raw.raw_name || '').trim() || `Item #${idx + 1}`

    let matchedItem: CloverItem | null = null
    let confidence: ScannedLineConfidence = raw.confidence || 'unmatched'

    if (raw.matched_clover_item_id && catalogById.has(raw.matched_clover_item_id)) {
      matchedItem = catalogById.get(raw.matched_clover_item_id) || null
      if (confidence === 'unmatched') confidence = 'high'
    } else {
      const fallback = findDeterministicMatch(rawName, cloverItems)
      if (fallback) {
        matchedItem = fallback.item
        confidence = fallback.confidence
      } else {
        confidence = 'unmatched'
      }
    }

    result.push({
      id: `scan-line-${idx}-${matchedItem?.id || 'unmatched'}`,
      rawName,
      quantity: roundedQty,
      matchedCloverItemId: matchedItem?.id || null,
      matchedCloverItemName: matchedItem?.name || null,
      matchedCloverCode: matchedItem?.clover_id || null,
      confidence,
      hasRecipe: (matchedItem?.recipe_ingredients?.length ?? 0) > 0,
      notes: raw.notes?.trim() || undefined,
    })
  })

  return result
}

export function computeEodIngredientDeductions(
  salesByCloverItemId: Record<string, number>,
  cloverItems: CloverItem[],
  ingredients: EodIngredientInput[]
): {
  deductions: EodIngredientDeduction[]
  unmappedSoldItems: UnmappedSoldItem[]
  totalItemsSold: number
} {
  const itemById = new Map<string, CloverItem>()
  for (const item of cloverItems) {
    itemById.set(item.id, item)
  }

  const ingredientById = new Map<string, EodIngredientInput>()
  for (const ing of ingredients) {
    ingredientById.set(ing.id, ing)
  }

  const requiredTotals: Record<string, number> = {}
  const unmappedSoldItems: UnmappedSoldItem[] = []
  let totalItemsSold = 0

  for (const [cloverItemId, rawQty] of Object.entries(salesByCloverItemId)) {
    const unitsSold = Number(rawQty)
    if (!Number.isFinite(unitsSold) || unitsSold <= 0) continue

    const item = itemById.get(cloverItemId)
    if (!item) continue

    totalItemsSold += unitsSold
    const recipeRows = item.recipe_ingredients || []

    if (recipeRows.length === 0) {
      unmappedSoldItems.push({
        cloverItemId: item.id,
        name: item.name,
        quantity: unitsSold,
      })
      continue
    }

    for (const rec of recipeRows) {
      const req = (Number(rec.quantity_required) || 0) * unitsSold
      if (req <= 0) continue
      requiredTotals[rec.ingredient_id] = (requiredTotals[rec.ingredient_id] || 0) + req
    }
  }

  const deductions: EodIngredientDeduction[] = Object.entries(requiredTotals)
    .map(([ingId, totalRequired]) => {
      const ing = ingredientById.get(ingId)
      const currentStock = ing ? Number(ing.currentStock) || 0 : 0
      const roundedRequired = Math.round(totalRequired * 10000) / 10000
      const balance = Math.round((currentStock - roundedRequired) * 10000) / 10000
      const isDeficit = balance < 0
      const deficitAmount = isDeficit ? Math.round(Math.abs(balance) * 10000) / 10000 : 0
      const estimatedCost = Math.round(deficitAmount * (ing?.cost_per_unit || 0) * 100) / 100

      return {
        ingredientId: ingId,
        name: ing ? ing.name : 'Unknown',
        unit: ing ? ing.unit : '',
        currentStock,
        totalRequired: roundedRequired,
        balance,
        projectedAfterClamp: Math.max(0, Math.round(balance * 10000) / 10000),
        isDeficit,
        deficitAmount,
        estimatedCost,
      }
    })
    .sort((a, b) => {
      if (a.isDeficit !== b.isDeficit) return a.isDeficit ? -1 : 1
      return a.name.localeCompare(b.name)
    })

  return {
    deductions,
    unmappedSoldItems,
    totalItemsSold,
  }
}
