import { getSuggestedPurchases } from '@/lib/groceries'
import { getStoreHeaderContext } from '@/lib/timezone'
import GroceriesClient from './GroceriesClient'

export const dynamic = 'force-dynamic'

export default async function GroceriesPage() {
  const [ingredients, headerContext] = await Promise.all([
    getSuggestedPurchases(),
    Promise.resolve(getStoreHeaderContext()),
  ])
  return <GroceriesClient ingredients={ingredients} dateLabel={headerContext.formattedDate} />
}
