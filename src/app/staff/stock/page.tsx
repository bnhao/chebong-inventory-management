import StockInOutClient from '@/components/StockInOutClient'
import { getStockOperationsData } from '@/lib/stock-data'

export const dynamic = 'force-dynamic'

export default async function StockPage({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string }>
}) {
  const params = await searchParams
  const initialMode = params?.mode === 'out' ? 'out' : 'in'
  const data = await getStockOperationsData()

  return (
    <StockInOutClient
      initialMode={initialMode}
      ingredients={data.ingredients}
      recentDeliveries={data.recentDeliveries}
      activeBatches={data.activeBatches}
      recentWaste={data.recentWaste}
    />
  )
}
