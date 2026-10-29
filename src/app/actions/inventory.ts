'use server'

import { createClient } from '@/lib/supabase/server'
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

// 1. SUBMIT RESTOCK ACTION
export async function submitRestockAction(input: RestockInput) {
  try {
    const supabase = await createClient()

    if (!input.ingredientId) {
      return { success: false, error: 'Please select an ingredient' }
    }
    const qty = Number(input.quantity)
    if (!qty || qty <= 0) {
      return { success: false, error: 'Please enter a valid quantity greater than 0' }
    }

    // Default expiration date if blank (now + 7 days) because expiration_date is NOT NULL
    let expDate = input.expirationDate
    if (!expDate || expDate.trim() === '') {
      const d = new Date()
      d.setDate(d.getDate() + 7)
      expDate = d.toISOString()
    } else {
      // Ensure ISO format
      expDate = new Date(expDate).toISOString()
    }

    const batchCode = input.batchCode || `BATCH-${Date.now().toString().slice(-6)}`

    // A. Insert into inventory_batches
    const { data: batch, error: batchErr } = await supabase
      .from('inventory_batches')
      .insert({
        ingredient_id: input.ingredientId,
        batch_code: batchCode,
        quantity_received: qty,
        quantity_remaining: qty,
        cost_per_unit: input.costPerUnit || 0,
        expiration_date: expDate,
        status: 'ACTIVE',
      })
      .select()
      .single()

    if (batchErr) {
      console.error('Batch creation error:', batchErr)
      return { success: false, error: `Batch creation failed: ${batchErr.message}` }
    }

    // B. Insert into inventory_transactions
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

    revalidatePath('/staff/dashboard')
    revalidatePath('/staff/restock')
    revalidatePath('/staff/cycle-count')
    revalidatePath('/staff/waste')
    revalidatePath('/staff/groceries')
    revalidatePath('/manager/dashboard')
    revalidatePath('/manager/thresholds')
    revalidatePath('/manager/reports')

    return { success: true, batchId: batch?.id, txId: tx?.id }
  } catch (err: unknown) {
    console.error('submitRestockAction fatal error:', err)
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error during restock' }
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
    if (!wasteQty || wasteQty <= 0) {
      return { success: false, error: 'Please enter a valid waste amount greater than 0' }
    }

    // If batchId is provided, decrement inventory_batches
    if (input.batchId) {
      const { data: batch } = await supabase
        .from('inventory_batches')
        .select('id, quantity_remaining')
        .eq('id', input.batchId)
        .single()

      if (batch) {
        const remaining = Number(batch.quantity_remaining) || 0
        const newRemaining = Math.max(0, remaining - wasteQty)
        await supabase
          .from('inventory_batches')
          .update({
            quantity_remaining: newRemaining,
            status: newRemaining <= 0 ? 'DEPLETED' : 'ACTIVE',
          })
          .eq('id', input.batchId)
      }
    }

    // Insert into inventory_transactions (trigger handle_inventory_transaction will deduct from ingredients.current_stock)
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

    revalidatePath('/staff/dashboard')
    revalidatePath('/staff/waste')
    revalidatePath('/staff/cycle-count')
    revalidatePath('/manager/dashboard')
    revalidatePath('/manager/reports')

    return { success: true, txId: tx?.id }
  } catch (err: unknown) {
    console.error('logWasteAction fatal error:', err)
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error during waste logging' }
  }
}

// 3. SUBMIT CYCLE COUNT ACTION
export async function submitCycleCountAction(entries: CycleCountEntry[]) {
  try {
    const supabase = await createClient()

    if (!entries || entries.length === 0) {
      return { success: false, error: 'No items submitted' }
    }

    for (const entry of entries) {
      const actual = Number(entry.actualCount)
      if (isNaN(actual) || actual < 0) continue

      // Insert transaction with new_stock
      const { error: txErr } = await supabase
        .from('inventory_transactions')
        .insert({
          ingredient_id: entry.ingredientId,
          transaction_type: 'CYCLE_COUNT',
          quantity_change: 0,
          new_stock: actual,
          reason: entry.notes || 'Physical inventory cycle count audit',
        })

      if (txErr) {
        console.error('Cycle count error for ingredient:', entry.ingredientId, txErr)
      }
    }

    revalidatePath('/staff/dashboard')
    revalidatePath('/staff/cycle-count')
    revalidatePath('/manager/dashboard')
    revalidatePath('/manager/thresholds')
    revalidatePath('/manager/reports')

    return { success: true }
  } catch (err: unknown) {
    console.error('submitCycleCountAction error:', err)
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error during cycle count' }
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
        spoiled_time_limit_days: Number(input.spoiled_time_limit_days) || 7,
        daily_usage_rate: Number(input.daily_usage_rate) || 0,
        cost_per_unit: Number(input.cost_per_unit) || 0,
        description: input.description || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', input.id)
      .select()
      .single()

    if (error) {
      console.error('Update ingredient error:', error)
      return { success: false, error: error.message }
    }

    revalidatePath('/manager/thresholds')
    revalidatePath('/manager/recipes')
    revalidatePath('/manager/dashboard')
    revalidatePath('/staff/dashboard')
    revalidatePath('/staff/restock')

    return { success: true, data }
  } catch (err: unknown) {
    console.error('updateIngredientAction fatal error:', err)
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error updating ingredient' }
  }
}

// 5. BATCH RESTOCK ACTION (For 'Restock Checked' grocery shopping runs)
export interface BatchRestockItem {
  ingredientId: string
  quantity: number
  unitCost?: number
}

export async function submitBatchRestockAction(items: BatchRestockItem[], locationOrNote?: string) {
  try {
    const supabase = await createClient()
    if (!items || items.length === 0) {
      return { success: false, error: 'No items selected to restock' }
    }

    const now = new Date()
    const defaultExp = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString()
    const batchGroupCode = `GROCERY-${Date.now().toString().slice(-6)}`

    for (const item of items) {
      if (item.quantity <= 0) continue

      const { data: batch, error: batchErr } = await supabase
        .from('inventory_batches')
        .insert({
          ingredient_id: item.ingredientId,
          batch_code: batchGroupCode,
          quantity_received: item.quantity,
          quantity_remaining: item.quantity,
          cost_per_unit: item.unitCost || 0,
          expiration_date: defaultExp,
          status: 'ACTIVE',
        })
        .select()
        .single()

      if (batchErr) {
        console.error('Batch error:', batchErr)
        continue
      }

      await supabase
        .from('inventory_transactions')
        .insert({
          ingredient_id: item.ingredientId,
          batch_id: batch?.id || null,
          transaction_type: 'RESTOCK',
          quantity_change: item.quantity,
          reason: locationOrNote || 'Restocked from grocery run (Costco / Asian Market)',
          reference_id: batchGroupCode,
        })
    }

    revalidatePath('/staff/dashboard')
    revalidatePath('/staff/restock')
    revalidatePath('/staff/groceries')
    revalidatePath('/manager/dashboard')
    revalidatePath('/manager/reports')

    return { success: true, count: items.length }
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : 'Batch restock failed' }
  }
}

