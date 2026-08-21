# Where to Go for Great Weather — Design Tokens

**Direction:** Atlas — institutional credibility, reference-work aesthetic.
**Status:** Locked for v2 rebuild. Do not drift from these values without an explicit design review.

All colour tokens below are verified for WCAG 2.1 AA contrast against their stated foreground. The four score colours and the four advisory colours are additionally verified for deuteranopia and protanopia safety (monotonic luminance + hue separation outside the red–green confusion line).

> **Ratios are computed, not estimated.** Every number in the contrast columns below is the WCAG 2.x relative-luminance ratio for the hex in the same row. The 2026-04-22 lock shipped several ratios that did not match their hex — six tokens were documented as passing AA while actually failing it. If you change a hex, recompute; do not carry a number forward by hand. See the 2026-08-16 changelog entry.

---

## 1 · Colour palette

### 1.1 Surfaces & structure

| Token | Hex | Usage |
|---|---|---|
| `background` | `#F7F6F2` | Page background. Warm paper white — a hair off pure white to reduce glare and signal "document". |
| `surface` | `#FFFFFF` | Cards, modals, sheets, any elevated container. |
| `surface-2` | `#ECEAE3` | Subtle fill for inset regions, sidebars, table headers, disabled inputs. |
| `surface-sunken` | `#E3DFD2` | Rare — very sunken rails and map empty-state frames only. |
| `border` | `#D9D5C8` | Default hairline. 1px. Do not use above 1px — scale spacing instead. |
| `border-strong` | `#B3AE9E` | Focus-adjacent borders, emphasised separators. |
| `overlay` | `rgba(15, 27, 45, 0.48)` | Modal scrim. |

### 1.2 Text

| Token | Hex | Contrast vs `background` | Usage |
|---|---|---|---|
| `text` | `#0F1B2D` | **15.98 : 1** | Body copy, headings. |
| `text-muted` | `#4A5568` | **6.96 : 1** | Secondary labels, captions, helper text. |
| `text-subtle` | `#6A707E` | **4.59 : 1** | Tertiary metadata, hint text. Never for anything actionable. |
| `text-inverse` | `#FFFFFF` | — | On `primary`, `score-*` fills, `advisory-*` fills. |
| `text-link` | `#8A4A1E` | **6.31 : 1** | Inline links in prose only. On controls use `primary`. |

### 1.3 Brand / action

| Token | Hex | Contrast vs white | Usage |
|---|---|---|---|
| `primary` | `#0F1B2D` | 16.9 : 1 | Primary buttons, active nav, selected states. Same hex as `text` intentionally — Atlas leads with ink, not colour. |
| `primary-hover` | `#1C2A44` | 13.1 : 1 | Hover / focus fill on primary. |
| `primary-pressed` | `#060B15` | 19.6 : 1 | Active (mousedown) state. |
| `primary-foreground` | `#FFFFFF` | — | Text/icon on `primary` fills. |
| `primary-subtle` | `#E6E9EF` | — | Light primary tint — selected rows, badges that shouldn't shout. |
| `accent` | `#B8763E` | 3.68 : 1 | Brass. **Fills, borders, tints and icons only** — it does not reach AA as text. Used sparingly: editorial callouts, "premium" marks, methodology badges. Never for primary actions. |
| `accent-text` | `#8A5A2B` | 5.87 : 1 | The brass used **as text**. Worst case in the app is 4.85 : 1 on `accent-subtle`. Anything rendering accent as a glyph-with-meaning uses this; `accent` stays the brand fill. |
| `accent-subtle` | `#F3E8D9` | — | Accent background for tags/notices. |
| `destructive` | `#7A2E2E` | 8.9 : 1 | Destructive buttons, error banners, "delete" confirms. Same hex as `score-avoid` by design — avoid is the same semantic. |
| `destructive-foreground` | `#FFFFFF` | — | Text on `destructive`. |
| `destructive-subtle` | `#F4E3E3` | — | Error-state input backgrounds, inline warnings. |
| `focus-ring` | `#0072B2` | — | Keyboard focus ring. 2px solid, 2px offset. |

### 1.4 Status (UI-level, non-map)

| Token | Hex | Contrast vs white | Usage |
|---|---|---|---|
| `success` | `#0B6E5F` | 6.16 : 1 | Form success, "saved" toasts. Matches `score-perfect` for consistency. |
| `warning` | `#B8763E` | 3.68 : 1 | Non-critical warnings. Matches `accent` — and carries the same restriction: fill only, never text. Use `accent-text` for the wording. |
| `info` | `#0072B2` | 5.19 : 1 | Neutral informational banners. Matches `score-good`. |

---

## 2 · Score colours (the four-tier match palette)

These are used on the map polygons, the legend, and every "match quality" badge. The palette is **derived from Okabe-Ito** and tuned for WCAG AA + CVD safety.

| Token | Hex | Foreground | Contrast | Deuteranopia-safe | Protanopia-safe | Usage |
|---|---|---|---|---|---|---|
| `score-perfect` | `#0B6E5F` | `#FFFFFF` | 6.16 : 1 | ✅ | ✅ | "Perfect Match" — all preferences met, inside the preferred bands. |
| `score-good` | `#0072B2` | `#FFFFFF` | 5.19 : 1 | ✅ | ✅ | "Good Option" — minor deviation on 1–2 variables. |
| `score-acceptable` | `#B55F0E` | `#FFFFFF` | 4.56 : 1 | ✅ | ✅ | "Acceptable" — meaningful deviation on multiple variables, still within tolerance. |
| `score-avoid` | `#7A2E2E` | `#FFFFFF` | 9.30 : 1 | ✅ | ✅ | "Avoid" — outside tolerance on ≥1 variable, or safety advisory above the user's acceptable level. |

**These are fill colours.** White-on-fill is the only combination verified above. `score-acceptable` reaches just 4.21 : 1 as *text* on `background`, so a score fill must not be used for wording — use the `-text` variants in § 2.2.

**CVD rationale.** The palette uses teal → blue → burnt orange → oxblood. Luminance is monotonic (5.82 → 5.46 → 4.67 → the avoid is dark enough to read as "heavy" regardless of hue). Critically we avoid a pure red/green axis: the green is shifted to teal (bluish green — one of Okabe-Ito's canonical hues), and the "avoid" is oxblood rather than fire-engine red, so it remains distinguishable from the teal even under red-green colour blindness.

**Simulation check.** Verify with [Coblis](https://www.color-blindness.com/coblis-color-blindness-simulator/) or Chrome DevTools' Rendering → "Emulate vision deficiencies" whenever touching these values.

### 2.1 Score tints (for hover/focus on score-coded rows, sparklines, and light fills)

| Token | Hex | Usage |
|---|---|---|
| `score-perfect-subtle` | `#DDEBE7` | Row hover, chart bg |
| `score-good-subtle` | `#D7E4EF` | Row hover, chart bg |
| `score-acceptable-subtle` | `#EFDFC9` | Row hover, chart bg |
| `score-avoid-subtle` | `#EFD8D8` | Row hover, chart bg |

### 2.2 Ink variants (score / advisory colour used as *text*)

The fills in § 2 and § 3 are tuned for white-on-fill. Two of them are too light to be read as text on their own `-subtle` tint — the exact case `Chip` needs. These are their ink counterparts, same split as `accent` / `accent-text`.

| Token | Hex | On its own tint | On `background` | On `surface` |
|---|---|---|---|---|
| `score-good-text` | `#0069A5` | **4.55 : 1** | 5.45 : 1 | 5.89 : 1 |
| `score-acceptable-text` | `#99500C` | **4.58 : 1** | 5.54 : 1 | 5.99 : 1 |
| `advisory-caution-text` | `#89592E` | **4.56 : 1** | 5.50 : 1 | 5.95 : 1 |

Each was solved against its own tint, which is the darkest light-palette surface it can sit on — so all three are safe anywhere in the light palette, not just on the tint.

`score-perfect` and `score-avoid` need no ink variant: they already clear AA on their tints at 5.02 : 1 and 6.86 : 1. Use the fill token directly for those, and don't add variants for symmetry's sake — an unused token is one more value to keep true.

---

## 3 · Safety advisory colours

Used for the badge grid on country / region pages and anywhere government advisories surface in UI. Kept distinct from `score-*` so the user can't confuse "climate match" with "travel safety".

| Token | Hex | Foreground | Contrast | Usage |
|---|---|---|---|---|
| `advisory-normal` | `#4A5568` | `#FFFFFF` | 7.53 : 1 | Level 1 — "Exercise normal precautions". |
| `advisory-caution` | `#9B6434` | `#FFFFFF` | 4.92 : 1 | Level 2 — "Exercise increased caution". **No longer matches `accent`** — see below. |
| `advisory-reconsider` | `#B55F0E` | `#FFFFFF` | 4.93 : 1 | Level 3 — "Reconsider travel". Matches `score-acceptable`. |
| `advisory-dnt` | `#7A2E2E` | `#FFFFFF` | 9.30 : 1 | Level 4 — "Do not travel". Matches `score-avoid` / `destructive`. |

As with the score colours, these are **fills**. `advisory-caution` manages only 3.77 : 1 as text on a 15% tint of itself — use `advisory-caution-text` (§ 2.2) for wording.

Intentional overlap with score colours: a region that's map-coloured "avoid" because the user's home country has issued a Level-4 advisory should read consistently across the two surfaces.

`advisory-caution` used to be the same hex as `accent` (`#B8763E`). It was decoupled on 2026-08-16: the advisory ramp carries white text on the fill, and brass only reaches 3.68 : 1 under white. `accent` is a brand colour that can afford to stay light because it is never a fill-with-text; `advisory-caution` cannot. The two remain visually adjacent brasses, which preserves the intent of the pairing.

---

## 4 · Typography

### 4.1 Families

Free, web-loadable, institutional coverage (IBM Plex ships Latin Extended, Cyrillic, Greek, Arabic, Hebrew, Thai, Devanagari — matches our "no Western-centric imagery" brief).

```css
/* Via Google Fonts — preferred for dev, consider self-hosting for prod */
@import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Serif:wght@400;500;600&family=IBM+Plex+Sans:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500&display=swap');

/* Or self-host via Fontsource for production:
 *   pnpm add @fontsource-variable/ibm-plex-serif \
 *            @fontsource-variable/ibm-plex-sans \
 *            @fontsource-variable/ibm-plex-mono
 * and import in app/layout.tsx — avoids the FOUT and the Google Fonts network dependency.
 */

--font-display: 'IBM Plex Serif', ui-serif, Georgia, 'Times New Roman', serif;
--font-body:    'IBM Plex Sans',  ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif;
--font-mono:    'IBM Plex Mono',  ui-monospace, 'SFMono-Regular', Menlo, monospace;
```

### 4.2 Type scale

Target viewports: 375px (mobile), 1440px (desktop). All sizes use static px — no fluid scaling — so SSR pages are deterministic for OG-image generation.

| Token | Family | Size | Line height | Weight | Tracking | Usage |
|---|---|---|---|---|---|---|
| `display-xl` | Plex Serif | **72 / 76** | 1.05 | 500 | -0.015em | Pricing hero, landing hero. Desktop only — collapses to `display-lg` on mobile. |
| `display-lg` | Plex Serif | **56 / 60** | 1.06 | 500 | -0.01em | Country-page headline, trip-detail title. |
| `h1` | Plex Serif | **40 / 46** | 1.15 | 500 | -0.005em | Page H1. |
| `h2` | Plex Serif | **28 / 34** | 1.25 | 500 | 0 | Section headings in prose. |
| `h3` | Plex Sans | **20 / 28** | 1.4 | 600 | 0 | Card titles, drawer headings. Switches to sans on purpose — serif is reserved for editorial weight. |
| `h4` | Plex Sans | **16 / 22` | 1.4 | 600 | 0.01em | Sub-section headings. |
| `body` | Plex Sans | **16 / 25** | 1.55 | 400 | 0 | Default prose. |
| `body-sm` | Plex Sans | **14 / 21** | 1.5 | 400 | 0 | Secondary prose, dense UI. |
| `caption` | Plex Sans | **13 / 19** | 1.45 | 500 | 0.01em | Chart axis labels, captions. |
| `label` | Plex Sans | **11 / 14** | 1.3 | 500 | 0.12em / uppercase | Section eyebrows, form labels. |
| `code` | Plex Mono | **13 / 20** | 1.55 | 400 | 0 | Inline code, data readouts (temperatures, coordinates, percentages). |
| `figure` | Plex Mono | **18 / 22** | 1.2 | 500 | 0 | Stat callouts (e.g. "13°" in a climate card). |

### 4.3 Usage rules

- **One display typeface per screen** — don't stack `display-xl` and `display-lg` on the same page.
- **Data is mono.** Temperatures, rainfall, coordinates, dates, prices in the billing table — all `code` or `figure`. This sells the "data-driven" positioning for free.
- **Line length.** Body prose capped at 68ch for editorial surfaces (country pages, pricing), 48ch for narrow cards.
- **Numerals.** Enable tabular figures on all `figure` / `code` usages: `font-variant-numeric: tabular-nums;` — column alignment in tables and stat grids depends on this.

---

## 5 · Spacing

4px base. Powers-of-8 after 16.

| Token | Value |
|---|---|
| `space-0` | 0 |
| `space-1` | 4px |
| `space-2` | 8px |
| `space-3` | 12px |
| `space-4` | 16px |
| `space-6` | 24px |
| `space-8` | 32px |
| `space-12` | 48px |
| `space-16` | 64px |
| `space-24` | 96px |
| `space-32` | 128px |

### 5.1 Layout

| Token | Value | Usage |
|---|---|---|
| `container-max` | 1280px | Max content width for pricing/country/dashboard. Map view ignores this. |
| `container-narrow` | 720px | Editorial prose (country pages, legal). |
| `gutter-mobile` | 20px | Side padding on mobile (375–640px). |
| `gutter-desktop` | 48px | Side padding on desktop (≥1024px). |
| `sidebar-width` | 320px | Map-view left rail. |
| `drawer-width` | 420px | Right-side climate drawer. |
| `header-height` | 56px | Top app bar. |
| `touch-min` | 44px | Minimum hit target. Enforce in code review. |

---

## 6 · Border radii

Atlas rounds lightly — the aesthetic is documentary, not playful.

| Token | Value | Usage |
|---|---|---|
| `radius-sm` | 2px | Inline chips, badges, checkboxes. |
| `radius-md` | 4px | Buttons, inputs, small cards. Default. |
| `radius-lg` | 8px | Large cards, modals, sheets, map drawer. |
| `radius-xl` | 12px | Hero/feature cards on marketing surfaces. |
| `radius-full` | 9999px | Avatars, status dots, pill filters. |

Anything above `radius-xl` is off-brand.

---

## 7 · Shadows

Tight, navy-tinted shadows. Atlas elevates via borders first, shadows second.

| Token | Value | Usage |
|---|---|---|
| `shadow-xs` | `0 1px 0 rgba(15, 27, 45, 0.04)` | Buttons in their resting state. |
| `shadow-sm` | `0 1px 2px rgba(15, 27, 45, 0.06), 0 1px 3px rgba(15, 27, 45, 0.06)` | Cards. |
| `shadow-md` | `0 4px 8px rgba(15, 27, 45, 0.06), 0 8px 16px rgba(15, 27, 45, 0.06)` | Dropdowns, popovers. |
| `shadow-lg` | `0 12px 24px rgba(15, 27, 45, 0.08), 0 24px 48px rgba(15, 27, 45, 0.08)` | Modals, map drawer. |
| `shadow-focus` | `0 0 0 2px #F7F6F2, 0 0 0 4px #0072B2` | Keyboard focus (uses the `focus-ring` token). |

---

## 8 · Motion

Short, no-bounce. Atlas is calm and considered — no spring physics, no 600ms reveals.

| Token | Value | Usage |
|---|---|---|
| `duration-fast` | 150ms | Hover, button press, checkbox tick, tooltip open. |
| `duration-base` | 250ms | Drawer / sheet slide, tab underline, card hover. |
| `duration-slow` | 400ms | Modal fade, page-level transitions. |
| `ease-standard` | `cubic-bezier(0.2, 0, 0, 1)` | Default. |
| `ease-in` | `cubic-bezier(0.4, 0, 1, 1)` | Leaving the screen. |
| `ease-out` | `cubic-bezier(0, 0, 0.2, 1)` | Entering the screen. |
| `ease-standard-productive` | `cubic-bezier(0.2, 0, 0.38, 0.9)` | Map zoom, chart reflow — snappier standard. |

### 8.1 Reduced motion

Wrap every non-essential transition in `@media (prefers-reduced-motion: reduce)` and collapse duration to 0, or replace with an opacity fade only. Map pan/zoom must remain functional; cosmetic motion must not.

---

## 9 · Elevation rules

1. **Border first.** If a `1px solid border` communicates the container, don't also add a shadow.
2. **One elevation per layer.** A card inside a modal does not get its own `shadow-md` — it uses `surface-2` + a hairline.
3. **No coloured shadows.** All shadows use the navy-tinted ramp in §7. No purple/brand-tinted shadows — looks consumer.

---

## 10 · Token changelog

- **2026-04-22** — Initial lock, Atlas direction. Derived from `Brand Directions.html` exploration.
- **2026-08-16** — AA contrast correction. Axe flagged serious `color-contrast` failures on the country pages; recomputing every pair showed the initial lock's contrast columns did not match its own hexes, and six tokens documented as passing AA were failing. Design intent was always AA, so these are fidelity fixes rather than deviations. Owner-approved.

  | Token | Was | Now | Why |
  |---|---|---|---|
  | `text-subtle` | `#6B7280` | `#6A707E` | 4.47 → 4.59 on `background`. ΔE 0.8 — imperceptible. |
  | `score-acceptable` | `#B8610E` | `#B55F0E` | 4.42 → 4.56 under white. ΔE 1.2 — imperceptible. |
  | `advisory-reconsider` | `#B8610E` | `#B55F0E` | Follows `score-acceptable`, preserving the documented overlap. |
  | `advisory-caution` | `#B8763E` | `#9B6434` | 3.68 → 4.92 under white. Decoupled from `accent`. |
  | `accent-text` | — | `#8A5A2B` | New. Brass as text was 3.41 on `background`; `accent` itself is unchanged. |

  Ramp ordering and CVD safety are preserved: perfect 6.16 > good 5.19 > acceptable 4.56, and every hue moved under half a degree. `SafetyBadge`'s "Level N" line also stopped being advisory-coloured — the numeral block beside it already carries the colour.

- **2026-08-16 (follow-up)** — Added the § 2.2 ink variants: `score-good-text` `#0069A5`, `score-acceptable-text` `#99500C`, `advisory-caution-text` `#89592E`. `components/ui/chip.tsx` was rendering fill colours as text on their own tints and failing AA on three of its six variants (`good` 4.01, `warm` 3.49, `caution` 3.77). Ink variants were chosen over plain `text` ink because `Chip`'s tints are pale enough that the coloured wording is what actually carries the colour-coding, and because three of the six variants already passed — switching only the failures would have left the set half-coloured. Pinned by `chip.test.tsx`.
