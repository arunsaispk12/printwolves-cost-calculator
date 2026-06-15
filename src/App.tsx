import { useState } from 'react'
import { Calculator, Package, FileText, Settings, type LucideIcon } from 'lucide-react'
import { CalculatorTab } from '@/tabs/CalculatorTab'
import { BulkPlannerTab } from '@/tabs/BulkPlannerTab'
import { QuoteBuilderTab } from '@/tabs/QuoteBuilderTab'
import { SettingsTab } from '@/tabs/SettingsTab'

type Tab = 'calculator' | 'bulk' | 'quote' | 'settings'

const tabs: { id: Tab; label: string; Icon: LucideIcon }[] = [
  { id: 'calculator', label: 'Calculator', Icon: Calculator },
  { id: 'bulk', label: 'Bulk Planner', Icon: Package },
  { id: 'quote', label: 'Quote Builder', Icon: FileText },
  { id: 'settings', label: 'Settings', Icon: Settings },
]

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>('calculator')

  return (
    <div className="min-h-screen bg-[#0f172a] text-slate-100 font-sans">
      {/* Header */}
      <header className="bg-zinc-900 border-b border-zinc-800 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded-md bg-gradient-to-br from-orange-500 to-orange-600" />
          <span className="font-bold text-white">Print Wolves</span>
          <span className="text-zinc-500 text-sm">/ Cost Calculator</span>
        </div>
        <span className="text-xs text-emerald-400 bg-emerald-900/30 border border-emerald-700/40 px-2 py-1 rounded">
          All saved
        </span>
      </header>

      {/* Tab Bar */}
      <nav className="bg-zinc-900 border-b border-zinc-800 px-6 flex gap-1">
        {tabs.map(({ id, label, Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors border-b-2 ${
              activeTab === id
                ? 'border-orange-500 text-orange-400'
                : 'border-transparent text-zinc-500 hover:text-zinc-300'
            }`}
          >
            <Icon size={14} />
            {label}
          </button>
        ))}
      </nav>

      {/* Tab Content */}
      <main className="max-w-7xl mx-auto">
        {activeTab === 'calculator' && <CalculatorTab />}
        {activeTab === 'bulk' && <BulkPlannerTab />}
        {activeTab === 'quote' && <QuoteBuilderTab />}
        {activeTab === 'settings' && <SettingsTab />}
      </main>
    </div>
  )
}
