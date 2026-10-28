'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

interface NavItem {
  href: string
  label: string
  icon: (active: boolean) => React.ReactNode
}

function HomeIcon(active: boolean) {
  const color = active ? '#e85d04' : '#6b7280'
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9.5L12 3l9 6.5V20a1 1 0 01-1 1H4a1 1 0 01-1-1V9.5z"/>
      <path d="M9 21V12h6v9"/>
    </svg>
  )
}

function RestockIcon(active: boolean) {
  const color = active ? '#e85d04' : '#6b7280'
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/>
      <polyline points="3.27 6.96 12 12.01 20.73 6.96"/>
      <line x1="12" y1="22.08" x2="12" y2="12"/>
    </svg>
  )
}

function CycleCountIcon(active: boolean) {
  const color = active ? '#e85d04' : '#6b7280'
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 11 12 14 22 4"/>
      <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/>
    </svg>
  )
}

function GroceriesIcon(active: boolean) {
  const color = active ? '#e85d04' : '#6b7280'
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="9" cy="21" r="1"/>
      <circle cx="20" cy="21" r="1"/>
      <path d="M1 1h4l2.68 13.39a2 2 0 002 1.61h9.72a2 2 0 001.95-1.57L23 6H6"/>
    </svg>
  )
}

const navItems: NavItem[] = [
  { href: '/staff/dashboard', label: 'Dashboard', icon: HomeIcon },
  { href: '/staff/restock', label: 'Restock', icon: RestockIcon },
  { href: '/staff/cycle-count', label: 'Cycle Count', icon: CycleCountIcon },
  { href: '/staff/groceries', label: 'Groceries', icon: GroceriesIcon },
]

export default function StaffDesktopNav() {
  const pathname = usePathname()

  return (
    <div className="hidden md:flex items-center gap-2">
      <div className="flex items-center bg-white border border-gray-200/80 rounded-2xl p-1 shadow-xs">
        {navItems.map((item) => {
          const isActive = pathname === item.href || (item.href !== '/staff/dashboard' && pathname.startsWith(item.href))
          return (
            <Link
              key={item.href}
              href={item.href}
              prefetch={true}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all whitespace-nowrap ${
                isActive
                  ? 'bg-orange-50 text-[#e85d04] border border-orange-200/60 shadow-xs'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              }`}
            >
              {item.icon(isActive)}
              <span>{item.label}</span>
            </Link>
          )
        })}
      </div>

      {/* Staff Profile Avatar */}
      <div className="w-10 h-10 rounded-full border border-gray-200 bg-white flex items-center justify-center shrink-0 shadow-xs ml-1">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#4b5563" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
          <circle cx="12" cy="7" r="4"/>
        </svg>
      </div>
    </div>
  )
}

