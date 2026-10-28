import { createClient } from '@/lib/supabase/server'
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
  discrepancy: number | null
  financialImpact: number
  notes: string | null
  performed_by: string | null
  created_at: string
}

async function getAuditReportsData(): Promise<AuditReportTransaction[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('inventory_transactions')
    .select(`
      id,
      ingredient_id,
      transaction_type,
      quantity_change,
      new_stock,
      previous_stock,
      reason,
      performed_by,
      created_at,
      ingredient:ingredients (
        name,
        unit,
        cost_per_unit
      )
    `)
    .order('created_at', { ascending: false })
    .limit(100)

  if (error || !data) {
    console.error('Error fetching audit reports data:', error)
    return []
  }

  type IngData = { name: string; unit: string; cost_per_unit: number | null }
  type TxRow = {
    id: string
    ingredient_id: string
    transaction_type: 'RESTOCK' | 'WASTE' | 'CYCLE_COUNT' | 'SALE'
    quantity_change: number
    new_stock: number | null
    previous_stock: number | null
    reason: string | null
    performed_by: string | null
    created_at: string
    ingredient: IngData[] | IngData | null
  }

  const txList = (data || []) as unknown as TxRow[]

  return txList.map((tx) => {
    const ing = Array.isArray(tx.ingredient) ? (tx.ingredient[0] as IngData) : (tx.ingredient as IngData)
    const name = ing?.name || 'Unknown'
    const unit = ing?.unit || 'units'
    const unitCost = Number(ing?.cost_per_unit) || 0

    let discrepancy: number | null = null
    let recordedQty = Number(tx.quantity_change) || 0

    if (tx.transaction_type === 'CYCLE_COUNT') {
      const actual = tx.new_stock !== null && tx.new_stock !== undefined ? Number(tx.new_stock) : recordedQty
      const prev = tx.previous_stock !== null && tx.previous_stock !== undefined ? Number(tx.previous_stock) : actual
      discrepancy = actual - prev
      recordedQty = actual
    }

    // Financial impact calculation
    let financialImpact = 0
    if (tx.transaction_type === 'CYCLE_COUNT' && discrepancy !== null) {
      financialImpact = discrepancy * unitCost
    } else if (tx.transaction_type === 'WASTE') {
      financialImpact = -(recordedQty * unitCost)
    } else if (tx.transaction_type === 'RESTOCK') {
      financialImpact = recordedQty * unitCost
    } else if (tx.transaction_type === 'SALE') {
      financialImpact = recordedQty * unitCost
    }

    return {
      id: tx.id,
      ingredient_id: tx.ingredient_id,
      ingredientName: name,
      unit,
      unitCost,
      transaction_type: tx.transaction_type,
      quantity: recordedQty,
      discrepancy,
      financialImpact: Math.round(financialImpact * 100) / 100,
      notes: tx.reason,
      performed_by: tx.performed_by,
      created_at: tx.created_at,
    }
  })
}

export default async function ReportsPage() {
  const transactions = await getAuditReportsData()
  return <ReportsClient initialTransactions={transactions} />
}
