'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  BookOpen,
  SlidersHorizontal,
  ShoppingBasket,
  FileText,
  type LucideIcon,
} from 'lucide-react'

interface NavItem {
  href: string
  label: string
  Icon: LucideIcon
}

const navItems: NavItem[] = [
  { href: '/manager/dashboard', label: 'Overview', Icon: LayoutDashboard },
  { href: '/manager/recipes', label: 'Recipes & Clover', Icon: BookOpen },
  { href: '/manager/thresholds', label: 'Thresholds', Icon: SlidersHorizontal },
  { href: '/manager/groceries', label: 'Groceries', Icon: ShoppingBasket },
  { href: '/manager/reports', label: 'Logs & audits', Icon: FileText },
]

export default function ManagerNav() {
  const pathname = usePathname()

  return (
    <nav aria-label="Manager navigation" className="flex items-center overflow-x-auto no-scrollbar">
      <div className="flex items-center bg-white border border-neutral-900/[0.08] shadow-[0_1px_2px_rgba(0,0,0,0.04)] rounded-xl p-1 gap-1">
        {navItems.map(({ href, label, Icon }) => {
          const isActive =
            pathname === href ||
            (href !== '/manager/dashboard' && pathname.startsWith(href))
          return (
            <Link
              key={href}
              href={href}
              prefetch={true}
              className={`h-9 flex items-center gap-2 px-3 rounded-lg text-sm font-medium transition-colors duration-150 whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c2410c] ${
                isActive
                  ? 'bg-[#fff7ed] text-[#c2410c] border border-[#fed7aa]'
                  : 'text-[#525252] hover:text-[#171717] hover:bg-[#f4f4f5] border border-transparent'
              }`}
            >
              <Icon
                size={16}
                strokeWidth={1.5}
                className={isActive ? 'text-[#c2410c]' : 'text-[#737373]'}
              />
              <span>{label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
