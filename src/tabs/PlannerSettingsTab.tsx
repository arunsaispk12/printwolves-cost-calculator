import { usePlannerStore } from '@/store/plannerStore'
import { Badge, Guide, NumberField, SectionLabel, Term } from '@/components/planner/ui'
import type { PlannerConfig } from '@/types/planner'

type NumericField = Exclude<keyof PlannerConfig, 'unconfirmed'>

const groups: Array<{ title: string; fields: Array<{ key: NumericField; label: string; suffix: string; step?: number }> }> = [
  {
    title: 'Landed cost',
    fields: [
      { key: 'packaging_inr', label: 'Packaging per unit', suffix: '₹' },
      { key: 'inbound_freight_pct', label: 'Inbound freight', suffix: '% of cost', step: 0.1 },
    ],
  },
  {
    title: 'Payment & shipping',
    fields: [
      { key: 'gateway_fee_pct', label: 'Gateway fee (Razorpay)', suffix: '%', step: 0.01 },
      { key: 'outbound_shipping_cost_inr', label: 'Real outbound shipping cost per order', suffix: '₹' },
      { key: 'customer_shipping_fee_inr', label: 'Shipping fee charged to customer', suffix: '₹' },
      { key: 'free_shipping_threshold_inr', label: 'Free shipping threshold', suffix: '₹' },
      { key: 'gift_wrap_fee_inr', label: 'Gift wrap fee charged to customer', suffix: '₹' },
      { key: 'gift_wrap_cost_inr', label: 'Your real gift wrap cost', suffix: '₹' },
    ],
  },
  {
    title: 'Margin & pricing',
    fields: [
      { key: 'target_margin_pct', label: 'Target net margin', suffix: '%' },
      { key: 'min_margin_pct', label: 'Margin floor', suffix: '%' },
      { key: 'b2b_extra_discount_pct', label: 'B2B extra discount', suffix: '%' },
      { key: 'compare_at_multiplier', label: 'Compare-at multiplier', suffix: '×', step: 0.05 },
      { key: 'gst_rate_pct', label: 'GST rate on products', suffix: '%' },
    ],
  },
]

export function PlannerSettingsTab() {
  const { config, updateConfig, confirmConfigField, resetConfig } = usePlannerStore()

  return (
    <div className="p-6 space-y-6 max-w-3xl">
      <SectionLabel>Planner settings</SectionLabel>
      <Guide id="planner-settings" title="What these settings do">
        <p>
          These apply to every estimate. Fields marked <Badge tone="warn">placeholder</Badge> are guesses, not measured figures; edit one, or press
          Confirm, once you know the real value. Every price and margin in the planner moves with them.
        </p>
        <dl className="space-y-1">
          <Term name="Landed cost">Packaging and inbound freight are added to each unit's component cost.</Term>
          <Term name="Payment & shipping">The gateway fee comes off every sale. Real shipping cost is what you pay the courier per order; the fee and threshold are what the customer is charged.</Term>
          <Term name="Margin & pricing">Target margin sets the B2C price. The floor is the lowest margin you accept; anything under it is flagged. Margin is measured on the selling price, after the gateway fee.</Term>
        </dl>
      </Guide>

      {groups.map(g => (
        <div key={g.title} className="border border-zinc-800 rounded-lg p-4 space-y-3">
          <SectionLabel>{g.title}</SectionLabel>
          <div className="grid sm:grid-cols-2 gap-4">
            {g.fields.map(f => {
              const placeholder = config.unconfirmed.includes(f.key)
              return (
                <NumberField
                  key={f.key}
                  label={f.label}
                  suffix={f.suffix}
                  step={f.step}
                  value={config[f.key] as number}
                  onChange={v => updateConfig({ [f.key]: v })}
                  hint={placeholder && (
                    <button onClick={() => confirmConfigField(f.key)} title="Mark this value as confirmed">
                      <Badge tone="warn">placeholder · Confirm</Badge>
                    </button>
                  )}
                />
              )
            })}
          </div>
        </div>
      ))}

      <button onClick={resetConfig} className="px-3 py-1.5 rounded border border-zinc-700 text-sm text-slate-300 hover:bg-zinc-800">
        Reset to defaults
      </button>
    </div>
  )
}
