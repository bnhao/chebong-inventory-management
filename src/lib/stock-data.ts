import { createClient } from '@/lib/supabase/server'
import { Ingredient } from '@/lib/types'

export interface IngredientForStock extends Ingredient {
  currentStock: number
}

export interface RecentDelivery {
  id: string
  ingredientName: string
  unit: string
  batchCode: string | null
  quantityReceived: number
  quantityRemaining: number
  expirationDate: string | null
  createdAt: string
  status: string
}

export interface WasteBatchOption {
  id: string
  ingredientId: string
  ingredientName: string
  unit: string
  batchCode: string | null
  quantityRemaining: number
  expirationDate: string | null
  receivedDate: string
}

export interface RecentWasteRecord {
  id: string
  ingredientName: string
  quantity: number
  unit: string
  reason: string
  createdAt: string
}

export interface StockOperationsData {
  ingredients: IngredientForStock[]
  recentDeliveries: RecentDelivery[]
  activeBatches: WasteBatchOption[]
  recentWaste: RecentWasteRecord[]
}

export async function getStockOperationsData(): Promise<StockOperationsData> {
  const supabase = await createClient()

  const [{ data: rawIngredients }, { data: rawRecentBatches }, { data: rawActiveBatches }, { data: rawWasteTxs }] =
    await Promise.all([
      supabase
        .from('ingredients')
        .select('id, name, unit, current_stock, low_stock_threshold, spoiled_time_limit_days, daily_usage_rate, cost_per_unit, created_at')
        .order('name', { ascending: true }),
      supabase
        .from('inventory_batches')
        .select(`
          id,
          ingredient_id,
          batch_code,
          quantity_received,
          quantity_remaining,
          expiration_date,
          created_at,
          status,
          ingredient:ingredients ( name, unit )
        `)
        .order('created_at', { ascending: false })
        .limit(8),
      supabase
        .from('inventory_batches')
        .select(`
          id,
          ingredient_id,
          batch_code,
          quantity_remaining,
          expiration_date,
          received_date,
          ingredient:ingredients (
            id,
            name,
            unit
          )
        `)
        .eq('status', 'ACTIVE')
        .gt('quantity_remaining', 0)
        .order('expiration_date', { ascending: true }),
      supabase
        .from('inventory_transactions')
        .select(`
          id,
          quantity_change,
          reason,
          created_at,
          ingredient:ingredients (
            name,
            unit
          )
        `)
        .eq('transaction_type', 'WASTE')
        .order('created_at', { ascending: false })
        .limit(8),
    ])

  const ingredients: IngredientForStock[] = (rawIngredients || []).map((row) => ({
    id: row.id as string,
    name: row.name as string,
    unit: (row.unit as string) || 'kg',
    low_stock_threshold: Number(row.low_stock_threshold) || 0,
    spoiled_time_limit_days: Number(row.spoiled_time_limit_days) || 7,
    daily_usage_rate: Number(row.daily_usage_rate) || 0,
    cost_per_unit: Number(row.cost_per_unit) || 0,
    created_at: row.created_at as string,
    currentStock: Number(row.current_stock) || 0,
  }))

  type RawDeliveryRow = {
    id: string
    batch_code: string | null
    quantity_received: number
    quantity_remaining: number
    expiration_date: string | null
    created_at: string
    status: string
    ingredient: { name: string; unit: string }[] | { name: string; unit: string } | null
  }

  const recentDeliveries: RecentDelivery[] = ((rawRecentBatches || []) as unknown as RawDeliveryRow[]).map((b) => {
    const ing = Array.isArray(b.ingredient) ? b.ingredient[0] : b.ingredient
    return {
      id: b.id,
      ingredientName: ing?.name || 'Ingredient',
      unit: ing?.unit || 'units',
      batchCode: b.batch_code,
      quantityReceived: Number(b.quantity_received) || 0,
      quantityRemaining: Number(b.quantity_remaining) || 0,
      expirationDate: b.expiration_date,
      createdAt: b.created_at,
      status: b.status || 'ACTIVE',
    }
  })

  type BatchJoin = {
    id: string
    ingredient_id: string
    batch_code: string | null
    quantity_remaining: number
    expiration_date: string | null
    received_date: string
    ingredient: { id: string; name: string; unit: string }[] | { id: string; name: string; unit: string } | null
  }

  const activeBatches: WasteBatchOption[] = ((rawActiveBatches || []) as unknown as BatchJoin[]).map((b) => {
    const ing = Array.isArray(b.ingredient) ? b.ingredient[0] : b.ingredient
    return {
      id: b.id,
      ingredientId: b.ingredient_id,
      ingredientName: ing?.name || 'Unknown Ingredient',
      unit: ing?.unit || 'unit',
      batchCode: b.batch_code,
      quantityRemaining: Number(b.quantity_remaining) || 0,
      expirationDate: b.expiration_date,
      receivedDate: b.received_date,
    }
  })

  type TxJoin = {
    id: string
    quantity_change: number
    reason: string | null
    created_at: string
    ingredient: { name: string; unit: string }[] | { name: string; unit: string } | null
  }

  const recentWaste: RecentWasteRecord[] = ((rawWasteTxs || []) as unknown as TxJoin[]).map((tx) => {
    const ing = Array.isArray(tx.ingredient) ? tx.ingredient[0] : tx.ingredient
    return {
      id: tx.id,
      ingredientName: ing?.name || 'Unknown',
      quantity: Number(tx.quantity_change) || 0,
      unit: ing?.unit || '',
      reason: tx.reason || 'Spoiled / Discarded',
      createdAt: tx.created_at,
    }
  })

  return {
    ingredients,
    recentDeliveries,
    activeBatches,
    recentWaste,
  }
}
