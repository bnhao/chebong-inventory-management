import { createClient } from '@/lib/supabase/server'
import RestockForm from './RestockForm'
import { Ingredient } from '@/lib/types'

export const dynamic = 'force-dynamic'

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

async function getRestockPageData() {
  const supabase = await createClient()

  // 1. Fetch ingredients
  const { data: rawIngredients } = await supabase
    .from('ingredients')
    .select('id, name, unit, low_stock_threshold, spoiled_time_limit_days, daily_usage_rate, cost_per_unit, created_at')
    .order('name', { ascending: true })

  // 2. Fetch recent deliveries from inventory_batches
  const { data: rawBatches } = await supabase
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
    .limit(8)

  type RawBatchRow = {
    id: string
    batch_code: string | null
    quantity_received: number
    quantity_remaining: number
    expiration_date: string | null
    created_at: string
    status: string
    ingredient: { name: string; unit: string }[] | { name: string; unit: string } | null
  }

  const recentDeliveries: RecentDelivery[] = ((rawBatches || []) as unknown as RawBatchRow[]).map((b) => {
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

  return {
    ingredients: (rawIngredients || []) as Ingredient[],
    recentDeliveries,
  }
}

export default async function RestockPage() {
  const data = await getRestockPageData()
  return (
    <RestockForm
      ingredients={data.ingredients}
      recentDeliveries={data.recentDeliveries}
    />
  )
}
