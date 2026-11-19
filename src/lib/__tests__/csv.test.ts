import { describe, expect, it } from 'vitest'
import { AuditCsvRow, buildAuditCsv, escapeCsvCell } from '@/lib/csv'

describe('CSV escaping & audit ledger export', () => {
  it('properly quotes commas, double quotes, and newlines without corrupting signed numbers', () => {
    expect(escapeCsvCell('Nov 19, 2026, 04:10 PM')).toBe('"Nov 19, 2026, 04:10 PM"')
    expect(escapeCsvCell('Said "fresh batch" #1 & 100%')).toBe('"Said ""fresh batch"" #1 & 100%"')
    expect(escapeCsvCell('line1\nline2')).toBe('"line1\nline2"')
    expect(escapeCsvCell(-14.5)).toBe('-14.5')
    expect(escapeCsvCell('-14.50')).toBe('-14.50')
    expect(escapeCsvCell('=SUM(A1:A2)')).toBe("'=SUM(A1:A2)")
  })

  it('builds valid RFC-4180 CSV rows with #, %, & and quoted timestamps', () => {
    const rows: AuditCsvRow[] = [
      {
        created_at: '2026-11-19T22:15:00.000Z',
        transaction_type: 'WASTE',
        ingredientName: 'Durian Pulp',
        quantity: 1.5,
        unit: 'kg',
        previous_stock: 6,
        new_stock: 4.5,
        discrepancy: null,
        financialImpact: -21.0,
        reference_id: 'BATCH-#101&20%',
        notes: 'Expired "walk-in", shelf B\nDiscarded',
      },
    ]

    const csv = buildAuditCsv(rows, 'America/Edmonton')
    const lines = csv.split('\r\n')
    expect(lines[0]).toContain('Timestamp,Transaction Type,Ingredient')
    // Timestamp includes a comma from Intl formatting -> must be wrapped in quotes
    expect(csv).toContain('"Nov 19, 2026, 03:15 PM"')
    expect(csv).toContain('-21.00')
    expect(csv).toContain('BATCH-#101&20%')
    expect(csv).toContain('"Expired ""walk-in"", shelf B\nDiscarded"')
  })
})
