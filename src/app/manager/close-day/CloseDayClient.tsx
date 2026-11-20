'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import RecipeEditModal from '@/components/RecipeEditModal'
import {
  checkEodSalesCommittedAction,
  commitEodSalesAction,
  CommitEodSalesResult,
  EodCommittedStatus,
} from '@/app/actions/recipes'
import {
  computeEodIngredientDeductions,
  ScannedLineConfidence,
  ScannedReceiptLine,
} from '@/lib/eod-sales'
import { RecipeIngredientOption } from '@/lib/recipes-data'
import { formatStoreTimestamp, getStoreTimezone } from '@/lib/timezone'
import { CloverItem } from '@/lib/types'

interface Props {
  initialCloverItems: CloverItem[]
  ingredients: RecipeIngredientOption[]
  defaultBusinessDate: string
}

interface SelectedPhoto {
  id: string
  file: File
  previewUrl: string
}

const MAX_SCAN_PHOTOS = 6
const MAX_SCAN_PHOTO_BYTES = 10 * 1024 * 1024

function MatchBadge({ confidence }: { confidence: ScannedLineConfidence }) {
  if (confidence === 'high') {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
        Matched
      </span>
    )
  }
  if (confidence === 'medium' || confidence === 'low') {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
        Check match
      </span>
    )
  }
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-50 text-red-700 border border-red-200">
      Not matched
    </span>
  )
}

export default function CloseDayClient({
  initialCloverItems,
  ingredients,
  defaultBusinessDate,
}: Props) {
  const router = useRouter()
  const storeTimeZone = getStoreTimezone()

  const [cloverItems, setCloverItems] = useState<CloverItem[]>(initialCloverItems)
  const [editingRecipeItem, setEditingRecipeItem] = useState<CloverItem | null>(null)

  useEffect(() => {
    setCloverItems(initialCloverItems)
    setEditingRecipeItem((prev) =>
      prev ? initialCloverItems.find((c) => c.id === prev.id) || null : null
    )
  }, [initialCloverItems])

  // Input mode: Scan Photo vs Manual Entry
  const [entryMode, setEntryMode] = useState<'scan' | 'manual'>('scan')
  const [manualSearch, setManualSearch] = useState('')

  // Business Date & Duplicate Check
  const [businessDate, setBusinessDate] = useState(defaultBusinessDate)
  const [eodStatus, setEodStatus] = useState<EodCommittedStatus | null>(null)
  const [checkingDate, setCheckingDate] = useState(false)
  const [allowSupplemental, setAllowSupplemental] = useState(false)
  const [eodNote, setEodNote] = useState('')

  // Photo Scanner State
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [scanPhotos, setScanPhotos] = useState<SelectedPhoto[]>([])
  const [isScanning, setIsScanning] = useState(false)
  const [scanError, setScanError] = useState('')
  const [scanWarnings, setScanWarnings] = useState<string[]>([])
  const [detectedDate, setDetectedDate] = useState<string | null>(null)
  const [scannedLines, setScannedLines] = useState<ScannedReceiptLine[]>([])
  const [scanAppliedMsg, setScanAppliedMsg] = useState('')

  // Sales Counts + Commit State
  const [salesInputs, setSalesInputs] = useState<Record<string, number>>({})
  const [isCommitting, setIsCommitting] = useState(false)
  const [commitResult, setCommitResult] = useState<CommitEodSalesResult | null>(null)
  const [commitError, setCommitError] = useState('')

  const step3Ref = useRef<HTMLDivElement | null>(null)

  // Clean up preview object URLs on unmount
  const photosRef = useRef<SelectedPhoto[]>([])
  useEffect(() => {
    photosRef.current = scanPhotos
  }, [scanPhotos])
  useEffect(() => {
    return () => {
      for (const p of photosRef.current) {
        URL.revokeObjectURL(p.previewUrl)
      }
    }
  }, [])

  // Check if businessDate already has EOD sales committed
  useEffect(() => {
    let cancelled = false
    setAllowSupplemental(false)

    async function checkDate() {
      if (!businessDate) return
      setCheckingDate(true)
      const status = await checkEodSalesCommittedAction(businessDate)
      if (!cancelled) {
        setEodStatus(status)
        setCheckingDate(false)
      }
    }

    checkDate()
    return () => {
      cancelled = true
    }
  }, [businessDate])

  const cloverItemById = useMemo(
    () => new Map(cloverItems.map((i) => [i.id, i])),
    [cloverItems]
  )

  const filteredManualItems = useMemo(() => {
    const q = manualSearch.trim().toLowerCase()
    if (!q) return cloverItems
    return cloverItems.filter(
      (i) =>
        i.name.toLowerCase().includes(q) ||
        (i.clover_id || '').toLowerCase().includes(q)
    )
  }, [cloverItems, manualSearch])

  const {
    deductions,
    unmappedSoldItems,
    totalItemsSold,
  } = useMemo(
    () => computeEodIngredientDeductions(salesInputs, cloverItems, ingredients),
    [salesInputs, cloverItems, ingredients]
  )

  function handlePhotosSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const chosen = Array.from(e.target.files || [])
    e.target.value = ''
    if (chosen.length === 0) return

    setScanError('')
    const next = [...scanPhotos]
    for (const file of chosen) {
      if (next.length >= MAX_SCAN_PHOTOS) {
        setScanError(`You can upload up to ${MAX_SCAN_PHOTOS} photos at a time.`)
        break
      }
      if (file.size > MAX_SCAN_PHOTO_BYTES) {
        setScanError(`"${file.name}" is larger than 10 MB.`)
        continue
      }
      next.push({
        id: `${file.name}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        file,
        previewUrl: URL.createObjectURL(file),
      })
    }
    setScanPhotos(next)
  }

  function removePhoto(id: string) {
    setScanPhotos((prev) => {
      const target = prev.find((p) => p.id === id)
      if (target) URL.revokeObjectURL(target.previewUrl)
      return prev.filter((p) => p.id !== id)
    })
  }

  function clearScan() {
    for (const p of scanPhotos) URL.revokeObjectURL(p.previewUrl)
    setScanPhotos([])
    setScannedLines([])
    setScanWarnings([])
    setDetectedDate(null)
    setScanError('')
    setScanAppliedMsg('')
  }

  async function handleScanPhotos() {
    if (scanPhotos.length === 0) {
      setScanError('Add at least 1 photo of your Clover sales report first.')
      return
    }

    setIsScanning(true)
    setScanError('')
    setScanAppliedMsg('')

    try {
      const formData = new FormData()
      for (const p of scanPhotos) {
        formData.append('images', p.file)
      }

      const res = await fetch('/api/eod-sales/scan', {
        method: 'POST',
        body: formData,
      })
      const body = (await res.json()) as {
        businessDate?: string | null
        lines?: ScannedReceiptLine[]
        warnings?: string[]
        error?: string
      }

      if (!res.ok) {
        setScanError(body.error || 'Could not read the report photo.')
        return
      }

      setScannedLines(body.lines || [])
      setScanWarnings(body.warnings || [])
      if (body.businessDate) {
        setDetectedDate(body.businessDate)
        setBusinessDate(body.businessDate)
      } else {
        setDetectedDate(null)
      }
    } catch (err: unknown) {
      setScanError(err instanceof Error ? err.message : 'Network error reading photo')
    } finally {
      setIsScanning(false)
    }
  }

  function updateScannedQty(lineId: string, nextQty: number) {
    setScannedLines((prev) =>
      prev.map((l) => (l.id === lineId ? { ...l, quantity: Math.max(0, nextQty) } : l))
    )
  }

  function updateScannedMatch(lineId: string, nextId: string) {
    setScannedLines((prev) =>
      prev.map((l) => {
        if (l.id !== lineId) return l
        if (!nextId) {
          return {
            ...l,
            matchedCloverItemId: null,
            matchedCloverItemName: null,
            matchedCloverCode: null,
            confidence: 'unmatched',
            hasRecipe: false,
          }
        }
        const matched = cloverItemById.get(nextId)
        return {
          ...l,
          matchedCloverItemId: nextId,
          matchedCloverItemName: matched?.name || null,
          matchedCloverCode: matched?.clover_id || null,
          confidence: 'high',
          hasRecipe: (matched?.recipe_ingredients?.length ?? 0) > 0,
        }
      })
    )
  }

  function dropScannedLine(lineId: string) {
    setScannedLines((prev) => prev.filter((l) => l.id !== lineId))
  }

  function applyScannedToStep3() {
    const merged: Record<string, number> = {}
    let lineCount = 0
    let unitCount = 0

    for (const line of scannedLines) {
      if (!line.matchedCloverItemId || line.quantity <= 0) continue
      merged[line.matchedCloverItemId] = (merged[line.matchedCloverItemId] || 0) + line.quantity
      lineCount++
      unitCount += line.quantity
    }

    if (lineCount === 0) {
      setScanError('Match at least one item with a quantity above 0.')
      return
    }

    setScanError('')
    setSalesInputs(merged)
    setCommitResult(null)
    setCommitError('')
    setScanAppliedMsg(
      `Ready to deduct ${lineCount} menu line(s) (${Math.round(unitCount * 100) / 100} items sold).`
    )
    step3Ref.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }

  async function handleCommitSales() {
    if (totalItemsSold === 0 || deductions.length === 0) return
    if (eodStatus?.alreadyCommitted && !allowSupplemental) return

    setIsCommitting(true)
    setCommitError('')
    setCommitResult(null)

    try {
      const res = await commitEodSalesAction({
        businessDate,
        salesByCloverItemId: salesInputs,
        allowSupplemental,
        note: eodNote,
      })

      if (!res.success) {
        setCommitError(res.error || 'Could not deduct today’s sales.')
        if (res.duplicate) {
          const refreshed = await checkEodSalesCommittedAction(businessDate)
          setEodStatus(refreshed)
        }
        return
      }

      setCommitResult(res)
      setSalesInputs({})
      setEodNote('')
      setAllowSupplemental(false)
      setScanAppliedMsg('')
      const refreshed = await checkEodSalesCommittedAction(businessDate)
      setEodStatus(refreshed)
      router.refresh()
    } catch (err: unknown) {
      setCommitError(err instanceof Error ? err.message : 'Failed to deduct sales')
    } finally {
      setIsCommitting(false)
    }
  }

  const matchedScannedCount = scannedLines.filter(
    (l) => l.matchedCloverItemId && l.quantity > 0
  ).length

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="bg-white rounded-2xl border border-gray-200/80 shadow-xs p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-[11px] font-bold text-[#e85d04] uppercase tracking-wider">
            End-of-Day Closeout
          </span>
          <h2 className="text-xl font-extrabold text-gray-900 tracking-tight mt-0.5">
            Close Day — Subtract Today&apos;s Sales
          </h2>
          <p className="text-xs text-gray-500 mt-1">
            3 easy steps: add your Clover sales report photo, check the items, and tap Deduct from Stock.
          </p>
        </div>

        <div className="shrink-0">
          <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">
            Sales Date
          </label>
          <input
            type="date"
            value={businessDate}
            onChange={(e) => setBusinessDate(e.target.value)}
            className="bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2 text-xs font-bold text-gray-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#e85d04]"
          />
        </div>
      </div>

      {/* Duplicate Date Guard */}
      {checkingDate ? (
        <div className="p-3 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-500">
          Checking if {businessDate} was already closed out...
        </div>
      ) : eodStatus?.alreadyCommitted ? (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl space-y-2.5">
          <p className="text-xs font-bold text-amber-950">
            ⚠️ You already deducted sales for {businessDate} ({eodStatus.existingCount} ingredient entries).
          </p>
          {eodStatus.lastCommittedAt && (
            <p className="text-xs text-amber-800">
              Last saved: {formatStoreTimestamp(eodStatus.lastCommittedAt, storeTimeZone)}
            </p>
          )}
          <label className="inline-flex items-center gap-2 text-xs font-bold text-amber-950 cursor-pointer">
            <input
              type="checkbox"
              checked={allowSupplemental}
              onChange={(e) => setAllowSupplemental(e.target.checked)}
              className="rounded border-amber-400 text-[#e85d04] focus:ring-[#e85d04]"
            />
            <span>Add extra sales for {businessDate} anyway</span>
          </label>
        </div>
      ) : null}

      {/* STEP 1: Add Today's Sales Report */}
      <div className="bg-white rounded-2xl border border-gray-200/80 shadow-xs p-5 sm:p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="w-8 h-8 rounded-full bg-[#e85d04] text-white text-sm font-black flex items-center justify-center shrink-0">
              1
            </span>
            <div>
              <h3 className="text-base font-extrabold text-gray-900">
                Add Today&apos;s Clover Sales
              </h3>
              <p className="text-xs text-gray-500">
                Snap a photo of your register report or type the numbers yourself.
              </p>
            </div>
          </div>

          {/* Scan vs Manual Switch */}
          <div className="bg-gray-100 p-1 rounded-xl grid grid-cols-2 gap-1 self-start sm:self-auto">
            <button
              type="button"
              onClick={() => setEntryMode('scan')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                entryMode === 'scan'
                  ? 'bg-white text-[#e85d04] shadow-2xs'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              📷 Photo Scan
            </button>
            <button
              type="button"
              onClick={() => setEntryMode('manual')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                entryMode === 'manual'
                  ? 'bg-white text-gray-900 shadow-2xs'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              ⌨️ Type Counts
            </button>
          </div>
        </div>

        {entryMode === 'scan' ? (
          <div className="bg-orange-50/40 border border-orange-200/80 rounded-2xl p-4 sm:p-5 space-y-4">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              onChange={handlePhotosSelected}
              className="hidden"
            />

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex-1 sm:flex-initial bg-white hover:bg-orange-50 border-2 border-dashed border-orange-300 hover:border-[#e85d04] text-[#e85d04] font-extrabold text-xs sm:text-sm px-5 py-3.5 rounded-xl transition-all"
              >
                📷 Take Photo or Choose Report Screenshot(s)
              </button>

              {scanPhotos.length > 0 && (
                <>
                  <button
                    type="button"
                    onClick={handleScanPhotos}
                    disabled={isScanning}
                    className="btn-tactile-primary text-white text-xs sm:text-sm font-extrabold px-5 py-3.5 rounded-xl disabled:opacity-50"
                  >
                    {isScanning
                      ? 'Reading Report...'
                      : `Read ${scanPhotos.length} Photo${scanPhotos.length === 1 ? '' : 's'}`}
                  </button>
                  <button
                    type="button"
                    onClick={clearScan}
                    className="px-3.5 py-3 rounded-xl bg-white border border-gray-200 text-xs font-bold text-gray-600 hover:bg-gray-50"
                  >
                    Clear
                  </button>
                </>
              )}
            </div>

            {scanPhotos.length > 0 && (
              <div className="flex flex-wrap gap-3">
                {scanPhotos.map((photo, idx) => (
                  <div
                    key={photo.id}
                    className="relative w-20 h-20 rounded-xl overflow-hidden border border-orange-200 bg-white shadow-2xs"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={photo.previewUrl}
                      alt={`Clover report page ${idx + 1}`}
                      className="w-full h-full object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => removePhoto(photo.id)}
                      aria-label={`Remove photo ${idx + 1}`}
                      className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/75 text-white text-[10px] font-bold flex items-center justify-center hover:bg-red-600"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}

            {scanError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs font-bold">
                {scanError}
              </div>
            )}
            {scanWarnings.length > 0 && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 text-xs space-y-1">
                <p className="font-bold">Notes from reading the photo:</p>
                <ul className="list-disc pl-4 space-y-0.5">
                  {scanWarnings.map((w, i) => (
                    <li key={i}>{w}</li>
                  ))}
                </ul>
              </div>
            )}
            {detectedDate && (
              <div className="p-2.5 bg-blue-50 border border-blue-200 rounded-xl text-blue-800 text-xs font-semibold">
                Found report date: <strong>{detectedDate}</strong> (updated Sales Date above).
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <input
              type="text"
              placeholder="Search menu item (e.g. Chè Thái, Matcha, B1)..."
              value={manualSearch}
              onChange={(e) => setManualSearch(e.target.value)}
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-xs text-gray-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#e85d04]"
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 max-h-96 overflow-y-auto pr-1">
              {filteredManualItems.map((item) => {
                const qty = salesInputs[item.id] || 0
                const hasRecipe = (item.recipe_ingredients?.length ?? 0) > 0
                return (
                  <div
                    key={item.id}
                    className={`rounded-xl border p-3 space-y-2 ${
                      qty > 0 ? 'bg-orange-50/40 border-orange-300' : 'bg-gray-50/70 border-gray-200'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-xs font-extrabold text-gray-900 line-clamp-1">
                        {item.name}
                      </span>
                      {!hasRecipe && (
                        <button
                          type="button"
                          onClick={() => setEditingRecipeItem(item)}
                          className="text-[10px] font-bold text-[#e85d04] bg-orange-50 border border-orange-200 px-1.5 py-0.5 rounded shrink-0 hover:bg-orange-100"
                        >
                          + Recipe
                        </button>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 bg-white border border-gray-200 rounded-lg p-1">
                      <button
                        type="button"
                        onClick={() =>
                          setSalesInputs((prev) => ({
                            ...prev,
                            [item.id]: Math.max(0, (prev[item.id] || 0) - 1),
                          }))
                        }
                        className="w-8 h-8 rounded-md bg-gray-100 hover:bg-gray-200 font-black text-xs text-gray-700"
                      >
                        −
                      </button>
                      <input
                        type="number"
                        min="0"
                        placeholder="0"
                        value={qty || ''}
                        onChange={(e) => {
                          const val = Math.max(0, parseInt(e.target.value, 10) || 0)
                          setSalesInputs((prev) => ({ ...prev, [item.id]: val }))
                        }}
                        className="flex-1 min-w-0 text-center text-xs font-black text-gray-900 focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          setSalesInputs((prev) => ({
                            ...prev,
                            [item.id]: (prev[item.id] || 0) + 1,
                          }))
                        }
                        className="w-8 h-8 rounded-md bg-orange-50 hover:bg-orange-100 border border-orange-200 font-black text-xs text-[#e85d04]"
                      >
                        +
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {/* STEP 2: Check Scanned Items (shown when scan has results) */}
      {scannedLines.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-200/80 shadow-xs p-5 sm:p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="w-8 h-8 rounded-full bg-gray-900 text-white text-sm font-black flex items-center justify-center shrink-0">
                2
              </span>
              <div>
                <h3 className="text-base font-extrabold text-gray-900">
                  Check Items Found ({scannedLines.length} lines · {matchedScannedCount} matched)
                </h3>
                <p className="text-xs text-gray-500">
                  Fix any wrong name or quantity, then tap Use These Counts.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={applyScannedToStep3}
              disabled={matchedScannedCount === 0}
              className="bg-gray-900 hover:bg-black disabled:opacity-50 text-white text-xs font-extrabold px-4 py-2.5 rounded-xl shrink-0"
            >
              Use These Counts →
            </button>
          </div>

          {scanAppliedMsg && (
            <div className="p-3 bg-green-50 border border-green-200 rounded-xl text-green-800 text-xs font-bold">
              ✓ {scanAppliedMsg}
            </div>
          )}

          <div className="space-y-2.5">
            {scannedLines.map((line) => {
              const liveMatch = line.matchedCloverItemId
                ? cloverItemById.get(line.matchedCloverItemId)
                : null
              const hasRecipe = (liveMatch?.recipe_ingredients?.length ?? 0) > 0

              return (
                <div
                  key={line.id}
                  className="bg-gray-50/70 border border-gray-200 rounded-xl p-3.5 flex flex-col md:flex-row md:items-center justify-between gap-3"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-extrabold text-gray-900">
                        {line.rawName}
                      </span>
                      <MatchBadge confidence={line.confidence} />
                      {liveMatch && !hasRecipe && (
                        <button
                          type="button"
                          onClick={() => setEditingRecipeItem(liveMatch)}
                          className="text-[11px] font-bold text-[#e85d04] bg-orange-50 border border-orange-200 px-2 py-0.5 rounded-full hover:bg-orange-100"
                        >
                          Needs Recipe — Add →
                        </button>
                      )}
                    </div>
                    {line.notes && (
                      <p className="text-[11px] text-gray-400 mt-0.5">{line.notes}</p>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <div className="flex items-center bg-white border border-gray-200 rounded-lg p-0.5">
                      <button
                        type="button"
                        onClick={() => updateScannedQty(line.id, line.quantity - 1)}
                        className="w-8 h-8 font-black text-xs text-gray-700 hover:bg-gray-100 rounded-md"
                      >
                        −
                      </button>
                      <input
                        type="number"
                        min="0"
                        step="1"
                        value={line.quantity}
                        onChange={(e) =>
                          updateScannedQty(line.id, parseFloat(e.target.value) || 0)
                        }
                        className="w-12 text-center text-xs font-black text-gray-900 focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => updateScannedQty(line.id, line.quantity + 1)}
                        className="w-8 h-8 font-black text-xs text-[#e85d04] hover:bg-orange-50 rounded-md"
                      >
                        +
                      </button>
                    </div>

                    <select
                      value={line.matchedCloverItemId || ''}
                      onChange={(e) => updateScannedMatch(line.id, e.target.value)}
                      className="bg-white border border-gray-200 rounded-lg px-2.5 py-2 text-xs text-gray-800 max-w-[220px] focus:outline-none focus:ring-2 focus:ring-[#e85d04]"
                    >
                      <option value="">— Skip line —</option>
                      {cloverItems.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.name}
                        </option>
                      ))}
                    </select>

                    <button
                      type="button"
                      onClick={() => dropScannedLine(line.id)}
                      className="text-gray-400 hover:text-red-600 px-2 py-1 text-xs font-bold"
                      aria-label={`Remove ${line.rawName}`}
                    >
                      ✕
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* STEP 3: Deduct Ingredients from Stock */}
      <div
        ref={step3Ref}
        className="bg-white rounded-2xl border border-gray-200/80 shadow-xs p-5 sm:p-6 space-y-4"
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="w-8 h-8 rounded-full bg-[#2e7d32] text-white text-sm font-black flex items-center justify-center shrink-0">
              {scannedLines.length > 0 ? '3' : '2'}
            </span>
            <div>
              <h3 className="text-base font-extrabold text-gray-900">
                Subtract Ingredients Used Today
              </h3>
              <p className="text-xs text-gray-500">
                Review what will be subtracted from your shelves, then tap Deduct.
              </p>
            </div>
          </div>

          {totalItemsSold > 0 && (
            <button
              type="button"
              onClick={() => setSalesInputs({})}
              className="text-xs font-bold text-gray-500 hover:text-gray-800 px-3 py-1.5 rounded-lg border border-gray-200"
            >
              Clear ({totalItemsSold})
            </button>
          )}
        </div>

        {commitResult?.success && (
          <div className="p-4 bg-green-50 border border-green-200 rounded-2xl text-green-900 text-xs space-y-2">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <p className="font-extrabold">
                ✓ Done! Subtracted {commitResult.committedCount} ingredient{commitResult.committedCount === 1 ? '' : 's'} for {businessDate}.
              </p>
              <Link
                href="/manager/reports"
                className="font-bold text-[#2e7d32] hover:underline shrink-0"
              >
                See Activity →
              </Link>
            </div>
            {commitResult.shortfalls && commitResult.shortfalls.length > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-2.5 text-amber-900">
                <p className="font-bold">Some ingredients hit 0 (check physical shelf):</p>
                <ul className="list-disc pl-4 mt-1">
                  {commitResult.shortfalls.map((s) => (
                    <li key={s.ingredient_id}>
                      <strong>{s.name}</strong>: needed {s.required} {s.unit}, had {s.available} {s.unit}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {commitError && (
          <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs font-bold">
            {commitError}
          </div>
        )}

        {unmappedSoldItems.length > 0 && (
          <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-950 space-y-2">
            <p className="font-bold">
              {unmappedSoldItems.length} sold item{unmappedSoldItems.length === 1 ? ' has' : 's have'} no recipe yet (tap to add ingredients):
            </p>
            <div className="flex flex-wrap gap-2">
              {unmappedSoldItems.map((u) => {
                const full = cloverItemById.get(u.cloverItemId)
                return (
                  <button
                    key={u.cloverItemId}
                    type="button"
                    onClick={() => full && setEditingRecipeItem(full)}
                    className="bg-white border border-amber-300 hover:border-[#e85d04] px-2.5 py-1 rounded-lg font-semibold"
                  >
                    {u.name} ({u.quantity}) <span className="text-[#e85d04] font-bold">+ Recipe</span>
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {deductions.length === 0 ? (
          <div className="text-center py-6 bg-gray-50/60 rounded-xl border border-dashed border-gray-200 text-xs text-gray-500">
            Nothing to deduct yet. Scan a report photo above or switch to Type Counts.
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {deductions.map((item) => (
                <div
                  key={item.ingredientId}
                  className={`p-4 rounded-xl border ${
                    item.isDeficit
                      ? 'bg-red-50/70 border-red-200'
                      : 'bg-green-50/50 border-green-200'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h4 className="text-sm font-bold text-gray-900">{item.name}</h4>
                      <p className="text-xs text-gray-600 mt-0.5">
                        Used: <strong>−{item.totalRequired} {item.unit}</strong>
                      </p>
                    </div>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        item.isDeficit
                          ? 'bg-red-100 text-red-700'
                          : 'bg-green-100 text-green-700'
                      }`}
                    >
                      {item.isDeficit ? 'Hits 0' : 'OK'}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mt-2 pt-2 border-t border-gray-200/60">
                    {item.currentStock} {item.unit} →{' '}
                    <strong className={item.isDeficit ? 'text-red-600' : 'text-[#2e7d32]'}>
                      {item.projectedAfterClamp} {item.unit} left
                    </strong>
                  </p>
                </div>
              ))}
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-2">
              <input
                type="text"
                placeholder="Optional note (e.g. Closing register Z-report)"
                value={eodNote}
                onChange={(e) => setEodNote(e.target.value)}
                className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-xs text-gray-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#2e7d32]"
              />
              <button
                type="button"
                onClick={handleCommitSales}
                disabled={
                  isCommitting ||
                  (Boolean(eodStatus?.alreadyCommitted) && !allowSupplemental)
                }
                className="bg-[#2e7d32] hover:bg-[#256829] disabled:opacity-50 text-white text-xs sm:text-sm font-extrabold px-6 py-3 rounded-xl shadow-xs active:scale-98 shrink-0"
              >
                {isCommitting
                  ? 'Deducting...'
                  : `Deduct Today's Sales (${businessDate})`}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Inline Recipe Editor Modal */}
      {editingRecipeItem && (
        <RecipeEditModal
          item={editingRecipeItem}
          ingredients={ingredients}
          onClose={() => setEditingRecipeItem(null)}
          onItemUpdated={(updated) => {
            setEditingRecipeItem(updated)
            setCloverItems((prev) =>
              prev.map((c) => (c.id === updated.id ? updated : c))
            )
          }}
        />
      )}
    </div>
  )
}
