'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

// Icons
function HomeIcon({ active }: { active: boolean }) {
  const color = active ? '#e85d04' : '#6b7280'
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9.5L12 3l9 6.5V20a1 1 0 01-1 1H4a1 1 0 01-1-1V9.5z"/>
      <path d="M9 21V12h6v9"/>
    </svg>
  )
}

function RestockIcon({ active }: { active: boolean }) {
  const color = active ? '#e85d04' : '#6b7280'
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/>
      <polyline points="3.27 6.96 12 12.01 20.73 6.96"/>
      <line x1="12" y1="22.08" x2="12" y2="12"/>
    </svg>
  )
}

function CycleCountIcon({ active }: { active: boolean }) {
  const color = active ? '#e85d04' : '#6b7280'
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 11 12 14 22 4"/>
      <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/>
    </svg>
  )
}

function GroceriesIcon({ active }: { active: boolean }) {
  const color = active ? '#e85d04' : '#6b7280'
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="9" cy="21" r="1"/>
      <circle cx="20" cy="21" r="1"/>
      <path d="M1 1h4l2.68 13.39a2 2 0 002 1.61h9.72a2 2 0 001.95-1.57L23 6H6"/>
    </svg>
  )
}

function RecipeIcon({ active }: { active: boolean }) {
  const color = active ? '#e85d04' : '#6b7280'
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
      <line x1="8" y1="6" x2="16" y2="6"/>
      <line x1="8" y1="10" x2="14" y2="10"/>
    </svg>
  )
}

function ThresholdIcon({ active }: { active: boolean }) {
  const color = active ? '#e85d04' : '#6b7280'
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3"/>
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
    </svg>
  )
}

function ReportIcon({ active }: { active: boolean }) {
  const color = active ? '#e85d04' : '#6b7280'
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
      <polyline points="14 2 14 8 20 8"/>
      <line x1="16" y1="13" x2="8" y2="13"/>
      <line x1="16" y1="17" x2="8" y2="17"/>
      <polyline points="10 9 9 9 8 9"/>
    </svg>
  )
}

const staffNavItems = [
  { href: '/staff/dashboard', label: 'Dashboard', Icon: HomeIcon },
  { href: '/staff/restock', label: 'Restock', Icon: RestockIcon },
  { href: '/staff/cycle-count', label: 'Cycle Count', Icon: CycleCountIcon },
  { href: '/staff/groceries', label: 'Groceries', Icon: GroceriesIcon },
]

const managerNavItems = [
  { href: '/manager/dashboard', label: 'Overview', Icon: HomeIcon },
  { href: '/manager/recipes', label: 'Recipes', Icon: RecipeIcon },
  { href: '/manager/thresholds', label: 'Thresholds', Icon: ThresholdIcon },
  { href: '/manager/reports', label: 'Logs', Icon: ReportIcon },
]

export default function BottomNav() {
  const pathname = usePathname()
  const isManager = pathname.startsWith('/manager')
  const items = isManager ? managerNavItems : staffNavItems

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-md border-t border-gray-200/80 md:hidden shadow-lg select-none pb-safe">
      <div className="flex items-center justify-around h-16 px-2 max-w-md mx-auto">
        {items.map(({ href, label, Icon }) => {
          const active = pathname === href || (href !== '/staff/dashboard' && href !== '/manager/dashboard' && pathname.startsWith(href))
          return (
            <Link
              key={href}
              href={href}
              prefetch={true}
              className={`flex flex-col items-center justify-center gap-0.5 min-w-[60px] px-2 py-1.5 rounded-xl transition-all active:scale-95 ${
                active ? 'text-[#e85d04]' : 'text-gray-500'
              }`}
            >
              <div className={`p-1 rounded-lg ${active ? 'bg-orange-50' : ''}`}>
                <Icon active={active} />
              </div>
              <span className={`text-[10px] font-bold ${active ? 'text-[#e85d04]' : 'text-gray-500'}`}>
                {label}
              </span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
