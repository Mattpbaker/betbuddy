import type { Metadata } from 'next'
import './globals.css'
import { Sidebar } from '@/components/layout/Sidebar'
import { BetSlipPanel } from '@/components/layout/BetSlipPanel'

export const metadata: Metadata = {
  title: 'Betbuddy',
  description: 'Personal football betting research tool',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-[#080c10] text-[#e0e6f0] h-screen flex flex-col overflow-hidden">
        <header className="h-12 bg-[#0a0e13] border-b border-[#1c2535] flex items-center px-5 shrink-0">
          <span className="font-['Rajdhani'] text-lg font-bold text-[#2a9d5c] tracking-[0.12em] uppercase">
            Betbuddy
          </span>
        </header>
        <div className="flex flex-1 min-h-0">
          <Sidebar />
          <main className="flex-1 overflow-y-auto pb-16 lg:pb-0">
            {children}
          </main>
          <BetSlipPanel />
        </div>
      </body>
    </html>
  )
}
