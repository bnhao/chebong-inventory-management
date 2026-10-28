'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import StaffDesktopNav from '@/components/StaffDesktopNav'
import { logWasteAction } from '@/app/actions/inventory'
import { WasteBatchOption, RecentWasteRecord } from './page'

interface Props {
  batches: WasteBatchOption[]
  recentWaste: RecentWasteRecord[]
}

function TrashIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#e85d04" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6"/>
      <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/>
      <path d="M10 11v6"/><path d="M14 11v6"/>
      <path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/>
    </svg>
  )
}

function PlusIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#e85d04" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="5" x2="12" y2="19"/>
      <line x1="5" y1="12" x2="19" y2="12"/>
    </svg>
  )
}

function CheckSquareIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 11 12 14 22 4"/>
      <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/>
    </svg>
  )
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
      setError('Please select an active batch and enter the wasted amount.')
      return
    }

    const qty = parseFloat(wasteAmount)
    if (!qty || qty <= 0) {
      setError('Please enter a valid waste amount greater than 0.')
      return
    }

    if (selectedBatch && qty > selectedBatch.quantityRemaining) {
      setError(
        `Cannot log more waste (${qty} ${selectedBatch.unit}) than remaining stock (${selectedBatch.quantityRemaining} ${selectedBatch.unit}).`
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
      {/* Subheader: Responsive header matching Dashboard */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
            Inventory Operations
          </p>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight mt-0.5">
            Log Waste
          </h1>
          <p className="text-xs sm:text-sm text-gray-500 mt-1">
            Record spoiled, damaged, or discarded ingredient batches to keep inventory accurate.
          </p>
        </div>
        <StaffDesktopNav />
      </div>

      {/* 12-Column Responsive Grid matching Dashboard 7/5 ratio */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column (7 cols): Quick Actions & Recent Waste History */}
        <div className="lg:col-span-7 space-y-6">
          {/* Quick Actions Bar */}
          <div className="space-y-3">
            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider block">
              QUICK ACTIONS
            </span>
            <div className="grid grid-cols-3 gap-3">
              {/* Log Waste (Active) */}
              <button
                type="button"
                className="flex flex-col items-center justify-center gap-2 bg-white border-2 border-[#e85d04] rounded-2xl p-4 shadow-xs"
              >
                <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-orange-50">
                  <TrashIcon />
                </div>
                <span className="text-xs font-bold text-[#e85d04] text-center">Log Waste</span>
              </button>

              {/* Manual Restock */}
              <button
                type="button"
                onClick={() => router.push('/staff/restock')}
                className="flex flex-col items-center justify-center gap-2 bg-white border border-gray-200/80 rounded-2xl p-4 shadow-xs active:scale-95 transition-all hover:border-gray-300"
              >
                <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-orange-50">
                  <PlusIcon />
                </div>
                <span className="text-xs font-medium text-gray-700 text-center">Manual Restock</span>
              </button>

              {/* Perform Cycle Count */}
              <button
                type="button"
                onClick={() => router.push('/staff/cycle-count')}
                className="flex flex-col items-center justify-center gap-2 bg-white border border-gray-200/80 rounded-2xl p-4 shadow-xs active:scale-95 transition-all hover:border-gray-300"
              >
                <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-green-50">
                  <CheckSquareIcon />
                </div>
                <span className="text-xs font-medium text-gray-700 text-center">Perform Cycle Count</span>
              </button>
            </div>
          </div>

          {/* Recent Waste Logs Card */}
          <div className="bg-white rounded-2xl border border-gray-200/80 shadow-xs p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-gray-900">Recent Waste Records</h3>
                <p className="text-xs text-gray-400 mt-0.5">Audit log of discarded inventory</p>
              </div>
              <span className="text-xs font-semibold text-red-600 bg-red-50 px-2.5 py-1 rounded-full border border-red-100">
                {recentWaste.length} logged
              </span>
            </div>

            {recentWaste.length === 0 ? (
              <p className="text-xs text-gray-400 py-6 text-center">
                No waste transactions recorded yet. Good job keeping spoilage low!
              </p>
            ) : (
              <div className="divide-y divide-gray-100 text-xs">
                {recentWaste.map((rec) => {
                  const dateStr = new Date(rec.createdAt).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    hour: 'numeric',
                    minute: '2-digit',
                  })
                  return (
                    <div key={rec.id} className="py-3 flex items-center justify-between first:pt-0 last:pb-0">
                      <div>
                        <span className="font-bold text-gray-900 block">{rec.ingredientName}</span>
                        <span className="text-gray-400 text-[11px]">{rec.reason} · {dateStr}</span>
                      </div>
                      <span className="font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded-lg border border-red-100">
                        -{rec.quantity} {rec.unit}
                      </span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right Column (5 cols): Waste Entry Form Card */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-white rounded-2xl border border-gray-200/80 shadow-xs p-5 sm:p-6 space-y-5">
            <div>
              <h2 className="text-lg font-extrabold text-gray-900 tracking-tight">Waste Entry</h2>
              <p className="text-xs text-gray-500 mt-0.5">Select a batch and log discarded stock.</p>
            </div>

            {success && (
              <div className="p-3.5 bg-green-50 border border-green-200 rounded-xl text-green-700 text-xs font-medium flex items-center gap-2">
                <span>✓</span> Waste logged successfully into inventory records!
              </div>
            )}

            {error && (
              <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl text-red-600 text-xs font-medium">
                {error}
              </div>
            )}

            {batches.length === 0 ? (
              <div className="text-center py-8 bg-gray-50/60 rounded-xl border border-dashed border-gray-200">
                <p className="text-gray-600 text-sm font-semibold">No active batches with stock</p>
                <p className="text-gray-400 text-xs mt-1">
                  All inventory batches are currently depleted or empty.
                </p>
                <button
                  type="button"
                  onClick={() => router.push('/staff/restock')}
                  className="mt-3 text-xs font-bold text-[#e85d04] hover:underline"
                >
                  Restock ingredients now →
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Batch Select */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider">
                    Ingredient Batch
                  </label>
                  <div className="relative">
                    <select
                      value={batchId}
                      onChange={(e) => {
                        setBatchId(e.target.value)
                        setWasteAmount('')
                      }}
                      className="w-full appearance-none bg-white border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#e85d04] focus:border-transparent pr-10 shadow-2xs"
                      required
                    >
                      <option value="">Select batch...</option>
                      {batches.map((batch) => (
                        <option key={batch.id} value={batch.id}>
                          {batch.ingredientName} — {batch.quantityRemaining} {batch.unit} (exp: {formatDate(batch.expirationDate)})
                        </option>
                      ))}
                    </select>
                    <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-gray-400">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="6 9 12 15 18 9"/>
                      </svg>
                    </div>
                  </div>
                </div>

                {/* Selected Batch Info Card */}
                {selectedBatch && (
                  <div className="bg-gray-50 border border-gray-100 rounded-xl p-3.5 space-y-1.5 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-gray-500 font-medium">Batch Remaining:</span>
                      <span className="font-extrabold text-gray-900">
                        {selectedBatch.quantityRemaining} {selectedBatch.unit}
                      </span>
                    </div>
                    {selectedBatch.expirationDate && (
                      <div className="flex items-center justify-between">
                        <span className="text-gray-500 font-medium">Expiration:</span>
                        <span className="font-semibold text-amber-700">
                          {formatDate(selectedBatch.expirationDate)}
                        </span>
                      </div>
                    )}
                  </div>
                )}

                {/* Waste Amount */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider">
                    Wasted Quantity {selectedBatch && `(${selectedBatch.unit})`}
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    max={selectedBatch?.quantityRemaining}
                    placeholder="0"
                    value={wasteAmount}
                    onChange={(e) => setWasteAmount(e.target.value)}
                    className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#e85d04] focus:border-transparent shadow-2xs"
                    required
                  />
                </div>

                {/* Reason */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider">
                    Reason / Cause
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Spoiled past shelf life, dropped container"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#e85d04] focus:border-transparent shadow-2xs"
                  />
                </div>

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={loading || !batchId}
                  className="w-full bg-[#e85d04] hover:bg-[#d45203] text-white font-bold py-3.5 rounded-xl text-sm transition-all duration-150 active:scale-98 disabled:opacity-50 disabled:cursor-not-allowed shadow-xs"
                >
                  {loading ? 'Submitting...' : 'Log Waste'}
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
