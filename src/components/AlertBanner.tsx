'use client'

import { AlertItem } from '@/lib/types'

function AlertIcon({ type }: { type: 'low_stock' | 'expiring_soon' | 'spoiled' }) {
  if (type === 'expiring_soon') {
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10"/>
        <line x1="12" y1="8" x2="12" y2="12"/>
        <line x1="12" y1="16" x2="12.01" y2="16"/>
      </svg>
    )
  }
  if (type === 'spoiled') {
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
        <line x1="12" y1="9" x2="12" y2="13"/>
        <line x1="12" y1="17" x2="12.01" y2="17"/>
      </svg>
    )
  }
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
      <line x1="12" y1="9" x2="12" y2="13"/>
      <line x1="12" y1="17" x2="12.01" y2="17"/>
    </svg>
  )
}

interface AlertBannerProps {
  alerts: AlertItem[]
}

export default function AlertBanner({ alerts }: AlertBannerProps) {
  if (alerts.length === 0) return null

  const criticalAlerts = alerts.filter((a) => a.severity === 'critical')
  const warningAlerts = alerts.filter((a) => a.severity === 'warning')

  return (
    <div className="px-4 py-2 space-y-2">
      {criticalAlerts.map((alert) => (
        <div
          key={alert.id}
          className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-xl px-3 py-3"
        >
          <div className="text-red-600 mt-0.5 shrink-0">
            <AlertIcon type={alert.type} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-red-800">{alert.ingredientName}</p>
            <p className="text-xs text-red-600 mt-0.5">{alert.message}</p>
          </div>
          <span className="text-[10px] font-bold text-red-700 bg-red-100 px-2 py-0.5 rounded-full shrink-0">
            URGENT
          </span>
        </div>
      ))}

      {warningAlerts.map((alert) => (
        <div
          key={alert.id}
          className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl px-3 py-3"
        >
          <div className="text-amber-600 mt-0.5 shrink-0">
            <AlertIcon type={alert.type} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-amber-800">{alert.ingredientName}</p>
            <p className="text-xs text-amber-600 mt-0.5">{alert.message}</p>
          </div>
          <span className="text-[10px] font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full shrink-0">
            LOW
          </span>
        </div>
      ))}
    </div>
  )
}

