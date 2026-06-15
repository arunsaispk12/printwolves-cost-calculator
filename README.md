# Print Wolves Cost Calculator

Industrial-grade 3D printing cost calculator for the Print Wolves business owner. Computes true production costs from first principles and derives the exact values needed to fill the KL/PW Admin → Step 5: Pricing form.

**Live:** [arunsaispk12.github.io/printwolves-cost-calculator](https://arunsaispk12.github.io/printwolves-cost-calculator/)

---

## What It Does

Enter a job (material, weight, print time, complexity, quantity, delivery speed) and the calculator:

1. **Breaks down every cost** — material, electricity, machine depreciation, maintenance, setup labor, monitoring labor, post-processing labor, failure buffer
2. **Derives sell prices** — B2C ex-GST, B2C inc-GST, B2B inc-GST, Compare At (MRP), using cost-plus formula with configurable margin
3. **Maps to Admin form fields** — Step 5 values with one-click copy-to-clipboard
4. **Shows bulk pricing** — all volume tiers with savings vs. single-unit, Best Value badge, Smart Recommendation
5. **Generates client quotes** — branded quote preview with tier selector, printable as PDF

Nothing is hardcoded. Every cost driver is configurable in the Settings tab and persisted to localStorage.

---

## Tabs

| Tab | Purpose |
|-----|---------|
| **Calculator** | Live pricing as you type. Left: job inputs. Right: cost breakdown + Admin Step 5 values |
| **Bulk Planner** | All quantity tiers in one table — unit price, totals (ex/inc GST), savings, Best Value highlight |
| **Quote Builder** | Client-facing quote with tier selector and print-to-PDF |
| **Settings** | 7 sections: Materials · Printer · Labor · Electricity · Pricing Strategy · Volume Tiers · Complexity Multipliers |

---

## Pricing Formula

```
production_cost = material + energy + depreciation + maintenance
                + setup_labor + monitoring_labor + post_proc_labor
                + failure_buffer

b2c_price = ceil(production_cost / (1 - margin%) × delivery_factor)
b2b_price = ceil(b2c_price × (1 - b2b_discount%))
gst_amount = b2c_price × gst_rate%
compare_at  = roundPsych(b2c_price × compare_at_multiplier)
```

All `ceil()` calls use `Math.ceil` to ensure prices always cover costs.

**Margin advisor:** suggests base margin by material cost tier (40–57%) + complexity uplift (0–8%), capped at 65%. Shown as a hint below the material selector.

---

## Stack

| Layer | Tech |
|-------|------|
| Build | Vite 5, TypeScript 5 |
| UI | React 18, shadcn/ui, Tailwind CSS v3 |
| State | Zustand (settings persisted to localStorage) |
| Tests | Vitest + @testing-library/react (34 assertions) |
| Icons | Lucide React |
| Deploy | GitHub Pages via Actions |

---

## Local Development

```bash
git clone https://github.com/arunsaispk12/printwolves-cost-calculator.git
cd printwolves-cost-calculator
npm install
npm run dev          # http://localhost:5173/printwolves-cost-calculator/
```

```bash
npm run build        # Production build → dist/
npm run test         # Run 34 unit tests
npx tsc --noEmit     # TypeScript check
```

---

## Settings Reference

All settings live in the **Settings tab** and persist across sessions.

### Materials
Each material has `cost_per_kg` (INR) and `density_g_cm3`. Eight defaults are pre-loaded (PLA+, PLA Silk, PETG, ABS, TPU, ASA, Resin Standard, Resin ABS-Like).

### Printer Profile
| Field | Default |
|-------|---------|
| Printer | Bambu Lab X1 Carbon |
| Purchase price | ₹1,20,000 |
| Lifespan | 5,000 hrs |
| Power draw | 350 W |
| Monthly maintenance | ₹2,000 |
| Monthly print hours | 300 hrs |
| Failure rate | 3% |

### Labor Rates
| Field | Default |
|-------|---------|
| Setup (flat per job) | ₹30 |
| Monitoring | ₹15/hr |
| Post-processing | ₹80/hr |

### Pricing Strategy
| Field | Default |
|-------|---------|
| Target retail margin | 45% |
| Minimum margin threshold | 30% |
| B2B discount from B2C | 15% |
| GST rate | 18% |
| Compare At multiplier | 1.3× |

### Volume Tiers (defaults)
| Min Qty | Discount |
|---------|----------|
| 1 | 0% |
| 5 | 5% |
| 10 | 10% |
| 25 | 15% |
| 50 | 20% |
| 100 | 25% |

### Delivery Speeds
| Speed | Premium |
|-------|---------|
| Standard (5–7 days) | +0% |
| Express (2–3 days) | +15% |
| Rush (24 hrs) | +30% |

### Complexity Multipliers
Applied to print hours before computing energy, depreciation, maintenance, and monitoring labor.

| Level | Multiplier |
|-------|-----------|
| Simple | 1.0× |
| Moderate | 1.15× |
| Complex | 1.35× |
| Very Complex | 1.60× |

---

## Admin Pricing Form — Step 5 Mapping

| Calculator Output | Admin Field |
|-------------------|-------------|
| Production Cost | Cost Price |
| B2C ex-GST | Base Price |
| B2C inc-GST | B2C Price |
| B2B inc-GST | B2B Price |
| Compare At (MRP) | Compare At |

Copy-to-clipboard buttons on each field for fast entry.

---

## TierProgressBar — Standalone Export

The `TierProgressBar` component is also built as a standalone library for embedding in the PrintWolves store product page.

```bash
npm run build:tier-bar   # Output → dist-tier-bar/
```

Output files:
- `dist-tier-bar/tier-progress-bar.js` — ES module (~11 kB)
- `dist-tier-bar/tier-progress-bar.umd.cjs` — UMD bundle (~8 kB)

React and ReactDOM are peer dependencies (externalized from the bundle).

Usage in PW store:
```tsx
import { TierProgressBar } from './tier-progress-bar.js'

<TierProgressBar
  tiers={volumeTiers}
  currentQty={qty}
  baseUnitPrice={b2cExGst}
  theme="light"          // "dark" for calculator, "light" for store product page
  onSuggestionClick={qty => setQty(qty)}
/>
```

---

## Deployment

Pushes to `main` auto-deploy to GitHub Pages via `.github/workflows/deploy.yml`.

Manual deploy:
```bash
npm run deploy   # runs build then gh-pages -d dist
```

After first deploy: GitHub → Settings → Pages → Source: `gh-pages` branch.

---

## Project Structure

```
src/
├── types/index.ts          # All TypeScript interfaces
├── lib/
│   ├── formatters.ts       # formatINR, roundPsych, roundUpToRupee
│   └── defaultConfig.ts    # Default settings (all configurable)
├── engine/
│   ├── pricingEngine.ts    # computePrice() — pure function
│   ├── marginAdvisor.ts    # suggestMargin() — material × complexity
│   └── bulkPlanner.ts      # computeBulkTiers() — best-value detection
├── store/
│   ├── settingsStore.ts    # Zustand, persisted to localStorage
│   └── calculatorStore.ts  # Zustand, session state
├── components/
│   ├── TierProgressBar.tsx # dark/light theme, reusable
│   ├── CostBreakdown.tsx   # Live cost rows + B2C price card
│   └── AdminPriceOutput.tsx # Step 5 field mapping with copy buttons
└── tabs/
    ├── CalculatorTab.tsx
    ├── BulkPlannerTab.tsx
    ├── QuoteBuilderTab.tsx
    └── SettingsTab.tsx
```

---

## Related Repos

| Repo | Purpose |
|------|---------|
| [KaspersLab-Ecosystem](https://github.com/arunsaispk12/KaspersLab-Ecosystem) | Central inventory + auth API |
| [PrintWolves-Ecommerce](https://github.com/arunsaispk12/PrintWolves-Ecommerce) | PW store (TierProgressBar embeds here) |
| [KaspersLab-Ecommerce](https://github.com/arunsaispk12/KaspersLab-Ecommerce) | KL electronics store |
