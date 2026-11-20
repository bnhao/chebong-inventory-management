import { formatStoreTimestamp, getStoreTimezone } from './timezone'

export interface AuditCsvRow {
  created_at: string
  transaction_type: 'RESTOCK' | 'WASTE' | 'CYCLE_COUNT' | 'SALE'
  ingredientName: string
  quantity: number
  unit: string
  previous_stock: number | null
  new_stock: number | null
  discrepancy: number | null
  financialImpact: number
  reference_id: string | null
  notes: string | null
}

const FORMULA_CHAR_RE = /^[=@\t\r]/
const SIGN_ONLY_TEXT_RE = /^[+-]/

export function escapeCsvCell(value: string | number | boolean | null | undefined): string {
  if (value === null || value === undefined) return ''
  if (typeof value === 'number') {
    return Number.isFinite(value) ? String(value) : ''
  }
  if (typeof value === 'boolean') {
    return value ? 'true' : 'false'
  }

  let str = String(value)
  if (FORMULA_CHAR_RE.test(str) || (SIGN_ONLY_TEXT_RE.test(str) && Number.isNaN(Number(str)))) {
    str = `'${str}`
  }

  if (/[",\r\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`
  }

  return str
}

export function buildAuditCsv(
  transactions: AuditCsvRow[],
  timeZone: string = getStoreTimezone()
): string {
  const headers = [
    'Timestamp',
    'Transaction Type',
    'Ingredient',
    'Quantity',
    'Unit',
    'Previous Stock',
    'New Stock',
    'Discrepancy',
    'Financial Impact ($)',
    'Reference ID',
    'Notes',
  ]

  const rows = transactions.map((tx) => [
    escapeCsvCell(formatStoreTimestamp(tx.created_at, timeZone)),
    escapeCsvCell(tx.transaction_type),
    escapeCsvCell(tx.ingredientName),
    escapeCsvCell(tx.quantity),
    escapeCsvCell(tx.unit),
    escapeCsvCell(tx.previous_stock !== null ? tx.previous_stock : ''),
    escapeCsvCell(tx.new_stock !== null ? tx.new_stock : ''),
    escapeCsvCell(tx.discrepancy !== null ? tx.discrepancy : 'N/A'),
    escapeCsvCell(tx.financialImpact.toFixed(2)),
    escapeCsvCell(tx.reference_id || ''),
    escapeCsvCell(tx.notes || ''),
  ])

  return [headers.map(escapeCsvCell).join(','), ...rows.map((r) => r.join(','))].join('\r\n')
}

export function downloadCsvFile(csvContent: string, filename: string): void {
  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
