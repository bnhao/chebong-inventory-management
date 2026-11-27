import StockInOutClient from '@/components/StockInOutClient'
import { getStockOperationsData } from '@/lib/stock-data'

export const dynamic = 'force-dynamic'

export default async function WastePage() {
  const data = await getStockOperationsData()
  return (
    <StockInOutClient
      initialMode="out"
      ingredients={data.ingredients}
      recentDeliveries={data.recentDeliveries}
      activeBatches={data.activeBatches}
      recentWaste={data.recentWaste}
    />
  )
}
