'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

const navItems = [
  { href: '/', icon: '⊞', label: 'Dashboard' },
  { href: '/slip', icon: '📋', label: 'Bet Slip' },
]

export function Sidebar() {
  const pathname = usePathname()

  return (
    <nav className="w-14 bg-[#0a0e13] border-r border-[#1c2535] flex flex-col items-center py-3 gap-2 shrink-0">
      {navItems.map(({ href, icon, label }) => (
        <Link
          key={href}
          href={href}
          title={label}
          className={`w-9 h-9 rounded-lg flex items-center justify-center text-base transition-colors
            ${pathname === href
              ? 'bg-[#2a9d5c18] text-[#2a9d5c]'
              : 'text-[#3a4a5e] hover:bg-[#1c2535] hover:text-[#8a9ab0]'
            }`}
        >
          {icon}
        </Link>
      ))}
    </nav>
  )
}
