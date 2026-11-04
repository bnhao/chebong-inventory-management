'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname, useRouter } from 'next/navigation'

export default function TopBar() {
  const pathname = usePathname()
  const router = useRouter()
  const isManager = pathname.startsWith('/manager')

  return (
    <header className="sticky top-0 z-40 surface-glass pt-safe">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand Logo & Name */}
          <Link
            href={isManager ? '/manager/dashboard' : '/staff/dashboard'}
            prefetch={true}
            className="flex items-center gap-2 sm:gap-2.5 group py-1"
          >
            <div className="relative h-9 w-9 sm:h-10 sm:w-10 flex items-center justify-center shrink-0">
              <Image
                src="/chebong-bowl.png"
                alt="CB Inventory Logo"
                fill
                className="object-contain logo-drop-shadow transition-transform duration-300 ease-out group-hover:scale-108 group-hover:-rotate-3"
                priority
                sizes="40px"
              />
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-base sm:text-lg font-black tracking-tight text-gray-900">
                CB <span className="text-[#e85d04]">Inventory</span>
              </span>
            </div>
          </Link>

          {/* Role Toggle Pill (Staff View / Manager View) */}
          <div className="flex items-center bg-gray-100/90 border border-gray-200/70 shadow-inner rounded-full p-1 gap-1">
            <button
              onClick={() => router.push('/staff/dashboard')}
              className={`px-3.5 sm:px-4 py-1.5 rounded-full text-xs sm:text-sm font-semibold transition-all duration-200 ${
                !isManager
                  ? 'btn-tactile-primary text-white'
                  : 'text-gray-500 hover:text-gray-900 hover:bg-white/60'
              }`}
            >
              Staff View
            </button>
            <button
              onClick={() => router.push('/manager/dashboard')}
              className={`px-3.5 sm:px-4 py-1.5 rounded-full text-xs sm:text-sm font-semibold transition-all duration-200 ${
                isManager
                  ? 'btn-tactile-primary text-white'
                  : 'text-gray-500 hover:text-gray-900 hover:bg-white/60'
              }`}
            >
              Manager View
            </button>
          </div>
        </div>
      </div>
    </header>
  )
}

