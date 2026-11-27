'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname, useRouter } from 'next/navigation'

export default function TopBar() {
  const pathname = usePathname()
  const router = useRouter()
  const isManager = pathname.startsWith('/manager')

  return (
    <header className="sticky top-0 z-40 surface-bar pt-safe">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <Link
            href={isManager ? '/manager/dashboard' : '/staff/dashboard'}
            prefetch={true}
            className="flex items-center gap-2.5 py-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c2410c] rounded-lg"
          >
            <div className="relative h-8 w-8 flex items-center justify-center shrink-0">
              <Image
                src="/chebong-bowl.png"
                alt="CB Inventory"
                fill
                className="object-contain"
                priority
                sizes="32px"
              />
            </div>
            <span className="text-base font-semibold tracking-[-0.01em] text-[#171717]">
              CB Inventory
            </span>
          </Link>

          <div
            role="tablist"
            aria-label="Workspace view"
            className="flex items-center bg-[#f4f4f5] border border-neutral-900/[0.08] rounded-xl p-1 gap-1"
          >
            <button
              type="button"
              role="tab"
              aria-selected={!isManager}
              onClick={() => router.push('/staff/dashboard')}
              className={`h-8 px-3 rounded-lg text-xs sm:text-sm font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c2410c] ${
                !isManager
                  ? 'bg-white text-[#171717] border border-neutral-900/[0.08] shadow-[0_1px_2px_rgba(0,0,0,0.05)]'
                  : 'text-[#525252] hover:text-[#171717] border border-transparent'
              }`}
            >
              Staff
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={isManager}
              onClick={() => router.push('/manager/dashboard')}
              className={`h-8 px-3 rounded-lg text-xs sm:text-sm font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c2410c] ${
                isManager
                  ? 'bg-white text-[#171717] border border-neutral-900/[0.08] shadow-[0_1px_2px_rgba(0,0,0,0.05)]'
                  : 'text-[#525252] hover:text-[#171717] border border-transparent'
              }`}
            >
              Manager
            </button>
          </div>
        </div>
      </div>
    </header>
  )
}
