import { GoogleGenAI } from '@google/genai'
import { NextRequest, NextResponse } from 'next/server'
import { RawGeminiReceiptLine, reconcileScannedLines } from '@/lib/eod-sales'
import { createClient } from '@/lib/supabase/server'
import { CloverItem } from '@/lib/types'

export const runtime = 'nodejs'

const MAX_IMAGES = 6
const MAX_IMAGE_BYTES = 10 * 1024 * 1024
const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
])

const RECEIPT_SCAN_JSON_SCHEMA = {
  type: 'object',
  properties: {
    business_date: {
      type: ['string', 'null'],
      description: 'Detected report business date in YYYY-MM-DD format if clearly printed, else null.',
    },
    items: {
      type: 'array',
      description: 'Every sold menu line item extracted from the Clover sales report images.',
      items: {
        type: 'object',
        properties: {
          raw_name: {
            type: 'string',
            description: 'Exact item name or label shown on the Clover sales report.',
          },
          quantity: {
            type: 'number',
            description: 'Quantity sold (units count) for this line item.',
          },
          matched_clover_item_id: {
            type: ['string', 'null'],
            description:
              'UUID of the matching item from the provided Chè Bông menu catalog, or null if no confident match.',
          },
          confidence: {
            type: 'string',
            enum: ['high', 'medium', 'low', 'unmatched'],
            description: 'Confidence in the menu catalog match.',
          },
          notes: {
            type: 'string',
            description: 'Optional note if OCR was blurry, abbreviated, or had modifiers.',
          },
        },
        required: ['raw_name', 'quantity', 'matched_clover_item_id', 'confidence'],
      },
    },
    warnings: {
      type: 'array',
      items: { type: 'string' },
      description: 'Any legibility warnings, cropped lines, or duplicate page overlap observations.',
    },
  },
  required: ['business_date', 'items', 'warnings'],
}

function normalizeMimeType(rawType: string, filename: string): string | null {
  const lower = rawType.toLowerCase().trim()
  if (lower === 'image/jpg') return 'image/jpeg'
  if (ALLOWED_MIME_TYPES.has(lower)) return lower

  const ext = filename.toLowerCase().split('.').pop() || ''
  if (ext === 'jpg' || ext === 'jpeg') return 'image/jpeg'
  if (ext === 'png') return 'image/png'
  if (ext === 'webp') return 'image/webp'
  if (ext === 'heic') return 'image/heic'
  if (ext === 'heif') return 'image/heif'
  return null
}

export async function POST(request: NextRequest) {
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY
  if (!apiKey) {
    return NextResponse.json(
      {
        error:
          'GEMINI_API_KEY is not configured. Add GEMINI_API_KEY to .env.local (and Vercel Environment Variables) to scan Clover sales report photos.',
      },
      { status: 503 }
    )
  }

  try {
    const formData = await request.formData()
    const files = formData
      .getAll('images')
      .filter((entry): entry is File => entry instanceof File && entry.size > 0)

    if (files.length === 0) {
      return NextResponse.json(
        { error: 'Please attach at least 1 Clover sales report photo or screenshot.' },
        { status: 400 }
      )
    }

    if (files.length > MAX_IMAGES) {
      return NextResponse.json(
        { error: `Please upload up to ${MAX_IMAGES} images per scan.` },
        { status: 400 }
      )
    }

    const imageContents: Array<{
      type: 'image'
      data: string
      mime_type: string
      resolution: 'high'
    }> = []

    for (const file of files) {
      if (file.size > MAX_IMAGE_BYTES) {
        return NextResponse.json(
          { error: `"${file.name}" exceeds the 10 MB per-image limit.` },
          { status: 400 }
        )
      }

      const mimeType = normalizeMimeType(file.type, file.name)
      if (!mimeType) {
        return NextResponse.json(
          {
            error: `Unsupported image format for "${file.name}". Use JPEG, PNG, WebP, or HEIC.`,
          },
          { status: 400 }
        )
      }

      const arrayBuffer = await file.arrayBuffer()
      const base64 = Buffer.from(arrayBuffer).toString('base64')
      imageContents.push({
        type: 'image',
        data: base64,
        mime_type: mimeType,
        resolution: 'high',
      })
    }

    const supabase = await createClient()
    const { data: cloverItemsRaw, error: catalogErr } = await supabase
      .from('clover_items')
      .select(`
        id,
        name,
        clover_id,
        price,
        category,
        is_active,
        created_at,
        recipe_ingredients (
          id,
          clover_item_id,
          ingredient_id,
          quantity_required
        )
      `)
      .eq('is_active', true)
      .order('clover_id', { ascending: true })

    if (catalogErr) {
      return NextResponse.json(
        { error: `Failed to load menu catalog: ${catalogErr.message}` },
        { status: 500 }
      )
    }

    const cloverItems = (cloverItemsRaw || []) as unknown as CloverItem[]
    const catalogContext = cloverItems.map((item) => ({
      id: item.id,
      clover_id: item.clover_id,
      name: item.name,
      category: item.category,
      price: Number(item.price) || 0,
    }))

    const promptText = [
      'Analyze the attached Clover POS End-of-Day Item Sales Report photo(s)/screenshot(s) for Chè Bông Dessert & Snacks.',
      'Extract every menu item line and its quantity sold (ignore summary totals, tax rows, tip rows, payment method rows, discounts, and void/refund subheaders unless an item has net positive quantity sold).',
      'If multiple photos show overlapping sections of one long receipt, avoid double-counting duplicated lines and add a note in warnings if overlap is detected.',
      'Match each extracted line to the closest item UUID (`matched_clover_item_id`) in the official Chè Bông menu catalog JSON below, or set `matched_clover_item_id` to null and `confidence` to "unmatched" when unsure.',
      '',
      'Official Menu Catalog:',
      JSON.stringify(catalogContext),
    ].join('\n')

    const ai = new GoogleGenAI({ apiKey })
    const interaction = await ai.interactions.create({
      model: 'gemini-4-hydrogen',
      store: false,
      system_instruction:
        'You are an accurate restaurant POS receipt OCR and menu-catalog matching assistant. Return strictly valid JSON matching the requested schema.',
      input: [
        { type: 'text', text: promptText },
        ...imageContents,
      ],
      response_format: {
        type: 'text',
        mime_type: 'application/json',
        schema: RECEIPT_SCAN_JSON_SCHEMA,
      },
    })

    const outputText = interaction.output_text
    if (!outputText) {
      return NextResponse.json(
        { error: 'Gemini returned an empty response while reading the sales report.' },
        { status: 502 }
      )
    }

    let parsed: {
      business_date?: string | null
      items?: RawGeminiReceiptLine[]
      warnings?: string[]
    }

    try {
      parsed = JSON.parse(outputText)
    } catch {
      return NextResponse.json(
        { error: 'Gemini response could not be parsed as valid JSON.' },
        { status: 502 }
      )
    }

    const rawLines = Array.isArray(parsed.items) ? parsed.items : []
    const lines = reconcileScannedLines(rawLines, cloverItems)
    const detectedDate =
      typeof parsed.business_date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(parsed.business_date)
        ? parsed.business_date
        : null

    const warnings = Array.isArray(parsed.warnings)
      ? parsed.warnings.filter((w): w is string => typeof w === 'string' && w.trim().length > 0)
      : []

    return NextResponse.json({
      businessDate: detectedDate,
      lines,
      warnings,
    })
  } catch (err: unknown) {
    console.error('EOD sales scan error:', err)
    const message = err instanceof Error ? err.message : 'Failed to scan sales report image'
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
