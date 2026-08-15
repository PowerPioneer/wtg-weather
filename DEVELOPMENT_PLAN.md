# Development Plan — Finishing the Website

Written 2026-08-15 after auditing the repo against `REBUILD_PLAN.md`,
`FEATURE_GAP_PLAN.md` (all six workstreams closed), and the shipped v2 state.
Each workstream below is scoped so a single focused Claude Code (Opus) session
can complete and verify it. Start every session with: *"Read
`DEVELOPMENT_PLAN.md`, workstream WS-<X>, plus the CLAUDE.md files it names.
Do not re-audit what the Current State section already establishes."*

Ordering: **WS-A blocks WS-B, WS-C and WS-D** (they all build on the real
account data path). WS-E and WS-F are independent and can run any time.
WS-G (cutover) is last and requires everything else green.

---

## Part 1 — Current state (verified 2026-08-15, don't re-derive)

**Done and deployed to v2:**

- Pipeline end-to-end: ERA5 → aggregation (country / admin-1 / admin-2) →
  percentiles → GeoJSON → both PMTiles tiers. Premium rebuilt 2026-08-14 with
  admin-2 and `safety` on all three levels.
- Advisories: six government scrapers, consolidation, US subdivision
  carve-outs resolved to ISO-3166-2, `safety` baked into both tile tiers,
  `advisories.json` → country pages via `wtg publish api-data`.
- Map: preferences panel with client-side paint-expression scoring, display
  modes, month selector, hover card, climate panel, region click-through,
  safety mode, premium source flip, viewport survives re-signing.
- SSR: `/[country]`, `/[country]/[month]` pre-rendered (237 countries ×
  13 pages), region pages on demand, real API data, zero-JS rendering
  verified, sitemap 3,084 URLs.
- API: auth (magic link + Google), sessions, tile signing + Caddy HMAC
  verification, Paddle webhook (sandbox), entitlements, `/v1/countries*`,
  and **complete tested CRUD routers for trips, favourites, alerts, orgs**
  (`api/tests/` covers them, including failure paths).
- Web auth UI: login, magic-link sent, onboarding wizards (consumer + agency).
- Design system fully implemented per `web/design/` (Atlas direction).

**Built but running on fixtures (the core remaining feature work):**

- `/account` (consumer and agency sections) reads `lib/mock-data.ts`, not the
  API — [account/page.tsx](web/src/app/account/page.tsx) imports fixtures
  unconditionally.
- `/trip/[id]` renders the one mock trip via `findTripData`.
- The landing page `/` builds its "featured countries" grid from
  `mockCountrySlugs()` **directly, not gated on `WTG_USE_MOCK_DATA`** — it is
  fixture-backed in production today.
- `/api/me` returns the API's plan naming (`consumer_premium`) where the web's
  `SessionUser` type says `premium`; entitlement booleans happen to resolve
  correctly but the shapes have never been aligned.

**Wired on one side only:**

- Paddle checkout: `web/src/lib/paddle.ts` + `api/routers/paddle_checkout.py`
  exist and are tested, but the pricing page and upgrade CTAs never call
  `requestCheckoutUrl` — no user can actually reach checkout.
- Alerts: API CRUD + `jobs/alerts_weekly.py` + `weekly-alerts.sh` exist; no
  web UI creates an alert, and nothing schedules the job (see below).

**Ops gaps (documented in FEATURE_GAP_PLAN.md progress notes):**

- **No root crontab exists on v2.** `weekly-advisories.sh`, `weekly-alerts.sh`,
  nightly `backup-postgres.sh` and `yearly-era5.sh` are written and tested
  stage-by-stage but nothing fires them.
- `yearly-era5.sh` still shells into a `pipeline` compose service that
  `docker-compose.yml` does not define — it has never been runnable as written
  (the weekly script had the same defect and was rewritten to run `uv` on the
  host; the yearly one was not).
- `travel.state.gov` 403s from the v2 IP (Cloudflare). The US scrape falls
  back to the on-disk dump silently; there is no staleness warning. Do not
  work around this by disguising the client — surface it and run the scrape
  from a permitted network instead.
- A B2 restore has been scripted (`restore-postgres.sh`) but a full
  backup→restore rehearsal is not on record.

**Broken links shipping today:**

- The footer links `/privacy` and `/terms`; neither route exists — both 404.

---

## Part 2 — Workstreams

### WS-A · Account, trips, favourites, alerts on real data  «blocker»

The API side is done and tested; this is web wiring. Read `web/CLAUDE.md` and
`api/CLAUDE.md` first.

1. **Align the session contract.** Decide the canonical plan vocabulary
   (recommend: keep the API's `free | consumer_premium | agency_*` and make
   the web's `SessionUser` speak it; the web's `premium` shorthand exists only
   in the mock layer). One mapping function in `lib/session.ts`, typed, with
   the entitlement booleans derived there and nowhere else. This touches
   auth-adjacent code — security note in the commit body per repo rules.
2. **Extend `lib/api-client.ts`** with typed calls for trips, favourites and
   alerts CRUD (the endpoints exist under `/api/trips`, `/api/favourites`,
   `/api/alerts`). Client-side, cookie-authenticated, per the browser-fetch
   allowlist in `web/CLAUDE.md`.
3. **Rewire `/account`**: consumer sections (trips list, favourites,
   alerts, plan/billing summary) from the API; empty states per
   `Upgrades & Empty States.html`. Keep the fixture path behind
   `WTG_USE_MOCK_DATA` for API-less dev — the flag stays opt-in.
4. **Trip lifecycle**: a "save as trip" action from the map's climate panel
   and the country/month pages (destination + month + the user's current
   preferences), the owner view of `/trip/[id]` on real data, edit/delete,
   and the public share view (no session → read-only, no owner rail).
   OG image from real trip data.
5. **Favourites**: toggle on country/region pages and in the map climate
   panel; anonymous users get the sign-in prompt, not a silent no-op.
6. **Alerts UI**: create from a country/month page ("email me when April in
   Portugal matches my preferences"), manage in `/account`. Premium-gated per
   the pricing table — free users see the upgrade prompt from `upgrade/copy.ts`.
7. **Fix the landing page**: featured grid from the published index
   (`routableCountries()` / the API index at build time), not
   `mockCountrySlugs()`. Pick featured slugs deterministically (e.g. best
   score for the current month) so the page stays static.

**Tests (write alongside, not after):**
- api-client contract tests against the FastAPI schemas (the RC-6 lesson:
  path/shape mismatches hid behind fixtures for months).
- Component tests: account sections render from API-shaped data; empty
  states; 401 → login redirect, not a crash.
- Failure paths: another user's trip id → 404; anonymous `/account` →
  redirect; alert creation as free user → gated.
- e2e (Playwright, mocked API or dev stack): sign in → create trip from map →
  see it in account → open public share link signed out.
- Session mapping unit tests: every API plan value → correct entitlements;
  unknown plan value → free, never premium.

**Acceptance:** `/account`, `/trip/[id]` and `/` render real data with
`WTG_USE_MOCK_DATA` unset; the mock trip is unreachable in prod; full suites
green.

### WS-B · Billing: checkout end-to-end + upgrade surfaces

Depends on WS-A (plan vocabulary). Sandbox only — live mode is WS-G.

1. Wire every upgrade CTA (pricing page tiers, `inline-upgrade-popover`,
   onboarding premium step, admin-2 zoom gate, premium display-mode picker)
   to `requestCheckoutUrl` → redirect. Loading + error states; the CTA copy
   stays sourced from `upgrade/copy.ts`.
2. Checkout return pages: success (poll `/api/me` until the webhook lands —
   entitlements cache is 60s, tell the user what's happening) and cancel.
3. Billing section in `/account`: current plan, renewal date, cancel /
   manage via Paddle's customer portal link (the API should mint it —
   never construct Paddle URLs client-side, per `lib/paddle.ts`'s contract).
4. Verify the downgrade path: subscription lapses → webhook → premium tile
   URL request returns 403 → map falls back to free tiles with an upgrade
   prompt, not a blank map (the RC-8 source flip makes this load-bearing:
   premium sessions read *all* layers from the premium archive).

**Tests:** webhook→entitlement transition (upgrade AND downgrade) against the
sandbox-mocked webhook; web-side: 403 on premium tile URL degrades to free
tiles (component test on `use-tile-urls` + map canvas); e2e: pricing → sandbox
checkout URL requested with the right plan. Never live Paddle in tests.
Every change here needs the security note in the commit body.

**Acceptance:** a sandbox subscription bought from the pricing page unlocks
admin-2 zoom and premium variables within ~60s without a reload loop; a
cancelled one degrades gracefully.

### WS-C · Agency accounts

Depends on WS-A. API routers (`orgs.py`) and tests exist; the web side is
fixture-backed shells (`agency-sections.tsx`, `clients/[id]`).

1. Org lifecycle from the agency onboarding wizard: create org → agency
   checkout (WS-B) → invite agents by email (magic-link style invite tokens;
   the email service adapter exists).
2. Agency dashboard on real data: members list, seat usage vs cap, pending
   invites, revoke.
3. Clients CRUD + client detail page per `Client Detail.html`: profile,
   assigned trips, notes. Assigning a trip to a client from the trip surfaces.
4. Seat-cap enforcement surfaced in UI: inviting past the cap shows the
   upgrade path (Starter → Pro), not an error toast.
5. Role handling: the account shell switches consumer/agency by membership;
   an agent (non-owner) sees clients but not billing.

**Tests:** failure paths first — invite past seat cap, invite token reuse,
expired token, non-member fetching an org's client → 404, agent hitting
billing → 403. e2e: owner invites agent → agent accepts → creates client →
assigns trip. Email sending mocked always.

**Acceptance:** the full agency journey works in sandbox; every role/cap
boundary has a negative test.

### WS-D · Alert matching + email delivery, running on a schedule

Depends on WS-A (alerts UI). The job (`jobs/alerts_weekly.py`,
`services/alerts.py`, `test_alerts_service.py`) exists.

1. Verify the weekly job end-to-end against a dev stack: alerts recomputed
   from the published bundle, transition detection (newly-matches and
   stopped-matching), one email per transition, idempotent re-run.
2. Emails via the react-email templates (`web/src/emails/`) through the
   SendGrid adapter; every alert email carries a one-click unsubscribe (list
   management is a deliverability requirement, not a nicety). Confirm the
   HANDOFF's open decision — trigger threshold (score delta ≥ 5 vs baseline)
   — with the owner before hard-coding it.
3. Redact recipient email at log-line construction (hard rule).
4. Schedule it: this workstream delivers the crontab *entry*; WS-E installs
   the crontab itself.

**Tests:** transition matrix (match→match no email; no→match email;
match→no email; new alert baseline), double-run idempotency, email adapter
mocked, unsubscribe token failure path.

**Acceptance:** a seeded alert fires exactly once on a transition in a
staged run, and the email renders correctly in a client preview.

### WS-E · Ops: make the automation actually run

Independent; do early — some of this protects data. Read `infra/CLAUDE.md`.

1. **Install the crontab on v2** from `infra/cron/crontab`: nightly backup,
   weekly advisories (Sun 03:00), weekly alerts (Mon 04:00), yearly ERA5.
   Verify each entry's environment (uv on PATH — see the deploy-trap notes;
   cron's PATH is not a login shell's).
2. **Rewrite `yearly-era5.sh`** to run `uv` on the host like the weekly
   script (its `docker compose exec pipeline` has never been runnable), and
   have it end with `wtg publish api-data` + tile rebuild + CDN purge +
   `--force-recreate web` (ISR holds pages for 30 days — a data change that
   doesn't recreate web is invisible).
3. **Backup restore rehearsal**: nightly dump → B2 → `restore-postgres.sh`
   into a scratch database; document the drill and its runtime in
   `infra/CLAUDE.md`.
4. **Advisory staleness**: warn (log + GlitchTip event) when a source's
   newest dump exceeds a threshold (e.g. 21 days) during `process
   advisories`; surface the per-source `last_changed` date on the web
   `SafetyPanel`, downgrading the badge to neutral past 14 days (HANDOFF
   watchpoint). Decide where the US scrape runs given the Cloudflare 403 —
   e.g. from the home machine with the dump rsynced — do not evade the block.
5. **GlitchTip alert rules** (error-rate spike → email) and a smoke check
   that web and api DSNs actually receive events (the debug routes exist).
6. **One end-to-end run of `weekly-advisories.sh`** as a single invocation on
   v2 — it has only ever been run stage by stage.

**Tests:** staleness-warning unit test in the pipeline; a `--dry-run` mode
for the yearly script asserting the command sequence; the rest is runbook
verification — record outcomes in `infra/CLAUDE.md`.

**Acceptance:** `crontab -l` on v2 matches the repo file; a restore drill has
a written record; a forced advisory change flows scrape → tiles → CDN purge →
recreated web without manual steps.

### WS-F · Launch completeness: legal, content, SEO polish

Independent. Mostly static pages — cheap, but blocking a paid EU launch.

1. **`/privacy` and `/terms`** — the footer already links them and they 404.
   Paddle (as merchant of record) requires terms + privacy + refund policy
   links at checkout. Static, zero-JS, Atlas-styled. Have the owner supply or
   approve the actual legal text — don't invent binding terms unreviewed.
2. **Refund policy + contact/support page** (an email address is enough).
3. **Cookie/consent posture**: Plausible is cookieless; the session cookie is
   strictly necessary; PostHog runs post-login only. Document the resulting
   consent position on the privacy page. If PostHog session replay is on,
   revisit — that likely does need consent.
4. **Styled `not-found.tsx` and `error.tsx`** (global + country segment) —
   the 404 is a real entry point with `dynamicParams` on everywhere.
5. **SEO pass**: verify `TouristDestination` structured data validates,
   canonicals on region pages, and add month-first landing pages
   (`/best-weather-in/[month]`: top-N countries by default-preference score
   for that month, from the published index, statically generated — 12 pages,
   strong query match, pure internal-linking win).
6. **robots.txt**: confirm v2 stays `Disallow: /` until cutover (flip is a
   WS-G step).

**Tests:** footer links resolve (the exact regression that shipped); month
pages render zero-JS with valid structured data; Lighthouse budget holds on
the new pages.

### WS-G · Cutover (run only when A–F are green)

`infra/CUTOVER.md` is the step-by-step authority — this workstream executes
it, it doesn't rewrite it.

1. Paddle sandbox → live: live products/prices, live webhook secret, one
   real transaction + refund as the smoke test. Security note in commit body.
2. Pre-render the web image via `./infra/scripts/build-web.sh` (never
   `docker compose build web`) so ~2,800 pages don't render on first hit
   under real traffic.
3. Flip robots.txt to allow, submit the sitemap in Search Console.
4. DNS cutover per CUTOVER.md, then its 72h checklist: GlitchTip error rate,
   analytics ingestion on both tools, CDN hit ratio, signed-tile 403 rate.
5. Keep the v1 snapshot 30 days (REBUILD_PLAN § After Cutover).

**Acceptance:** apex serves v2; one live purchase and refund verified; 72h
checklist complete; rollback path untouched and documented.

---

## Part 3 — Suggestions beyond the plan (product backlog, owner's call)

Not scheduled; listed so decisions get made deliberately.

- **Free-tier ads**: the pricing table promises "ads" on free and nothing
  implements them. Recommend cutting the line from the pricing copy for
  launch rather than building an ad integration — revisit with traffic.
- **Imperial units**: the `unit` query param is parsed and ignored across
  four surfaces (map legend, hover card, panel, SSR pages). One coherent
  formatting pass; meaningful for the US audience the advisory data already
  serves.
- **Regional carve-outs for the other five governments**: the gazetteer and
  join are built; only the US scraper resolves subdivisions. A Dutch-name
  alias table for the NL feed is the highest-value next step (224 countries
  of coverage).
- **Country search**: a header search box over the 237-entry registry
  (client-side, no API) — the map is currently the only way in besides SEO.
- **Compare view**: two destinations side by side for a month — natural
  premium feature, reuses the chart components wholesale.
- **PDF export**: HANDOFF open decision #1 (recommended yes there). Premium
  trip-detail export; `/trip/[id]` prints well already, so start with a print
  stylesheet + "Download PDF" via headless render.
- **Scoring wind / premium variables**: deliberately out (parity with baked
  `pref_<mm>` keeps the default map stable). Widening scoring is a
  pipeline+web change and a tile rebuild — treat as its own workstream if
  wanted, never a side-effect.
- **Parked per HANDOFF**: dark mode (Q3 2026), i18n via next-intl, agency
  co-branding, native wrappers.

---

## Part 4 — Cross-cutting test plan

Standing rules (from `.claude/rules/testing.md`, non-negotiable): tests live
next to source; no live external APIs ever (CDS, Paddle, government sites,
SendGrid); every money/auth/tile-signing endpoint keeps a failure-path test.

**Per-layer:**

- *Pipeline (pytest)*: the tile-content smoke test (`test_tiles_content.py`)
  runs against any rebuilt archive before deploy — it is the check whose
  absence shipped RC-1/RC-2. Golden-file QA table for the 20 reference
  countries guards aggregation regressions. Fixtures for scrapers are slices
  of live feeds, never synthetic (the lesson from the Netherlands scraper:
  a synthetic fixture tests your idea of the source, which is the thing in
  doubt).
- *API (pytest)*: schema/contract tests per router; failure paths for forged
  signature, expired session, missing entitlement, double-spent webhook stay
  green; new WS-A/B/C endpoints follow the same pattern.
- *Web unit (vitest)*: scoring parity tests against the Python source stay
  the bridge between map and pipeline; api-client contract tests are the
  bridge to FastAPI; session/entitlement mapping fully enumerated.
- *Web e2e (Playwright, exists with axe)*: grow the suite to the five
  journeys — anonymous free map use; signup via magic link; subscribe
  (sandbox) → premium unlock; trip create → share; agency invite → client →
  assigned trip. Run axe on every page it visits; keep the map keyboard spec.
- *Zero-JS check*: country/month/region pages rendered with JS disabled in
  e2e — the SEO surface is the business.
- *Performance*: Lighthouse CI budget (LCP < 2.0s, CLS < 0.05, TBT < 100ms)
  blocks merge; add the new WS-F pages to the sampled routes.
- *Two-repo fields*: any field added to the published bundle gets a
  round-trip test through the API response model (the Pydantic-filter lesson
  — pipeline tests passing proves nothing about what reaches the client).

**Release gate before WS-G:** all suites green; e2e journeys green against a
full local stack; tile smoke test green against the production archives; a
restore drill on record; crontab verified live.
