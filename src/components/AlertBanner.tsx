'use client'

import { AlertTriangle, Clock } from 'lucide-react'
import { AlertItem } from '@/lib/types'

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
          className="flex items-start gap-3 bg-[#fef2f2] border border-[#fecaca] rounded-xl px-4 py-3"
        >
          <AlertTriangle size={16} strokeWidth={1.5} className="text-[#b91c1c] mt-0.5 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-[#7f1d1d]">{alert.ingredientName}</p>
            <p className="text-xs text-[#991b1b] mt-0.5">{alert.message}</p>
          </div>
          <span className="font-mono text-xs text-[#b91c1c] shrink-0">
            {alert.type === 'spoiled' ? 'Spoiled' : 'Urgent'}
          </span>
        </div>
      ))}

      {warningAlerts.map((alert) => (
        <div
          key={alert.id}
          className="flex items-start gap-3 bg-[#fffbeb] border border-[#fde68a] rounded-xl px-4 py-3"
        >
          <Clock size={16} strokeWidth={1.5} className="text-[#b45309] mt-0.5 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-[#78350f]">{alert.ingredientName}</p>
            <p className="text-xs text-[#92400e] mt-0.5">{alert.message}</p>
          </div>
          <span className="font-mono text-xs text-[#b45309] shrink-0">
            {alert.type === 'expiring_soon' ? 'Expiring' : 'Low'}
          </span>
        </div>
      ))}
    </div>
  )
}
