'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState, useEffect } from 'react'

const navItems = [
  { href: '/', icon: '⊞', label: 'Dashboard' },
  { href: '/slip', icon: '📋', label: 'Bet Slip' },
  { href: '/accumulators', icon: '◈', label: 'Accumulators' },
]

export function Sidebar() {
  const pathname = usePathname()
  const [slipCount, setSlipCount] = useState(0)

  useEffect(() => {
    async function fetchCount() {
      try {
        const res = await fetch('/api/slip')
        if (res.ok) {
          const data = await res.json()
          setSlipCount(data.items?.length ?? 0)
        }
      } catch {}
    }
    fetchCount()
    window.addEventListener('slip-updated', fetchCount)
    return () => window.removeEventListener('slip-updated', fetchCount)
  }, [])

  return (
    <>
      {/* Desktop sidebar */}
      <nav className="w-14 bg-[#0a0e13] border-r border-[#1c2535] flex-col items-center py-3 gap-2 shrink-0 hidden lg:flex">
        {navItems.map(({ href, icon, label }) => (
          <Link
            key={href}
            href={href}
            title={label}
            className={`relative w-9 h-9 rounded-lg flex items-center justify-center text-base transition-colors
              ${pathname === href
                ? 'bg-[#2a9d5c18] text-[#2a9d5c]'
                : 'text-[#3a4a5e] hover:bg-[#1c2535] hover:text-[#8a9ab0]'
              }`}
          >
            {icon}
            {href === '/slip' && slipCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 text-[8px] font-mono bg-[#2a9d5c] text-[#080c10] font-bold w-3.5 h-3.5 rounded-full flex items-center justify-center">
                {slipCount > 9 ? '9+' : slipCount}
              </span>
            )}
          </Link>
        ))}
      </nav>

      {/* Mobile bottom nav */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-[#0a0e13] border-t border-[#1c2535] flex lg:hidden">
        {navItems.map(({ href, icon, label }) => (
          <Link
            key={href}
            href={href}
            className={`relative flex-1 flex flex-col items-center justify-center py-3 gap-1 transition-colors
              ${pathname === href ? 'text-[#2a9d5c]' : 'text-[#3a4a5e]'}`}
          >
            <span className="text-lg">{icon}</span>
            <span className="text-[9px] font-mono tracking-wider uppercase">{label}</span>
            {href === '/slip' && slipCount > 0 && (
              <span className="absolute top-2 left-1/2 translate-x-1 text-[8px] font-mono bg-[#2a9d5c] text-[#080c10] font-bold w-3.5 h-3.5 rounded-full flex items-center justify-center">
                {slipCount > 9 ? '9+' : slipCount}
              </span>
            )}
          </Link>
        ))}
      </nav>
    </>
  )
}
