import { getSuggestedPurchases } from '@/lib/groceries'
import { getStoreHeaderContext } from '@/lib/timezone'
import GroceriesClient from '@/app/staff/groceries/GroceriesClient'

export const dynamic = 'force-dynamic'

export default async function ManagerGroceriesPage() {
  const [ingredients, headerContext] = await Promise.all([
    getSuggestedPurchases(),
    Promise.resolve(getStoreHeaderContext()),
  ])
  return (
    <GroceriesClient
      ingredients={ingredients}
      isManagerView={true}
      dateLabel={headerContext.formattedDate}
    />
  )
}
