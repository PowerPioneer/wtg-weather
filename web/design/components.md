# Components Inventory — Atlas / Where to Go for Great Weather v2

Target path: `web/src/components/ui/*` (primitives) and `web/src/components/*` (composed).

All primitives are **server-render-safe** unless explicitly marked `'use client'`. Stateful components list their client-only dependencies inline. Props use TypeScript-style signatures; export as named exports (no default exports).

---

## Folder layout

```
web/src/components/
├── ui/                       # tokenised primitives — no product logic
│   ├── button.tsx
│   ├── chip.tsx
│   ├── card.tsx
│   ├── input.tsx
│   ├── select.tsx
│   ├── toggle.tsx
│   ├── tabs.tsx
│   ├── dialog.tsx            # client
│   ├── sheet.tsx             # client
│   ├── popover.tsx           # client
│   ├── tooltip.tsx           # client
│   ├── progress.tsx
│   ├── skeleton.tsx
│   ├── separator.tsx
│   └── scroll-area.tsx       # client
│
├── match/                    # climate-match domain primitives
│   ├── score-badge.tsx       # compact pill
│   ├── score-gauge.tsx       # arc with number — hero only
│   ├── score-ramp.tsx        # legend ramp component
│   └── match-tooltip.tsx     # map hover card
│
├── safety/
│   ├── safety-badge.tsx      # combined or single-gov
│   └── safety-panel.tsx      # combined + collapsible per-gov grid
│
├── charts/                   # server-rendered SVG — no runtime JS
│   ├── climate-chart.tsx     # temp/rain/sun/wind/snow/sst/humidity/heat
│   ├── sparkline.tsx
│   ├── chart-axes.tsx
│   └── chart-bands.tsx       # 10/50/90 percentile band renderer
│
├── map/                      # client
│   ├── map-canvas.tsx
│   ├── map-legend.tsx        # swaps by layer (bins vs continuous ramp)
│   ├── display-mode-modal.tsx
│   ├── display-mode-sheet.tsx
│   └── inline-upgrade-popover.tsx
│
├── upgrade/
│   ├── upgrade-banner.tsx
│   ├── upgrade-modal.tsx
│   ├── upgrade-inline-card.tsx
│   └── tier-card.tsx         # pricing tier
│
├── trip/
│   ├── trip-card.tsx         # owner + public variants
│   ├── trip-header.tsx       # inline-editable title
│   ├── trip-params.tsx       # param table w/ PRO markers
│   ├── trip-destinations.tsx # top-10 list
│   └── trip-action-rail.tsx  # owner only
│
├── country/
│   ├── country-hero.tsx
│   ├── best-months-pills.tsx
│   ├── regions-grid.tsx
│   ├── month-accordion.tsx
│   └── related-destinations.tsx
│
├── account/
│   ├── sidebar-nav.tsx
│   ├── trips-grid.tsx
│   ├── favourites-grid.tsx
│   ├── alerts-list.tsx
│   ├── settings-form.tsx
│   ├── billing-card.tsx
│   ├── clients-table.tsx     # agency
│   ├── team-table.tsx        # agency
│   ├── activity-feed.tsx     # agency
│   ├── branding-section.tsx  # agency — disabled
│   └── client-notes.tsx      # agency
│
├── auth/
│   ├── auth-card.tsx
│   ├── magic-link-form.tsx
│   └── magic-link-sent.tsx
│
├── onboarding/
│   ├── wizard-step.tsx
│   └── wizard-stepper.tsx
│
├── layout/
│   ├── page-header.tsx
│   ├── page-footer.tsx
│   ├── container.tsx
│   └── admin-strip.tsx       # dev-only
│
├── content/
│   ├── prose.tsx             # typography wrapper for MDX pages
│   ├── eyebrow.tsx
│   ├── note-card.tsx
│   └── empty-state.tsx
│
└── emails/                   # react-email templates (table-based HTML)
    ├── magic-link.tsx
    └── welcome.tsx
```

---

## Primitive specs

### `Button`
```ts
type ButtonProps = {
  variant?: 'primary' | 'secondary' | 'ghost' | 'destructive' | 'link';
  size?: 'sm' | 'md' | 'lg';        // 32 / 40 / 48 px
  fullWidth?: boolean;
  loading?: boolean;
  icon?: ReactNode;                  // leading icon
  iconAfter?: ReactNode;             // trailing (→)
  as?: 'button' | 'a';
} & HTMLAttributes;
```
Default size `md`. Primary uses `--color-primary` (navy ink). Destructive uses `--color-destructive`. Ghost has no border, no fill, hover = `--color-surface-2`.

### `Chip`
```ts
type ChipProps = {
  variant?: 'neutral' | 'premium' | 'good' | 'warm' | 'avoid' | 'caution';
  size?: 'xs' | 'sm';                // 20 / 24 px height
  leadingDot?: boolean;
};
```
Always uppercase mono, letter-spacing `0.12em`, font-size 10.5 (xs) or 11 (sm). `premium` uses `--color-accent` + `--color-accent-subtle`.

### `Card`
```ts
type CardProps = {
  padding?: 'none' | 'sm' | 'md' | 'lg';   // 0 / 16 / 24 / 32
  tone?: 'paper' | 'inset' | 'sunken';
  bordered?: boolean;                       // default true
  elevated?: boolean;                       // adds shadow-sm
};
```
Radius always `--radius-lg` (8px). Nested cards drop their own shadow — border only.

### `ScoreBadge`
```ts
type ScoreBadgeProps = {
  score: number;            // 0-100
  size?: 'sm' | 'md' | 'lg';
  label?: 'auto' | 'number' | 'verbose';  // 'auto' shows number + short label
};
```
Colour derived from bins: `≥85 perfect`, `70–84 good`, `50–69 acceptable`, `<50 avoid`. Uses `--color-score-*` tokens.

### `ScoreGauge`
```ts
type ScoreGaugeProps = {
  score: number;            // 0-100
  size?: 'md' | 'lg';       // 96 / 128
  label?: string;           // e.g. "Perfect match"
  sub?: string;             // e.g. "Peru · April"
};
```
Arc is 270°, `--color-border` track, score-coloured fill. Number in `font-display`, label in `font-mono` uppercase.

### `SafetyBadge` / `SafetyPanel`
`Badge` is a combined read of advisory sources (level 1–4). `Panel` expands to a 3-col per-government grid (US / UK / CA / AU) with issued/updated dates.

### `ClimateChart` (server-rendered SVG)
```ts
type ClimateChartProps = {
  kind: 'temp' | 'rain' | 'sun' | 'wind' | 'snow' | 'sst' | 'humidity' | 'heat';
  months: MonthData[];               // length 12
  bands?: { p10: number[]; p90: number[] };  // Premium only
  locked?: boolean;                   // renders blurred + upgrade prompt
  unit?: 'metric' | 'imperial';
  compact?: boolean;                  // card variant
};
```
No client JS. All charts render at SSR. Bands are conditionally included per session plan.

### `Sparkline`
```ts
type SparklineProps = {
  values: number[];
  width?: number;      // default 120
  height?: number;     // default 28
  tone?: 'ink' | 'muted' | 'score-good' | 'score-perfect' | ...;
};
```

### `MapLegend`
```ts
type MapLegendProps = {
  layer: 'score' | 'temperature' | 'rainfall' | 'sunshine' | 'wind' |
         'snow' | 'sst' | 'heat' | 'humidity';
  unit?: 'metric' | 'imperial';
  collapsible?: boolean;   // mobile
};
```
Swaps between 4-bin swatches (score) and continuous 7-stop ramps (everything else).

### `DisplayModeModal` / `DisplayModeSheet`
Controlled by a single `useDisplayMode()` hook (Zustand, client). 10 variables in a grid; 4 premium variables show lock icon + inline upgrade popover on click when free.

### `InlineUpgradePopover`
```ts
type InlineUpgradePopoverProps = {
  anchor: RefObject<HTMLElement>;
  feature: 'admin2' | 'snow' | 'sst' | 'heat' | 'humidity' |
           'bands' | 'save-trip' | 'alert' | 'export';
  onDismiss: () => void;
};
```
Caret-pointed white card with a one-line pitch, `Try Premium` primary, `Not now` ghost. Copy table lives in `upgrade/copy.ts`.

### `UpgradeModal`
Full modal with the 6-point Premium list and price. Opens from the public trip detail, alert-create flow, save-trip limit.

### `TierCard`
```ts
type TierCardProps = {
  tier: 'free' | 'premium' | 'agency-solo' | 'agency-team' | 'agency-studio';
  price: string;            // formatted
  period: 'month' | 'year' | 'custom';
  highlight?: boolean;      // Premium & Agency-Team
  features: string[];
  cta: { label: string; href: string };
};
```

### `EmptyState`
```ts
type EmptyStateProps = {
  illustration?: ReactNode;   // SVG preferred
  headline: string;
  sub?: string;
  primary?: { label: string; href: string };
  secondary?: { label: string; href: string };
  meta?: string;              // e.g. "Premium feature"
};
```

### `PageHeader` / `PageFooter`
`PageHeader` props: `{ logo, nav[], cta? }`. Max width follows `--size-container-max`; gutters `--size-gutter-{mobile,desktop}`.

### `AdminStrip`
Dev-only. Renders when `process.env.NODE_ENV !== 'production'`. Shows route, session email, plan. 24px strip at the top, `--color-surface-sunken`.

---

## State management

| Scope | Tool |
|---|---|
| URL-driven (map filters, display mode, unit) | `nuqs` (searchParams) |
| Session (sidebar open, last-visited region) | `zustand` with `persist` middleware → `localStorage` |
| Server data (country, region, trip) | RSC fetch + `revalidate` tags |
| Forms | `react-hook-form` + `zod` |
| Auth | NextAuth + magic link provider |

---

## Accessibility invariants

1. All interactive targets ≥ 44×44 on touch, ≥ 32×32 on desktop.
2. `focus-visible` rings on every interactive element (`--color-focus-ring`, 2px offset).
3. Score colour never sole carrier of meaning — always accompany with a short label or icon.
4. Map is keyboard-accessible: tab selects focused country; arrow-keys pan; `+`/`-` zoom.
5. All charts have a `<title>` and hidden `<desc>` describing the trend, and a `<table>` fallback in a `<details>` sibling for screen readers.
6. `prefers-reduced-motion` disables cosmetic transitions; map pan/zoom stays.

---

## Testing seeds

- `vitest` unit snapshot per primitive with 3 variants each.
- `playwright` visual regression per page at 375 / 768 / 1440.
- `axe-core` run inside Playwright on every page.
- `lighthouse-ci` gate on PR: Performance ≥ 90, Accessibility ≥ 95, SEO ≥ 95, Best Practices ≥ 95.

---

## Migration notes (from the HTML design set)

- Pricing page final copy: `Pricing Final.html`
- Country page final: `Country Page Final.html`
- All other pages: canonical file is the non-"Final" HTML, already consolidated.
- Design canvases (pan/zoom wrappers) are presentational only — **do not port**. Use the flat per-artboard HTML inside them as the reference layout.
