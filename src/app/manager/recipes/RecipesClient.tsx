'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
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
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
        High
      </span>
    )
  }
  if (confidence === 'medium') {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
        Medium
      </span>
    )
  }
  if (confidence === 'low') {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-orange-50 text-orange-700 border border-orange-200">
        Low
      </span>
    )
  }
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-50 text-red-700 border border-red-200">
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
  const [selectedItemForRecipe, setSelectedItemForRecipe] = useState<CloverItem | null>(null)

  useEffect(() => {
    setCloverItems(initialCloverItems)
    setSelectedItemForRecipe((prev) =>
      prev ? initialCloverItems.find((item) => item.id === prev.id) || null : null
    )
  }, [initialCloverItems])

  // Menu Filtering & Search state
  const [selectedCategory, setSelectedCategory] = useState<string>('All')
  const [searchQuery, setSearchQuery] = useState('')
  const [mappingFilter, setMappingFilter] = useState<'ALL' | 'UNMAPPED' | 'MAPPED'>('ALL')

  // New Clover Item Modal state
  const [showAddItemModal, setShowAddItemModal] = useState(false)
  const [newItemName, setNewItemName] = useState('')
  const [newItemCloverId, setNewItemCloverId] = useState('')
  const [newItemPrice, setNewItemPrice] = useState('')
  const [newItemCategory, setNewItemCategory] = useState('Chè (Desserts)')
  const [isSavingItem, setIsSavingItem] = useState(false)
  const [itemModalError, setItemModalError] = useState('')

  // Recipe editing state inside modal
  const [selectedIngredientToAdd, setSelectedIngredientToAdd] = useState('')
  const [qtyToAdd, setQtyToAdd] = useState('')
  const [isAddingIngredient, setIsAddingIngredient] = useState(false)
  const [recipeModalError, setRecipeModalError] = useState('')

  // EOD Sales & Deficit Calculator State
  const [businessDate, setBusinessDate] = useState<string>(defaultBusinessDate)
  const [eodStatus, setEodStatus] = useState<EodCommittedStatus | null>(null)
  const [checkingEodStatus, setCheckingEodStatus] = useState(false)
  const [allowSupplemental, setAllowSupplemental] = useState(false)
  const [eodNote, setEodNote] = useState('')
  const [salesInputs, setSalesInputs] = useState<Record<string, number>>({})
  const [isCommittingSales, setIsCommittingSales] = useState(false)
  const [commitResult, setCommitResult] = useState<CommitEodSalesResult | null>(null)
  const [salesErrorMsg, setSalesErrorMsg] = useState('')

  // Gemini EOD Sales Report Photo Scanner State
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [scanPhotos, setScanPhotos] = useState<SelectedPhoto[]>([])
  const [isScanningReport, setIsScanningReport] = useState(false)
  const [scanError, setScanError] = useState('')
  const [scanWarnings, setScanWarnings] = useState<string[]>([])
  const [detectedReportDate, setDetectedReportDate] = useState<string | null>(null)
  const [scannedLines, setScannedLines] = useState<ScannedReceiptLine[]>([])
  const [scanAppliedMsg, setScanAppliedMsg] = useState('')
  const depletionSectionRef = useRef<HTMLDivElement | null>(null)

  // Revoke object URLs on unmount
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

  // Check if businessDate already has EOD sales committed
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

  // Filtered Clover Items for Menu & Recipe Mapping
  const filteredCloverItems = useMemo(() => {
    return cloverItems.filter((item) => {
      if (selectedCategory !== 'All' && item.category !== selectedCategory) {
        return false
      }
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

  // Compute live ingredient deficits & unmapped sold items
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

  // Create new Clover Item via Server Action
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

  // Add Ingredient to Active Recipe via Server Action
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

  // Remove Ingredient from Recipe via Server Action
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

  // Photo picker handlers
  function handlePhotosSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const chosen = Array.from(e.target.files || [])
    e.target.value = ''
    if (chosen.length === 0) return

    setScanError('')
    const nextPhotos: SelectedPhoto[] = [...scanPhotos]

    for (const file of chosen) {
      if (nextPhotos.length >= MAX_SCAN_PHOTOS) {
        setScanError(`Maximum of ${MAX_SCAN_PHOTOS} photos allowed per scan.`)
        break
      }
      if (file.size > MAX_SCAN_PHOTO_BYTES) {
        setScanError(`"${file.name}" exceeds the 10 MB per-photo limit.`)
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
      setScanError('Select or snap at least 1 photo of your Clover EOD sales report.')
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
        setScanError(body.error || 'Failed to scan sales report.')
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
      setScanError(err instanceof Error ? err.message : 'Network error scanning sales report')
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
      setScanError('Match at least one scanned line with a quantity > 0 to apply.')
      return
    }

    setScanError('')
    setSalesInputs(merged)
    setCommitResult(null)
    setSalesErrorMsg('')
    setScanAppliedMsg(
      `Applied ${appliedLines} scanned line(s) (${Math.round(appliedUnits * 100) / 100} total items) to EOD Sales below.`
    )

    depletionSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }

  // Atomic EOD Sales Commit via Server Action
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
    <div className="space-y-8">
      {/* Top Controls & Header */}
      <div className="bg-white p-5 rounded-2xl border border-gray-200/80 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-extrabold text-gray-900 tracking-tight">
              Official Chè Bông Menu &amp; Clover POS Recipe Mapping
            </h2>
            <p className="text-xs text-gray-500 mt-1 max-w-2xl">
              All {cloverItems.length} menu items ready for End-of-Day sales deductions. Click <strong>Edit Recipe</strong> on any item to map raw ingredients or hand-cooked jellies per serving.
            </p>
          </div>

          <button
            type="button"
            onClick={() => {
              setItemModalError('')
              setShowAddItemModal(true)
            }}
            className="inline-flex items-center gap-2 bg-[#e85d04] hover:bg-[#d45203] text-white text-xs sm:text-sm font-bold px-4 py-2.5 rounded-xl shadow-xs transition-all active:scale-98 shrink-0"
          >
            <span>＋</span> Add Clover Item
          </button>
        </div>

        {/* Category Filter Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pt-1">
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
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 ${
                  isActive
                    ? 'bg-gray-900 text-white shadow-xs'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200/80 hover:text-gray-900'
                }`}
              >
                <span>{cat}</span>
                <span
                  className={`px-1.5 py-0.5 rounded-md text-[10px] ${
                    isActive ? 'bg-white/20 text-white' : 'bg-white text-gray-600'
                  }`}
                >
                  {count}
                </span>
              </button>
            )
          })}
        </div>

        {/* Search & Mapping Filter Bar */}
        <div className="flex flex-col sm:flex-row items-center gap-3">
          <div className="relative flex-1 w-full">
            <input
              type="text"
              placeholder="Search menu item (e.g. Chè Thai, Matcha, B1, CHE-1A)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2 text-xs text-gray-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#e85d04]"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-2 text-xs text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            )}
          </div>

          <div className="flex items-center gap-1.5 w-full sm:w-auto">
            {(['ALL', 'UNMAPPED', 'MAPPED'] as const).map((status) => (
              <button
                key={status}
                type="button"
                onClick={() => setMappingFilter(status)}
                className={`px-3 py-2 rounded-xl text-xs font-bold border transition-all ${
                  mappingFilter === status
                    ? 'bg-orange-50 text-[#e85d04] border-orange-200'
                    : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                }`}
              >
                {status === 'ALL'
                  ? 'All Items'
                  : status === 'UNMAPPED'
                  ? 'Needs Recipe'
                  : 'Mapped'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* MOBILE CARD VIEW */}
      <div className="block md:hidden space-y-3">
        <div className="flex items-center justify-between px-1">
          <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">
            Menu Items ({filteredCloverItems.length})
          </h3>
          <span className="text-[11px] text-gray-400">Mobile View</span>
        </div>
        {filteredCloverItems.map((item) => (
          <div
            key={item.id}
            className="bg-white rounded-2xl border border-gray-200/80 shadow-xs p-4 space-y-3"
          >
            <div className="flex items-start justify-between">
              <div>
                <h4 className="font-extrabold text-gray-900 text-sm">{item.name}</h4>
                <p className="text-[11px] text-gray-400 mt-0.5">
                  ID: <span className="font-mono font-semibold text-gray-600">{item.clover_id || 'N/A'}</span> · {item.category}
                </p>
              </div>
              <span className="text-sm font-extrabold text-gray-900">
                ${item.price.toFixed(2)}
              </span>
            </div>

            <div>
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1.5">
                Recipe Ingredients
              </span>
              <div className="flex flex-wrap gap-1.5">
                {item.recipe_ingredients && item.recipe_ingredients.length > 0 ? (
                  item.recipe_ingredients.map((rec) => {
                    const ingName = rec.ingredient?.name || 'Item'
                    const unit = rec.ingredient?.unit || ''
                    return (
                      <span
                        key={rec.id}
                        className="inline-flex items-center gap-1 text-[11px] font-medium bg-orange-50 text-orange-800 border border-orange-200/60 px-2 py-0.5 rounded-md"
                      >
                        <span>{ingName}:</span>
                        <strong className="font-bold">{rec.quantity_required} {unit}</strong>
                      </span>
                    )
                  })
                ) : (
                  <span className="text-xs text-gray-400 italic">No ingredients mapped yet</span>
                )}
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                setRecipeModalError('')
                setSelectedItemForRecipe(item)
              }}
              className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl border border-orange-200 bg-orange-50/70 text-[#e85d04] hover:bg-orange-100 font-bold text-xs transition-all active:scale-98"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 20h9"/>
                <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
              </svg>
              Edit Recipe
            </button>
          </div>
        ))}
      </div>

      {/* Wide Desktop Data Table */}
      <div className="hidden md:block bg-white rounded-2xl border border-gray-200/80 shadow-xs overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wider">
            Active Menu Items ({filteredCloverItems.length} of {cloverItems.length})
          </h3>
          <span className="text-xs text-gray-400 font-medium">Clover EOD &amp; Webhook Ready</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50/70 text-gray-600 text-xs font-bold uppercase tracking-wider border-b border-gray-100">
                <th className="py-3 px-5">Item Name</th>
                <th className="py-3 px-4">Clover ID</th>
                <th className="py-3 px-4">Category</th>
                <th className="py-3 px-4">Price</th>
                <th className="py-3 px-5">Mapped Recipe Ingredients</th>
                <th className="py-3 px-5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-sm">
              {filteredCloverItems.map((item) => (
                <tr key={item.id} className="hover:bg-gray-50/60 transition-colors">
                  <td className="py-3.5 px-5 font-bold text-gray-900">
                    {item.name}
                  </td>
                  <td className="py-3.5 px-4 font-mono text-xs text-gray-500">
                    <span className="bg-gray-100 px-2 py-0.5 rounded-md font-semibold text-gray-700">
                      {item.clover_id || 'N/A'}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 text-xs font-semibold text-gray-600">
                    {item.category}
                  </td>
                  <td className="py-3.5 px-4 font-bold text-gray-800">
                    ${item.price.toFixed(2)}
                  </td>
                  <td className="py-3.5 px-5">
                    <div className="flex flex-wrap gap-1.5 max-w-md">
                      {item.recipe_ingredients && item.recipe_ingredients.length > 0 ? (
                        item.recipe_ingredients.map((rec) => {
                          const ingName = rec.ingredient?.name || 'Item'
                          const unit = rec.ingredient?.unit || ''
                          return (
                            <span
                              key={rec.id}
                              className="inline-flex items-center gap-1 text-[11px] font-medium bg-orange-50 text-orange-800 border border-orange-200/60 px-2 py-0.5 rounded-md"
                            >
                              <span>{ingName}:</span>
                              <strong className="font-bold">{rec.quantity_required} {unit}</strong>
                            </span>
                          )
                        })
                      ) : (
                        <span className="text-xs text-gray-400 italic">
                          No ingredients mapped yet
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="py-3.5 px-5 text-right">
                    <button
                      type="button"
                      onClick={() => {
                        setRecipeModalError('')
                        setSelectedItemForRecipe(item)
                      }}
                      className="inline-flex items-center gap-1.5 text-xs font-bold text-[#e85d04] hover:text-[#c44f04] bg-orange-50/70 hover:bg-orange-100 border border-orange-200/80 px-3 py-1.5 rounded-xl transition-all"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 20h9"/>
                        <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
                      </svg>
                      Edit Recipe
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* End-of-Day Clover Sales Report Scanner + Atomic Depletion Engine */}
      <div className="bg-white rounded-2xl border border-gray-200/80 shadow-xs p-5 sm:p-6 space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-gray-100 pb-4">
          <div>
            <h3 className="text-lg font-extrabold text-gray-900 tracking-tight flex items-center gap-2">
              <span>⚡</span> Clover End-of-Day Sales &amp; Stock Deduction
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">
              Snap photos of your printed/screen Clover EOD Item Sales report or enter item counts directly to deduct raw ingredients atomically.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div>
              <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">
                Business Date
              </label>
              <input
                type="date"
                value={businessDate}
                onChange={(e) => setBusinessDate(e.target.value)}
                className="bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs font-bold text-gray-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#e85d04]"
              />
            </div>

            {totalItemsSold > 0 && (
              <div className="self-end">
                <button
                  type="button"
                  onClick={handleCommitSalesDeduction}
                  disabled={
                    isCommittingSales ||
                    deficitAnalysis.length === 0 ||
                    (Boolean(eodStatus?.alreadyCommitted) && !allowSupplemental)
                  }
                  className="bg-[#2e7d32] hover:bg-[#256829] text-white text-xs font-bold px-4 py-2.5 rounded-xl shadow-xs active:scale-98 transition-all disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
                >
                  {isCommittingSales
                    ? 'Committing Atomic Deduction...'
                    : `Commit EOD Sales (${businessDate})`}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Duplicate Business Date Warning */}
        {checkingEodStatus ? (
          <div className="p-3 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-500">
            Checking commit history for {businessDate}...
          </div>
        ) : eodStatus?.alreadyCommitted ? (
          <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl space-y-2.5">
            <div className="flex items-start gap-2.5">
              <span className="text-base leading-none mt-0.5">⚠️</span>
              <div className="space-y-1 text-xs text-amber-900">
                <p className="font-bold">
                  EOD sales already committed for {businessDate} ({eodStatus.existingCount} ingredient deduction log{eodStatus.existingCount === 1 ? '' : 's'})
                </p>
                {eodStatus.lastCommittedAt && (
                  <p className="text-amber-800/90">
                    Last committed: {formatStoreTimestamp(eodStatus.lastCommittedAt, storeTimeZone)} ({eodStatus.referenceIds.join(', ')})
                  </p>
                )}
              </div>
            </div>
            <label className="inline-flex items-center gap-2 text-xs font-bold text-amber-950 cursor-pointer pl-6">
              <input
                type="checkbox"
                checked={allowSupplemental}
                onChange={(e) => setAllowSupplemental(e.target.checked)}
                className="rounded border-amber-400 text-[#e85d04] focus:ring-[#e85d04]"
              />
              <span>Commit as supplemental batch for {businessDate} (skip duplicate block)</span>
            </label>
          </div>
        ) : null}

        {/* Gemini Vision Photo / Screenshot Scanner */}
        <div className="bg-orange-50/40 border border-orange-200/80 rounded-2xl p-4 sm:p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h4 className="text-sm font-extrabold text-gray-900 flex items-center gap-2">
                <span>📷</span> Scan Clover EOD Report (Photo / Screenshot)
              </h4>
              <p className="text-xs text-gray-600 mt-0.5">
                Upload 1–6 photos of a receipt or register screen. Gemini AI extracts sold quantities and matches them to your 43 menu items for review.
              </p>
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
                className="px-3.5 py-2 rounded-xl bg-white hover:bg-gray-50 border border-orange-200 text-xs font-bold text-[#e85d04] shadow-2xs transition-all"
              >
                + Add Photo(s)
              </button>

              {scanPhotos.length > 0 && (
                <>
                  <button
                    type="button"
                    onClick={handleScanReport}
                    disabled={isScanningReport}
                    className="px-4 py-2 rounded-xl bg-[#e85d04] hover:bg-[#d45203] text-white text-xs font-bold shadow-xs transition-all disabled:opacity-50"
                  >
                    {isScanningReport
                      ? 'Scanning with Gemini...'
                      : `Scan ${scanPhotos.length} Photo${scanPhotos.length === 1 ? '' : 's'}`}
                  </button>
                  <button
                    type="button"
                    onClick={handleClearScan}
                    className="px-3 py-2 rounded-xl bg-white hover:bg-gray-100 border border-gray-200 text-xs font-semibold text-gray-600"
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
                  className="relative w-20 h-20 rounded-xl overflow-hidden border border-orange-200 bg-white shadow-2xs group"
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
                    className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/70 text-white text-[10px] font-bold flex items-center justify-center hover:bg-red-600"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}

          {scanError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs font-medium">
              {scanError}
            </div>
          )}

          {scanWarnings.length > 0 && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 text-xs space-y-1">
              <p className="font-bold">Scanner notes:</p>
              <ul className="list-disc pl-4 space-y-0.5">
                {scanWarnings.map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            </div>
          )}

          {detectedReportDate && (
            <div className="p-2.5 bg-blue-50 border border-blue-200 rounded-xl text-blue-800 text-xs font-semibold">
              Detected report date: <strong>{detectedReportDate}</strong> (Business Date updated above).
            </div>
          )}

          {scanAppliedMsg && (
            <div className="p-3 bg-green-50 border border-green-200 rounded-xl text-green-800 text-xs font-semibold">
              ✓ {scanAppliedMsg}
            </div>
          )}

          {/* Editable Scanned Review Table */}
          {scannedLines.length > 0 && (
            <div className="bg-white rounded-xl border border-orange-200/80 overflow-hidden space-y-3 p-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h5 className="text-xs font-extrabold text-gray-900 uppercase tracking-wider">
                    Review Extracted Sales Lines ({scannedLines.length} found · {matchedScannedCount} matched)
                  </h5>
                  <p className="text-[11px] text-gray-500">
                    Verify quantities and catalog matches before applying to the EOD sales counts below.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleApplyScannedLines}
                  disabled={matchedScannedCount === 0}
                  className="bg-gray-900 hover:bg-black text-white text-xs font-bold px-3.5 py-2 rounded-xl shadow-2xs transition-all disabled:opacity-50 shrink-0"
                >
                  Apply Matched Items to EOD Sales
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-gray-50 text-gray-500 text-[11px] font-bold uppercase tracking-wider border-b border-gray-100">
                      <th className="py-2 px-3">Receipt Line</th>
                      <th className="py-2 px-3 w-24">Qty Sold</th>
                      <th className="py-2 px-3 min-w-[210px]">Matched Menu Item</th>
                      <th className="py-2 px-3">Match</th>
                      <th className="py-2 px-3">Recipe</th>
                      <th className="py-2 px-2 text-right">Drop</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {scannedLines.map((line) => {
                      const liveMatchedItem = line.matchedCloverItemId
                        ? cloverItemById.get(line.matchedCloverItemId)
                        : null
                      const liveHasRecipe =
                        (liveMatchedItem?.recipe_ingredients?.length ?? 0) > 0

                      return (
                        <tr key={line.id} className="hover:bg-gray-50/50">
                          <td className="py-2.5 px-3">
                            <span className="font-bold text-gray-900 block">{line.rawName}</span>
                            {line.notes && (
                              <span className="text-[10px] text-gray-400">{line.notes}</span>
                            )}
                          </td>
                          <td className="py-2.5 px-3">
                            <input
                              type="number"
                              min="0"
                              step="1"
                              value={line.quantity}
                              onChange={(e) => updateScannedLineQty(line.id, e.target.value)}
                              className="w-20 bg-gray-50 border border-gray-200 rounded-lg px-2 py-1 text-xs font-bold text-gray-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#e85d04]"
                            />
                          </td>
                          <td className="py-2.5 px-3">
                            <select
                              value={line.matchedCloverItemId || ''}
                              onChange={(e) => updateScannedLineMatch(line.id, e.target.value)}
                              className="w-full bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs text-gray-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#e85d04]"
                            >
                              <option value="">— Ignore line —</option>
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
                              <span className="text-[11px] text-gray-400">Ignored</span>
                            ) : liveHasRecipe ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                Mapped
                              </span>
                            ) : (
                              <div className="flex items-center gap-1.5">
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                                  No recipe
                                </span>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setRecipeModalError('')
                                    setSelectedItemForRecipe(liveMatchedItem)
                                  }}
                                  className="text-[11px] font-bold text-[#e85d04] hover:underline"
                                >
                                  Map Recipe
                                </button>
                              </div>
                            )}
                          </td>
                          <td className="py-2.5 px-2 text-right">
                            <button
                              type="button"
                              onClick={() => removeScannedLine(line.id)}
                              className="text-gray-400 hover:text-red-600 px-1.5 py-1 font-bold"
                              title="Remove line"
                            >
                              ✕
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

        {/* Commit Result / Error Alerts */}
        {commitResult?.success && (
          <div className="p-4 bg-green-50 border border-green-200 rounded-2xl text-green-900 text-xs space-y-2">
            <p className="font-bold">
              ✓ Committed EOD sales ({commitResult.referenceId}): {commitResult.committedCount} ingredient deduction{commitResult.committedCount === 1 ? '' : 's'} synced across stock &amp; FIFO batches.
            </p>
            {commitResult.shortfalls && commitResult.shortfalls.length > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-2.5 text-amber-900">
                <p className="font-bold">Clamped at 0 stock with shortfall noted:</p>
                <ul className="list-disc pl-4 mt-1">
                  {commitResult.shortfalls.map((s) => (
                    <li key={s.ingredient_id}>
                      <strong>{s.name}</strong>: required {s.required} {s.unit}, had {s.available} {s.unit} (shortfall {s.shortfall} {s.unit})
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {commitResult.unmappedSoldItems && commitResult.unmappedSoldItems.length > 0 && (
              <div className="bg-white/80 border border-green-200 rounded-xl p-2.5 text-gray-700">
                Skipped {commitResult.unmappedSoldItems.length} sold item(s) without mapped recipes:{' '}
                {commitResult.unmappedSoldItems.map((u) => `${u.name} (${u.quantity})`).join(', ')}.
              </div>
            )}
          </div>
        )}

        {salesErrorMsg && (
          <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs font-medium">
            {salesErrorMsg}
          </div>
        )}

        {/* Optional EOD Note */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex-1">
            <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">
              Optional Shift / Report Note
            </label>
            <input
              type="text"
              placeholder="e.g. Evening register close — Clover Z-report"
              value={eodNote}
              onChange={(e) => setEodNote(e.target.value)}
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2 text-xs text-gray-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#e85d04]"
            />
          </div>
          {totalItemsSold > 0 && (
            <button
              type="button"
              onClick={() => setSalesInputs({})}
              className="self-start sm:self-end px-3.5 py-2 rounded-xl border border-gray-200 text-xs font-bold text-gray-600 hover:bg-gray-50"
            >
              Reset Quantities ({totalItemsSold})
            </button>
          )}
        </div>

        {/* Inputs Grid for Clover Items Sales Volume */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {cloverItems.map((item) => {
            const hasRecipe = (item.recipe_ingredients?.length ?? 0) > 0
            return (
              <div key={item.id} className="bg-gray-50 border border-gray-200/80 rounded-xl p-3 space-y-1.5">
                <div className="flex items-center justify-between gap-1">
                  <span className="text-xs font-bold text-gray-800 line-clamp-1" title={item.name}>
                    {item.name}
                  </span>
                  {!hasRecipe && (
                    <span className="text-[9px] font-bold text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded shrink-0">
                      No recipe
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1.5">
                  <input
                    type="number"
                    min="0"
                    placeholder="0 sold"
                    value={salesInputs[item.id] || ''}
                    onChange={(e) => {
                      const val = Math.max(0, parseInt(e.target.value, 10) || 0)
                      setSalesInputs((prev) => ({ ...prev, [item.id]: val }))
                    }}
                    className="w-full bg-white border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs text-gray-900 font-bold focus:outline-none focus:ring-2 focus:ring-[#e85d04]"
                  />
                  <span className="text-[11px] text-gray-500 font-medium">units</span>
                </div>
              </div>
            )
          })}
        </div>

        {/* Unmapped Sold Items Warning */}
        {unmappedSoldItems.length > 0 && (
          <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 space-y-2">
            <p className="font-bold">
              {unmappedSoldItems.length} sold item{unmappedSoldItems.length === 1 ? ' has' : 's have'} no recipe mapped yet (will be skipped on commit):
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
                    className="inline-flex items-center gap-1.5 bg-white border border-amber-300 hover:border-[#e85d04] text-amber-950 font-semibold px-2.5 py-1 rounded-lg"
                  >
                    <span>{u.name} ({u.quantity})</span>
                    <span className="text-[#e85d04] font-bold">Map Recipe →</span>
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* Deficit Calculation Results Grid */}
        <div ref={depletionSectionRef}>
          {deficitAnalysis.length > 0 ? (
            <div className="space-y-3 pt-2">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                  Projected Ingredient Depletion ({deficitAnalysis.length} ingredients)
                </h4>
                <button
                  type="button"
                  onClick={handleCommitSalesDeduction}
                  disabled={
                    isCommittingSales ||
                    (Boolean(eodStatus?.alreadyCommitted) && !allowSupplemental)
                  }
                  className="bg-[#2e7d32] hover:bg-[#256829] text-white text-xs font-bold px-4 py-2 rounded-xl shadow-xs active:scale-98 transition-all disabled:opacity-50 disabled:cursor-not-allowed self-start sm:self-auto"
                >
                  {isCommittingSales
                    ? 'Committing...'
                    : `Confirm & Commit EOD Sales (${businessDate})`}
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {deficitAnalysis.map((item) => (
                  <div
                    key={item.ingredientId}
                    className={`p-4 rounded-xl border transition-all ${
                      item.isDeficit
                        ? 'bg-red-50/70 border-red-200 shadow-2xs'
                        : 'bg-green-50/50 border-green-200'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <h5 className="text-sm font-bold text-gray-900">{item.name}</h5>
                        <p className="text-xs text-gray-500 mt-0.5">
                          Current: <strong>{item.currentStock} {item.unit}</strong> · Need: <strong>{item.totalRequired} {item.unit}</strong>
                        </p>
                      </div>
                      {item.isDeficit ? (
                        <span className="bg-red-100 text-red-700 text-[10px] font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider">
                          Shortfall
                        </span>
                      ) : (
                        <span className="bg-green-100 text-green-700 text-[10px] font-bold px-2 py-0.5 rounded-full">
                          Covered
                        </span>
                      )}
                    </div>

                    <div className="mt-3 pt-2 border-t border-gray-200/60 flex items-center justify-between text-xs">
                      <span className="text-gray-600">After Commit:</span>
                      <span className={`font-extrabold ${item.isDeficit ? 'text-red-600' : 'text-[#2e7d32]'}`}>
                        {item.projectedAfterClamp} {item.unit}
                      </span>
                    </div>

                    {item.isDeficit && (
                      <div className="mt-1 text-[11px] text-red-600 font-semibold">
                        Clamped at 0 · Shortfall: {item.deficitAmount} {item.unit} (~${item.estimatedCost.toFixed(2)})
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="text-center py-4 bg-gray-50/50 rounded-xl border border-dashed border-gray-200">
              <p className="text-xs text-gray-500">
                Scan a Clover EOD sales report above or enter item quantities to preview raw ingredient deductions.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Modal: Edit Recipe Ingredients */}
      {selectedItemForRecipe && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-gray-100 space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-gray-900">
                  Recipe for: {selectedItemForRecipe.name}
                </h3>
                <p className="text-xs text-gray-500">
                  Required ingredients per serving ({selectedItemForRecipe.clover_id})
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedItemForRecipe(null)}
                className="text-gray-400 hover:text-gray-600 p-1 text-lg font-bold"
              >
                ✕
              </button>
            </div>

            {recipeModalError && (
              <div className="p-2.5 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 font-medium">
                {recipeModalError}
              </div>
            )}

            {/* List of currently mapped ingredients */}
            <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
              {selectedItemForRecipe.recipe_ingredients && selectedItemForRecipe.recipe_ingredients.length > 0 ? (
                selectedItemForRecipe.recipe_ingredients.map((rec) => (
                  <div
                    key={rec.id}
                    className="flex items-center justify-between bg-gray-50 px-3.5 py-2.5 rounded-xl border border-gray-200/70"
                  >
                    <div>
                      <span className="text-xs font-bold text-gray-800">
                        {rec.ingredient?.name || 'Ingredient'}
                      </span>
                      <p className="text-[11px] text-gray-500">
                        {rec.quantity_required} {rec.ingredient?.unit || 'units'} per order
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveIngredient(rec.id)}
                      className="text-red-500 hover:text-red-700 text-xs font-semibold px-2 py-1 rounded-lg hover:bg-red-50 transition-colors"
                    >
                      Remove
                    </button>
                  </div>
                ))
              ) : (
                <p className="text-xs text-gray-400 py-3 text-center">No ingredients mapped yet.</p>
              )}
            </div>

            {/* Form to attach a new ingredient */}
            <form onSubmit={handleAddIngredientToRecipe} className="border-t border-gray-100 pt-4 space-y-3">
              <span className="text-xs font-bold text-gray-700 uppercase tracking-wider block">
                Add Ingredient to Recipe
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <select
                  value={selectedIngredientToAdd}
                  onChange={(e) => setSelectedIngredientToAdd(e.target.value)}
                  className="bg-white border border-gray-200 rounded-xl px-3 py-2 text-xs text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#e85d04]"
                  required
                >
                  <option value="">Select ingredient...</option>
                  {ingredients.map((ing) => {
                    const isJelly = ing.name.toLowerCase().includes('jelly') || ing.category === 'Hand-Cooked Jellies'
                    return (
                      <option key={ing.id} value={ing.id}>
                        {ing.name} ({ing.unit}){isJelly ? ' · 🍳 Hand-Cooked' : ''}
                      </option>
                    )
                  })}
                </select>

                <div className="flex gap-2">
                  <input
                    type="number"
                    step="0.001"
                    min="0.001"
                    placeholder="Qty req"
                    value={qtyToAdd}
                    onChange={(e) => setQtyToAdd(e.target.value)}
                    className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-xs text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#e85d04]"
                    required
                  />
                  <button
                    type="submit"
                    disabled={isAddingIngredient}
                    className="bg-[#e85d04] hover:bg-[#d45203] text-white text-xs font-bold px-3 py-2 rounded-xl shrink-0"
                  >
                    {isAddingIngredient ? '...' : 'Add'}
                  </button>
                </div>
              </div>
            </form>

            <div className="pt-2 text-right">
              <button
                type="button"
                onClick={() => setSelectedItemForRecipe(null)}
                className="bg-gray-100 hover:bg-gray-200 text-gray-800 text-xs font-bold px-4 py-2 rounded-xl transition-all"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Add New Clover Item */}
      {showAddItemModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-gray-100 space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <h3 className="text-base font-bold text-gray-900">Add Clover POS Item</h3>
              <button
                type="button"
                onClick={() => setShowAddItemModal(false)}
                className="text-gray-400 hover:text-gray-600 text-lg font-bold"
              >
                ✕
              </button>
            </div>

            {itemModalError && (
              <div className="p-2.5 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 font-medium">
                {itemModalError}
              </div>
            )}

            <form onSubmit={handleCreateCloverItem} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                  Item Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Chè Thái Đặc Biệt"
                  value={newItemName}
                  onChange={(e) => setNewItemName(e.target.value)}
                  className="w-full bg-white border border-gray-200 rounded-xl px-3.5 py-2.5 text-xs text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#e85d04]"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                  Clover Item ID
                </label>
                <input
                  type="text"
                  placeholder="e.g. CLV-006"
                  value={newItemCloverId}
                  onChange={(e) => setNewItemCloverId(e.target.value)}
                  className="w-full bg-white border border-gray-200 rounded-xl px-3.5 py-2.5 text-xs text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#e85d04]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                    Price ($)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="7.50"
                    value={newItemPrice}
                    onChange={(e) => setNewItemPrice(e.target.value)}
                    className="w-full bg-white border border-gray-200 rounded-xl px-3.5 py-2.5 text-xs text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#e85d04]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                    Category
                  </label>
                  <select
                    value={newItemCategory}
                    onChange={(e) => setNewItemCategory(e.target.value)}
                    className="w-full bg-white border border-gray-200 rounded-xl px-3.5 py-2.5 text-xs text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#e85d04]"
                  >
                    {MENU_CATEGORIES.filter((c) => c !== 'All').map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowAddItemModal(false)}
                  className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold py-2.5 rounded-xl transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingItem}
                  className="flex-1 bg-[#e85d04] hover:bg-[#d45203] text-white text-xs font-bold py-2.5 rounded-xl shadow-xs transition-all disabled:opacity-50"
                >
                  {isSavingItem ? 'Saving...' : 'Save Item'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
