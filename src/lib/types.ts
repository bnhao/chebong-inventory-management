// Database types for Che Bong Inventory Management

export type TransactionType = 'RESTOCK' | 'WASTE' | 'CYCLE_COUNT' | 'SALE'
export type UserRole = 'STAFF' | 'MANAGER'

export interface Ingredient {
  id: string
  name: string
  unit: string
  low_stock_threshold: number
  spoiled_time_limit_days: number
  daily_usage_rate: number
  cost_per_unit?: number
  description?: string | null
  created_at: string
}

export interface Batch {
  id: string
  ingredient_id: string
  quantity: number
  remaining_quantity: number
  expiration_date: string | null
  created_at: string
  ingredient?: Ingredient
}

export interface InventoryTransaction {
  id: string
  ingredient_id: string
  batch_id: string | null
  transaction_type: TransactionType
  quantity: number
  notes: string | null
  discrepancy: number | null
  performed_by: string
  created_at: string
  ingredient?: Ingredient
  batch?: Batch
}

export interface AlertItem {
  id: string
  ingredientName: string
  type: 'low_stock' | 'expiring_soon' | 'spoiled'
  message: string
  subMessage?: string
  severity: 'warning' | 'critical'
  daysLeft?: number
  currentStock?: number
  threshold?: number
  unit?: string
  batchDate?: string
}

export interface DashboardData {
  alerts: AlertItem[]
  totalIngredients: number
  lowStockCount: number
  expiringCount: number
}

// Clover POS & Recipe Management Types
export interface CloverItem {
  id: string
  name: string
  clover_id: string | null
  price: number
  category: string
  is_active: boolean
  created_at: string
  recipe_ingredients?: RecipeIngredient[]
}

export interface RecipeIngredient {
  id: string
  clover_item_id: string
  ingredient_id: string
  quantity_required: number
  created_at?: string
  ingredient?: Ingredient
}

// Clover Sales Deficit Calculation
export interface IngredientDeficit {
  ingredientId: string
  name: string
  unit: string
  currentStock: number
  totalRequired: number
  deficit: number // positive if shortfall
  unitCost: number
  totalCost: number
  hasShortage: boolean
}
