'use client'

import { useEffect, useState, useRef } from 'react'
import Image from 'next/image'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export default function PwaRegister() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [showInstallBanner, setShowInstallBanner] = useState(false)
  const [isIOS, setIsIOS] = useState(false)
  const [isStandalone, setIsStandalone] = useState(false)
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null)
  const [isUpdating, setIsUpdating] = useState(false)
  const refreshing = useRef(false)

  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
      return
    }

    // 1. Listen for Service Worker controllerchange to reload cleanly once
    const handleControllerChange = () => {
      if (refreshing.current) return
      refreshing.current = true
      window.location.reload()
    }
    navigator.serviceWorker.addEventListener('controllerchange', handleControllerChange)

    let registration: ServiceWorkerRegistration | null = null

    // Register Service Worker
    navigator.serviceWorker
      .register('/sw.js')
      .then((reg) => {
        registration = reg

        // Check if there is already a waiting service worker
        if (reg.waiting) {
          setWaitingWorker(reg.waiting)
        }

        // Listen for new service workers being discovered
        reg.onupdatefound = () => {
          const installingWorker = reg.installing
          if (installingWorker) {
            installingWorker.onstatechange = () => {
              if (installingWorker.state === 'installed' && navigator.serviceWorker.controller) {
                // New update ready and waiting
                setWaitingWorker(installingWorker)
              }
            }
          }
        }
      })
      .catch((err) => {
        console.warn('Service worker registration failed:', err)
      })

    // 2. Proactively check for updates when returning to the app or tab
    const checkForUpdates = () => {
      if (registration && typeof registration.update === 'function') {
        registration.update().catch(() => {})
      }
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        checkForUpdates()
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('focus', checkForUpdates)
    // Periodic check every 15 minutes
    const interval = setInterval(checkForUpdates, 15 * 60 * 1000)

    // 3. Detect if already running as installed standalone PWA
    const standaloneMode =
      window.matchMedia('(display-mode: standalone)').matches ||
      ('standalone' in window.navigator && Boolean((window.navigator as unknown as { standalone: boolean }).standalone))

    setIsStandalone(standaloneMode)

    // 4. Detect iOS Safari for Add to Home Screen prompt
    const userAgent = window.navigator.userAgent.toLowerCase()
    const isIosDevice = /iphone|ipad|ipod/.test(userAgent) && !/crios|fxios|opios/.test(userAgent)
    setIsIOS(isIosDevice)

    const isDismissed = sessionStorage.getItem('pwa_prompt_dismissed')
    if (isIosDevice && !standaloneMode && !isDismissed) {
      const timer = setTimeout(() => setShowInstallBanner(true), 3500)
      return () => {
        clearTimeout(timer)
        clearInterval(interval)
        document.removeEventListener('visibilitychange', handleVisibilityChange)
        window.removeEventListener('focus', checkForUpdates)
        navigator.serviceWorker.removeEventListener('controllerchange', handleControllerChange)
      }
    }

    // 5. Handle Android / Chrome beforeinstallprompt
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
      if (!isDismissed && !standaloneMode) {
        setShowInstallBanner(true)
      }
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstall)

    return () => {
      clearInterval(interval)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('focus', checkForUpdates)
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall)
      navigator.serviceWorker.removeEventListener('controllerchange', handleControllerChange)
    }
  }, [])

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      await deferredPrompt.prompt()
      const choice = await deferredPrompt.userChoice
      if (choice.outcome === 'accepted') {
        setShowInstallBanner(false)
      }
      setDeferredPrompt(null)
    }
  }

  const handleDismissInstall = () => {
    setShowInstallBanner(false)
    sessionStorage.setItem('pwa_prompt_dismissed', 'true')
  }

  const handleApplyUpdate = () => {
    if (waitingWorker) {
      setIsUpdating(true)
      waitingWorker.postMessage({ type: 'SKIP_WAITING' })
    } else {
      window.location.reload()
    }
  }

  return (
    <>
      {/* 1. App Update Banner (Shown when a new version deploys on Vercel) */}
      {waitingWorker && (
        <div className="fixed top-4 left-4 right-4 md:left-auto md:right-6 md:max-w-md z-50 animate-in fade-in slide-in-from-top-3 duration-300">
          <div className="bg-gray-950 text-white p-3.5 sm:p-4 rounded-2xl shadow-2xl border border-orange-500/40 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="relative w-9 h-9 rounded-xl bg-orange-500/20 text-[#e85d04] flex items-center justify-center shrink-0 border border-orange-500/30">
                <svg className="w-5 h-5 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </div>
              <div className="text-left min-w-0">
                <h4 className="text-xs font-bold text-white tracking-wide">
                  New Version Available
                </h4>
                <p className="text-[11px] text-gray-300 truncate">
                  Latest updates are ready to apply.
                </p>
              </div>
            </div>

            <button
              onClick={handleApplyUpdate}
              disabled={isUpdating}
              className="bg-[#e85d04] hover:bg-[#d45203] text-white text-xs font-bold px-3.5 py-1.5 rounded-xl shadow-md transition-all active:scale-95 shrink-0"
            >
              {isUpdating ? 'Updating...' : 'Update'}
            </button>
          </div>
        </div>
      )}

      {/* 2. PWA Add to Home Screen Banner (Mobile browser only, not standalone) */}
      {!isStandalone && showInstallBanner && (
        <div className="fixed bottom-20 md:bottom-6 left-4 right-4 md:left-auto md:right-6 md:max-w-md z-50 animate-in fade-in slide-in-from-bottom-4 duration-300">
          <div className="bg-gray-900/95 backdrop-blur-md text-white p-3.5 sm:p-4 rounded-2xl shadow-2xl border border-gray-800 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="relative w-10 h-10 rounded-xl bg-white p-1.5 flex items-center justify-center shrink-0 shadow-md">
                <Image
                  src="/chebong-bowl.png"
                  alt="CB Inventory"
                  fill
                  className="object-contain p-1"
                />
              </div>
              <div className="text-left">
                <h4 className="text-xs font-bold text-white tracking-wide">
                  Install CB Inventory App
                </h4>
                <p className="text-[11px] text-gray-300 leading-tight">
                  {isIOS ? (
                    <span>
                      Tap <span className="font-semibold text-orange-400">Share ⎋</span> below, then{' '}
                      <span className="font-semibold text-orange-400">&apos;Add to Home Screen&apos;</span> to run fullscreen.
                    </span>
                  ) : (
                    'Add to your phone for instant, fullscreen native app access'
                  )}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {!isIOS && deferredPrompt && (
                <button
                  onClick={handleInstallClick}
                  className="bg-[#e85d04] hover:bg-[#d45203] text-white text-xs font-bold px-3 py-1.5 rounded-xl shadow-xs transition-all active:scale-95"
                >
                  Install
                </button>
              )}
              <button
                onClick={handleDismissInstall}
                className="text-gray-400 hover:text-white p-1 text-xs"
                aria-label="Dismiss"
              >
                ✕
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
