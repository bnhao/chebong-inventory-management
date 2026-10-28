'use client'

import { useEffect, useState } from 'react'
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

  useEffect(() => {
    // 1. Register Service Worker
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker
          .register('/sw.js')
          .then((reg) => {
            // Check for updates periodically
            reg.onupdatefound = () => {
              const installingWorker = reg.installing
              if (installingWorker) {
                installingWorker.onstatechange = () => {
                  if (installingWorker.state === 'installed' && navigator.serviceWorker.controller) {
                    console.log('New Chè Bông PWA content available.')
                  }
                }
              }
            }
          })
          .catch((err) => {
            console.warn('Service worker registration failed:', err)
          })
      })
    }

    // 2. Detect if already running as installed standalone PWA
    const standaloneMode =
      window.matchMedia('(display-mode: standalone)').matches ||
      ('standalone' in window.navigator && Boolean((window.navigator as unknown as { standalone: boolean }).standalone))

    setIsStandalone(standaloneMode)
    if (standaloneMode) return

    // 3. Detect iOS Safari
    const userAgent = window.navigator.userAgent.toLowerCase()
    const isIosDevice = /iphone|ipad|ipod/.test(userAgent) && !/crios|fxios|opios/.test(userAgent)
    setIsIOS(isIosDevice)

    // Check if dismissed previously this session
    const isDismissed = sessionStorage.getItem('pwa_prompt_dismissed')

    if (isIosDevice && !standaloneMode && !isDismissed) {
      // Delay showing iOS prompt slightly for smooth UX
      const timer = setTimeout(() => setShowInstallBanner(true), 3500)
      return () => clearTimeout(timer)
    }

    // 4. Handle Android/Chrome beforeinstallprompt
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
      if (!isDismissed) {
        setShowInstallBanner(true)
      }
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstall)

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall)
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

  const handleDismiss = () => {
    setShowInstallBanner(false)
    sessionStorage.setItem('pwa_prompt_dismissed', 'true')
  }

  if (isStandalone || !showInstallBanner) {
    return null
  }

  return (
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
                  <span className="font-semibold text-orange-400">&apos;Add to Home Screen&apos;</span> to remove browser bars & run fullscreen.
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
            onClick={handleDismiss}
            className="text-gray-400 hover:text-white p-1 text-xs"
            aria-label="Dismiss"
          >
            ✕
          </button>
        </div>
      </div>
    </div>
  )
}

