'use server'

import { createClient } from '@/lib/supabase/server'
import { computeEodIngredientDeductions, UnmappedSoldItem } from '@/lib/eod-sales'
import { CloverItem } from '@/lib/types'
import { revalidatePath } from 'next/cache'

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

function revalidateRecipeAndInventoryPaths() {
  revalidatePath('/manager/close-day')
  revalidatePath('/manager/recipes')
  revalidatePath('/manager/dashboard')
  revalidatePath('/manager/reports')
  revalidatePath('/manager/thresholds')
  revalidatePath('/manager/groceries')
  revalidatePath('/staff/dashboard')
  revalidatePath('/staff/stock')
  revalidatePath('/staff/groceries')
  revalidatePath('/staff/waste')
  revalidatePath('/staff/cycle-count')
}

export async function createCloverItemAction(input: {
  name: string
  cloverId?: string
  price: number
  category: string
}) {
  try {
    const supabase = await createClient()
    const name = input.name.trim()
    if (!name) {
      return { success: false, error: 'Menu item name is required' }
    }

    const cloverId = input.cloverId?.trim() || `CLV-${Date.now().toString().slice(-4)}`
    const price = Number.isFinite(Number(input.price)) ? Math.max(0, Number(input.price)) : 0

    const { data, error } = await supabase
      .from('clover_items')
      .insert({
        name,
        clover_id: cloverId,
        price,
        category: input.category || 'Chè (Desserts)',
        is_active: true,
      })
      .select()
      .single()

    if (error) {
      return { success: false, error: error.message }
    }

    revalidatePath('/manager/recipes')
    return { success: true, data: { ...data, price: Number(data.price) || 0, recipe_ingredients: [] } }
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to create Clover item',
    }
  }
}

export async function upsertRecipeIngredientAction(input: {
  cloverItemId: string
  ingredientId: string
  quantityRequired: number
}) {
  try {
    const supabase = await createClient()
    const qty = Number(input.quantityRequired)
    if (!input.cloverItemId || !input.ingredientId || !Number.isFinite(qty) || qty <= 0) {
      return { success: false, error: 'Please select an ingredient and enter a quantity > 0' }
    }

    const { data, error } = await supabase
      .from('recipe_ingredients')
      .upsert(
        {
          clover_item_id: input.cloverItemId,
          ingredient_id: input.ingredientId,
          quantity_required: qty,
        },
        { onConflict: 'clover_item_id,ingredient_id' }
      )
      .select(`
        id,
        clover_item_id,
        ingredient_id,
        quantity_required,
        ingredient:ingredients (
          id,
          name,
          unit,
          cost_per_unit
        )
      `)
      .single()

    if (error) {
      return { success: false, error: error.message }
    }

    revalidatePath('/manager/recipes')
    return { success: true, data }
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to save recipe ingredient',
    }
  }
}

export async function removeRecipeIngredientAction(recipeIngredientId: string) {
  try {
    const supabase = await createClient()
    if (!recipeIngredientId) {
      return { success: false, error: 'Recipe ingredient ID is required' }
    }

    const { error } = await supabase
      .from('recipe_ingredients')
      .delete()
      .eq('id', recipeIngredientId)

    if (error) {
      return { success: false, error: error.message }
    }

    revalidatePath('/manager/recipes')
    return { success: true }
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to remove ingredient from recipe',
    }
  }
}

export interface EodCommittedStatus {
  alreadyCommitted: boolean
  existingCount: number
  lastCommittedAt: string | null
  referenceIds: string[]
}

export async function checkEodSalesCommittedAction(
  businessDate: string
): Promise<EodCommittedStatus> {
  if (!DATE_RE.test(businessDate)) {
    return {
      alreadyCommitted: false,
      existingCount: 0,
      lastCommittedAt: null,
      referenceIds: [],
    }
  }

  try {
    const supabase = await createClient()
    const baseRef = `EOD-SALES-${businessDate}`

    const { data, error } = await supabase
      .from('inventory_transactions')
      .select('reference_id, created_at')
      .eq('transaction_type', 'SALE')
      .or(`reference_id.eq.${baseRef},reference_id.like.${baseRef}-%`)
      .order('created_at', { ascending: false })

    if (error || !data || data.length === 0) {
      return {
        alreadyCommitted: false,
        existingCount: 0,
        lastCommittedAt: null,
        referenceIds: [],
      }
    }

    const refs = Array.from(
      new Set(data.map((r) => r.reference_id as string).filter(Boolean))
    )

    return {
      alreadyCommitted: true,
      existingCount: data.length,
      lastCommittedAt: (data[0]?.created_at as string) || null,
      referenceIds: refs,
    }
  } catch {
    return {
      alreadyCommitted: false,
      existingCount: 0,
      lastCommittedAt: null,
      referenceIds: [],
    }
  }
}

export interface EodShortfallItem {
  ingredient_id: string
  name: string
  unit: string
  required: number
  available: number
  shortfall: number
}

export interface CommitEodSalesResult {
  success: boolean
  duplicate?: boolean
  existingCount?: number
  lastCommittedAt?: string | null
  referenceId?: string
  committedCount?: number
  shortfalls?: EodShortfallItem[]
  unmappedSoldItems?: UnmappedSoldItem[]
  error?: string
}

export async function commitEodSalesAction(input: {
  businessDate: string
  salesByCloverItemId: Record<string, number>
  allowSupplemental?: boolean
  note?: string
}): Promise<CommitEodSalesResult> {
  try {
    if (!DATE_RE.test(input.businessDate)) {
      return { success: false, error: 'Please select a valid business date (YYYY-MM-DD).' }
    }

    const supabase = await createClient()

    const [{ data: cloverItemsRaw, error: cloverErr }, { data: ingredientsRaw, error: ingErr }] =
      await Promise.all([
        supabase
          .from('clover_items')
          .select(`
            id,
            name,
            clover_id,
            price,
            category,
            is_active,
            created_at,
            recipe_ingredients (
              id,
              clover_item_id,
              ingredient_id,
              quantity_required
            )
          `)
          .eq('is_active', true),
        supabase
          .from('ingredients')
          .select('id, name, unit, cost_per_unit, current_stock'),
      ])

    if (cloverErr || ingErr) {
      return {
        success: false,
        error: cloverErr?.message || ingErr?.message || 'Failed to load catalog for deduction.',
      }
    }

    const cloverItems = (cloverItemsRaw || []) as unknown as CloverItem[]
    const ingredients = (ingredientsRaw || []).map((i) => ({
      id: i.id as string,
      name: i.name as string,
      unit: i.unit as string,
      cost_per_unit: Number(i.cost_per_unit) || 0,
      currentStock: Number(i.current_stock) || 0,
    }))

    const { deductions, unmappedSoldItems, totalItemsSold } = computeEodIngredientDeductions(
      input.salesByCloverItemId || {},
      cloverItems,
      ingredients
    )

    if (totalItemsSold === 0) {
      return { success: false, error: 'Enter or scan at least one sold menu item.' }
    }

    if (deductions.length === 0) {
      return {
        success: false,
        unmappedSoldItems,
        error:
          'None of the sold items have recipe ingredients mapped yet. Map recipes first to deduct raw ingredients.',
      }
    }

    const rpcPayload = deductions.map((d) => ({
      ingredient_id: d.ingredientId,
      quantity: d.totalRequired,
      reason: `Clover EOD sales (${input.businessDate} · ${totalItemsSold} items sold)`,
    }))

    const { data, error: rpcErr } = await supabase.rpc('commit_eod_sales', {
      p_business_date: input.businessDate,
      p_deductions: rpcPayload,
      p_allow_supplemental: Boolean(input.allowSupplemental),
      p_note: input.note?.trim() || null,
    })

    if (rpcErr) {
      console.error('commit_eod_sales RPC error:', rpcErr)
      if (rpcErr.code === 'PGRST202') {
        return {
          success: false,
          error:
            'Database RPC commit_eod_sales is missing. Run supabase/migrations/20261119_data_integrity_and_fifo_sync.sql in Supabase SQL Editor.',
        }
      }
      return { success: false, error: rpcErr.message }
    }

    const result = (data || {}) as {
      success?: boolean
      duplicate?: boolean
      existing_count?: number
      last_committed_at?: string | null
      reference_id?: string
      committed_count?: number
      shortfalls?: EodShortfallItem[]
      error?: string
    }

    if (result.duplicate) {
      return {
        success: false,
        duplicate: true,
        existingCount: result.existing_count,
        lastCommittedAt: result.last_committed_at || null,
        error: `EOD sales for ${input.businessDate} were already committed (${result.existing_count} deduction logs). Enable "Commit as supplemental batch" to record additional sales.`,
      }
    }

    if (!result.success) {
      return {
        success: false,
        error: result.error || 'Failed to commit EOD sales deduction',
      }
    }

    revalidateRecipeAndInventoryPaths()

    return {
      success: true,
      referenceId: result.reference_id,
      committedCount: result.committed_count,
      shortfalls: result.shortfalls || [],
      unmappedSoldItems,
    }
  } catch (err: unknown) {
    console.error('commitEodSalesAction fatal error:', err)
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Unexpected error committing EOD sales',
    }
  }
}
