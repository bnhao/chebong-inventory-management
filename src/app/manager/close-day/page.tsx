import { getRecipesAndIngredientsData } from '@/lib/recipes-data'
import { getStoreDateString } from '@/lib/timezone'
import CloseDayClient from './CloseDayClient'

export const dynamic = 'force-dynamic'

export default async function CloseDayPage() {
  const [{ cloverItems, ingredientsWithStock }, defaultBusinessDate] = await Promise.all([
    getRecipesAndIngredientsData(),
    Promise.resolve(getStoreDateString()),
  ])

  return (
    <CloseDayClient
      initialCloverItems={cloverItems}
      ingredients={ingredientsWithStock}
      defaultBusinessDate={defaultBusinessDate}
    />
  )
}
