import StockInOutClient from '@/components/StockInOutClient'
import { getStockOperationsData } from '@/lib/stock-data'

export const dynamic = 'force-dynamic'

export default async function RestockPage() {
  const data = await getStockOperationsData()
  return (
    <StockInOutClient
      initialMode="in"
      ingredients={data.ingredients}
      recentDeliveries={data.recentDeliveries}
      activeBatches={data.activeBatches}
      recentWaste={data.recentWaste}
    />
  )
}
