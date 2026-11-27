'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  AlertTriangle,
  ArrowRight,
  Camera,
  Check,
  Pencil,
  Plus,
  Search,
  X,
} from 'lucide-react'
import {
  checkEodSalesCommittedAction,
  commitEodSalesAction,
  CommitEodSalesResult,
  createCloverItemAction,
  EodCommittedStatus,
  removeRecipeIngredientAction,
  upsertRecipeIngredientAction,
} from '@/app/actions/recipes'
import {
  computeEodIngredientDeductions,
  ScannedLineConfidence,
  ScannedReceiptLine,
} from '@/lib/eod-sales'
import { formatStoreTimestamp, getStoreTimezone } from '@/lib/timezone'
import { CloverItem, RecipeIngredient } from '@/lib/types'

interface IngredientWithStock {
  id: string
  name: string
  unit: string
  category?: string
  cost_per_unit: number
  low_stock_threshold: number
  daily_usage_rate: number
  currentStock: number
}

interface Props {
  initialCloverItems: CloverItem[]
  ingredients: IngredientWithStock[]
  defaultBusinessDate: string
}

interface SelectedPhoto {
  id: string
  file: File
  previewUrl: string
}

const MENU_CATEGORIES = [
  'All',
  'Chè (Desserts)',
  'Bánh Mì (Subs)',
  'Giải Khát (Drinks)',
  'Viet Coffee',
  'Bubble Tea & Milk Tea',
  'Matcha Series',
] as const

const MAX_SCAN_PHOTOS = 6
const MAX_SCAN_PHOTO_BYTES = 10 * 1024 * 1024

function ConfidenceBadge({ confidence }: { confidence: ScannedLineConfidence }) {
  if (confidence === 'high') {
    return (
      <span className="font-mono text-xs text-[#15803d] bg-[#f0fdf4] border border-[#bbf7d0] px-2 py-0.5 rounded-md">
        High
      </span>
    )
  }
  if (confidence === 'medium') {
    return (
      <span className="font-mono text-xs text-[#b45309] bg-[#fffbeb] border border-[#fde68a] px-2 py-0.5 rounded-md">
        Medium
      </span>
    )
  }
  if (confidence === 'low') {
    return (
      <span className="font-mono text-xs text-[#c2410c] bg-[#fff7ed] border border-[#fed7aa] px-2 py-0.5 rounded-md">
        Low
      </span>
    )
  }
  return (
    <span className="font-mono text-xs text-[#b91c1c] bg-[#fef2f2] border border-[#fecaca] px-2 py-0.5 rounded-md">
      Unmatched
    </span>
  )
}

export default function RecipesClient({
  initialCloverItems,
  ingredients,
  defaultBusinessDate,
}: Props) {
  const router = useRouter()
  const storeTimeZone = getStoreTimezone()

  const [cloverItems, setCloverItems] = useState<CloverItem[]>(initialCloverItems)
  const [selectedItemForRecipe, setSelectedItemForRecipe] = useState<CloverItem | null>(
    null
  )

  useEffect(() => {
    setCloverItems(initialCloverItems)
    setSelectedItemForRecipe((prev) =>
      prev ? initialCloverItems.find((item) => item.id === prev.id) || null : null
    )
  }, [initialCloverItems])

  const [selectedCategory, setSelectedCategory] = useState<string>('All')
  const [searchQuery, setSearchQuery] = useState('')
  const [mappingFilter, setMappingFilter] = useState<'ALL' | 'UNMAPPED' | 'MAPPED'>('ALL')

  const [showAddItemModal, setShowAddItemModal] = useState(false)
  const [newItemName, setNewItemName] = useState('')
  const [newItemCloverId, setNewItemCloverId] = useState('')
  const [newItemPrice, setNewItemPrice] = useState('')
  const [newItemCategory, setNewItemCategory] = useState('Chè (Desserts)')
  const [isSavingItem, setIsSavingItem] = useState(false)
  const [itemModalError, setItemModalError] = useState('')

  const [selectedIngredientToAdd, setSelectedIngredientToAdd] = useState('')
  const [qtyToAdd, setQtyToAdd] = useState('')
  const [isAddingIngredient, setIsAddingIngredient] = useState(false)
  const [recipeModalError, setRecipeModalError] = useState('')

  const [businessDate, setBusinessDate] = useState<string>(defaultBusinessDate)
  const [eodStatus, setEodStatus] = useState<EodCommittedStatus | null>(null)
  const [checkingEodStatus, setCheckingEodStatus] = useState(false)
  const [allowSupplemental, setAllowSupplemental] = useState(false)
  const [eodNote, setEodNote] = useState('')
  const [salesInputs, setSalesInputs] = useState<Record<string, number>>({})
  const [isCommittingSales, setIsCommittingSales] = useState(false)
  const [commitResult, setCommitResult] = useState<CommitEodSalesResult | null>(null)
  const [salesErrorMsg, setSalesErrorMsg] = useState('')

  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [scanPhotos, setScanPhotos] = useState<SelectedPhoto[]>([])
  const [isScanningReport, setIsScanningReport] = useState(false)
  const [scanError, setScanError] = useState('')
  const [scanWarnings, setScanWarnings] = useState<string[]>([])
  const [detectedReportDate, setDetectedReportDate] = useState<string | null>(null)
  const [scannedLines, setScannedLines] = useState<ScannedReceiptLine[]>([])
  const [scanAppliedMsg, setScanAppliedMsg] = useState('')
  const depletionSectionRef = useRef<HTMLDivElement | null>(null)

  const scanPhotosRef = useRef<SelectedPhoto[]>([])
  useEffect(() => {
    scanPhotosRef.current = scanPhotos
  }, [scanPhotos])

  useEffect(() => {
    return () => {
      for (const p of scanPhotosRef.current) {
        URL.revokeObjectURL(p.previewUrl)
      }
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    setAllowSupplemental(false)

    async function checkDate() {
      if (!businessDate) return
      setCheckingEodStatus(true)
      const status = await checkEodSalesCommittedAction(businessDate)
      if (!cancelled) {
        setEodStatus(status)
        setCheckingEodStatus(false)
      }
    }

    checkDate()
    return () => {
      cancelled = true
    }
  }, [businessDate])

  const filteredCloverItems = useMemo(() => {
    return cloverItems.filter((item) => {
      if (selectedCategory !== 'All' && item.category !== selectedCategory) return false
      const hasIngredients = item.recipe_ingredients && item.recipe_ingredients.length > 0
      if (mappingFilter === 'MAPPED' && !hasIngredients) return false
      if (mappingFilter === 'UNMAPPED' && hasIngredients) return false
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase()
        const matchesName = item.name.toLowerCase().includes(q)
        const matchesId = (item.clover_id || '').toLowerCase().includes(q)
        const matchesCat = (item.category || '').toLowerCase().includes(q)
        if (!matchesName && !matchesId && !matchesCat) return false
      }
      return true
    })
  }, [cloverItems, selectedCategory, mappingFilter, searchQuery])

  const {
    deductions: deficitAnalysis,
    unmappedSoldItems,
    totalItemsSold,
  } = useMemo(() => {
    return computeEodIngredientDeductions(salesInputs, cloverItems, ingredients)
  }, [salesInputs, cloverItems, ingredients])

  const cloverItemById = useMemo(() => {
    return new Map(cloverItems.map((item) => [item.id, item]))
  }, [cloverItems])

  async function handleCreateCloverItem(e: React.FormEvent) {
    e.preventDefault()
    if (!newItemName.trim()) return

    setIsSavingItem(true)
    setItemModalError('')
    try {
      const res = await createCloverItemAction({
        name: newItemName,
        cloverId: newItemCloverId,
        price: parseFloat(newItemPrice) || 0,
        category: newItemCategory,
      })

      if (!res.success || !res.data) {
        setItemModalError(res.error || 'Failed to create item')
        return
      }

      setCloverItems((prev) => [...prev, res.data as CloverItem])
      setShowAddItemModal(false)
      setNewItemName('')
      setNewItemCloverId('')
      setNewItemPrice('')
      router.refresh()
    } finally {
      setIsSavingItem(false)
    }
  }

  async function handleAddIngredientToRecipe(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedItemForRecipe || !selectedIngredientToAdd || !qtyToAdd) return

    setIsAddingIngredient(true)
    setRecipeModalError('')
    try {
      const qty = parseFloat(qtyToAdd)
      const res = await upsertRecipeIngredientAction({
        cloverItemId: selectedItemForRecipe.id,
        ingredientId: selectedIngredientToAdd,
        quantityRequired: qty,
      })

      if (!res.success || !res.data) {
        setRecipeModalError(res.error || 'Failed to add ingredient')
        return
      }

      const savedRow = res.data as unknown as RecipeIngredient
      const updatedRecipeList = [
        ...(selectedItemForRecipe.recipe_ingredients?.filter(
          (r) => r.ingredient_id !== selectedIngredientToAdd
        ) || []),
        savedRow,
      ]

      const updatedItem: CloverItem = {
        ...selectedItemForRecipe,
        recipe_ingredients: updatedRecipeList,
      }

      setSelectedItemForRecipe(updatedItem)
      setCloverItems((prev) =>
        prev.map((item) => (item.id === selectedItemForRecipe.id ? updatedItem : item))
      )

      setSelectedIngredientToAdd('')
      setQtyToAdd('')
      router.refresh()
    } finally {
      setIsAddingIngredient(false)
    }
  }

  async function handleRemoveIngredient(recipeIngredientId: string) {
    if (!selectedItemForRecipe) return
    setRecipeModalError('')

    const res = await removeRecipeIngredientAction(recipeIngredientId)
    if (!res.success) {
      setRecipeModalError(res.error || 'Failed to remove ingredient')
      return
    }

    const updatedRecipeList =
      selectedItemForRecipe.recipe_ingredients?.filter(
        (r) => r.id !== recipeIngredientId
      ) || []

    const updatedItem: CloverItem = {
      ...selectedItemForRecipe,
      recipe_ingredients: updatedRecipeList,
    }

    setSelectedItemForRecipe(updatedItem)
    setCloverItems((prev) =>
      prev.map((item) => (item.id === selectedItemForRecipe.id ? updatedItem : item))
    )
    router.refresh()
  }

  function handlePhotosSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const chosen = Array.from(e.target.files || [])
    e.target.value = ''
    if (chosen.length === 0) return

    setScanError('')
    const nextPhotos: SelectedPhoto[] = [...scanPhotos]

    for (const file of chosen) {
      if (nextPhotos.length >= MAX_SCAN_PHOTOS) {
        setScanError(`Maximum of ${MAX_SCAN_PHOTOS} photos allowed per scan`)
        break
      }
      if (file.size > MAX_SCAN_PHOTO_BYTES) {
        setScanError(`"${file.name}" exceeds the 10 MB per-photo limit`)
        continue
      }
      nextPhotos.push({
        id: `${file.name}-${file.size}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        file,
        previewUrl: URL.createObjectURL(file),
      })
    }

    setScanPhotos(nextPhotos)
  }

  function handleRemovePhoto(photoId: string) {
    setScanPhotos((prev) => {
      const target = prev.find((p) => p.id === photoId)
      if (target) URL.revokeObjectURL(target.previewUrl)
      return prev.filter((p) => p.id !== photoId)
    })
  }

  function handleClearScan() {
    for (const p of scanPhotos) {
      URL.revokeObjectURL(p.previewUrl)
    }
    setScanPhotos([])
    setScannedLines([])
    setScanWarnings([])
    setDetectedReportDate(null)
    setScanError('')
    setScanAppliedMsg('')
  }

  async function handleScanReport() {
    if (scanPhotos.length === 0) {
      setScanError('Select at least one photo of your Clover EOD report')
      return
    }

    setIsScanningReport(true)
    setScanError('')
    setScanAppliedMsg('')

    try {
      const formData = new FormData()
      for (const photo of scanPhotos) {
        formData.append('images', photo.file)
      }

      const response = await fetch('/api/eod-sales/scan', {
        method: 'POST',
        body: formData,
      })

      const body = (await response.json()) as {
        businessDate?: string | null
        lines?: ScannedReceiptLine[]
        warnings?: string[]
        error?: string
      }

      if (!response.ok) {
        setScanError(body.error || 'Failed to scan sales report')
        return
      }

      setScannedLines(body.lines || [])
      setScanWarnings(body.warnings || [])
      if (body.businessDate) {
        setDetectedReportDate(body.businessDate)
        setBusinessDate(body.businessDate)
      } else {
        setDetectedReportDate(null)
      }
    } catch (err: unknown) {
      setScanError(err instanceof Error ? err.message : 'Network error scanning report')
    } finally {
      setIsScanningReport(false)
    }
  }

  function updateScannedLineMatch(lineId: string, nextCloverItemId: string) {
    setScannedLines((prev) =>
      prev.map((line) => {
        if (line.id !== lineId) return line
        if (!nextCloverItemId) {
          return {
            ...line,
            matchedCloverItemId: null,
            matchedCloverItemName: null,
            matchedCloverCode: null,
            confidence: 'unmatched',
            hasRecipe: false,
          }
        }
        const matched = cloverItemById.get(nextCloverItemId)
        return {
          ...line,
          matchedCloverItemId: nextCloverItemId,
          matchedCloverItemName: matched?.name || null,
          matchedCloverCode: matched?.clover_id || null,
          confidence: 'high',
          hasRecipe: (matched?.recipe_ingredients?.length ?? 0) > 0,
        }
      })
    )
  }

  function updateScannedLineQty(lineId: string, rawVal: string) {
    const qty = Math.max(0, parseFloat(rawVal) || 0)
    setScannedLines((prev) =>
      prev.map((line) => (line.id === lineId ? { ...line, quantity: qty } : line))
    )
  }

  function removeScannedLine(lineId: string) {
    setScannedLines((prev) => prev.filter((line) => line.id !== lineId))
  }

  function handleApplyScannedLines() {
    const merged: Record<string, number> = {}
    let appliedLines = 0
    let appliedUnits = 0

    for (const line of scannedLines) {
      if (!line.matchedCloverItemId || line.quantity <= 0) continue
      merged[line.matchedCloverItemId] =
        (merged[line.matchedCloverItemId] || 0) + line.quantity
      appliedLines++
      appliedUnits += line.quantity
    }

    if (appliedLines === 0) {
      setScanError('Match at least one scanned line with a quantity greater than 0')
      return
    }

    setScanError('')
    setSalesInputs(merged)
    setCommitResult(null)
    setSalesErrorMsg('')
    setScanAppliedMsg(
      `Applied ${appliedLines} scanned line(s) (${Math.round(appliedUnits * 100) / 100} total items) below`
    )

    depletionSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }

  async function handleCommitSalesDeduction() {
    if (totalItemsSold === 0) return
    if (eodStatus?.alreadyCommitted && !allowSupplemental) return

    setIsCommittingSales(true)
    setCommitResult(null)
    setSalesErrorMsg('')

    try {
      const res = await commitEodSalesAction({
        businessDate,
        salesByCloverItemId: salesInputs,
        allowSupplemental,
        note: eodNote,
      })

      if (!res.success) {
        setSalesErrorMsg(res.error || 'Failed to commit EOD sales')
        if (res.duplicate) {
          const refreshedStatus = await checkEodSalesCommittedAction(businessDate)
          setEodStatus(refreshedStatus)
        }
        return
      }

      setCommitResult(res)
      setSalesInputs({})
      setEodNote('')
      setAllowSupplemental(false)
      setScanAppliedMsg('')
      const refreshedStatus = await checkEodSalesCommittedAction(businessDate)
      setEodStatus(refreshedStatus)
      router.refresh()
    } catch (err: unknown) {
      setSalesErrorMsg(err instanceof Error ? err.message : 'Failed to commit sales')
    } finally {
      setIsCommittingSales(false)
    }
  }

  const matchedScannedCount = scannedLines.filter(
    (l) => l.matchedCloverItemId && l.quantity > 0
  ).length

  return (
    <div className="space-y-6">
      {/* Menu & Recipe Mapping Header */}
      <div className="surface-card p-5 rounded-2xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-medium text-[#171717]">
              Chè Bông menu and Clover recipe mapping
            </h2>
            <p className="text-xs text-[#737373] mt-0.5">
              {cloverItems.length} menu items mapped to raw ingredients and in-house jellies per serving
            </p>
          </div>

          <button
            type="button"
            onClick={() => {
              setItemModalError('')
              setShowAddItemModal(true)
            }}
            className="h-9 px-4 btn-primary rounded-xl text-xs font-medium inline-flex items-center gap-1.5 shrink-0"
          >
            <Plus size={15} strokeWidth={1.5} />
            <span>Add Clover item</span>
          </button>
        </div>

        {/* Category tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
          {MENU_CATEGORIES.map((cat) => {
            const isActive = selectedCategory === cat
            const count =
              cat === 'All'
                ? cloverItems.length
                : cloverItems.filter((i) => i.category === cat).length
            return (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={`h-8 px-3 rounded-lg text-xs font-medium transition-colors whitespace-nowrap flex items-center gap-1.5 ${
                  isActive
                    ? 'bg-[#171717] text-white'
                    : 'bg-[#f4f4f5] text-[#525252] hover:text-[#171717]'
                }`}
              >
                <span>{cat}</span>
                <span
                  className={`font-mono text-xs tabular-nums ${
                    isActive ? 'text-white/70' : 'text-[#737373]'
                  }`}
                >
                  {count}
                </span>
              </button>
            )
          })}
        </div>

        {/* Search & mapping filter */}
        <div className="flex flex-col sm:flex-row items-center gap-3">
          <div className="relative flex-1 w-full">
            <Search
              size={15}
              strokeWidth={1.5}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#737373]"
            />
            <input
              type="text"
              placeholder="Search menu items"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-9 bg-white border border-neutral-900/[0.14] rounded-xl pl-9 pr-8 text-xs text-[#171717] placeholder-[#a3a3a3] focus:outline-none focus:ring-2 focus:ring-[#c2410c]"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                aria-label="Clear search"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#737373] hover:text-[#171717]"
              >
                <X size={14} strokeWidth={1.5} />
              </button>
            )}
          </div>

          <div className="flex items-center bg-[#f4f4f5] rounded-xl p-1 text-xs w-full sm:w-auto">
            {(['ALL', 'UNMAPPED', 'MAPPED'] as const).map((status) => (
              <button
                key={status}
                type="button"
                onClick={() => setMappingFilter(status)}
                className={`h-7 flex-1 sm:flex-initial px-3 rounded-lg font-medium transition-colors ${
                  mappingFilter === status
                    ? 'bg-white text-[#171717] shadow-[0_1px_2px_rgba(0,0,0,0.04)]'
                    : 'text-[#525252] hover:text-[#171717]'
                }`}
              >
                {status === 'ALL'
                  ? 'All'
                  : status === 'UNMAPPED'
                  ? 'Needs recipe'
                  : 'Mapped'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Mobile card view */}
      <div className="block md:hidden space-y-3">
        <div className="flex items-center justify-between px-1">
          <span className="text-xs font-medium text-[#525252]">
            Menu items ({filteredCloverItems.length})
          </span>
        </div>
        {filteredCloverItems.map((item) => (
          <div key={item.id} className="surface-card rounded-2xl p-4 space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h4 className="font-medium text-[#171717] text-sm">{item.name}</h4>
                <p className="text-xs text-[#737373] font-mono mt-0.5">
                  {item.clover_id || '—'} · {item.category}
                </p>
              </div>
              <span className="text-sm font-mono tabular-nums font-medium text-[#171717]">
                ${item.price.toFixed(2)}
              </span>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {item.recipe_ingredients && item.recipe_ingredients.length > 0 ? (
                item.recipe_ingredients.map((rec) => (
                  <span key={rec.id} className="batch-stamp">
                    {rec.ingredient?.name || 'Item'}: {rec.quantity_required}{' '}
                    {rec.ingredient?.unit || ''}
                  </span>
                ))
              ) : (
                <span className="text-xs text-[#737373]">No recipe mapped</span>
              )}
            </div>

            <button
              type="button"
              onClick={() => {
                setRecipeModalError('')
                setSelectedItemForRecipe(item)
              }}
              className="w-full h-9 btn-secondary rounded-xl text-xs font-medium inline-flex items-center justify-center gap-1.5"
            >
              <Pencil size={13} strokeWidth={1.5} />
              <span>Edit recipe</span>
            </button>
          </div>
        ))}
      </div>

      {/* Desktop table */}
      <div className="hidden md:block surface-card rounded-2xl overflow-hidden">
        <div className="px-5 py-3.5 border-b border-neutral-900/[0.08] flex items-center justify-between">
          <h3 className="text-sm font-medium text-[#171717]">
            Menu items ({filteredCloverItems.length} of {cloverItems.length})
          </h3>
          <span className="text-xs text-[#737373]">Clover EOD ready</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#fafafa] text-[#737373] text-xs font-medium border-b border-neutral-900/[0.08]">
                <th className="py-3 px-5 font-medium">Item</th>
                <th className="py-3 px-4 font-medium">Clover ID</th>
                <th className="py-3 px-4 font-medium">Category</th>
                <th className="py-3 px-4 font-medium text-right">Price</th>
                <th className="py-3 px-5 font-medium">Mapped ingredients</th>
                <th className="py-3 px-5 font-medium text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-900/[0.06] text-sm">
              {filteredCloverItems.map((item) => (
                <tr key={item.id} className="hover:bg-[#fafafa] transition-colors">
                  <td className="py-3 px-5 font-medium text-[#171717]">{item.name}</td>
                  <td className="py-3 px-4">
                    <span className="batch-stamp">{item.clover_id || '—'}</span>
                  </td>
                  <td className="py-3 px-4 text-xs text-[#525252]">{item.category}</td>
                  <td className="py-3 px-4 text-right font-mono tabular-nums text-[#171717]">
                    ${item.price.toFixed(2)}
                  </td>
                  <td className="py-3 px-5">
                    <div className="flex flex-wrap gap-1.5 max-w-md">
                      {item.recipe_ingredients && item.recipe_ingredients.length > 0 ? (
                        item.recipe_ingredients.map((rec) => (
                          <span key={rec.id} className="batch-stamp">
                            {rec.ingredient?.name || 'Item'}: {rec.quantity_required}{' '}
                            {rec.ingredient?.unit || ''}
                          </span>
                        ))
                      ) : (
                        <span className="text-xs text-[#737373]">No recipe mapped</span>
                      )}
                    </div>
                  </td>
                  <td className="py-3 px-5 text-right">
                    <button
                      type="button"
                      onClick={() => {
                        setRecipeModalError('')
                        setSelectedItemForRecipe(item)
                      }}
                      className="h-8 px-3 btn-secondary rounded-lg text-xs font-medium inline-flex items-center gap-1.5"
                    >
                      <Pencil size={13} strokeWidth={1.5} />
                      <span>Edit</span>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* End-of-day Clover sales & stock deduction */}
      <section className="surface-card rounded-2xl p-6 space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-neutral-900/[0.08] pb-4">
          <div>
            <h3 className="text-base font-medium text-[#171717]">
              Clover end-of-day sales and stock deduction
            </h3>
            <p className="text-xs text-[#737373] mt-0.5">
              Scan a Clover EOD sales report or enter counts manually to deduct raw ingredients
            </p>
          </div>

          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <label className="block text-xs text-[#737373]">Business date</label>
              <input
                type="date"
                value={businessDate}
                onChange={(e) => setBusinessDate(e.target.value)}
                className="h-9 bg-white border border-neutral-900/[0.14] rounded-xl px-3 text-xs font-mono tabular-nums text-[#171717] focus:outline-none focus:ring-2 focus:ring-[#c2410c]"
              />
            </div>

            {totalItemsSold > 0 && (
              <button
                type="button"
                onClick={handleCommitSalesDeduction}
                disabled={
                  isCommittingSales ||
                  deficitAnalysis.length === 0 ||
                  (Boolean(eodStatus?.alreadyCommitted) && !allowSupplemental)
                }
                className="h-9 px-4 btn-primary rounded-xl text-xs font-medium disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
              >
                {isCommittingSales
                  ? 'Committing…'
                  : `Commit EOD sales (${businessDate})`}
              </button>
            )}
          </div>
        </div>

        {checkingEodStatus ? (
          <div className="p-3 bg-[#fafafa] border border-neutral-900/[0.08] rounded-xl text-xs text-[#737373]">
            Checking commit history for {businessDate}…
          </div>
        ) : eodStatus?.alreadyCommitted ? (
          <div className="p-4 bg-[#fffbeb] border border-[#fde68a] rounded-xl space-y-2.5">
            <div className="flex items-start gap-2.5">
              <AlertTriangle
                size={16}
                strokeWidth={1.5}
                className="text-[#b45309] mt-0.5 shrink-0"
              />
              <div className="space-y-1 text-xs text-[#78350f]">
                <p className="font-medium">
                  EOD sales already committed for {businessDate} ({eodStatus.existingCount}{' '}
                  deduction log{eodStatus.existingCount === 1 ? '' : 's'})
                </p>
                {eodStatus.lastCommittedAt && (
                  <p className="text-[#92400e] font-mono tabular-nums">
                    Last committed:{' '}
                    {formatStoreTimestamp(eodStatus.lastCommittedAt, storeTimeZone)} (
                    {eodStatus.referenceIds.join(', ')})
                  </p>
                )}
              </div>
            </div>
            <label className="inline-flex items-center gap-2 text-xs font-medium text-[#78350f] cursor-pointer pl-6">
              <input
                type="checkbox"
                checked={allowSupplemental}
                onChange={(e) => setAllowSupplemental(e.target.checked)}
                className="rounded border-[#fde68a] text-[#c2410c] focus:ring-[#c2410c]"
              />
              <span>Commit as supplemental batch for {businessDate}</span>
            </label>
          </div>
        ) : null}

        {/* Photo scanner */}
        <div className="bg-[#fafafa] border border-neutral-900/[0.08] rounded-xl p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-lg bg-white border border-neutral-900/[0.08] flex items-center justify-center text-[#525252] shrink-0">
                <Camera size={16} strokeWidth={1.5} />
              </div>
              <div>
                <h4 className="text-sm font-medium text-[#171717]">
                  Scan Clover EOD report
                </h4>
                <p className="text-xs text-[#737373] mt-0.5">
                  Upload 1–6 photos of a receipt or register screen to extract sold counts for review
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                onChange={handlePhotosSelected}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="h-9 px-3 btn-secondary rounded-xl text-xs font-medium inline-flex items-center gap-1.5"
              >
                <Plus size={14} strokeWidth={1.5} />
                <span>Add photos</span>
              </button>

              {scanPhotos.length > 0 && (
                <>
                  <button
                    type="button"
                    onClick={handleScanReport}
                    disabled={isScanningReport}
                    className="h-9 px-4 btn-primary rounded-xl text-xs font-medium disabled:opacity-50"
                  >
                    {isScanningReport
                      ? 'Scanning…'
                      : `Scan ${scanPhotos.length} photo${scanPhotos.length === 1 ? '' : 's'}`}
                  </button>
                  <button
                    type="button"
                    onClick={handleClearScan}
                    className="h-9 px-3 btn-secondary rounded-xl text-xs font-medium"
                  >
                    Clear
                  </button>
                </>
              )}
            </div>
          </div>

          {scanPhotos.length > 0 && (
            <div className="flex flex-wrap gap-3">
              {scanPhotos.map((photo, idx) => (
                <div
                  key={photo.id}
                  className="relative w-20 h-20 rounded-xl overflow-hidden border border-neutral-900/[0.12] bg-white"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={photo.previewUrl}
                    alt={`Sales report page ${idx + 1}`}
                    className="w-full h-full object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => handleRemovePhoto(photo.id)}
                    aria-label={`Remove photo ${idx + 1}`}
                    className="absolute top-1 right-1 w-5 h-5 rounded-md bg-black/70 text-white flex items-center justify-center hover:bg-[#b91c1c]"
                  >
                    <X size={12} strokeWidth={1.75} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {scanError && (
            <div className="p-3 bg-[#fef2f2] border border-[#fecaca] rounded-xl text-[#b91c1c] text-xs font-medium">
              {scanError}
            </div>
          )}

          {scanWarnings.length > 0 && (
            <div className="p-3 bg-[#fffbeb] border border-[#fde68a] rounded-xl text-[#78350f] text-xs space-y-1">
              <p className="font-medium">Scanner notes</p>
              <ul className="list-disc pl-4 space-y-0.5">
                {scanWarnings.map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            </div>
          )}

          {detectedReportDate && (
            <div className="p-3 bg-white border border-neutral-900/[0.08] rounded-xl text-[#171717] text-xs font-mono">
              Detected report date: {detectedReportDate}
            </div>
          )}

          {scanAppliedMsg && (
            <div className="p-3 bg-[#f0fdf4] border border-[#bbf7d0] rounded-xl text-[#15803d] text-xs font-medium flex items-center gap-2">
              <Check size={14} strokeWidth={1.5} />
              <span>{scanAppliedMsg}</span>
            </div>
          )}

          {scannedLines.length > 0 && (
            <div className="bg-white rounded-xl border border-neutral-900/[0.08] overflow-hidden space-y-3 p-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h5 className="text-xs font-medium text-[#171717]">
                    Extracted sales lines ({scannedLines.length} found · {matchedScannedCount}{' '}
                    matched)
                  </h5>
                  <p className="text-xs text-[#737373]">
                    Verify quantities and matches before applying below
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleApplyScannedLines}
                  disabled={matchedScannedCount === 0}
                  className="h-8 px-3 btn-primary rounded-lg text-xs font-medium disabled:opacity-50 shrink-0"
                >
                  Apply matched items
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-[#fafafa] text-[#737373] border-b border-neutral-900/[0.08]">
                      <th className="py-2 px-3 font-medium">Receipt line</th>
                      <th className="py-2 px-3 font-medium w-24">Qty</th>
                      <th className="py-2 px-3 font-medium min-w-[210px]">Matched item</th>
                      <th className="py-2 px-3 font-medium">Match</th>
                      <th className="py-2 px-3 font-medium">Recipe</th>
                      <th className="py-2 px-2 font-medium text-right">Drop</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-900/[0.06]">
                    {scannedLines.map((line) => {
                      const liveMatchedItem = line.matchedCloverItemId
                        ? cloverItemById.get(line.matchedCloverItemId)
                        : null
                      const liveHasRecipe =
                        (liveMatchedItem?.recipe_ingredients?.length ?? 0) > 0

                      return (
                        <tr key={line.id} className="hover:bg-[#fafafa]">
                          <td className="py-2.5 px-3">
                            <span className="font-medium text-[#171717] block">
                              {line.rawName}
                            </span>
                            {line.notes && (
                              <span className="text-xs text-[#737373]">{line.notes}</span>
                            )}
                          </td>
                          <td className="py-2.5 px-3">
                            <input
                              type="number"
                              min="0"
                              step="1"
                              value={line.quantity}
                              onChange={(e) => updateScannedLineQty(line.id, e.target.value)}
                              className="w-20 h-8 bg-white border border-neutral-900/[0.14] rounded-lg px-2 text-xs font-mono tabular-nums text-[#171717] focus:outline-none focus:ring-2 focus:ring-[#c2410c]"
                            />
                          </td>
                          <td className="py-2.5 px-3">
                            <select
                              value={line.matchedCloverItemId || ''}
                              onChange={(e) =>
                                updateScannedLineMatch(line.id, e.target.value)
                              }
                              className="w-full h-8 bg-white border border-neutral-900/[0.14] rounded-lg px-2.5 text-xs text-[#171717] focus:outline-none focus:ring-2 focus:ring-[#c2410c]"
                            >
                              <option value="">Ignore line</option>
                              {cloverItems.map((item) => (
                                <option key={item.id} value={item.id}>
                                  {item.name} {item.clover_id ? `(${item.clover_id})` : ''}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="py-2.5 px-3">
                            <ConfidenceBadge confidence={line.confidence} />
                          </td>
                          <td className="py-2.5 px-3">
                            {!liveMatchedItem ? (
                              <span className="text-[#737373]">Ignored</span>
                            ) : liveHasRecipe ? (
                              <span className="font-mono text-xs text-[#15803d]">Mapped</span>
                            ) : (
                              <button
                                type="button"
                                onClick={() => {
                                  setRecipeModalError('')
                                  setSelectedItemForRecipe(liveMatchedItem)
                                }}
                                className="text-xs font-medium text-[#c2410c] hover:underline"
                              >
                                Map recipe
                              </button>
                            )}
                          </td>
                          <td className="py-2.5 px-2 text-right">
                            <button
                              type="button"
                              onClick={() => removeScannedLine(line.id)}
                              aria-label="Remove line"
                              className="text-[#737373] hover:text-[#b91c1c] p-1"
                            >
                              <X size={14} strokeWidth={1.5} />
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {commitResult?.success && (
          <div className="p-4 bg-[#f0fdf4] border border-[#bbf7d0] rounded-xl text-[#15803d] text-xs space-y-2">
            <p className="font-medium flex items-center gap-1.5">
              <Check size={14} strokeWidth={1.5} />
              <span>
                Committed EOD sales ({commitResult.referenceId}):{' '}
                {commitResult.committedCount} deduction
                {commitResult.committedCount === 1 ? '' : 's'} synced
              </span>
            </p>
            {commitResult.shortfalls && commitResult.shortfalls.length > 0 && (
              <div className="bg-[#fffbeb] border border-[#fde68a] rounded-lg p-3 text-[#78350f]">
                <p className="font-medium">Clamped at 0 stock with shortfall:</p>
                <ul className="list-disc pl-4 mt-1 font-mono tabular-nums">
                  {commitResult.shortfalls.map((s) => (
                    <li key={s.ingredient_id}>
                      {s.name}: required {s.required} {s.unit}, available {s.available}{' '}
                      {s.unit} (shortfall {s.shortfall} {s.unit})
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {commitResult.unmappedSoldItems &&
              commitResult.unmappedSoldItems.length > 0 && (
                <div className="bg-white border border-[#bbf7d0] rounded-lg p-2.5 text-[#525252]">
                  Skipped {commitResult.unmappedSoldItems.length} unmapped item(s):{' '}
                  {commitResult.unmappedSoldItems
                    .map((u) => `${u.name} (${u.quantity})`)
                    .join(', ')}
                </div>
              )}
          </div>
        )}

        {salesErrorMsg && (
          <div className="p-3 bg-[#fef2f2] border border-[#fecaca] rounded-xl text-[#b91c1c] text-xs font-medium">
            {salesErrorMsg}
          </div>
        )}

        {/* Shift note */}
        <div className="flex flex-col sm:flex-row sm:items-end gap-3">
          <div className="flex-1 space-y-1">
            <label className="block text-xs text-[#737373]">Shift note (optional)</label>
            <input
              type="text"
              placeholder="Evening register close"
              value={eodNote}
              onChange={(e) => setEodNote(e.target.value)}
              className="w-full h-9 bg-white border border-neutral-900/[0.14] rounded-xl px-3 text-xs text-[#171717] placeholder-[#a3a3a3] focus:outline-none focus:ring-2 focus:ring-[#c2410c]"
            />
          </div>
          {totalItemsSold > 0 && (
            <button
              type="button"
              onClick={() => setSalesInputs({})}
              className="h-9 px-3 btn-secondary rounded-xl text-xs font-medium shrink-0"
            >
              Reset quantities ({totalItemsSold})
            </button>
          )}
        </div>

        {/* Manual item count grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {cloverItems.map((item) => {
            const hasRecipe = (item.recipe_ingredients?.length ?? 0) > 0
            return (
              <div
                key={item.id}
                className="bg-[#fafafa] border border-neutral-900/[0.08] rounded-xl p-3 space-y-2"
              >
                <div className="flex items-center justify-between gap-1">
                  <span
                    className="text-xs font-medium text-[#171717] line-clamp-1"
                    title={item.name}
                  >
                    {item.name}
                  </span>
                  {!hasRecipe && (
                    <span className="font-mono text-[10px] text-[#b45309] shrink-0">
                      Unmapped
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1.5">
                  <input
                    type="number"
                    min="0"
                    placeholder="0"
                    value={salesInputs[item.id] || ''}
                    onChange={(e) => {
                      const val = Math.max(0, parseInt(e.target.value, 10) || 0)
                      setSalesInputs((prev) => ({ ...prev, [item.id]: val }))
                    }}
                    className="w-full h-8 bg-white border border-neutral-900/[0.14] rounded-lg px-2.5 text-xs font-mono tabular-nums text-[#171717] focus:outline-none focus:ring-2 focus:ring-[#c2410c]"
                  />
                  <span className="text-xs text-[#737373]">sold</span>
                </div>
              </div>
            )
          })}
        </div>

        {unmappedSoldItems.length > 0 && (
          <div className="p-4 bg-[#fffbeb] border border-[#fde68a] rounded-xl text-xs text-[#78350f] space-y-2">
            <p className="font-medium">
              {unmappedSoldItems.length} sold item
              {unmappedSoldItems.length === 1 ? ' has' : 's have'} no recipe mapped (will be
              skipped)
            </p>
            <div className="flex flex-wrap gap-2">
              {unmappedSoldItems.map((u) => {
                const fullItem = cloverItemById.get(u.cloverItemId)
                return (
                  <button
                    key={u.cloverItemId}
                    type="button"
                    onClick={() => {
                      if (fullItem) {
                        setRecipeModalError('')
                        setSelectedItemForRecipe(fullItem)
                      }
                    }}
                    className="h-8 inline-flex items-center gap-1.5 bg-white border border-[#fde68a] hover:border-[#c2410c] text-[#171717] px-2.5 rounded-lg"
                  >
                    <span>
                      {u.name} ({u.quantity})
                    </span>
                    <span className="text-[#c2410c] inline-flex items-center gap-0.5 font-medium">
                      Map
                      <ArrowRight size={12} strokeWidth={1.5} />
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* Projected depletion */}
        <div ref={depletionSectionRef}>
          {deficitAnalysis.length > 0 ? (
            <div className="space-y-3 pt-2">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <h4 className="text-sm font-medium text-[#171717]">
                  Projected ingredient depletion ({deficitAnalysis.length})
                </h4>
                <button
                  type="button"
                  onClick={handleCommitSalesDeduction}
                  disabled={
                    isCommittingSales ||
                    (Boolean(eodStatus?.alreadyCommitted) && !allowSupplemental)
                  }
                  className="h-9 px-4 btn-primary rounded-xl text-xs font-medium disabled:opacity-50 self-start sm:self-auto"
                >
                  {isCommittingSales
                    ? 'Committing…'
                    : `Confirm and commit (${businessDate})`}
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {deficitAnalysis.map((item) => (
                  <div
                    key={item.ingredientId}
                    className={`p-4 rounded-xl border ${
                      item.isDeficit
                        ? 'bg-[#fef2f2] border-[#fecaca]'
                        : 'bg-[#fafafa] border-neutral-900/[0.08]'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h5 className="text-sm font-medium text-[#171717]">{item.name}</h5>
                        <p className="text-xs text-[#737373] font-mono tabular-nums mt-0.5">
                          On hand {item.currentStock} · Need {item.totalRequired} {item.unit}
                        </p>
                      </div>
                      <span
                        className={`font-mono text-xs px-2 py-0.5 rounded-md border ${
                          item.isDeficit
                            ? 'bg-white border-[#fecaca] text-[#b91c1c]'
                            : 'bg-[#f0fdf4] border-[#bbf7d0] text-[#15803d]'
                        }`}
                      >
                        {item.isDeficit ? 'Shortfall' : 'Covered'}
                      </span>
                    </div>

                    <div className="mt-3 pt-2 border-t border-neutral-900/[0.06] flex items-center justify-between text-xs font-mono tabular-nums">
                      <span className="font-sans text-[#737373]">After commit</span>
                      <span
                        className={`font-medium ${
                          item.isDeficit ? 'text-[#b91c1c]' : 'text-[#15803d]'
                        }`}
                      >
                        {item.projectedAfterClamp} {item.unit}
                      </span>
                    </div>

                    {item.isDeficit && (
                      <div className="mt-1 text-xs font-mono tabular-nums text-[#b91c1c]">
                        Shortfall {item.deficitAmount} {item.unit} (~$
                        {item.estimatedCost.toFixed(2)})
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="text-center py-6 bg-[#fafafa] rounded-xl border border-dashed border-neutral-900/[0.12]">
              <p className="text-xs text-[#737373]">
                Scan a report or enter sold counts above to preview ingredient deductions
              </p>
            </div>
          )}
        </div>
      </section>

      {/* Edit Recipe Modal */}
      {selectedItemForRecipe && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-[2px] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-[0_8px_24px_rgba(0,0,0,0.08)] border border-neutral-900/[0.08] space-y-5">
            <div className="flex items-center justify-between border-b border-neutral-900/[0.08] pb-3">
              <div>
                <h3 className="text-base font-medium text-[#171717]">
                  {selectedItemForRecipe.name}
                </h3>
                <p className="text-xs text-[#737373] font-mono">
                  Ingredients per serving · {selectedItemForRecipe.clover_id || '—'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedItemForRecipe(null)}
                aria-label="Close"
                className="w-8 h-8 rounded-lg flex items-center justify-center text-[#737373] hover:text-[#171717] hover:bg-[#f4f4f5]"
              >
                <X size={16} strokeWidth={1.5} />
              </button>
            </div>

            {recipeModalError && (
              <div className="p-3 bg-[#fef2f2] border border-[#fecaca] rounded-xl text-xs text-[#b91c1c]">
                {recipeModalError}
              </div>
            )}

            <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
              {selectedItemForRecipe.recipe_ingredients &&
              selectedItemForRecipe.recipe_ingredients.length > 0 ? (
                selectedItemForRecipe.recipe_ingredients.map((rec) => (
                  <div
                    key={rec.id}
                    className="flex items-center justify-between bg-[#fafafa] px-3.5 py-2.5 rounded-xl border border-neutral-900/[0.08]"
                  >
                    <div>
                      <span className="text-sm font-medium text-[#171717]">
                        {rec.ingredient?.name || 'Ingredient'}
                      </span>
                      <p className="text-xs text-[#737373] font-mono tabular-nums">
                        {rec.quantity_required} {rec.ingredient?.unit || 'units'} per order
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveIngredient(rec.id)}
                      className="text-[#b91c1c] hover:bg-[#fef2f2] text-xs font-medium px-2.5 py-1 rounded-lg transition-colors"
                    >
                      Remove
                    </button>
                  </div>
                ))
              ) : (
                <p className="text-xs text-[#737373] py-4 text-center">
                  No ingredients mapped yet
                </p>
              )}
            </div>

            <form
              onSubmit={handleAddIngredientToRecipe}
              className="border-t border-neutral-900/[0.08] pt-4 space-y-3"
            >
              <span className="text-xs font-medium text-[#525252] block">
                Add ingredient
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <select
                  value={selectedIngredientToAdd}
                  onChange={(e) => setSelectedIngredientToAdd(e.target.value)}
                  className="w-full h-9 bg-white border border-neutral-900/[0.14] rounded-xl px-3 text-xs text-[#171717] focus:outline-none focus:ring-2 focus:ring-[#c2410c]"
                  required
                >
                  <option value="">Select ingredient</option>
                  {ingredients.map((ing) => {
                    const isJelly =
                      ing.name.toLowerCase().includes('jelly') ||
                      ing.category === 'Hand-Cooked Jellies'
                    return (
                      <option key={ing.id} value={ing.id}>
                        {ing.name} ({ing.unit})
                        {isJelly ? ' · In-house' : ''}
                      </option>
                    )
                  })}
                </select>

                <div className="flex gap-2">
                  <input
                    type="number"
                    step="0.001"
                    min="0.001"
                    placeholder="Qty"
                    value={qtyToAdd}
                    onChange={(e) => setQtyToAdd(e.target.value)}
                    className="w-full h-9 bg-white border border-neutral-900/[0.14] rounded-xl px-3 text-xs font-mono tabular-nums text-[#171717] focus:outline-none focus:ring-2 focus:ring-[#c2410c]"
                    required
                  />
                  <button
                    type="submit"
                    disabled={isAddingIngredient}
                    className="h-9 px-3 btn-primary rounded-xl text-xs font-medium shrink-0"
                  >
                    {isAddingIngredient ? '…' : 'Add'}
                  </button>
                </div>
              </div>
            </form>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedItemForRecipe(null)}
                className="h-9 px-4 btn-secondary rounded-xl text-xs font-medium"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Clover Item Modal */}
      {showAddItemModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-[2px] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-[0_8px_24px_rgba(0,0,0,0.08)] border border-neutral-900/[0.08] space-y-4">
            <div className="flex items-center justify-between border-b border-neutral-900/[0.08] pb-3">
              <h3 className="text-base font-medium text-[#171717]">Add Clover item</h3>
              <button
                type="button"
                onClick={() => setShowAddItemModal(false)}
                aria-label="Close"
                className="w-8 h-8 rounded-lg flex items-center justify-center text-[#737373] hover:text-[#171717] hover:bg-[#f4f4f5]"
              >
                <X size={16} strokeWidth={1.5} />
              </button>
            </div>

            {itemModalError && (
              <div className="p-3 bg-[#fef2f2] border border-[#fecaca] rounded-xl text-xs text-[#b91c1c]">
                {itemModalError}
              </div>
            )}

            <form onSubmit={handleCreateCloverItem} className="space-y-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-[#525252]">Item name</label>
                <input
                  type="text"
                  placeholder="Chè Thái Đặc Biệt"
                  value={newItemName}
                  onChange={(e) => setNewItemName(e.target.value)}
                  className="w-full h-10 bg-white border border-neutral-900/[0.14] rounded-xl px-3 text-sm text-[#171717] focus:outline-none focus:ring-2 focus:ring-[#c2410c]"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-[#525252]">
                  Clover item ID
                </label>
                <input
                  type="text"
                  placeholder="CLV-006"
                  value={newItemCloverId}
                  onChange={(e) => setNewItemCloverId(e.target.value)}
                  className="w-full h-10 bg-white border border-neutral-900/[0.14] rounded-xl px-3 text-sm font-mono text-[#171717] focus:outline-none focus:ring-2 focus:ring-[#c2410c]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="block text-xs font-medium text-[#525252]">Price ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="7.50"
                    value={newItemPrice}
                    onChange={(e) => setNewItemPrice(e.target.value)}
                    className="w-full h-10 bg-white border border-neutral-900/[0.14] rounded-xl px-3 text-sm font-mono tabular-nums text-[#171717] focus:outline-none focus:ring-2 focus:ring-[#c2410c]"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="block text-xs font-medium text-[#525252]">Category</label>
                  <select
                    value={newItemCategory}
                    onChange={(e) => setNewItemCategory(e.target.value)}
                    className="w-full h-10 bg-white border border-neutral-900/[0.14] rounded-xl px-3 text-xs text-[#171717] focus:outline-none focus:ring-2 focus:ring-[#c2410c]"
                  >
                    {MENU_CATEGORIES.filter((c) => c !== 'All').map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddItemModal(false)}
                  className="flex-1 h-9 btn-secondary rounded-xl text-xs font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingItem}
                  className="flex-1 h-9 btn-primary rounded-xl text-xs font-medium disabled:opacity-50"
                >
                  {isSavingItem ? 'Saving…' : 'Save item'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
