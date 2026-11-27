'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  ArrowRight,
  Check,
  ClipboardCheck,
  PackagePlus,
  Trash2,
} from 'lucide-react'
import StaffDesktopNav from '@/components/StaffDesktopNav'
import { logWasteAction } from '@/app/actions/inventory'
import { WasteBatchOption, RecentWasteRecord } from './page'

interface Props {
  batches: WasteBatchOption[]
  recentWaste: RecentWasteRecord[]
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return 'No expiry'
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  })
}

export default function WasteForm({ batches, recentWaste }: Props) {
  const router = useRouter()

  const [batchId, setBatchId] = useState('')
  const [wasteAmount, setWasteAmount] = useState('')
  const [reason, setReason] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')

  const selectedBatch = batches.find((b) => b.id === batchId)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!batchId || !wasteAmount) {
      setError('Select an active batch and enter the wasted amount')
      return
    }

    const qty = parseFloat(wasteAmount)
    if (!qty || qty <= 0) {
      setError('Enter a waste amount greater than 0')
      return
    }

    if (selectedBatch && qty > selectedBatch.quantityRemaining) {
      setError(
        `Cannot exceed remaining batch stock (${selectedBatch.quantityRemaining} ${selectedBatch.unit})`
      )
      return
    }

    setLoading(true)
    setError('')

    const res = await logWasteAction({
      batchId,
      ingredientId: selectedBatch?.ingredientId || '',
      quantity: qty,
      reason: reason || 'Spoiled / Discarded by staff',
    })

    setLoading(false)

    if (!res.success) {
      setError(res.error || 'Failed to log waste')
      return
    }

    setSuccess(true)
    setBatchId('')
    setWasteAmount('')
    setReason('')
    router.refresh()
    setTimeout(() => setSuccess(false), 3500)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <p className="text-xs text-[#737373]">Staff operations</p>
          <h1 className="text-2xl sm:text-[28px] leading-[1.15] font-medium text-[#171717] tracking-[-0.015em] mt-1">
            Log waste
          </h1>
          <p className="text-sm text-[#525252] mt-1">
            Record spoiled or discarded batches to keep stock accurate
          </p>
        </div>
        <StaffDesktopNav />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-7 space-y-6">
          <section className="space-y-3">
            <h2 className="text-sm font-medium text-[#171717]">Quick actions</h2>
            <div className="grid grid-cols-3 gap-3">
              <button
                type="button"
                className="flex flex-col items-start gap-3 p-4 bg-[#fff7ed] border border-[#fed7aa] rounded-2xl text-left"
              >
                <div className="w-9 h-9 rounded-lg bg-white border border-[#fed7aa] flex items-center justify-center text-[#c2410c]">
                  <Trash2 size={16} strokeWidth={1.5} />
                </div>
                <span className="text-sm font-medium text-[#c2410c]">Log waste</span>
              </button>

              <button
                type="button"
                onClick={() => router.push('/staff/restock')}
                className="flex flex-col items-start gap-3 p-4 surface-card-interactive rounded-2xl text-left"
              >
                <div className="w-9 h-9 rounded-lg bg-[#f4f4f5] border border-neutral-900/[0.06] flex items-center justify-center text-[#525252]">
                  <PackagePlus size={16} strokeWidth={1.5} />
                </div>
                <span className="text-sm font-medium text-[#171717]">Manual restock</span>
              </button>

              <button
                type="button"
                onClick={() => router.push('/staff/cycle-count')}
                className="flex flex-col items-start gap-3 p-4 surface-card-interactive rounded-2xl text-left"
              >
                <div className="w-9 h-9 rounded-lg bg-[#f4f4f5] border border-neutral-900/[0.06] flex items-center justify-center text-[#525252]">
                  <ClipboardCheck size={16} strokeWidth={1.5} />
                </div>
                <span className="text-sm font-medium text-[#171717]">Cycle count</span>
              </button>
            </div>
          </section>

          <section className="surface-card rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-medium text-[#171717]">Recent waste records</h2>
                <p className="text-xs text-[#737373] mt-0.5">Discarded inventory log</p>
              </div>
              <span className="font-mono text-xs tabular-nums text-[#737373]">
                {recentWaste.length} logged
              </span>
            </div>

            {recentWaste.length === 0 ? (
              <p className="text-xs text-[#737373] py-6 text-center">
                No waste recorded yet
              </p>
            ) : (
              <div className="divide-y divide-neutral-900/[0.06]">
                {recentWaste.map((rec) => {
                  const dateStr = new Date(rec.createdAt).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    hour: 'numeric',
                    minute: '2-digit',
                  })
                  return (
                    <div
                      key={rec.id}
                      className="py-3 flex items-center justify-between gap-3 first:pt-0 last:pb-0"
                    >
                      <div className="min-w-0">
                        <span className="text-sm font-medium text-[#171717] block truncate">
                          {rec.ingredientName}
                        </span>
                        <span className="text-xs text-[#737373] font-mono tabular-nums">
                          {rec.reason} · {dateStr}
                        </span>
                      </div>
                      <span className="font-mono text-xs tabular-nums text-[#b91c1c] bg-[#fef2f2] px-2 py-0.5 rounded-md border border-[#fecaca] shrink-0">
                        -{rec.quantity} {rec.unit}
                      </span>
                    </div>
                  )
                })}
              </div>
            )}
          </section>
        </div>

        <div className="lg:col-span-5">
          <div className="surface-card rounded-2xl p-6 space-y-5">
            <div>
              <h2 className="text-base font-medium text-[#171717]">Waste entry</h2>
              <p className="text-xs text-[#737373] mt-0.5">
                Select a batch and record discarded stock
              </p>
            </div>

            {success && (
              <div className="p-3 bg-[#f0fdf4] border border-[#bbf7d0] rounded-xl text-[#15803d] text-xs font-medium flex items-center gap-2">
                <Check size={14} strokeWidth={1.5} />
                <span>Waste logged</span>
              </div>
            )}

            {error && (
              <div className="p-3 bg-[#fef2f2] border border-[#fecaca] rounded-xl text-[#b91c1c] text-xs font-medium">
                {error}
              </div>
            )}

            {batches.length === 0 ? (
              <div className="text-center py-8 bg-[#fafafa] rounded-xl border border-dashed border-neutral-900/[0.12]">
                <p className="text-sm font-medium text-[#171717]">No active batches</p>
                <p className="text-xs text-[#737373] mt-1">
                  All batches are currently empty
                </p>
                <button
                  type="button"
                  onClick={() => router.push('/staff/restock')}
                  className="mt-3 text-xs font-medium text-[#c2410c] hover:text-[#9a3412] inline-flex items-center gap-1"
                >
                  <span>Restock ingredients</span>
                  <ArrowRight size={14} strokeWidth={1.5} />
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="block text-xs font-medium text-[#525252]">
                    Ingredient batch
                  </label>
                  <select
                    value={batchId}
                    onChange={(e) => {
                      setBatchId(e.target.value)
                      setWasteAmount('')
                    }}
                    className="w-full h-10 bg-white border border-neutral-900/[0.14] hover:border-neutral-900/[0.24] rounded-xl px-3 text-sm text-[#171717] focus:outline-none focus:ring-2 focus:ring-[#c2410c] focus:border-transparent transition-colors"
                    required
                  >
                    <option value="">Select batch</option>
                    {batches.map((batch) => (
                      <option key={batch.id} value={batch.id}>
                        {batch.ingredientName} — {batch.quantityRemaining} {batch.unit} (Exp {formatDate(batch.expirationDate)})
                      </option>
                    ))}
                  </select>
                </div>

                {selectedBatch && (
                  <div className="bg-[#fafafa] border border-neutral-900/[0.08] rounded-xl p-3 space-y-1.5 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-[#737373]">Remaining</span>
                      <span className="font-mono tabular-nums font-medium text-[#171717]">
                        {selectedBatch.quantityRemaining} {selectedBatch.unit}
                      </span>
                    </div>
                    {selectedBatch.expirationDate && (
                      <div className="flex items-center justify-between">
                        <span className="text-[#737373]">Expiration</span>
                        <span className="batch-stamp">
                          Exp {formatDate(selectedBatch.expirationDate)}
                        </span>
                      </div>
                    )}
                  </div>
                )}

                <div className="space-y-1.5">
                  <label className="block text-xs font-medium text-[#525252]">
                    Wasted quantity{selectedBatch ? ` (${selectedBatch.unit})` : ''}
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    max={selectedBatch?.quantityRemaining}
                    placeholder="0"
                    value={wasteAmount}
                    onChange={(e) => setWasteAmount(e.target.value)}
                    className="w-full h-10 bg-white border border-neutral-900/[0.14] rounded-xl px-3 text-sm font-mono tabular-nums text-[#171717] placeholder-[#a3a3a3] focus:outline-none focus:ring-2 focus:ring-[#c2410c]"
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-medium text-[#525252]">
                    Reason
                  </label>
                  <input
                    type="text"
                    placeholder="Spoiled past shelf life"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    className="w-full h-10 bg-white border border-neutral-900/[0.14] rounded-xl px-3 text-sm text-[#171717] placeholder-[#a3a3a3] focus:outline-none focus:ring-2 focus:ring-[#c2410c]"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading || !batchId}
                  className="w-full h-10 btn-primary rounded-xl text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? 'Submitting…' : 'Log waste'}
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
