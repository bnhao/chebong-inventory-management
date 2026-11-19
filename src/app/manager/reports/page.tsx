import { createClient } from '@/lib/supabase/server'
import { getStoreRangeBoundsUtc, StoreRangeBounds } from '@/lib/timezone'
import ReportsClient from './ReportsClient'

export const dynamic = 'force-dynamic'

export interface AuditReportTransaction {
  id: string
  ingredient_id: string
  ingredientName: string
  unit: string
  unitCost: number
  transaction_type: 'RESTOCK' | 'WASTE' | 'CYCLE_COUNT' | 'SALE'
  quantity: number
  previous_stock: number | null
  new_stock: number | null
  discrepancy: number | null
  financialImpact: number
  notes: string | null
  reference_id: string | null
  performed_by: string | null
  created_at: string
}

const PAGE_SIZE = 1000
const MAX_ROWS = 10000

async function getAuditReportsData(bounds: StoreRangeBounds): Promise<AuditReportTransaction[]> {
  const supabase = await createClient()

  type IngData = { name: string; unit: string; cost_per_unit: number | null }
  type TxRow = {
    id: string
    ingredient_id: string
    transaction_type: 'RESTOCK' | 'WASTE' | 'CYCLE_COUNT' | 'SALE'
    quantity_change: number
    new_stock: number | null
    previous_stock: number | null
    reason: string | null
    reference_id: string | null
    performed_by: string | null
    created_at: string
    ingredient: IngData[] | IngData | null
  }

  const allRows: TxRow[] = []

  for (let offset = 0; offset < MAX_ROWS; offset += PAGE_SIZE) {
    let query = supabase
      .from('inventory_transactions')
      .select(`
        id,
        ingredient_id,
        transaction_type,
        quantity_change,
        new_stock,
        previous_stock,
        reason,
        reference_id,
        performed_by,
        created_at,
        ingredient:ingredients (
          name,
          unit,
          cost_per_unit
        )
      `)
      .order('created_at', { ascending: false })
      .range(offset, offset + PAGE_SIZE - 1)

    if (bounds.startIso) {
      query = query.gte('created_at', bounds.startIso)
    }
    if (bounds.endIso) {
      query = query.lt('created_at', bounds.endIso)
    }

    const { data, error } = await query
    if (error) {
      console.error('Error fetching audit reports data:', error)
      break
    }

    const batch = (data || []) as unknown as TxRow[]
    allRows.push(...batch)
    if (batch.length < PAGE_SIZE) {
      break
    }
  }

  return allRows.map((tx) => {
    const ing = Array.isArray(tx.ingredient) ? (tx.ingredient[0] as IngData) : (tx.ingredient as IngData)
    const name = ing?.name || 'Unknown'
    const unit = ing?.unit || 'units'
    const unitCost = Number(ing?.cost_per_unit) || 0

    let discrepancy: number | null = null
    let recordedQty = Number(tx.quantity_change) || 0

    if (tx.transaction_type === 'CYCLE_COUNT') {
      const actual = tx.new_stock !== null && tx.new_stock !== undefined ? Number(tx.new_stock) : recordedQty
      const prev = tx.previous_stock !== null && tx.previous_stock !== undefined ? Number(tx.previous_stock) : actual
      discrepancy = Math.round((actual - prev) * 100) / 100
      recordedQty = actual
    }

    // Consistent inventory value change sign:
    // + for RESTOCK and positive cycle-count surplus,
    // - for SALE (COGS consumption), WASTE, and negative cycle-count shortage.
    let financialImpact = 0
    if (tx.transaction_type === 'CYCLE_COUNT' && discrepancy !== null) {
      financialImpact = discrepancy * unitCost
    } else if (tx.transaction_type === 'WASTE') {
      financialImpact = -(Math.abs(recordedQty) * unitCost)
    } else if (tx.transaction_type === 'RESTOCK') {
      financialImpact = Math.abs(recordedQty) * unitCost
    } else if (tx.transaction_type === 'SALE') {
      financialImpact = -(Math.abs(recordedQty) * unitCost)
    }

    return {
      id: tx.id,
      ingredient_id: tx.ingredient_id,
      ingredientName: name,
      unit,
      unitCost,
      transaction_type: tx.transaction_type,
      quantity: recordedQty,
      previous_stock: tx.previous_stock !== null ? Number(tx.previous_stock) : null,
      new_stock: tx.new_stock !== null ? Number(tx.new_stock) : null,
      discrepancy,
      financialImpact: Math.round(financialImpact * 100) / 100,
      notes: tx.reason,
      reference_id: tx.reference_id,
      performed_by: tx.performed_by,
      created_at: tx.created_at,
    }
  })
}

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string; from?: string; to?: string }>
}) {
  const params = await searchParams
  const bounds = getStoreRangeBoundsUtc(params?.range, params?.from, params?.to)
  const transactions = await getAuditReportsData(bounds)

  return (
    <ReportsClient
      initialTransactions={transactions}
      rangeKey={bounds.rangeKey}
      fromDate={bounds.fromDate}
      toDate={bounds.toDate}
    />
  )
}
