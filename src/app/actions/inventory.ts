'use server'

import { createClient } from '@/lib/supabase/server'
import { computeExpirationIso } from '@/lib/timezone'
import { revalidatePath } from 'next/cache'

export interface RestockInput {
  ingredientId: string
  quantity: number
  expirationDate?: string | null
  batchCode?: string | null
  costPerUnit?: number
  reason?: string
}

export interface WasteInput {
  batchId?: string | null
  ingredientId: string
  quantity: number
  reason?: string
}

export interface CycleCountEntry {
  ingredientId: string
  actualCount: number
  notes?: string
}

export interface UpdateIngredientInput {
  id: string
  name: string
  unit: string
  low_stock_threshold: number
  spoiled_time_limit_days: number
  daily_usage_rate: number
  cost_per_unit?: number
  description?: string | null
}

function revalidateInventoryRoutes() {
  revalidatePath('/staff/dashboard')
  revalidatePath('/staff/stock')
  revalidatePath('/staff/restock')
  revalidatePath('/staff/cycle-count')
  revalidatePath('/staff/waste')
  revalidatePath('/staff/groceries')
  revalidatePath('/manager/dashboard')
  revalidatePath('/manager/close-day')
  revalidatePath('/manager/thresholds')
  revalidatePath('/manager/reports')
  revalidatePath('/manager/groceries')
  revalidatePath('/manager/recipes')
}

// 1. SUBMIT RESTOCK ACTION
export async function submitRestockAction(input: RestockInput) {
  try {
    const supabase = await createClient()

    if (!input.ingredientId) {
      return { success: false, error: 'Please select an ingredient' }
    }
    const qty = Number(input.quantity)
    if (!Number.isFinite(qty) || qty <= 0) {
      return { success: false, error: 'Please enter a valid quantity greater than 0' }
    }

    const { data: ing, error: ingErr } = await supabase
      .from('ingredients')
      .select('spoiled_time_limit_days, cost_per_unit')
      .eq('id', input.ingredientId)
      .single()

    if (ingErr || !ing) {
      return { success: false, error: 'Selected ingredient was not found' }
    }

    const shelfLifeDays = Number(ing.spoiled_time_limit_days) || 7
    const expDate = computeExpirationIso(input.expirationDate, shelfLifeDays)
    const unitCost =
      input.costPerUnit !== undefined && Number.isFinite(Number(input.costPerUnit))
        ? Math.max(0, Number(input.costPerUnit))
        : Math.max(0, Number(ing.cost_per_unit) || 0)

    const batchCode = input.batchCode || `BATCH-${Date.now().toString().slice(-6)}`
    const nowIso = new Date().toISOString()

    // A. Insert into inventory_batches
    const { data: batch, error: batchErr } = await supabase
      .from('inventory_batches')
      .insert({
        ingredient_id: input.ingredientId,
        batch_code: batchCode,
        quantity_received: qty,
        quantity_remaining: qty,
        cost_per_unit: unitCost,
        received_date: nowIso,
        expiration_date: expDate,
        status: 'ACTIVE',
      })
      .select()
      .single()

    if (batchErr) {
      console.error('Batch creation error:', batchErr)
      return { success: false, error: `Batch creation failed: ${batchErr.message}` }
    }

    // B. Insert into inventory_transactions (trigger updates ingredients.current_stock)
    const { data: tx, error: txErr } = await supabase
      .from('inventory_transactions')
      .insert({
        ingredient_id: input.ingredientId,
        batch_id: batch?.id || null,
        transaction_type: 'RESTOCK',
        quantity_change: qty,
        reason: input.reason || 'Manual restock via staff app',
        reference_id: batchCode,
      })
      .select()
      .single()

    if (txErr) {
      console.error('Transaction error:', txErr)
      return { success: false, error: `Transaction logging failed: ${txErr.message}` }
    }

    revalidateInventoryRoutes()

    return { success: true, batchId: batch?.id, txId: tx?.id }
  } catch (err: unknown) {
    console.error('submitRestockAction fatal error:', err)
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Unknown error during restock',
    }
  }
}

// 2. LOG WASTE ACTION
export async function logWasteAction(input: WasteInput) {
  try {
    const supabase = await createClient()

    if (!input.ingredientId) {
      return { success: false, error: 'Please select an ingredient' }
    }
    const wasteQty = Number(input.quantity)
    if (!Number.isFinite(wasteQty) || wasteQty <= 0) {
      return { success: false, error: 'Please enter a valid waste amount greater than 0' }
    }

    if (input.batchId) {
      const { data: batch, error: batchErr } = await supabase
        .from('inventory_batches')
        .select('id, quantity_remaining')
        .eq('id', input.batchId)
        .single()

      if (batchErr || !batch) {
        return { success: false, error: 'Selected batch was not found' }
      }

      const remaining = Number(batch.quantity_remaining) || 0
      if (wasteQty > remaining) {
        return {
          success: false,
          error: `Cannot log ${wasteQty} waste when only ${remaining} remains in this batch.`,
        }
      }
    }

    // Insert into inventory_transactions: trigger atomically updates both ingredients.current_stock and inventory_batches
    const { data: tx, error: txErr } = await supabase
      .from('inventory_transactions')
      .insert({
        ingredient_id: input.ingredientId,
        batch_id: input.batchId || null,
        transaction_type: 'WASTE',
        quantity_change: wasteQty,
        reason: input.reason || 'Spoiled / Discarded by staff',
      })
      .select()
      .single()

    if (txErr) {
      console.error('Waste transaction error:', txErr)
      return { success: false, error: `Waste log failed: ${txErr.message}` }
    }

    revalidateInventoryRoutes()

    return { success: true, txId: tx?.id }
  } catch (err: unknown) {
    console.error('logWasteAction fatal error:', err)
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Unknown error during waste logging',
    }
  }
}

// 3. SUBMIT CYCLE COUNT ACTION (Atomic RPC)
export async function submitCycleCountAction(entries: CycleCountEntry[]) {
  try {
    const supabase = await createClient()

    if (!entries || entries.length === 0) {
      return { success: false, error: 'No items submitted' }
    }

    const validEntries = entries
      .map((entry) => ({
        ingredient_id: entry.ingredientId,
        actual_count: Number(entry.actualCount),
        reason: entry.notes?.trim() || 'Physical inventory cycle count audit',
      }))
      .filter((e) => e.ingredient_id && Number.isFinite(e.actual_count) && e.actual_count >= 0)

    if (validEntries.length === 0) {
      return { success: false, error: 'Please enter at least one valid count (0 or greater).' }
    }

    const { data, error } = await supabase.rpc('submit_cycle_count_batch', {
      p_entries: validEntries,
    })

    if (error) {
      console.error('submitCycleCountAction RPC error:', error)
      if (error.code === 'PGRST202') {
        return {
          success: false,
          error:
            'Database RPC submit_cycle_count_batch is missing. Run supabase/migrations/20261119_data_integrity_and_fifo_sync.sql in Supabase SQL Editor.',
        }
      }
      return { success: false, error: error.message }
    }

    if (data && typeof data === 'object' && 'success' in data && !data.success) {
      return {
        success: false,
        error: String((data as { error?: string }).error || 'Cycle count submission failed'),
      }
    }

    revalidateInventoryRoutes()

    return { success: true, count: validEntries.length }
  } catch (err: unknown) {
    console.error('submitCycleCountAction error:', err)
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Unknown error during cycle count',
    }
  }
}

// 4. UPDATE INGREDIENT ACTION (FULL EDIT)
export async function updateIngredientAction(input: UpdateIngredientInput) {
  try {
    const supabase = await createClient()

    if (!input.id) return { success: false, error: 'Ingredient ID is required' }
    if (!input.name.trim()) return { success: false, error: 'Ingredient name cannot be empty' }

    const { data, error } = await supabase
      .from('ingredients')
      .update({
        name: input.name.trim(),
        unit: input.unit.trim() || 'kg',
        low_stock_threshold: Number(input.low_stock_threshold) || 0,
        spoiled_time_limit_days: Math.max(1, parseInt(String(input.spoiled_time_limit_days), 10) || 7),
        daily_usage_rate: Number(input.daily_usage_rate) || 0,
        cost_per_unit: Number(input.cost_per_unit) || 0,
        description: input.description ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', input.id)
      .select()
      .single()

    if (error) {
      console.error('Update ingredient error:', error)
      return { success: false, error: error.message }
    }

    revalidateInventoryRoutes()

    return { success: true, data }
  } catch (err: unknown) {
    console.error('updateIngredientAction fatal error:', err)
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Unknown error updating ingredient',
    }
  }
}

// 5. BATCH RESTOCK ACTION (Atomic RPC for Grocery Runs)
export interface BatchRestockItem {
  ingredientId: string
  quantity: number
  unitCost?: number
}

export async function submitBatchRestockAction(items: BatchRestockItem[], locationOrNote?: string) {
  try {
    const supabase = await createClient()
    const validItems = (items || []).filter(
      (i) => i.ingredientId && Number.isFinite(Number(i.quantity)) && Number(i.quantity) > 0
    )

    if (validItems.length === 0) {
      return { success: false, error: 'No valid items selected to restock' }
    }

    const ids = validItems.map((i) => i.ingredientId)
    const { data: ingRows, error: ingErr } = await supabase
      .from('ingredients')
      .select('id, spoiled_time_limit_days, cost_per_unit')
      .in('id', ids)

    if (ingErr) {
      return { success: false, error: `Failed to load ingredient shelf-life settings: ${ingErr.message}` }
    }

    const ingMap = new Map<string, { spoiledDays: number; costPerUnit: number }>()
    for (const row of ingRows || []) {
      ingMap.set(row.id as string, {
        spoiledDays: Number(row.spoiled_time_limit_days) || 7,
        costPerUnit: Number(row.cost_per_unit) || 0,
      })
    }

    const now = new Date()
    const batchGroupCode = `GROCERY-${Date.now().toString().slice(-6)}`
    const payload = validItems.map((item) => {
      const meta = ingMap.get(item.ingredientId)
      const shelfLifeDays = meta?.spoiledDays ?? 7
      const costPerUnit =
        item.unitCost !== undefined && Number.isFinite(Number(item.unitCost))
          ? Math.max(0, Number(item.unitCost))
          : meta?.costPerUnit ?? 0

      return {
        ingredient_id: item.ingredientId,
        quantity: Number(item.quantity),
        cost_per_unit: costPerUnit,
        expiration_date: computeExpirationIso(null, shelfLifeDays, now),
      }
    })

    const { data, error } = await supabase.rpc('submit_restock_batch', {
      p_items: payload,
      p_batch_code: batchGroupCode,
      p_reason: locationOrNote || 'Restocked from grocery run (Costco / Asian Market)',
    })

    if (error) {
      console.error('submitBatchRestockAction RPC error:', error)
      if (error.code === 'PGRST202') {
        return {
          success: false,
          error:
            'Database RPC submit_restock_batch is missing. Run supabase/migrations/20261119_data_integrity_and_fifo_sync.sql in Supabase SQL Editor.',
        }
      }
      return { success: false, error: error.message }
    }

    if (data && typeof data === 'object' && 'success' in data && !data.success) {
      return {
        success: false,
        error: String((data as { error?: string }).error || 'Batch restock failed'),
      }
    }

    revalidateInventoryRoutes()

    return { success: true, count: validItems.length, batchCode: batchGroupCode }
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Batch restock failed',
    }
  }
}
