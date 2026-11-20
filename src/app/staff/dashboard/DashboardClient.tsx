'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import StaffDesktopNav from '@/components/StaffDesktopNav'
import { StaffDashboardData } from './page'

interface Props {
  data: StaffDashboardData
}

function TrashIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6"/>
      <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/>
      <path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/>
    </svg>
  )
}

function PlusIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#e85d04" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
    </svg>
  )
}

function CheckSquareIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 11 12 14 22 4"/>
      <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/>
    </svg>
  )
}

export default function DashboardClient({ data }: Props) {
  const router = useRouter()
  const [showAllAlerts, setShowAllAlerts] = useState(false)

  const lowStockCount = data.alerts.filter((a) => a.type === 'low_stock').length
  const expiringCount = data.alerts.filter((a) => a.type === 'expiring_soon' || a.type === 'spoiled').length

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
            {data.headerContext.formattedDate} · {data.headerContext.shiftLabel}
          </p>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight mt-0.5">
            {data.headerContext.greeting} 👋
          </h1>
          <p className="text-sm text-gray-500 mt-1">Here is what to check for your shift today.</p>
        </div>

        <StaffDesktopNav />
      </div>

      {/* Friendly Status Hero */}
      <div
        className={`enter-fade-up rounded-3xl p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
          data.alerts.length === 0
            ? 'bg-linear-to-br from-green-50 to-emerald-100/60 border border-green-200/80 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.8),0_8px_24px_-8px_rgba(22,163,74,0.18)]'
            : 'surface-accent-warm'
        }`}
      >
        <div className="flex items-center gap-4">
          <div className="text-4xl">{data.alerts.length === 0 ? '🎉' : '🛒'}</div>
          <div>
            <p className="text-lg sm:text-xl font-extrabold text-gray-900 tracking-tight">
              {data.alerts.length === 0
                ? "You're all set!"
                : `${data.alerts.length} ${data.alerts.length === 1 ? 'thing needs' : 'things need'} attention`}
            </p>
            <p className="text-sm text-gray-600 mt-0.5">
              {data.alerts.length === 0
                ? 'Everything is stocked and fresh right now.'
                : `${lowStockCount} running low · ${expiringCount} expiring soon`}
            </p>
          </div>
        </div>
        <Link
          href={data.alerts.length === 0 ? '/staff/cycle-count' : '/staff/groceries'}
          className="btn-tactile-primary text-white font-bold text-sm px-5 py-3 rounded-xl text-center shrink-0"
        >
          {data.alerts.length === 0 ? 'Count Stock Now' : 'Open Buy List'}
        </Link>
      </div>

      {/* 3 Big Thumb-Friendly Quick Actions + Buy List */}
      <div className="space-y-3">
        <span className="text-xs font-bold text-gray-400 uppercase tracking-wider block">
          What do you need to do?
        </span>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <button
            type="button"
            onClick={() => router.push('/staff/stock')}
            className="flex flex-col items-center justify-center p-5 surface-card-interactive rounded-2xl group"
          >
            <div className="w-12 h-12 rounded-xl bg-linear-to-b from-orange-50 to-orange-100/70 border border-orange-200/60 flex items-center justify-center mb-2.5 group-hover:scale-110 transition-transform">
              <PlusIcon />
            </div>
            <span className="text-sm font-extrabold text-gray-900">Add Stock</span>
            <span className="text-[11px] text-gray-500 mt-0.5">Log a delivery</span>
          </button>

          <button
            type="button"
            onClick={() => router.push('/staff/stock?mode=out')}
            className="flex flex-col items-center justify-center p-5 surface-card-interactive rounded-2xl group"
          >
            <div className="w-12 h-12 rounded-xl bg-linear-to-b from-red-50 to-red-100/70 border border-red-200/60 flex items-center justify-center mb-2.5 group-hover:scale-110 transition-transform">
              <TrashIcon />
            </div>
            <span className="text-sm font-extrabold text-gray-900">Toss Spoiled</span>
            <span className="text-[11px] text-gray-500 mt-0.5">Expired or spilled</span>
          </button>

          <button
            type="button"
            onClick={() => router.push('/staff/cycle-count')}
            className="flex flex-col items-center justify-center p-5 surface-card-interactive rounded-2xl group"
          >
            <div className="w-12 h-12 rounded-xl bg-linear-to-b from-green-50 to-green-100/70 border border-green-200/60 flex items-center justify-center mb-2.5 group-hover:scale-110 transition-transform">
              <CheckSquareIcon />
            </div>
            <span className="text-sm font-extrabold text-gray-900">Count Stock</span>
            <span className="text-[11px] text-gray-500 mt-0.5">Check the shelves</span>
          </button>

          <button
            type="button"
            onClick={() => router.push('/staff/groceries')}
            className="flex flex-col items-center justify-center p-5 surface-card-interactive rounded-2xl group"
          >
            <div className="w-12 h-12 rounded-xl bg-linear-to-b from-amber-50 to-amber-100/70 border border-amber-200/60 flex items-center justify-center text-2xl mb-2.5 group-hover:scale-110 transition-transform">
              🛒
            </div>
            <span className="text-sm font-extrabold text-gray-900">Buy List</span>
            <span className="text-[11px] text-gray-500 mt-0.5">Shop &amp; check off</span>
          </button>
        </div>
      </div>

      {/* Main Split: Needs Attention + Today's Count */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Needs Attention (7 cols) */}
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
                : `${lowStockCount} low · ${expiringCount} expiring`}
            </span>
          </div>

          {data.alerts.length === 0 ? (
            <div className="bg-linear-to-r from-green-50 to-emerald-50/60 border border-green-200/80 rounded-2xl p-5 flex items-center gap-3 shadow-xs">
              <span className="text-xl">✅</span>
              <div>
                <p className="text-sm font-bold text-green-900">Everything looks fresh and stocked</p>
                <p className="text-xs text-green-700">No low-stock or expiring items right now.</p>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {(showAllAlerts ? data.alerts : data.alerts.slice(0, 3)).map((alert) => {
                if (alert.type === 'expiring_soon') {
                  return (
                    <div
                      key={alert.id}
                      className="bg-linear-to-r from-[#fffbeb] via-[#fffbeb] to-[#fef3c7]/50 border border-[#fde68a] rounded-2xl p-4 flex items-start gap-3.5 shadow-2xs"
                    >
                      <div className="text-amber-500 text-lg shrink-0 mt-0.5">⚠️</div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm sm:text-base font-bold text-[#78350f]">
                          {alert.message}
                        </p>
                        <p className="text-xs text-[#92400e]/85 mt-0.5">
                          {alert.subMessage || 'Use this first'}
                        </p>
                      </div>
                    </div>
                  )
                }

                return (
                  <div
                    key={alert.id}
                    className="bg-linear-to-r from-[#fef2f2] via-[#fef2f2] to-[#fee2e2]/45 border border-[#fecaca] rounded-2xl p-4 flex items-start gap-3.5 shadow-2xs"
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
                  className="w-full py-2.5 px-4 surface-card-interactive rounded-xl text-xs font-bold text-gray-700 hover:text-gray-900 flex items-center justify-center gap-1.5"
                >
                  <span>
                    {showAllAlerts
                      ? 'Show fewer'
                      : `See ${data.alerts.length - 3} more items`}
                  </span>
                </button>
              )}
            </div>
          )}
        </div>

        {/* Today's Count Checklist (5 cols) */}
        <div className="lg:col-span-5 surface-card rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-gray-900">Today&apos;s Count</h3>
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-[#2e7d32] border border-emerald-200/70">
                {data.cycleCountSummary.countedCount} / {data.cycleCountSummary.totalCount}
              </span>
            </div>
            <Link
              href="/staff/cycle-count"
              className="text-xs font-bold text-[#e85d04] hover:underline shrink-0"
            >
              Count Now →
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
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-green-50 text-[#2e7d32] border border-green-200/70 shrink-0">
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
    </div>
  )
}
