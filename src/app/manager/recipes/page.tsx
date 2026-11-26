import { getRecipesAndIngredientsData } from '@/lib/recipes-data'
import RecipesClient from './RecipesClient'

export const dynamic = 'force-dynamic'

export default async function RecipesPage() {
  const { cloverItems, ingredientsWithStock } = await getRecipesAndIngredientsData()
  return (
    <RecipesClient
      initialCloverItems={cloverItems}
      ingredients={ingredientsWithStock}
    />
  )
}
