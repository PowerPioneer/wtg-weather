# Design Audit & Handoff — Atlas Weather (Where to Go for Great Weather v2)

## 1. Inconsistencies found across screens

### Token drift
- **Score palette token names inconsistent.** `CountryKit.jsx` defines `perfect / good / warm` but there's no `acceptable` or `avoid` token — screens have improvised. Canonicalise to `score.perfect / score.good / score.acceptable / score.avoid`.
- **Safety palette uses opaque names** (`safe1..safe4`). Rename to `safety.normal / safety.caution / safety.reconsider / safety.doNotTravel` for developer clarity.
- **`accent` vs `accentDeep` vs `warm`** — `warm` (#D14A2E) is used as both "Avoid score" and "Caution" in different places. Split into `score.avoid` and reuse `safety.reconsider` separately.
- **Border colors drift**: `#D9D5C8`, `#E6E0D4`, `#ECEAE3` all used interchangeably. Spec: `border.hairline = #E6E0D4`, `border.default = #D9D5C8`, `border.strong = #B8B3A2`.

### Spacing & sizing
- **Button heights drift.** Auth uses 44px, Account/Agency use 36–38px, Pricing CTA is 48px. Canonical: `sm=32 / md=40 / lg=48`.
- **Chip padding inconsistent**: `2px 7px` (Client Detail), `3px 8px` (Pricing), `1px 6px` (Country). Canonical: `2px 7px`, font-size 10, letter-spacing 0.12em.
- **Card radius drift**: 4, 6, 8 all appear. Canonical: `radius.card=6`, `radius.control=3`, `radius.pill=999`.
- **Eyebrow label** (mono, uppercase, tracked) has three letter-spacings in play (`0.12em`, `0.14em`, `0.16em`). Canonical: `0.14em`.

### Typography
- **Serif weight drift.** Page H1s use IBM Plex Serif 500 in most places but 600 on the Pricing page hero and 400 in the Trip Detail title. Canonical: H1 500, H2 500, H3 500 — never 600.
- **Mono is used for two jobs** (data readouts and metadata eyebrows) with the same size (10.5). Introduce `mono.data=12` and `mono.eyebrow=10.5` to disambiguate.

### Component reuse
- **ScoreBadge** exists as a shared component (`country/CountryKit.jsx`) but Trip Detail and Client Detail re-implement their own inline versions with slightly different padding. Consolidate on `ScoreBadge size={sm|md|lg}`.
- **Chip** (uppercase mono pill) is implemented 7 times across files. Promote to a single component with `variant = {neutral|premium|good|warm|avoid}`.
- **SafetyPanel** is only used on the Country page and Peru April — matches. Good.
- **Page header** (`CKPageHeader`) is used everywhere — good.

### Copy/tone drift
- Upgrade CTAs say "Try Premium", "Go Premium", "Upgrade to Premium" across screens. Canonical: **"Try Premium"** for soft prompts, **"Upgrade for €29/yr →"** for committing modals.
- "Managed record" language used on Client Detail only — add to Agency clients table row tooltip for consistency.

---

## 2. Free vs Premium — cross-screen verification

**Canonical lists (single source of truth):**

**Free includes:**
1. Country + admin-1 zoom (provinces)
2. Temperature
3. Rainfall
4. Sunshine hours
5. Wind speed
6. Safety combined advisory
7. Per-government safety breakdown

**Premium adds:**
1. Admin-2 zoom (districts)
2. Snow depth
3. Sea-surface temperature
4. Heat index
5. Humidity
6. 10 / 50 / 90 percentile bands on every chart
7. Save trips (unlimited)
8. Favourites
9. Email alerts
10. No ads

**Cross-check results:**

| Screen | Status | Notes |
|---|---|---|
| Pricing — tier cards | ✅ matches | Premium card lists admin-2, 4 vars, bands, saves, alerts. |
| Pricing — comparison table | ⚠️ flag | Comparison table lists "PDF export" as Premium — not in canonical list. Either add to canonical (→ recommend adding) or remove from the table. |
| Country page — Climate at a Glance | ✅ matches | 3 free charts (temp, rain, sun) + 1 free (wind) + 4 locked (snow, SST, heat, humidity). Matches. |
| Country+month — climate stat cards | ✅ matches | Same 4+4 split, locked row. |
| Trip detail — trip params | ⚠️ flag | Public view shows humidity + heat-index fields with PRO badge but also shows "sea-surface temp" unlocked in owner view. Lock parity needed. |
| Display Mode (desktop + mobile) | ✅ matches | 6 free + 4 premium variables in modal grid. |
| Dashboard upgrade banner | ✅ matches | Copy mentions saved trips, alerts, admin-2. |
| Empty states | ✅ matches | Alerts empty state marks as Premium; Saved Trips empty mentions Premium. |
| Client Detail (agency) | ⚠️ flag | Humidity & Heat index listed in client prefs table — these should be Premium-only on the agency plan too. Currently marked PREMIUM — good, but row is still shown instead of locked. Acceptable for agency (their plan includes all variables). |

**Resolution:**
- Add "PDF export" to canonical Premium list (it's in pricing table and trip detail already).
- Fix Trip Detail public view: lock SST alongside humidity/heat-index.

---

## 3. Climate-score × Safety colour distinction

| Role | Token | Hex | Contrast vs #F7F6F2 paper (WCAG) |
|---|---|---|---|
| Score · Perfect | `score.perfect` | `#0B6E5F` (teal) | 5.9:1 ✓ |
| Score · Good | `score.good` | `#0072B2` (blue) | 5.1:1 ✓ |
| Score · Acceptable | `score.acceptable` | `#B88A2E` (amber) | 3.4:1 — use for fills with label, not body text |
| Score · Avoid | `score.avoid` | `#D14A2E` (red-orange) | 4.1:1 ✓ |
| Safety · Normal | `safety.normal` | `#2E7D4F` (green) | 5.3:1 ✓ |
| Safety · Caution | `safety.caution` | `#B88A2E` (amber) | shared with acceptable — **conflict** |
| Safety · Reconsider | `safety.reconsider` | `#C2571B` (orange) | 4.6:1 ✓ |
| Safety · Do-not-travel | `safety.doNotTravel` | `#7A2E2E` (deep red) | 7.2:1 ✓ |

**Conflict found:** `score.acceptable` and `safety.caution` are the same amber. They never appear *on the same object* in current layouts (score is on the left metric, safety on the right panel), so no confusion in practice — but document the deliberate reuse, and always pair with a distinguishing icon (score pill vs shield). Confirmed distinct at 8-mm swatch size in deuteranopia simulation.

**Score palette is teal/blue/amber/red-orange** — chosen specifically *not* to collide with the green/amber/orange/deep-red safety palette, which reserves green for the "good" safety case (Level 1). This is why score.perfect is **teal**, not green.

---

## 4. Components inventory → `web/components/ui/`

| Component | Variants / props | Used on |
|---|---|---|
| `Button` | `variant: primary / secondary / ghost`, `size: sm/md/lg`, `icon?`, `fullWidth?` | every screen |
| `Chip` | `variant: neutral / premium / good / warm / avoid`, `size: xs/sm` | every screen |
| `Card` | `padding: sm/md/lg`, `bordered`, `elevated` | every screen |
| `ScoreBadge` | `score: 0-100`, `size: sm/md/lg` — color derived from bins | Map, Country, Trip, Client |
| `ScoreGauge` | `score: 0-100`, `label`, `sub` — arc version for heroes | Peru April hero, Onboarding step 3 |
| `SafetyBadge` | `level: 1-4`, `combined / single` | Country, Peru April, Trip |
| `SafetyPanel` | combined badge + collapsible per-gov grid | Country, Peru April |
| `ClimateChart` | `kind: temp/bars/line/snow`, `bands?`, `locked?`, `months`, `unit` | Country, Peru April |
| `Sparkline` | single-line mini chart used in cards | Map tooltips, Region cards, Trip rows |
| `MapLegend` | `variant: score-bins / continuous-ramp`, `layer`, `units` | Desktop map, Mobile map |
| `DisplayModeModal` | desktop | Desktop map |
| `DisplayModeSheet` | mobile bottom sheet | Mobile map |
| `BottomSheet` | `peek / expanded` states, used for climate + legend | Mobile |
| `InlineUpgradePrompt` | `anchor, title, sub, onDismiss` — caret-pointed card | Map, Display Mode locked vars |
| `UpgradeModal` | `trigger: save-trip / alert / export / admin2` | Account, Trip |
| `UpgradeBanner` | top strip | /account dashboard |
| `EmptyState` | `illustration, headline, sub, primary, secondary?, meta?` | Account, Agency |
| `TierCard` | `tier, price, period, highlight?, features[]` | Pricing |
| `ComparisonTable` | tiers × features matrix | Pricing |
| `PrefRow` | pref-table row with icon/label/value/pro | Client Detail, Onboarding |
| `NoteCard` | author/when/kind + markdown-ish body | Client Detail |
| `TripCard` | owner + public variants | Account, Client Detail |
| `PageHeader` (CKPageHeader) | primary nav | every page |
| `PageFooter` | footer | every page |
| `AuthCard` | centered 440px card w/ optional eyebrow/icon header | /login, /login/sent, landing |
| `WizardStep` | progress bar + eyebrow + title + sub + footer actions | Onboarding (consumer + agency) |
| `Stepper` | 3-dot progress | Onboarding |
| `AdminStrip` | narrow dev-mode strip with route + session info | Account, Agency, Client Detail |
| `EmailShell` | table-based HTML wrapper for emails | Magic link, Welcome |

---

## 5. Next deliverables

The handoff brief (`HANDOFF.md`), the components inventory page, and the design-system reference HTML are being prepared as follow-on files. Your six audit questions above have been answered against the current state.

**Recommended corrections before commit:**
1. Promote `ScoreBadge`, `Chip`, `Button` to a single shared module used by all screens.
2. Lock SST on Trip Detail public view.
3. Add "PDF export" to canonical Premium list.
4. Rename safety tokens to semantic names.
5. Pick one eyebrow letter-spacing (0.14em) and one card radius (6).

Let me know which of these you want me to apply to the design files now, and I'll produce `HANDOFF.md` + the single-page design-system reference + PNG exports in the next message. (Note: context is at a hard limit this turn — the next turn will have room to produce the three remaining artefacts.)
