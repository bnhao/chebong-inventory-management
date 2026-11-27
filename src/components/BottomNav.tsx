'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  PackagePlus,
  ClipboardCheck,
  ShoppingBasket,
  BookOpen,
  SlidersHorizontal,
  FileText,
  type LucideIcon,
} from 'lucide-react'

interface NavItem {
  href: string
  label: string
  Icon: LucideIcon
}

const staffNavItems: NavItem[] = [
  { href: '/staff/dashboard', label: 'Dashboard', Icon: LayoutDashboard },
  { href: '/staff/restock', label: 'Restock', Icon: PackagePlus },
  { href: '/staff/cycle-count', label: 'Count', Icon: ClipboardCheck },
  { href: '/staff/groceries', label: 'Groceries', Icon: ShoppingBasket },
]

const managerNavItems: NavItem[] = [
  { href: '/manager/dashboard', label: 'Overview', Icon: LayoutDashboard },
  { href: '/manager/recipes', label: 'Recipes', Icon: BookOpen },
  { href: '/manager/thresholds', label: 'Thresholds', Icon: SlidersHorizontal },
  { href: '/manager/groceries', label: 'Groceries', Icon: ShoppingBasket },
  { href: '/manager/reports', label: 'Logs', Icon: FileText },
]

export default function BottomNav() {
  const pathname = usePathname()
  const isManager = pathname.startsWith('/manager')
  const items = isManager ? managerNavItems : staffNavItems

  return (
    <nav
      aria-label="Mobile navigation"
      className="fixed bottom-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-sm border-t border-neutral-900/[0.08] md:hidden select-none pb-safe"
    >
      <div className="flex items-center justify-around h-16 px-2 max-w-md mx-auto">
        {items.map(({ href, label, Icon }) => {
          const active =
            pathname === href ||
            (href !== '/staff/dashboard' &&
              href !== '/manager/dashboard' &&
              pathname.startsWith(href))
          return (
            <Link
              key={href}
              href={href}
              prefetch={true}
              className={`flex flex-col items-center justify-center gap-1 min-w-14 px-2 py-1.5 rounded-lg transition-colors duration-150 ${
                active ? 'text-[#c2410c]' : 'text-[#737373] hover:text-[#171717]'
              }`}
            >
              <Icon size={18} strokeWidth={1.5} />
              <span className="text-xs font-medium leading-none">{label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
