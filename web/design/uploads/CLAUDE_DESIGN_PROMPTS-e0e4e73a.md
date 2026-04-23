# Phase 4.5 — Claude Design Prompts (consolidated)

Single source of truth for the design pass. Each prompt is self-contained and ready to paste — corrections from earlier patches are folded in. Run them in order, one per session, in a single Claude Design project called `wtg-v2`.

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
  (must be visually distinct from the score colours so users don't
  confuse climate quality with travel safety)
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

## Prompt 3.5 — Display Mode expansion

Run after Prompt 3 finishes, in the same conversation.

```
Quick refinement to the desktop map design we just produced.

The Display Mode modal in the variation we picked needs to expand
to handle every variable in the rebuild, not just the ones shown
on the current site. Here's the full list:

Free tier (always unlocked):
- My Preferences  ← default, shows the 4-colour Perfect/Good/
                    Acceptable/Avoid score map
- Temperature
- Rainfall
- Sunshine
- Wind speed       ← NEW
- Safety           ← shows the 4 advisory levels per country
                    (Normal / Caution / Reconsider / Do Not Travel)

Premium tier (locked for Free users with a small lock icon):
- Snow depth
- Sea surface temperature
- Heat index
- Humidity

Total: 10 options in the modal (6 Free + 4 Premium).

Three things to design:

1. The expanded Display Mode modal itself
   - "My Preferences" stays visually prominent at the top — it's
     the default and the most-used view. Full-width button or
     hero card.
   - The other 9 single-variable options below, in a grid that
     works on desktop (probably 3 columns × 3 rows) AND collapses
     gracefully on the mobile bottom sheet (probably 2 columns).
   - Free variables and Premium variables visually distinguished:
     same shape and treatment, but Premium ones have a small lock
     icon in the corner and a subtle "PRO" badge or muted
     foreground colour.
   - When a Free user taps a locked variable, do NOT just show a
     "you can't" tooltip. Instead, show a small inline upgrade
     popover anchored to the tapped item, with: a one-line
     description of what that variable shows, a sample preview
     thumbnail of the map view it would unlock, "Try Premium
     €2.99/mo" CTA, and a dismiss. This is a conversion surface;
     treat it like one. (Reuse the inline soft prompt we'll
     design in Prompt 13 — make sure the patterns are
     compatible.)
   - Each variable button should have a small icon. Suggest a
     consistent icon set (Lucide, Phosphor, or Heroicons all
     work).
   - If 9 single-variable options below "My Preferences" feels
     cluttered, propose a "Climate variables" sub-section
     separator between the Free climate options and the Premium
     ones, with Safety placed thoughtfully (it's not a climate
     variable, so it may belong in its own slot or grouped with
     My Preferences as a "headline" view).

2. What the map actually LOOKS like in each single-variable mode
   - The 4-colour score scheme only applies to "My Preferences."
     Single-variable modes need their own colour scales and
     legends.

   - Climate variables use continuous gradients:
     - Temperature → diverging cool-to-warm (blue → cream → red),
       must be perceptually uniform and colour-blind safe.
       Suggest a tested ramp like ColorBrewer RdBu or cmocean
       balance — diverging palettes are easy to get wrong.
     - Rainfall → sequential blue (light → dark)
     - Sunshine → sequential yellow/orange
     - Wind speed → sequential teal or grey-to-green
     - Snow depth → sequential blue-white (premium)
     - Sea surface temperature → diverging blue-to-red, ocean-only
       (the polygons over land should be greyed out or transparent
       in this mode)
     - Heat index → sequential warm (yellow → orange → red)
     - Humidity → sequential blue-green

   - Safety uses a DISCRETE 4-level scheme, not a continuous
     gradient. It must use the safety advisory colour tokens
     from tokens.md (Normal / Caution / Reconsider / Do Not
     Travel) — explicitly NOT the climate score colours
     (Perfect Match / Good Option / Acceptable / Avoid). The
     two scales must remain visually distinct so users don't
     confuse climate quality with travel safety.

   - Safety map behaviour: when the five governments (US, UK,
     CA, AU, DE) disagree on a country's level, the polygon
     colour reflects the HIGHEST of the five (most cautious
     view). The breakdown per government appears in the
     Climate Information drawer when the country is clicked —
     but the polygon itself is single-coloured. Add a note in
     the design indicating this so the developer implements
     it consistently.

   - For each variable, design the floating legend that
     replaces the Perfect/Good/Acceptable/Avoid legend in the
     top-centre of the map:
     - Climate variables: continuous colour bar with 2-3 axis
       labels (min, mid, max) including units, a title, and a
       small info icon that opens a tooltip explaining the
       measurement.
     - Safety: discrete 4-swatch legend with each level's
       label and colour.
     - My Preferences: the existing Perfect Match / Good
       Option / Acceptable / Avoid legend.

3. Switching behaviour
   - When the user changes display mode, the map should
     crossfade the layer paint (~250ms, ease-standard from
     tokens.md), not hard-cut. Show me how this transition
     should feel via a simple before/after frame pair.
   - The selected mode should be obviously highlighted in the
     modal so when the user reopens it, they know what they're
     viewing.
   - The legend in the top-centre of the map should also
     animate in/out as the mode changes (fade + slight slide,
     consistent with the modal transition).

Constraints:
- Match the design language and tokens established in
  Prompts 1-3.
- The expanded modal must NOT feel cluttered. If 10 options
  doesn't fit gracefully, propose section separators that
  improve clarity (Free climate / Free safety / Premium
  variables) — but only if grouping actually helps.
- Mobile bottom-sheet version of the same modal must remain
  usable — don't sacrifice mobile to make desktop pretty.
- Keep climate-score colours and safety-advisory colours
  visually distinct everywhere they appear together.

One refined variation, please. We'll commit this as the final
Display Mode design.
```

After this finishes: confirm the legends and colour ramps look colourblind-safe (especially the diverging temperature and SST ramps — diverging palettes are easiest to get wrong). Confirm the climate-score and safety-advisory palettes are visually distinguishable when shown side-by-side. Then export and continue to Prompt 4.

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
- Floating top-centre legend that swaps based on selected
  display mode (see point below)
- Bottom sheet pattern for Climate Information when a country is
  tapped — peek state showing country name and a one-line summary,
  expanded state revealing the full charts
- Each modal (month, display, preferences) opens as a bottom sheet
  with a drag handle, not a full-screen takeover
- Sticky CTA at the bottom of the preferences sheet to apply
  changes (or auto-apply on slider release — design for both
  options and recommend one)

Display Mode bottom sheet must show all 10 options designed
in the Display Mode expansion step:

Free (always unlocked):
- My Preferences (default, hero treatment at top)
- Temperature
- Rainfall
- Sunshine
- Wind speed
- Safety

Premium (locked with lock icon + PRO badge):
- Snow depth
- Sea surface temperature
- Heat index
- Humidity

Layout: 2 columns on mobile (vs 3 on desktop). Same locked-state
behaviour — tapping a Premium variable opens an inline upgrade
popover, not a tooltip. The bottom sheet should be tall enough
to show all 10 options without scrolling on a typical 375×812
viewport, OR scroll smoothly within the sheet if it can't.

Top-centre legend on mobile must swap based on the selected
display mode, same as desktop:
- "My Preferences" → 4-tier score legend (Perfect Match / Good
  Option / Acceptable / Avoid)
- Climate variables → continuous colour bar with units
- Safety → discrete 4-swatch advisory legend

On a 375px viewport, the continuous colour bar legends need to
be narrower than desktop. Design how they collapse gracefully —
possibly to a small compact pill that expands on tap to reveal
the full scale.

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

Use these EXACT tier feature lists in the pricing cards and the
comparison table. Do not abbreviate or guess.

Free — €0
- Country and admin-1 (state/region) zoom
- Climate variables: Temperature, Rainfall, Sunshine, Wind speed
- Safety advisories from US, UK, Canada, Australia, Germany
  (combined view, most-cautious-wins)
- Display modes: My Preferences, Temperature, Rainfall, Sunshine,
  Wind, Safety
- 10-year monthly climatology averages
- Ad-supported

Consumer Premium — €2.99/mo or €24/yr (save 33%)
Everything in Free, plus:
- Admin-2 (district/county) deep zoom
- Additional variables: Snow depth, Sea surface temperature,
  Heat index, Humidity
- 10/50/90 percentile bands on charts (see how variable the
  weather actually is, not just the average)
- Save unlimited trips
- Save favourite destinations
- Email alerts when a destination starts matching your preferences
- No ads
- Per-government advisory breakdown view (see how each country
  rates a destination, not just the combined view)

Agency Starter — €39/mo
Everything in Consumer Premium for 3 seats, plus:
- Client management (create client profiles, store their
  preferences, assign trips)
- Shared organisation workspace
- Audit log of all agent actions
- Branded shareable trip pages (your agency name on /trips/[id])

Agency Pro — €99/mo
Everything in Agency Starter, plus:
- 10 seats
- Priority support
- Advanced filters and export options

Agency Enterprise — Custom
Everything in Agency Pro, plus:
- Unlimited seats
- API access for integration with your booking systems
- Custom data refresh cadence
- White-label (subdomain + full branding) — coming 2026
- SLA and dedicated support

Page structure:
- Hero: one-line value prop + sub-line (work with me on copy)
- A monthly/yearly toggle for the consumer tiers
- Tier cards in a single horizontal row on desktop, stacked on
  mobile, with the Premium card visually prominent (badge,
  elevation, accent border)
- Below the cards: a feature comparison table (rows = features,
  columns = tiers, checkmarks/dashes) — apply the same accuracy
  to the table as to the cards
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

The Premium card should visually emphasise the per-government
advisory breakdown, percentile bands, and admin-2 zoom — those
are the highest-perceived-value upgrades over Free.

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

- Climate at a glance: the three default charts (Temperature,
  Rainfall, Sunshine) are the Free-tier view, side-by-side on
  desktop or stacked on mobile, rendered server-side as static
  SVG. For Premium users, this section expands to show 5
  additional charts: Wind speed (Free), Snow depth (Premium),
  Sea surface temperature (Premium, only for coastal countries),
  Heat index (Premium), Humidity (Premium). Wind is Free. The
  four Premium charts must be designed with a clear locked
  state for Free users — show the chart titles and a blurred
  or dimmed preview, with an inline "Unlock with Premium
  €2.99/mo" prompt overlaying the group.

  For Premium users, also show the 10/50/90 percentile bands
  on the Temperature chart specifically (a shaded band around
  the min/max lines). Other charts can stay as bars/lines for
  clarity.

- Regions: a grid of region cards (admin-1 polygons), each
  showing region name, current-month score badge, mini sparkline
  of temperature

- Best month deep-dive: 12 collapsible sections, one per month,
  each linking to /peru/[month] for the full per-month page

- Travel safety: by default, show the combined "most cautious
  wins" view as a single colour-coded badge with source
  attribution. Below it, a small "See breakdown by country"
  toggle expands to show the five individual government
  advisories side-by-side with their source URLs and dates.
  The breakdown view is Free.

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
  to the rest of the year. For Premium users, expand this row
  with locked previews of the additional variables (wind, snow
  depth, SST, heat index, humidity), consistent with the country
  page's Premium chart treatment.
- Region breakdown: a sortable table or card grid of regions,
  scored for THIS month
- Travel safety advisories (same component as the country page —
  combined view by default with breakdown toggle)
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
- Trip parameters card: a trip preference includes ranges for
  Temperature, Rainfall, Sunshine, Wind speed, plus an
  acceptable Safety threshold. For Premium users, trips also
  store ranges for Snow depth, Sea surface temperature, Heat
  index, and Humidity. Show the Premium-only fields visually
  distinguished (subtle PRO badge or muted treatment) when
  displayed in any context where a Free user might see them
  (e.g. a public shared trip view).
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
5. Account settings — authentication is magic-link-only (with
   optional Google OAuth). NO password field. Show:
   - Email address (with "change email" flow)
   - Linked Google account (connect/disconnect)
   - Active sessions list (with "sign out other devices" action)
   - Language
   - Units (°C/°F, km/mi, mm/in)
   - Marketing email opt-in toggle
6. Billing — current plan, next renewal date. Subscription
   management (payment method, cancellation, invoice history)
   opens the Paddle customer portal in a new tab — we don't
   reimplement it in our own UI. Design the handoff to feel
   intentional, not janky. A clear "Manage subscription on
   Paddle ↗" button with explanation of what they'll find
   there.

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

Authentication is magic-link-only with optional Google OAuth.
There are no passwords anywhere in the product.

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
4. Post-signup onboarding (consumer) — runs for ALL new consumer
   signups regardless of whether they came in via Free signup
   or via Paddle checkout for Premium. The only difference: if
   they came from a successful Premium checkout, step 1 includes
   a brief "Welcome to Premium ✓" confirmation card above the
   units selector — celebratory but quick, not blocking. Don't
   build two parallel flows; build one flow with a conditional
   confirmation. Three quick steps:
   (a) preferred units (°C/°F, km/mi, mm/in) — with optional
       Premium confirmation card above
   (b) optional default preferences (or "I'll set these later")
   (c) "let's plan your first trip" → /
5. Post-signup onboarding (agency owner) — comes from a
   successful Paddle checkout. The flow:
   (a) "Welcome to [Tier name]" confirmation card
   (b) Name your organisation (required)
   (c) Set organisation default preferences (optional, helpful
       for agencies serving similar client profiles — agencies
       often have a house style of trip e.g. "luxury beach",
       "adventure trekking", and pre-setting org defaults
       speeds up creating client trips later)
   (d) Invite first agents by email (skippable, can be done
       later from the dashboard)
   (e) Arrive at the agency dashboard with an empty-state
       "Add your first client" CTA prominently visible
6. Email-template designs (separately, since they render in
   email clients):
   - Magic link email: include the user's IP location (city,
     country) and approximate device ("Chrome on macOS") in
     the email body so they can verify the request was theirs.
     Standard security hygiene for passwordless auth.
   - Welcome email: plain, readable, brand-consistent,
     table-based HTML email layout.

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
   admin-1 on the map, or taps a locked Display Mode variable).
   A floating card with one-line value prop + "Try Premium
   €2.99/mo" CTA + "no thanks" dismiss. This is the same
   pattern referenced in the Display Mode design — make sure
   it's reusable.
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

2. CRITICAL: verify Free vs Premium feature treatment is
   consistent across every screen where it appears. Cross-check
   these surfaces against each other:
   - Pricing page tier cards and comparison table (Prompt 5)
   - Country page Climate at a Glance section (Prompt 6)
   - Country+month page climate stat cards (Prompt 7)
   - Trip detail trip parameters card (Prompt 8)
   - Display Mode modals on desktop and mobile (Prompts 3.5
     and 4)
   - Dashboard upgrade banner and empty states (Prompts 9, 13)
   The Free tier MUST consistently include: country + admin-1
   zoom, Temperature, Rainfall, Sunshine, Wind speed, Safety
   (combined view), per-government breakdown view. The Premium
   tier adds: admin-2 zoom, Snow depth, Sea surface temperature,
   Heat index, Humidity, 10/50/90 percentile bands, save trips,
   favourites, alerts, no ads. Flag any screen that contradicts
   these lists.

3. Verify climate-score colours (Perfect Match / Good Option /
   Acceptable / Avoid) and safety-advisory colours (Normal /
   Caution / Reconsider / Do Not Travel) are visually distinct
   everywhere they could appear together — country page,
   Display Mode legends, dashboard summaries.

4. Produce a components inventory: every reusable component
   we've used (Button, Card, Tier Card, Climate Chart, Map
   Drawer, Bottom Sheet, etc.) with its variants and props,
   so my developers can build a matching library in
   web/components/ui/.

5. Generate a Claude Code handoff brief — a single markdown
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
   - The Free vs Premium feature lists from step 2 above,
     so the developer has one unambiguous reference

6. Export every screen to PNG, the design system to a single
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
├── map-desktop/              ← screenshots + exported code (Prompts 3, 3.5)
├── map-mobile/               ← from Prompt 4
├── pricing/                  ← from Prompt 5
├── country/                  ← from Prompt 6
├── country-month/            ← from Prompt 7
├── trip-detail/              ← from Prompt 8
├── dashboard-consumer/       ← from Prompt 9
├── dashboard-agency/         ← from Prompt 10
├── client-detail/            ← from Prompt 11
├── auth/                     ← from Prompt 12
└── upgrade-prompts/          ← from Prompt 13
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
