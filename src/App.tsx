import { Fragment, useState } from 'react'
import { Calculator, Package, FileText, Settings, Boxes, Layers, Percent, SlidersHorizontal, type LucideIcon } from 'lucide-react'
import { CalculatorTab } from '@/tabs/CalculatorTab'
import { BulkPlannerTab } from '@/tabs/BulkPlannerTab'
import { QuoteBuilderTab } from '@/tabs/QuoteBuilderTab'
import { SettingsTab } from '@/tabs/SettingsTab'
import { ProductsTab } from '@/tabs/ProductsTab'
import { PriceLadderTab } from '@/tabs/PriceLadderTab'
import { OffersTab } from '@/tabs/OffersTab'
import { PlannerSettingsTab } from '@/tabs/PlannerSettingsTab'

type Tab = 'calculator' | 'bulk' | 'quote' | 'settings' | 'products' | 'ladder' | 'offers' | 'planner'

const tabs: { id: Tab; label: string; Icon: LucideIcon }[] = [
  { id: 'calculator', label: 'Calculator', Icon: Calculator },
  { id: 'bulk', label: 'Bulk Planner', Icon: Package },
  { id: 'quote', label: 'Quote Builder', Icon: FileText },
  { id: 'settings', label: 'Settings', Icon: Settings },
  { id: 'products', label: 'Products', Icon: Boxes },
  { id: 'ladder', label: 'Price Ladder', Icon: Layers },
  { id: 'offers', label: 'Offers', Icon: Percent },
  { id: 'planner', label: 'Planner Settings', Icon: SlidersHorizontal },
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
          <span className="text-zinc-500 text-sm">/ Cost &amp; Offers Planner</span>
        </div>
        <span className="text-xs text-emerald-400 bg-emerald-900/30 border border-emerald-700/40 px-2 py-1 rounded">
          All saved
        </span>
      </header>

      {/* Tab Bar */}
      {/* One line at any width: scrolls sideways instead of wrapping. The planner tabs
          (Products onward) are set apart from the original single-job calculator. */}
      <nav className="bg-zinc-900 border-b border-zinc-800 px-6 flex items-stretch gap-1 overflow-x-auto">
        {tabs.map(({ id, label, Icon }) => (
          <Fragment key={id}>
            {id === 'products' && (
              <span className="flex items-center gap-2 pl-3 pr-1 ml-2 border-l border-zinc-800 text-[10px] font-semibold tracking-widest text-zinc-600 uppercase whitespace-nowrap">
                Planner
              </span>
            )}
            <button
              onClick={() => setActiveTab(id)}
              className={`flex items-center gap-2 px-3 py-3 text-sm font-medium whitespace-nowrap transition-colors border-b-2 ${
                activeTab === id
                  ? 'border-orange-500 text-orange-400'
                  : 'border-transparent text-zinc-500 hover:text-zinc-300'
              }`}
            >
              <Icon size={14} />
              {label}
            </button>
          </Fragment>
        ))}
      </nav>

      {/* Tab Content */}
      <main className="max-w-7xl mx-auto">
        {activeTab === 'calculator' && <CalculatorTab />}
        {activeTab === 'bulk' && <BulkPlannerTab />}
        {activeTab === 'quote' && <QuoteBuilderTab />}
        {activeTab === 'settings' && <SettingsTab />}
        {activeTab === 'products' && <ProductsTab />}
        {activeTab === 'ladder' && <PriceLadderTab />}
        {activeTab === 'offers' && <OffersTab />}
        {activeTab === 'planner' && <PlannerSettingsTab />}
      </main>
    </div>
  )
}
