import { createClient } from '@/lib/supabase/server'
import WasteForm from './WasteForm'

export const dynamic = 'force-dynamic'

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

async function getWastePageData(): Promise<{
  batches: WasteBatchOption[]
  recentWaste: RecentWasteRecord[]
}> {
  const supabase = await createClient()

  // 1. Fetch active batches with remaining quantity
  const { data: rawBatches } = await supabase
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
    .gt('quantity_remaining', 0)
    .order('expiration_date', { ascending: true })

  // 2. Fetch recent waste transactions
  const { data: rawWasteTxs } = await supabase
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
    .limit(10)

  type BatchJoin = {
    id: string
    ingredient_id: string
    batch_code: string | null
    quantity_remaining: number
    expiration_date: string | null
    received_date: string
    ingredient: { id: string; name: string; unit: string }[] | { id: string; name: string; unit: string } | null
  }

  const batches: WasteBatchOption[] = ((rawBatches || []) as unknown as BatchJoin[]).map((b) => {
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

  return { batches, recentWaste }
}

export default async function WastePage() {
  const data = await getWastePageData()
  return <WasteForm batches={data.batches} recentWaste={data.recentWaste} />
}
