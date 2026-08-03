# Print Wolves Design System — Design Spec

**Date:** 2026-08-03
**Status:** Approved for planning

## Purpose

Build a real, branded Print Wolves design system inside this repo so it can later be synced to Claude Design (`/design-sync`) — giving the design agent genuine, on-brand components to build with instead of generic defaults. A secondary effect: this repo's own app (Calculator, Bulk Planner, Quote Builder, Settings) gets rebranded to match the actual Print Wolves logo, since the app will consume the design system directly rather than a parallel copy.

## Background / decisions made

- **Not scoped for a general `/design-sync` run as-is.** The existing `src/components/ui/*` is stock, unmodified shadcn/ui — no brand identity — so an earlier `/design-sync` attempt was intentionally declined pending this work.
- **Brand color source conflict found and resolved.** `KaspersLab-Ecosystem/branding/README.md` documents Print Wolves' primary color as purple `#7c3aed`, but the actual shipped logo (`PW3D Icon MarkT.png`, `PW3D Horizontal Word markT.png`) is steel/electric blue with silver metallic facets and orange-amber glowing eyes — no purple anywhere. The README's `02_Variants` folders are empty, consistent with it being an unfilled template that predates the final logo. **Decision: the shipped logo is authoritative, not the README.** The README should be corrected separately (out of scope here) to avoid this drift causing confusion again.
- The existing `pw.orange` (`#f97316`) Tailwind token was previously (mis)treated as if it were the primary brand color. It's actually correct as a color — it matches the logo's eye glow — but was being used too broadly. It's superseded by the Ember Copper accent scale below (a muted/desaturated variant in the same hue family), used sparingly.
- Brand scope is **Print Wolves only** — not a shared KaspersLab-wide system. KaspersLab-Ecommerce can get its own design system later if needed.
- The design system lives **inside this repo**, following the precedent already set by `tier-bar/` (a folder holding a standalone-buildable piece of this app).
- Domain-specific components (`CostBreakdown`, `AdminPriceOutput`) are included, with their props generalized away from this app's specific `PricingResult` type.
- Storybook is included, both as the normal way to develop/preview a component library and because it gives any future `/design-sync` run higher-fidelity, screenshot-verified previews.

## 1. Brand identity

All values below were derived from the actual logo artwork and validated visually (palette directions, an accent-clash fix, and a typography pairing were all reviewed against rendered mockups before being locked in).

### Color tokens

**Neutrals** (cool-tinted black → silver — matches the logo's black background and silver metallic facets):

| Step | Hex |
|---|---|
| 950 | `#05060a` |
| 900 | `#0b0e14` |
| 800 | `#161b26` |
| 700 | `#232a3a` |
| 600 | `#384154` |
| 500 | `#5b6579` |
| 400 | `#8b93a3` |
| 300 | `#b7bdc9` |
| 200 | `#dde0e6` |
| 100 | `#eff1f4` |
| 50 | `#f8f9fb` |

**Primary — steel/electric blue** (matches the wordmark gradient and icon's blue facets):

| Step | Hex |
|---|---|
| 950 | `#0b1638` |
| 900 | `#14265f` |
| 800 | `#172f7f` |
| 700 | `#1c3fa8` |
| 600 | `#2557d1` |
| 500 | `#3b74f0` *(main)* |
| 400 | `#5c92fb` |
| 300 | `#8ab3ff` |
| 200 | `#b9d2ff` |
| 100 | `#dce8ff` |
| 50 | `#eef4ff` |

**Accent — Ember Copper** (desaturated/darkened orange; matches the eyes' hue but muted so it doesn't fight the saturated blue):

| Step | Hex |
|---|---|
| 950 | `#3d1809` |
| 900 | `#5c2410` |
| 800 | `#742d15` |
| 700 | `#8a3a1f` |
| 600 | `#a8492a` |
| 500 | `#c2542b` *(main)* |
| 400 | `#d97a4f` |
| 300 | `#eba883` |
| 200 | `#f3c4a8` |
| 100 | `#f8ddc9` |
| 50 | `#fdf1e7` |

**Usage rule:** Accent is for rare emphasis only (a badge, a single highlighted CTA) — never the dominant color of a screen or the default interactive color. Primary blue is the default interactive/brand color everywhere else.

**Semantic** (deliberately outside the brand hue families so they never get confused with brand color):

| Role | Hex |
|---|---|
| success | `#22c55e` |
| warning | `#eab308` |
| error / destructive | `#ef4444` |
| info | primary-500 `#3b74f0` |

### Typography

- **Headings:** Space Grotesk, weights 500/600/700 — geometric character echoes the low-poly logo facets.
- **Body & data:** Inter, weights 400–700 — `font-variant-numeric: tabular-nums` on all currency figures (this app is currency-dense; alignment matters).
- Both loaded as self-hosted or `@fontsource` packages (not a runtime Google Fonts `<link>`, to avoid an external network dependency in the built app).

### Mode

Dark-mode-first — the native context of the logo (black background, glowing facets). A light variant of every token is kept for:
- `TierProgressBar` embedded in the PW store (`theme="light"`)
- Printable quotes in Quote Builder, which should stay light/ink-friendly regardless of the app's UI theme

### Radius & spacing

Carry over the existing shadcn convention (`--radius: 0.5rem`, with `-2px`/`-4px` derived steps) — no reason to change a convention that already works.

## 2. Architecture

New folder at repo root, following the precedent of `tier-bar/`:

```
design-system/
├── .storybook/
│   ├── main.ts
│   └── preview.ts
├── src/
│   ├── tokens/
│   │   └── theme.css          # CSS custom properties — source of truth for all colors above
│   ├── components/
│   │   ├── Button/
│   │   │   ├── Button.tsx
│   │   │   ├── Button.stories.tsx
│   │   │   └── index.ts
│   │   ├── ...                # same three-file pattern per component
│   │   ├── TierProgressBar/
│   │   ├── CostBreakdown/
│   │   └── AdminPriceOutput/
│   └── index.ts                # barrel export of all components + prop types
└── README.md
```

- `tailwind.config.ts` gains the three new color scales (neutral/primary/accent) alongside the existing shadcn semantic slots; the semantic slots (`--background`, `--primary`, `--border`, etc. in `src/index.css`) get repointed to reference the new scale's dark-mode values by default, with a `.light` (or existing `.dark`-inverse) override for the light variant.
- No separate `package.json` for `design-system/` — it shares the repo's root `package.json`, same as `tier-bar/` shares it today. Storybook's devDependencies get added there.
- **Single source of truth:** the app's `src/` imports components directly from `design-system/src/components/*`. `src/components/ui/*` is deleted, not kept as a parallel copy — avoids the two ever drifting apart.
- `tier-bar/entry.tsx` (the standalone PW-store embed build) imports `TierProgressBar` from `design-system/` instead of `src/components/TierProgressBar.tsx`, which moves there.

## 3. Component inventory (20 components)

**Rebranded, moved from `src/components/ui/*`** (10): Button, Card, Badge, Input, Label, Select, Separator, Slider, Tabs, Tooltip

**New primitives** (7), added because a "full" design system needs more surface than this one app currently exercises: Dialog, Alert, Table, Checkbox, RadioGroup, DropdownMenu, Toast (via `sonner`, the current shadcn-recommended toast approach)

Icons throughout (Dialog close, Checkbox check, Alert glyphs, DropdownMenu chevrons, etc.) use `lucide-react`, the icon library already in use — no new icon dependency introduced.

**Custom, generalized** (3):
- `TierProgressBar` — moves in as-is (already generic: `tiers`, `currentQty`, `baseUnitPrice`, `theme`, `onSuggestionClick`), rebranded to the new tokens.
- `CostBreakdown` — currently hard-coupled to `PricingResult['breakdown']`. Generalized to accept `rows: { label: string; value: number; formatted?: string }[]` and a `total`. The app supplies a small mapper from `PricingResult` to this shape.
- `AdminPriceOutput` — currently hard-coupled to `PricingResult` fields. Generalized to accept `fields: { label: string; sublabel?: string; value: number; highlight?: boolean; copyable?: boolean }[]`. Same mapper pattern.

## 4. Migration impact on the existing app

This is a visible, intentional side effect, not a bug: the live Calculator/Bulk Planner/Quote Builder/Settings tabs will visually change to the new dark-mode-first blue/copper palette and Space Grotesk/Inter typography, because the app stops using the default shadcn theme and starts consuming `design-system/` directly.

Printable quotes (Quote Builder → PDF) keep a light background regardless of the app's dark theme, per the "Mode" section above.

## 5. Verification plan

- One Storybook story file per component covering its meaningful variants/states (e.g., Button: default/secondary/destructive/outline/ghost × sizes; TierProgressBar: dark/light theme, near-tier, maxed-out; CostBreakdown: populated/empty). Stories are the primary visual verification surface for this work — reviewed as components are built, not just at the end.
- After migration, run and confirm clean: `npm run build`, `npm run build:tier-bar`, `npx tsc --noEmit`, `npm run test` (existing 34 assertions must still pass), `npm run lint`.
- Manually smoke-test the running app (`npm run dev`) across all four tabs to confirm the rebrand renders correctly and no functionality regressed.

## Out of scope

- Correcting `KaspersLab-Ecosystem/branding/README.md`'s stale purple color documentation (flagged, not fixed, here).
- A shared KaspersLab-wide design system covering KaspersLab-Ecommerce.
- Running `/design-sync` itself — this spec only produces the design system it would consume; syncing is a separate, later step.
