'use client'
import { useState } from 'react'
import { AccumulatorCraftTab } from '@/components/AccumulatorCraftTab'
import { AccumulatorSavedTab } from '@/components/AccumulatorSavedTab'

type Tab = 'craft' | 'saved'

export default function AccumulatorsPage() {
  const [tab, setTab] = useState<Tab>('craft')

  return (
    <div className="p-4 sm:p-6 max-w-5xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-['Rajdhani'] text-2xl font-bold text-white tracking-widest uppercase">
          Accumulator Builder
        </h1>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-[#0d1117] border border-[#1c2535] rounded-lg p-1 w-fit">
        {(['craft', 'saved'] as Tab[]).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-5 py-1.5 rounded-md font-['Rajdhani'] font-bold text-sm tracking-widest uppercase transition-colors ${
              tab === t
                ? 'bg-[#2a9d5c18] text-[#2a9d5c]'
                : 'text-[#5a6a7e] hover:text-[#8a9ab0]'
            }`}
          >
            {t === 'craft' ? 'Craft' : 'Saved'}
          </button>
        ))}
      </div>

      {tab === 'craft' ? <AccumulatorCraftTab /> : <AccumulatorSavedTab />}
    </div>
  )
}
