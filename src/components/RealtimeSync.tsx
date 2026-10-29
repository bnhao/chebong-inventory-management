'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function RealtimeSync() {
  const router = useRouter()
  const [lastSyncMsg, setLastSyncMsg] = useState<string | null>(null)
  const debounceTimer = useRef<NodeJS.Timeout | null>(null)
  const toastTimer = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    // Only run in browser environment
    if (typeof window === 'undefined') return

    const supabase = createClient()

    const triggerRefresh = (tableName: string) => {
      // Clear pending debounce
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current)
      }

      // Debounce router.refresh() by 350ms to batch rapid multi-row operations
      debounceTimer.current = setTimeout(() => {
        router.refresh()

        // Flash discreet visual confirmation
        const label =
          tableName === 'inventory_transactions'
            ? 'Inventory activity synced'
            : tableName === 'inventory_batches'
            ? 'New batch synced'
            : 'Stock updated'

        setLastSyncMsg(`🟢 Live: ${label}`)

        if (toastTimer.current) clearTimeout(toastTimer.current)
        toastTimer.current = setTimeout(() => {
          setLastSyncMsg(null)
        }, 2800)
      }, 350)
    }

    // Subscribe to public database changes across inventory tables
    const channel = supabase
      .channel('cb-inventory-live-sync')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'inventory_transactions' },
        () => triggerRefresh('inventory_transactions')
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'inventory_batches' },
        () => triggerRefresh('inventory_batches')
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'ingredients' },
        () => triggerRefresh('ingredients')
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'clover_items' },
        () => triggerRefresh('clover_items')
      )
      .subscribe()

    // Also trigger refresh when phone or browser window returns to foreground
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        router.refresh()
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('focus', handleVisibilityChange)

    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current)
      if (toastTimer.current) clearTimeout(toastTimer.current)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('focus', handleVisibilityChange)
      supabase.removeChannel(channel)
    }
  }, [router])

  // If there's a live update flash, show a non-intrusive micro-badge
  if (!lastSyncMsg) return null

  return (
    <div className="fixed top-18 right-4 z-50 pointer-events-none animate-in fade-in slide-in-from-top-2 duration-300">
      <div className="bg-gray-900/90 backdrop-blur-md text-white text-[11px] font-bold px-3 py-1.5 rounded-full shadow-lg border border-gray-700/80 flex items-center gap-1.5">
        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping inline-block" />
        <span>{lastSyncMsg}</span>
      </div>
    </div>
  )
}
