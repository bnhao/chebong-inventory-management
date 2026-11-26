'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { getStoreTimezone } from '@/lib/timezone'
import { ManagerDashboardData } from './page'

interface Props {
  data: ManagerDashboardData
}

export default function ManagerDashboardClient({ data }: Props) {
  const router = useRouter()
  const storeTz = getStoreTimezone()

  const [showAllAlerts, setShowAllAlerts] = useState(false)
  const [logTypeFilter, setLogTypeFilter] = useState<'ALL' | 'RESTOCK' | 'WASTE' | 'CYCLE_COUNT' | 'SALE'>('ALL')

  const logCounts = useMemo(() => {
    const logs = data.recentLogs || []
    return {
      ALL: logs.length,
      RESTOCK: logs.filter((l) => l.transaction_type === 'RESTOCK').length,
      WASTE: logs.filter((l) => l.transaction_type === 'WASTE').length,
      CYCLE_COUNT: logs.filter((l) => l.transaction_type === 'CYCLE_COUNT').length,
      SALE: logs.filter((l) => l.transaction_type === 'SALE').length,
    }
  }, [data.recentLogs])

  const filteredLogs = useMemo(() => {
    const logs = data.recentLogs || []
    if (logTypeFilter === 'ALL') return logs
    return logs.filter((log) => log.transaction_type === logTypeFilter)
  }, [data.recentLogs, logTypeFilter])

  const visibleAlerts = showAllAlerts ? data.alerts : data.alerts.slice(0, 3)

  return (
    <div className="space-y-6">
      {/* Top 4 Store Snapshot Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="surface-card-interactive rounded-2xl p-4 sm:p-5 enter-fade-up stagger-1">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Stock Value</p>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-2xl sm:text-3xl font-extrabold text-gray-900">
              ${data.totalValuation.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </span>
          </div>
          <p className="text-xs text-gray-400 mt-1.5">{data.totalItems} ingredients</p>
        </div>

        <div className="surface-card-interactive rounded-2xl p-4 sm:p-5 enter-fade-up stagger-2">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Running Low</p>
          <div className="flex items-baseline gap-2 mt-1">
            <span className={`text-2xl sm:text-3xl font-extrabold ${data.lowStockCount > 0 ? 'text-[#e85d04]' : 'text-gray-900'}`}>
              {data.lowStockCount}
            </span>
            <span className="text-xs text-gray-400">items</span>
          </div>
          <p className="text-xs text-orange-600 font-medium mt-1.5">
            {data.lowStockCount > 0 ? 'Need to buy soon' : 'All stocked'}
          </p>
        </div>

        <div className="surface-card-interactive rounded-2xl p-4 sm:p-5 enter-fade-up stagger-3">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Expiring Soon</p>
          <div className="flex items-baseline gap-2 mt-1">
            <span className={`text-2xl sm:text-3xl font-extrabold ${data.expiringCount + data.spoiledCount > 0 ? 'text-red-600' : 'text-gray-900'}`}>
              {data.expiringCount + data.spoiledCount}
            </span>
            <span className="text-xs text-gray-400">batches</span>
          </div>
          <p className="text-xs text-red-500 font-medium mt-1.5">
            {data.spoiledCount} expired · {data.expiringCount} soon
          </p>
        </div>

        <div className="surface-card-interactive rounded-2xl p-4 sm:p-5 enter-fade-up stagger-4">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Counted Today</p>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-2xl sm:text-3xl font-extrabold text-[#2e7d32]">
              {data.cycleCountSummary.countedCount} / {data.cycleCountSummary.totalCount}
            </span>
          </div>
          <p className="text-xs text-green-700 font-medium mt-1.5">
            {data.cycleCountSummary.progressPct}% checked today
          </p>
        </div>
      </div>

      {/* Prominent End-of-Day Closeout + Quick Manager Shortcuts */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
        <Link
          href="/manager/close-day"
          className="lg:col-span-7 surface-accent-warm rounded-3xl p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:shadow-md transition-all group"
        >
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-white border border-orange-200 flex items-center justify-center text-3xl shrink-0 shadow-2xs group-hover:scale-105 transition-transform">
              📷
            </div>
            <div>
              <span className="text-[11px] font-bold text-[#e85d04] uppercase tracking-wider">
                End-of-Day Closeout
              </span>
              <h2 className="text-lg sm:text-xl font-extrabold text-gray-900 tracking-tight mt-0.5">
                Close Out Today (Scan Sales Report)
              </h2>
              <p className="text-xs sm:text-sm text-gray-600 mt-0.5">
                Snap a photo of your Clover sales report to automatically subtract ingredients used today.
              </p>
            </div>
          </div>
          <span className="btn-tactile-primary text-white font-bold text-xs sm:text-sm px-5 py-3 rounded-xl text-center shrink-0">
            Open Close Day →
          </span>
        </Link>

        <div className="lg:col-span-5 grid grid-cols-2 gap-3">
          <Link
            href="/manager/groceries"
            className="surface-card-interactive rounded-2xl p-4 flex flex-col justify-between gap-2"
          >
            <div className="text-2xl">🛒</div>
            <div>
              <p className="text-sm font-extrabold text-gray-900">Buy List</p>
              <p className="text-xs text-gray-500 mt-0.5">What to buy &amp; prep</p>
            </div>
          </Link>

          <Link
            href="/manager/thresholds"
            className="surface-card-interactive rounded-2xl p-4 flex flex-col justify-between gap-2"
          >
            <div className="text-2xl">⚙️</div>
            <div>
              <p className="text-sm font-extrabold text-gray-900">Stock Rules</p>
              <p className="text-xs text-gray-500 mt-0.5">Min stock, costs &amp; expiry</p>
            </div>
          </Link>
        </div>
      </div>

      {/* Main Split: Needs Attention + Today's Count */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: Needs Attention */}
        <div className="lg:col-span-7 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                Needs Attention
              </span>
              {data.alerts.length > 0 && (
                <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-xs font-black bg-red-100 text-red-700 border border-red-200">
                  {data.alerts.length}
                </span>
              )}
            </div>
            <span className="text-xs text-gray-500 font-medium">
              {data.alerts.length === 0
                ? 'All good'
                : `${data.lowStockCount} low · ${data.expiringCount + data.spoiledCount} expiring`}
            </span>
          </div>

          {data.alerts.length === 0 ? (
            <div className="bg-green-50 border border-green-200/80 rounded-2xl p-4 flex items-center gap-3">
              <span className="text-xl">✅</span>
              <div>
                <p className="text-sm font-bold text-green-900">Everything is stocked and fresh</p>
                <p className="text-xs text-green-700">No low-stock or expiring items right now.</p>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {visibleAlerts.map((alert) => {
                if (alert.type === 'expiring_soon') {
                  return (
                    <div
                      key={alert.id}
                      className="bg-[#fffbeb] border border-[#fef08a] rounded-2xl p-4 flex items-start gap-3.5 shadow-xs"
                    >
                      <div className="text-amber-500 text-lg shrink-0 mt-0.5">⚠️</div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm sm:text-base font-bold text-[#78350f]">
                          {alert.message}
                        </p>
                        <p className="text-xs text-[#92400e]/85 mt-0.5">
                          {alert.subMessage || 'Use first'}
                        </p>
                      </div>
                    </div>
                  )
                }

                return (
                  <div
                    key={alert.id}
                    className="bg-[#fef2f2] border border-[#fecaca] rounded-2xl p-4 flex items-start gap-3.5 shadow-xs"
                  >
                    <div className="w-4 h-4 rounded-full bg-red-600 mt-1 shrink-0 ring-4 ring-red-100" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm sm:text-base font-bold text-[#991b1b]">
                        {alert.message}
                      </p>
                      <p className="text-xs sm:text-sm text-[#b91c1c] mt-0.5">
                        {alert.subMessage}
                      </p>
                    </div>
                  </div>
                )
              })}

              {data.alerts.length > 3 && (
                <button
                  type="button"
                  onClick={() => setShowAllAlerts(!showAllAlerts)}
                  className="w-full py-2.5 px-4 bg-white hover:bg-gray-50 border border-gray-200/90 rounded-xl text-xs font-bold text-gray-700 flex items-center justify-center gap-1.5 shadow-2xs"
                >
                  <span>
                    {showAllAlerts ? 'Show fewer' : `See ${data.alerts.length - 3} more items`}
                  </span>
                </button>
              )}
            </div>
          )}
        </div>

        {/* Right: Today's Count Progress */}
        <div className="lg:col-span-5 surface-card rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-gray-900">Today&apos;s Count</h3>
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-[#2e7d32] border border-emerald-200/70">
                {data.cycleCountSummary.countedCount} / {data.cycleCountSummary.totalCount}
              </span>
            </div>
            <Link
              href="/manager/reports"
              className="text-xs font-semibold text-[#e85d04] hover:underline shrink-0"
            >
              See Activity →
            </Link>
          </div>

          <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
            <div
              className="bg-[#2e7d32] h-2 rounded-full transition-all duration-300"
              style={{ width: `${data.cycleCountSummary.progressPct}%` }}
            />
          </div>

          <div className="divide-y divide-gray-100">
            {data.cycleCountSummary.items.map((item) => (
              <div key={item.ingredientId} className="py-3 flex items-center justify-between gap-2 first:pt-0 last:pb-0">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-sm font-semibold text-gray-800 truncate">{item.name}</span>
                  {item.status === 'pending' && item.priorityReason === 'critical' && (
                    <span className="px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-red-50 text-red-700 border border-red-200 shrink-0">
                      Urgent
                    </span>
                  )}
                  {item.status === 'pending' && item.priorityReason === 'warning' && (
                    <span className="px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200 shrink-0">
                      Check
                    </span>
                  )}
                </div>
                {item.status === 'counted' ? (
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-green-50 text-[#2e7d32] border border-green-200/60 shrink-0">
                    Done · {item.countedQty} {item.unit}
                  </span>
                ) : (
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-500 shrink-0">
                    Not counted
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recent Activity Preview */}
      <div className="surface-card rounded-2xl p-5 sm:p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-gray-100">
          <div
            onClick={() => router.push('/manager/reports')}
            className="cursor-pointer group flex items-start sm:items-center gap-2.5"
          >
            <span className="text-xl">📜</span>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-extrabold text-gray-900 group-hover:text-[#e85d04] transition-colors tracking-tight">
                  Recent Activity
                </h2>
                <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-xs font-black bg-gray-100 text-gray-700 border border-gray-200">
                  {data.recentLogs.length}
                </span>
              </div>
              <p className="text-xs text-gray-500 mt-0.5">
                Deliveries, tossed items, shelf counts, and daily sales.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => router.push('/manager/reports')}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-[#e85d04] hover:text-[#d45203] bg-orange-50 hover:bg-orange-100/80 px-3.5 py-2 rounded-xl border border-orange-200/60 transition-all shrink-0 self-start sm:self-auto"
          >
            <span>Open Full Activity</span>
            <span>→</span>
          </button>
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar bg-gray-100/80 p-1 rounded-xl">
          {[
            { id: 'ALL' as const, label: 'All', count: logCounts.ALL },
            { id: 'RESTOCK' as const, label: '📦 Added', count: logCounts.RESTOCK },
            { id: 'WASTE' as const, label: '🗑️ Tossed', count: logCounts.WASTE },
            { id: 'CYCLE_COUNT' as const, label: '📋 Counts', count: logCounts.CYCLE_COUNT },
            { id: 'SALE' as const, label: '🏷️ Sales', count: logCounts.SALE },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setLogTypeFilter(tab.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 ${
                logTypeFilter === tab.id
                  ? 'bg-white text-gray-900 shadow-2xs'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <span>{tab.label}</span>
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-gray-200/70 text-gray-700 font-extrabold">
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        {filteredLogs.length === 0 ? (
          <div
            onClick={() => router.push('/manager/reports')}
            className="py-6 text-center bg-gray-50/70 border border-dashed border-gray-200 rounded-2xl cursor-pointer hover:bg-gray-100/60 transition-colors"
          >
            <p className="text-xs font-semibold text-gray-500">No activity yet for this filter.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100 border border-gray-100 rounded-2xl overflow-hidden">
            {filteredLogs.slice(0, 4).map((log) => {
              const date = new Date(log.created_at)
              const formattedDate = date.toLocaleDateString('en-US', {
                timeZone: storeTz,
                month: 'short',
                day: 'numeric',
              })
              const formattedTime = date.toLocaleTimeString('en-US', {
                timeZone: storeTz,
                hour: '2-digit',
                minute: '2-digit',
              })

              return (
                <div
                  key={log.id}
                  onClick={() => router.push('/manager/reports')}
                  className="p-3.5 hover:bg-orange-50/40 transition-colors cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-3 group"
                >
                  <div className="flex items-start sm:items-center gap-3 min-w-0">
                    <div className="shrink-0">
                      {log.transaction_type === 'RESTOCK' ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-lg">
                          📦 Added
                        </span>
                      ) : log.transaction_type === 'WASTE' ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-red-800 bg-red-50 border border-red-200 px-2.5 py-0.5 rounded-lg">
                          🗑️ Tossed
                        </span>
                      ) : log.transaction_type === 'CYCLE_COUNT' ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-800 bg-blue-50 border border-blue-200 px-2.5 py-0.5 rounded-lg">
                          📋 Count
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-purple-800 bg-purple-50 border border-purple-200 px-2.5 py-0.5 rounded-lg">
                          🏷️ Sales
                        </span>
                      )}
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-extrabold text-sm text-gray-900 group-hover:text-[#e85d04] transition-colors">
                          {log.ingredientName}
                        </span>
                        <span className="text-[11px] text-gray-400">
                          {formattedDate} · {formattedTime}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5 truncate">
                        {log.reason || 'Stock updated'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 pl-10 sm:pl-0">
                    <div className="text-left sm:text-right">
                      <div className="text-xs font-black">
                        {log.transaction_type === 'RESTOCK' ? (
                          <span className="text-emerald-700">+{log.quantity_change} {log.unit}</span>
                        ) : log.transaction_type === 'WASTE' || log.transaction_type === 'SALE' ? (
                          <span className="text-red-700">−{Math.abs(log.quantity_change)} {log.unit}</span>
                        ) : (
                          <span className="text-blue-700">Count: {log.new_stock !== null ? log.new_stock : log.quantity_change} {log.unit}</span>
                        )}
                      </div>
                      <div className="text-[11px] text-gray-400 font-medium">
                        {log.previous_stock !== null && log.new_stock !== null ? (
                          <span>{log.previous_stock} → {log.new_stock} {log.unit}</span>
                        ) : (
                          <span>Updated</span>
                        )}
                      </div>
                    </div>
                    <span className="text-[#e85d04] text-xs font-bold">→</span>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
