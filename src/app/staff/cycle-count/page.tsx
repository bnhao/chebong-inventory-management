import { createClient } from '@/lib/supabase/server'
import CycleCountForm from './CycleCountForm'

export const dynamic = 'force-dynamic'

export interface IngredientForCycleCount {
  id: string
  name: string
  unit: string
  systemStock: number
}

async function getIngredientsForCycleCount(): Promise<IngredientForCycleCount[]> {
  const supabase = await createClient()

  const { data: ingredients, error } = await supabase
    .from('ingredients')
    .select('id, name, unit, current_stock')
    .order('name', { ascending: true })

  if (error || !ingredients) {
    console.error('Error fetching ingredients for cycle count:', error)
    return []
  }

  return ingredients.map((ing) => ({
    id: ing.id,
    name: ing.name,
    unit: ing.unit,
    systemStock: Number(ing.current_stock) || 0,
  }))
}

export default async function CycleCountPage() {
  const ingredients = await getIngredientsForCycleCount()
  return <CycleCountForm ingredients={ingredients} />
}
