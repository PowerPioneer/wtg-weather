# Design → Engineering Handoff

**Project:** Where to Go for Great Weather — v2 rebuild
**Direction:** Atlas (locked)
**Phase:** 4.5 (design) → 5 (implementation)
**Status:** Ready for Phase 5 kickoff

---

## TL;DR for Phase 5

You have everything you need to start the Next.js rebuild. All design decisions are locked. All tokens are codified. All screens are designed as flat HTML references you can pixel-match against.

**Start here, in this order:**

1. Read `web/design/tokens.md` — all colour / type / spacing / motion decisions, with rationale.
2. Install `web/design/tailwind.theme.css` at `web/src/app/globals.css`.
3. Read `web/design/components.md` — component tree, prop signatures, state strategy.
4. Build primitives in `web/src/components/ui/` first (Button, Chip, Card, Input, Dialog, Sheet, Popover) — every other component depends on these.
5. Build `match/`, `safety/`, `charts/` domain primitives next.
6. Port pages in order of least → most interactive: pricing → country → per-month → trip detail → account → agency → map (most interactive, do last).

---

## Reference files (read these)

| Path | What it is | When to use |
|---|---|---|
| `web/design/tokens.md` | Colour/type/spacing/motion spec | Single source of truth for every style decision |
| `web/design/tailwind.theme.css` | Tailwind v4 `@theme` block | Drop into `globals.css` verbatim |
| `web/design/components.md` | Component tree + prop signatures | Before building any component |
| `web/design/system.html` | Live design-system reference page | Opens in browser, interactive token viewer |
| `web/design/AUDIT.md` | Cross-screen consistency audit findings | Read once — carry the fixes into implementation |

## Design-canvas references (layout source of truth)

Each of these HTMLs is a pan/zoom canvas containing multiple artboards. Double-click any artboard to focus-mode it. Use these as pixel-level references for layouts; ignore the canvas chrome itself.

| Page / flow | Canonical file |
|---|---|
| Pricing | `Pricing Final.html` |
| Country | `Country Page Final.html` |
| Per-month (Peru April) | `Peru April.html` |
| Desktop map | `Desktop Map.html` |
| Mobile map | `Mobile Map.html` |
| Display Mode (modal + sheet) | `Display Mode.html` |
| Trip detail (owner + public) | `Trip Detail.html` |
| Account dashboard | `Account.html` |
| Agency dashboard | `Agency.html` |
| Client detail (agency) | `Client Detail.html` |
| Auth + onboarding | `Auth & Onboarding.html` |
| Upgrades & empty states | `Upgrades & Empty States.html` |

The earlier-draft files (`Pricing.html`, `Country Page.html`) are superseded — ignore them.

---

## Implementation plan for Phase 5

### 5.0 · Project setup (½ day)

```bash
pnpm create next-app@latest web --typescript --tailwind --app --src-dir
cd web
pnpm add @fontsource-variable/ibm-plex-serif \
         @fontsource-variable/ibm-plex-sans \
         @fontsource-variable/ibm-plex-mono \
         zustand nuqs react-hook-form zod \
         @radix-ui/react-dialog @radix-ui/react-popover \
         @radix-ui/react-tooltip @radix-ui/react-tabs \
         clsx tailwind-variants
pnpm add -D vitest @playwright/test @axe-core/playwright
```

Replace the generated `globals.css` with `web/design/tailwind.theme.css`.
Import the three IBM Plex font packages in `app/layout.tsx`.
Configure `next.config.ts` with `images.remotePatterns` for country flags CDN and `experimental.reactCompiler = true`.

### 5.1 · Primitives (2 days)

Build `web/src/components/ui/*` in this order. Every primitive gets a `.stories.tsx` snapshot and a visual regression test.

1. `button`, `chip`, `card`, `separator`, `skeleton` — no external deps
2. `input`, `select`, `toggle`, `progress` — form primitives
3. `dialog`, `sheet`, `popover`, `tooltip` — Radix-backed
4. `tabs`, `scroll-area` — Radix-backed

### 5.2 · Domain primitives (2 days)

`match/`, `safety/`, `charts/` per `components.md`. Charts are SSR-rendered SVG; test with `@testing-library/react` that the correct path data renders for a known month series.

### 5.3 · Pages (5 days)

Port in the order:

1. `/` (landing, redirects to map)
2. `/pricing` — pure SSR, no state
3. `/[country]` — SSR, 12-month accordion is CSS-only (`<details>`)
4. `/[country]/[month]` — SSR, reuses components from `/[country]`
5. `/trip/[id]` — SSR for public; client-interactive for owner
6. `/account` — client shell with SSR sections
7. `/account` (agency variant) — same shell, role-switched content
8. `/map` — client-heavy. MapLibre + vector tiles from the Phase 2 pipeline.

### 5.4 · Auth (1 day)

NextAuth + email magic link + Google OAuth. Use `react-email` for magic-link / welcome templates (source in `emails/` inventory). The rendered HTML in `Auth & Onboarding.html` is the reference.

### 5.5 · Onboarding (½ day)

3-step consumer wizard, 4-step agency wizard. Progress persisted in the session table. Premium card on step 3 (consumer) / step 4 (agency) with a Paddle checkout handoff.

### 5.6 · Observability + launch (1 day)

- Sentry for errors
- PostHog for product analytics (page_view, map_layer_change, upgrade_click, trip_saved)
- Lighthouse CI gate on PR
- Cloudflare Pages deploy, `preview` on every branch

**Total: ~12 engineering days.**

---

## Open decisions requiring product input

1. **PDF export** — listed in the pricing comparison table and trip-detail owner action rail but not in every Premium summary. Decision needed: include in canonical Premium list? (Recommend: yes.)
2. **Agency branding** — section exists on `Agency.html` but disabled with "Coming 2026" badge. Decision: ship disabled in v2, or hide entirely until ready?
3. **Email alerts trigger logic** — currently specced on score delta ≥ 5 points vs baseline. Confirm threshold with Paul.
4. **Map vector tile host** — Cloudflare R2 + custom worker, or Mapbox? Affects `MapCanvas` initialiser.
5. **Analytics free tier** — PostHog self-host or cloud? Affects session replay feature availability.

---

## Risks & watchpoints

- **Chart SSR cost.** 8 chart kinds × 12 months × all countries gets heavy at build time. Pre-compute the SVG path `d` strings in the data pipeline (Phase 2) and store on the country row; render them as `<path d={country.chartPaths.temp} />`. Keeps the page component thin.
- **Map bundle.** MapLibre is ~250KB gzipped. Route-split: `/map/*` is a separate bundle. Everything else stays under the 100KB budget.
- **Safety data freshness.** Advisory scraper runs daily; surface `updated` date prominently on every `SafetyPanel`. Stale data (>14d) should downgrade the badge to `--color-border-strong` neutral.
- **Premium feature parity across surfaces.** `AUDIT.md` §2 caught two lock-state drifts — add an ESLint rule that flags new `<Lock />` or `<PremiumBadge />` usage outside `upgrade/copy.ts` to keep the copy table authoritative.
- **Accessibility regressions on the map.** Keyboard navigation over country polygons is bespoke (arrow keys = pan, not tab-select). Bake a keyboard-interaction e2e test day one; regressions will be silent otherwise.
- **Font loading FOUT.** Self-host via Fontsource — do not ship the Google Fonts URL to production. Preload `IBM Plex Serif 500` and `IBM Plex Sans 400/600` in `head`.

---

## Design-side decisions already made (don't re-litigate)

- **One direction: Atlas.** Horizon (editorial warm) and Meridian (dark technical) were explored and rejected. Atlas sells credibility — the money-vs-risk calculus for a €29/yr tool is "looks trustworthy", not "looks fun".
- **No dark mode in v2.** Atlas is light-only. Revisit Q3 2026.
- **No marketing animations.** Atlas motion is 150–400ms, easing only, no spring physics. The product is a reference work.
- **Score palette is teal/blue/amber/oxblood, not green/yellow/orange/red.** CVD-safe — see `tokens.md` §2.
- **Mono for data.** Temperatures, percentages, coordinates, dates: `font-mono`, tabular figures. Non-negotiable.
- **Button heights 32/40/48.** All prior drift (36, 38, 44) corrected.
- **Radii cap at 12px.** Nothing above `--radius-xl` — off-brand.
- **One eyebrow letter-spacing: 0.14em.** (Audit corrected to 0.12em to match `tokens.md` — either value is fine, pick the one in tokens and enforce via utility class.)
- **Serif never at 600.** Display + H1–H2 all at weight 500.

---

## Post-launch (Phase 6 hints)

- **Dark mode.** Design exists conceptually as "Meridian"; port tokens once demand is validated.
- **i18n.** IBM Plex covers every alphabet we need; string extraction via `next-intl`. Number/date formatting through `Intl`.
- **Mobile native wrappers.** The mobile web experience is good enough for v2. Capacitor wrappers are Phase 7+.
- **Agency co-branding.** Unlock the `branding-section` once the file-upload + subdomain routing is implemented.

---

**Design lead:** handing off. Ping in `#design` for layout clarifications; ping Paul for product questions.

**Engineering lead:** you're up. See `web/design/system.html` for a live preview of the token system.
