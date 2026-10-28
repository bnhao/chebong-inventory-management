'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export interface CreateIngredientInput {
  name: string
  unit: string
  low_stock_threshold?: number
  spoiled_time_limit_days?: number
  daily_usage_rate?: number
  cost_per_unit?: number
}

export async function createIngredientAction(input: CreateIngredientInput) {
  try {
    const supabase = await createClient()

    const name = input.name.trim()
    if (!name) {
      return { success: false, error: 'Ingredient name is required' }
    }

    const unit = input.unit.trim() || 'kg'
    const lowStock = Number(input.low_stock_threshold) || 0
    const spoiledDays = Number(input.spoiled_time_limit_days) || 7
    const dailyUsage = Number(input.daily_usage_rate) || 0
    const cost = Number(input.cost_per_unit) || 0

    const { data, error } = await supabase
      .from('ingredients')
      .insert({
        name,
        unit,
        current_stock: 0,
        low_stock_threshold: lowStock,
        spoiled_time_limit_days: spoiledDays,
        daily_usage_rate: dailyUsage,
        cost_per_unit: cost,
      })
      .select()
      .single()

    if (error) {
      console.error('Supabase create ingredient error:', error)
      if (error.code === '42501') {
        return {
          success: false,
          error: 'Permission denied by Row Level Security (RLS). Run the provided fix SQL in Supabase SQL Editor.',
          code: '42501',
        }
      }
      return { success: false, error: error.message, code: error.code }
    }

    revalidatePath('/staff/dashboard')
    revalidatePath('/staff/restock')
    revalidatePath('/staff/groceries')
    revalidatePath('/manager/dashboard')
    revalidatePath('/manager/thresholds')
    revalidatePath('/manager/recipes')

    return { success: true, data }
  } catch (err: unknown) {
    console.error('Server action error:', err)
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Unknown server error',
    }
  }
}

