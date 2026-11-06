import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Brand, PlannerConfig, PlannerProduct } from '@/types/planner'
import { defaultPlannerConfig } from '@/lib/plannerDefaults'
import { remotePersistStorage } from '@/lib/remoteStorage'

interface PlannerStore {
  config: PlannerConfig
  products: PlannerProduct[]
  brand_filter: Brand | 'all'
  selected_id: string | null

  updateConfig: (updates: Partial<PlannerConfig>) => void
  confirmConfigField: (field: keyof PlannerConfig) => void
  upsertProduct: (product: PlannerProduct) => void
  removeProduct: (id: string) => void
  setBrandFilter: (brand: Brand | 'all') => void
  selectProduct: (id: string | null) => void
  resetConfig: () => void
}

export const usePlannerStore = create<PlannerStore>()(
  persist(
    (set) => ({
      config: defaultPlannerConfig,
      products: [],
      brand_filter: 'all',
      selected_id: null,

      // Editing a placeholder value confirms it: the owner has now chosen it.
      updateConfig: (updates) =>
        set(s => ({
          config: {
            ...s.config,
            ...updates,
            unconfirmed: s.config.unconfirmed.filter(k => !(k in updates)),
          },
        })),

      confirmConfigField: (field) =>
        set(s => ({ config: { ...s.config, unconfirmed: s.config.unconfirmed.filter(k => k !== field) } })),

      upsertProduct: (product) =>
        set(s => ({
          products: s.products.some(p => p.id === product.id)
            ? s.products.map(p => (p.id === product.id ? product : p))
            : [...s.products, product],
        })),

      removeProduct: (id) =>
        set(s => ({
          products: s.products.filter(p => p.id !== id),
          selected_id: s.selected_id === id ? null : s.selected_id,
        })),

      setBrandFilter: (brand) => set({ brand_filter: brand }),
      selectProduct: (id) => set({ selected_id: id }),
      resetConfig: () => set({ config: defaultPlannerConfig }),
    }),
    {
      name: 'pw-planner',
      storage: remotePersistStorage<Pick<PlannerStore, 'config' | 'products'>>(),
      // Only the data is saved. The selected row and brand filter are screen
      // state: saving them would turn every click into a "change" on the server.
      partialize: (s) => ({ config: s.config, products: s.products }),
    },
  ),
)

export function useVisibleProducts(): PlannerProduct[] {
  const products = usePlannerStore(s => s.products)
  const brand = usePlannerStore(s => s.brand_filter)
  return brand === 'all' ? products : products.filter(p => p.brand === brand)
}

export function useSelectedProduct(): PlannerProduct | null {
  const id = usePlannerStore(s => s.selected_id)
  const products = usePlannerStore(s => s.products)
  return products.find(p => p.id === id) ?? null
}
