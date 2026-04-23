# Phase 4.5 — Claude Design Prompts

Copy-paste prompts for the design pass. Use these in order, one per design session. Each is self-contained so context carries even if conversations reset.

## Before you start

1. **Enable Claude Design** — claude.ai → Labs → Claude Design. Pro/Max/Team/Enterprise only. Research preview, may have a queue.
2. **Create one project for this work** — call it `wtg-v2`. Keep all screens inside it so the design system carries across.
3. **Upload reference material to the project once at the start:**
   - The 8 screenshots of the current live site (so Claude knows the *current* visual baseline you're moving away from)
   - `REBUILD_PLAN.md` (so it understands the product and tier model)
   - This file (so it knows the design pass scope)
4. **Workflow per screen:** paste the prompt → review the first version → use inline comments and adjustment knobs to refine → export the chosen variation → save to `web/design/<screen>/` in your repo.
5. **Don't move to Phase 5 until every screen below has a committed exported design.**

---

## Prompt 1 — Onboarding / brand foundation

```
I'm rebuilding a web app called Where to Go for Great Weather
(wheretogoforgreatweather.com). It's an interactive world map that
helps travellers find destinations matching their ideal weather for
a given month, combined with travel safety advisories from five
governments.

I've uploaded screenshots of the current live site — that's what we
are moving AWAY from. The current design is functional but feels
dated, the colour palette has accessibility problems (red/green/yellow
isn't safe for deuteranopia), and it doesn't communicate trust well
enough for a paid product.

The new product has tiers:
- Free: country-level data, basic variables, with ads
- Consumer Premium €2.99/mo: deeper detail, more variables, no ads,
  saved trips, alerts
- Agency Starter €39/mo (3 seats), Pro €99/mo (10 seats), Enterprise
- Audience: travellers planning trips (mobile-heavy) and travel agents
  (desktop-heavy)

For this first session, help me define the brand foundation. I want
the product to feel:
- Trustworthy and data-driven (we use 10 years of ERA5 climate
  reanalysis, not vibes)
- Calm and considered (it's about planning, not booking under pressure)
- Modern and uncluttered (the current site feels cramped)
- International (used worldwide, no Western-centric imagery)

Show me 3 distinct brand directions. For each, give me:
- A short name and one-line mood
- A primary palette of 5-7 colours (must include 4 score colours that
  pass WCAG AA against white AND are distinguishable for deuteranopia
  and protanopia — consider Okabe-Ito, viridis, or similar)
- A typography pairing (one display font for headers, one body font;
  prefer free, web-loadable fonts like Inter, Manrope, Geist, Source
  Sans, or system stacks)
- A spacing scale and border-radius approach
- One sample button, card, and badge in each direction so I can see
  the personality
```

---

## Prompt 2 — Design system / tokens

```
I'm picking direction [X] from the previous session. Now lock that
in as the design system for this project.

Please produce a tokens.md file that I can drop into
web/design/tokens.md. It should contain:

- Colour palette: every named token (background, surface, surface-2,
  border, text, text-muted, primary, primary-hover, primary-foreground,
  destructive, etc.) with hex values and intended usage
- Score colours specifically: perfect-match, good-option, acceptable,
  avoid — with hex, contrast ratios against white, and confirmation
  they pass colour-blind safety checks
- Safety advisory colours: normal, caution, reconsider, do-not-travel
- Typography: font families with @import or @font-face notes, full
  type scale (display-xl, display-lg, h1, h2, h3, body, body-sm,
  caption, label) with px sizes, line heights, and weights
- Spacing scale (4px base, 4-8-12-16-24-32-48-64-96)
- Border radii (sm, md, lg, full)
- Shadow scale (sm, md, lg)
- Motion tokens (duration-fast 150ms, duration-base 250ms,
  duration-slow 400ms, ease-standard, ease-in, ease-out)

After producing tokens.md, also produce a Tailwind v4 config snippet
(@theme block) that maps these tokens to Tailwind utilities, so my
developers can use class names like `bg-surface-2` and
`text-score-good` directly.
```

---

## Prompt 3 — Map view (desktop)

```
Design the desktop map view — this is the home page at /.

Layout requirements:
- Full-bleed map fills the viewport (MapLibre GL canvas, vector tiles)
- Top header (slim, ~56px) with logo "Where to Go for Great Weather",
  tagline "Plan smarter. Travel sunnier.", search input (geocoder),
  account avatar button on the right
- Left sidebar (~320px, collapsible) with three sections:
  1. Month selector — 12 months in a 4×3 or 6×2 grid, currently
     selected month highlighted
  2. Display mode — "My Preferences" (default) plus four single-
     variable views: Temp, Rain, Safety, Sun
  3. Preferences — sliders for: Temperature range (°C/°F toggle),
     Rainfall range (mm/day, with info tooltip explaining the scale),
     Sunshine range (h/day), Wind speed range (km/h, NEW vs current
     site), Acceptable safety level (4-step segmented)
- Floating top-centre legend showing the four score colours:
  Perfect Match / Good Option / Acceptable / Avoid
- Floating bottom-right zoom controls and a "Locate me" button
- Bottom-right corner attribution (MapLibre, OpenStreetMap, ERA5,
  geoBoundaries)
- When a country/region is clicked: a side drawer slides in from
  the right with Climate Information — country name, region name,
  three charts (temperature min/max line chart, rainfall bar chart,
  sunshine bar chart), all with the year cycle on the x-axis. For
  premium users, show 10/50/90 percentile bands on the temperature
  chart.
- A subtle, non-intrusive ad slot at the very bottom (free tier
  only — design it so it doesn't feel like the site's selling point)

Show me 3 variations:
1. Light, airy, lots of whitespace (Linear / Vercel feel)
2. Map-first, controls minimised to icon buttons until tapped
   (Mapbox Studio / Felt feel)
3. Editorial, with the climate panel feeling more like a travel
   magazine (Skyscanner / Lonely Planet feel)

For all 3: respect the locked design tokens, ensure mobile-friendly
hit targets (min 44px), and show how a premium-only interaction
(zooming past the admin-1 level) prompts an upgrade without
breaking the flow.
```

---

## Prompt 4 — Map view (mobile)

```
Now design the mobile version of the map (375×812 viewport).

Mobile is ~70% of our current traffic. The current site stacks
controls awkwardly. I want it to feel like a native app.

Requirements:
- Full-bleed map
- Slim top bar with logo + hamburger
- Three floating action buttons stacked on the left: month
  selector, display mode, preferences (current site does this
  and it works — keep the pattern, improve the visuals)
- Floating top-centre score legend (compact, scrollable horizontal
  if needed)
- Bottom sheet pattern for Climate Information when a country is
  tapped — peek state showing country name and a one-line summary,
  expanded state revealing the full charts
- Each modal (month, display, preferences) opens as a bottom sheet
  with a drag handle, not a full-screen takeover
- Sticky CTA at the bottom of the preferences sheet to apply
  changes (or auto-apply on slider release — design for both
  options and recommend one)

Show me 2 variations focusing on the bottom sheet density and the
floating button arrangement. Keep the brand language consistent
with the desktop version from the previous session.
```

---

## Prompt 5 — Pricing page

```
Design the pricing page at /pricing.

This is the conversion-critical screen. €2.99/mo is a low price
point — buyers decide on feel in seconds. Trust signals matter
more than feature lists.

Tiers to show (left to right):
1. Free — €0 — country + admin-1, basic variables (temp, rain,
   sun, wind), with ads
2. Consumer Premium — €2.99/mo or €24/yr (save 33%) — admin-2
   detail, all variables (+ snow depth, sea temp, heat index,
   humidity), 10/50/90 percentile bands, saved trips, favourites,
   alerts, no ads. THIS IS THE FEATURED TIER.
3. Agency Starter — €39/mo — 3 seats, everything Premium plus
   client management
4. Agency Pro — €99/mo — 10 seats
5. Agency Enterprise — Custom — unlimited seats + API access

Page structure:
- Hero: one-line value prop + sub-line (work with me on copy)
- A monthly/yearly toggle for the consumer tiers
- Tier cards in a single horizontal row on desktop, stacked on
  mobile, with the Premium card visually prominent (badge,
  elevation, accent border)
- Below the cards: a feature comparison table (rows = features,
  columns = tiers, checkmarks/dashes)
- Trust band: data sources, EU VAT handled by Paddle (Merchant
  of Record), no card details stored, cancel anytime
- FAQ accordion: 6 common questions
- Final CTA band

Show me 3 variations:
1. Credibility-led — emphasises data depth, methodology, EU
   compliance, "trusted by N agencies"
2. Aspirational — large travel imagery, mood-led
3. Utilitarian — clean, dense, comparison-first (Linear pricing
   page energy)

For the Premium card specifically, propose copy for the headline
benefit and the 4-5 bullet points that close the sale.
```

---

## Prompt 6 — Country page (SSR / SEO entry point)

```
Design the country detail page — example URL: /peru

This is an SEO landing page. ~70% of organic search traffic will
arrive here. It needs to be useful even with JavaScript disabled
(server-rendered) and load fast.

Structure:
- Above the fold: country name, country flag, hero image (a
  representative landscape — placeholder for now), 1-paragraph
  climate summary, a "Best months to visit" pill row showing
  the top 3 months ranked by default-preference score
- Climate at a glance: 3 charts side-by-side (desktop) or
  stacked (mobile) — temperature, rainfall, sunshine across
  all 12 months. These render server-side as static SVG.
- Regions: a grid of region cards (admin-1 polygons), each
  showing region name, current-month score badge, mini sparkline
  of temperature
- Best month deep-dive: 12 collapsible sections, one per month,
  each linking to /peru/[month] for the full per-month page
- Travel safety: current advisory levels from US/UK/CA/AU/DE,
  shown as a small badge grid with source attribution. If they
  conflict, show all and let the user understand the disagreement.
- Related destinations: 4-6 cards of similar-climate countries
- Bottom CTA: "Open this country on the interactive map"
- Footer with sitemap, attribution, legal

Show me 2 variations:
1. Editorial / travel-magazine
2. Data-first / Wikipedia-style with clean information hierarchy

The whole page MUST work and look complete with no JavaScript —
no skeleton loaders, no client-side data fetching for the main
content. Design accordingly.
```

---

## Prompt 7 — Country + month page

```
Design the per-month country page — example URL: /peru/april

Same SEO importance as the country page but more specific. Should
feel like a focused answer to "what's the weather like in Peru in
April?"

Structure:
- Hero: "Peru in April" + a one-line verdict ("Generally good for
  the highlands, wet in the Amazon basin")
- A score gauge or visualisation showing the country's overall
  match score for default preferences in this month
- Three climate stat cards: average temp range, rainfall, sunshine
  hours — all with a small sparkline showing how April compares
  to the rest of the year
- Region breakdown: a sortable table or card grid of regions,
  scored for THIS month
- Travel safety advisories (same component as the country page)
- "Plan a trip in April" CTA → opens map with month and country
  pre-selected
- Internal links: previous/next month for Peru, same month for
  neighbouring countries
- Structured data badge (mention this is for SEO — TouristTrip
  schema)

One variation only — match the chosen country page direction.
```

---

## Prompt 8 — Trip detail page

```
Design the trip detail page at /trips/[id].

A "trip" is a saved combination of: month(s), preferences, and
optionally a target country/region. Premium users save trips,
agencies create them on behalf of clients.

Two variations needed:
1. Owner view — full controls to edit, delete, share, set alert
2. Public view — when someone opens a shared link

Structure:
- Trip title (editable inline for owner)
- "For [client name]" subtitle if owned by an agency
- A static map preview centred on the matching destinations,
  with the score-coloured polygons rendered as a snapshot
- Trip parameters card: month, preference summary (temp range,
  rainfall, sunshine, wind, safety threshold)
- Top destinations list: the top 10 polygons matching this
  trip's criteria, with score, climate snapshot, and a link
  to the country/region page
- Owner-only actions: Edit preferences, Add to alerts, Share
  link, Export PDF, Delete
- Public-view CTA: "Plan your own trip" → /

The page should look great as a link preview (OpenGraph image
generated server-side from this same layout) and should be
printable / PDF-exportable for travel agencies giving clients
deliverables.
```

---

## Prompt 9 — Account dashboard (consumer)

```
Design the consumer account dashboard at /account.

For users with a Free or Consumer Premium subscription. Simple,
focused, minimal.

Sections (left nav or tab pattern):
1. Overview — plan status, quick stats (saved trips count,
   active alerts count), upgrade prompt if Free
2. Saved trips — grid of trip cards, each showing the trip
   parameters and a mini map snapshot, click → /trips/[id]
3. Favourites — grid of favourited countries/regions, click →
   country page
4. Alerts — list of active alerts ("Notify me when Cusco scores
   Perfect Match for July with my preferences"), with on/off
   toggles
5. Account settings — email, password (or just magic link), 
   linked Google account, language, units (°C/°F, km/mi)
6. Billing — current plan, next renewal date, manage subscription
   (links out to Paddle customer portal)

Empty states matter: a Free user with no saved trips needs to
see a prompt that's helpful and not pushy. Design these explicitly.

One clean variation. This should feel like Linear's settings —
calm, dense, no marketing inside the product.
```

---

## Prompt 10 — Agency dashboard

```
Design the agency dashboard for owners of Agency Starter / Pro /
Enterprise plans. URL: /account (same path, different layout
when the active organization is an agency).

Same left nav as consumer plus:
1. Clients — table of clients with name, country, # trips
   assigned, last activity, agent owner. Search + filter. CTA
   to add new client. Click row → /account/clients/[id].
2. Team — table of agents (name, email, role, last login,
   trips authored). CTA to invite agent (limited by seat cap;
   show "X of Y seats used" prominently).
3. Activity — a chronological feed of agent actions across
   the org (created trip for client, modified preferences,
   shared link).
4. Branding (locked behind v2 white-label feature) — show the
   field as visible-but-disabled with a "Coming in 2026" badge
   so users know it's planned.

Plan card on the Overview page should clearly show seats
used/cap, current MRR commitment, upgrade/downgrade path.

Design considerations:
- This is a B2B product — agency owners care about predictable
  costs, audit trails, and being able to demonstrate value to
  their own bosses. Lean professional, not playful.
- Information density should be higher than the consumer
  dashboard. Tables, not cards, for clients and team.

One variation — Notion / Linear professional density.
```

---

## Prompt 11 — Agency client detail

```
Design the per-client view at /account/clients/[id], visible to
agents in an agency.

Header:
- Client name, contact info, assigned primary agent, "Active
  since [date]"

Tabs:
1. Profile — client preferences (default temp/rainfall/sunshine/
   wind/safety ranges), travel restrictions, notes (free-text
   markdown). Editable by any agent in the org.
2. Trips — all trips assigned to this client, sortable by date,
   month, score. CTA to create new trip.
3. Activity — agent actions on this client's records.
4. Files (placeholder for v2 — "Coming soon" badge).

Important: "Client" in our model is a person the agency serves,
NOT a login user. They don't have an account. Agents update
their preferences and create trips on their behalf. Design
should make this clear — no "send invite" buttons, no
"client login" affordances.

One variation, consistent with the agency dashboard.
```

---

## Prompt 12 — Auth screens

```
Design the authentication flow.

Screens needed:
1. /login — magic link form (email input + "Send link" button)
   AND a "Continue with Google" button. Simple, single column,
   centred card, ~440px wide on desktop.
2. /login/sent — confirmation that the magic link was sent,
   with "resend in 60s" countdown and "wrong email? go back" link.
3. Magic link landing — the page the user arrives at after
   clicking the link in their email, showing a brief loading
   state then redirecting either to / or to a post-signup
   onboarding step if first login.
4. Post-signup onboarding (consumer) — 3 quick steps:
   (a) preferred units (°C/°F, km/mi),
   (b) optional default preferences (or "I'll set these later"),
   (c) "let's plan your first trip" → /
5. Post-signup onboarding (agency owner) — coming from a Paddle
   checkout success: name your organization, invite first agents
   (skippable), arrive at the agency dashboard.
6. Email-template designs (separately, since they render in
   email clients) — magic link email and welcome email. Plain,
   readable, brand-consistent, table-based HTML email layout.

One variation per screen. Friendly tone. No social proof,
testimonials, or marketing copy on the auth screens themselves —
keep them functional.
```

---

## Prompt 13 — Premium upgrade prompts and empty states

```
Design every premium upgrade prompt and key empty state in the
product. These are conversion surfaces — treat them with care.

Upgrade prompts (3 variants, used contextually):
1. Inline soft prompt — appears when a free user hits a
   premium feature gate gracefully (e.g. tries to zoom past
   admin-1 on the map). A floating card with one-line value
   prop + "Try Premium €2.99/mo" CTA + "no thanks" dismiss.
2. Modal upgrade prompt — appears when the user tries a
   premium-only action explicitly (e.g. clicks "Save trip"
   on Free tier). Modal with the value prop, what's included,
   pricing toggle, primary CTA to checkout, secondary "stay
   on Free".
3. Banner — a slim persistent banner at the top of the
   account dashboard showing "You're on Free — unlock saved
   trips, alerts, and admin-2 zoom for €2.99/mo".

Empty states (5 surfaces):
1. Saved trips, no trips yet
2. Favourites, no favourites yet
3. Alerts, no alerts yet
4. Search returned no climate matches for the user's
   preferences in the chosen month (this should feel
   helpful — suggest loosening preferences or trying
   another month)
5. Agency clients, no clients yet (with a helpful "import
   from CSV" CTA in addition to "add client manually")

Each empty state should have an illustration or icon, a
1-line headline, a 1-line supporting sentence, and a primary
CTA. Tone: warm, encouraging, never patronising.
```

---

## Prompt 14 — Final consistency and handoff

```
We've now designed every screen for the rebuild. Final pass:

1. Review the full project for inconsistencies — same component
   used differently across screens, button heights drifting,
   spacing scales not respected, colour usage diverging from
   tokens.md. List every inconsistency you find.
2. Produce a components inventory: every reusable component
   we've used (Button, Card, Tier Card, Climate Chart, Map
   Drawer, Bottom Sheet, etc.) with its variants and props,
   so my developers can build a matching library in
   web/components/ui/.
3. Generate a Claude Code handoff brief — a single markdown
   file I can drop into web/design/HANDOFF.md that tells the
   Phase 5 implementer:
   - The overall design intent (1 paragraph)
   - The token file location and import instructions
   - Per-screen implementation order (which screens unblock
     others)
   - Known technical constraints from the rebuild plan
     (must work without JS for SSR pages, must respect
     reduced motion, must hit the Lighthouse budget)
   - Per-screen fidelity targets (pixel-perfect for the
     map and pricing page; structure-faithful but
     framework-flexible for the dashboards)
4. Export every screen to PNG, the design system to a single
   HTML reference page, and the React/Tailwind components
   where Claude Design supports it.

After this, I'll commit everything to web/design/ in my repo
and Phase 5 of the rebuild can begin.
```

---

## What to commit to your repo

After Claude Design exports, your `web/design/` folder should look like this:

```
web/design/
├── README.md                 ← 1-paragraph design intent + link to HANDOFF.md
├── HANDOFF.md                ← from Prompt 14
├── tokens.md                 ← from Prompt 2
├── tailwind.theme.ts         ← from Prompt 2 (Tailwind v4 @theme block)
├── components.md             ← components inventory from Prompt 14
├── map-desktop/              ← screenshots + exported code
├── map-mobile/
├── pricing/
├── country/
├── country-month/
├── trip-detail/
├── dashboard-consumer/
├── dashboard-agency/
├── client-detail/
├── auth/
└── upgrade-prompts/
```

Then update `web/CLAUDE.md` with:

```markdown
## Design reference

The canonical visual design for every screen lives in `web/design/`.
Phase 5 implementation MUST match the visual language defined there
(colours, spacing, typography, component patterns). Start by reading
`web/design/HANDOFF.md`, then `web/design/tokens.md`, then the per-screen
folders. If a design artifact conflicts with a technical constraint
(a11y, performance budget, framework limitation), flag it and propose
an alternative rather than silently deviating.
```

Phase 5 is now unblocked.
