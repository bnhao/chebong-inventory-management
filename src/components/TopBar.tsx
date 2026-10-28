'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'

export default function TopBar() {
  const pathname = usePathname()
  const router = useRouter()
  const isManager = pathname.startsWith('/manager')

  return (
    <header className="sticky top-0 z-40 bg-white border-b border-gray-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand Logo & Name */}
          <Link href={isManager ? '/manager/dashboard' : '/staff/dashboard'} prefetch={true} className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#e85d04] flex items-center justify-center shadow-sm shadow-orange-200">
              <span className="text-white font-extrabold text-base">C</span>
            </div>
            <span className="text-base sm:text-lg font-bold text-gray-900 tracking-tight">
              Che Bong Inventory
            </span>
          </Link>

          {/* Role Toggle Pill (Staff View / Manager View) */}
          <div className="flex items-center bg-gray-100 rounded-full p-1 gap-1">
            <button
              onClick={() => router.push('/staff/dashboard')}
              className={`px-3.5 sm:px-4 py-1.5 rounded-full text-xs sm:text-sm font-semibold transition-all ${
                !isManager
                  ? 'bg-[#e85d04] text-white shadow-sm'
                  : 'text-gray-500 hover:text-gray-900'
              }`}
            >
              Staff View
            </button>
            <button
              onClick={() => router.push('/manager/dashboard')}
              className={`px-3.5 sm:px-4 py-1.5 rounded-full text-xs sm:text-sm font-semibold transition-all ${
                isManager
                  ? 'bg-[#e85d04] text-white shadow-sm'
                  : 'text-gray-500 hover:text-gray-900'
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
