# Aggregation QA — Phase 3a (April 2026)

This is the rationale document for the country-level aggregation rules in
[`pipeline/src/wtg_pipeline/processing/country_rules.py`](../src/wtg_pipeline/processing/country_rules.py).
The rules are **mandatory before tile generation** — they exist because
naive area-weighted averaging across every polygon attributed to a country
produces meaningless numbers for non-contiguous or climatically incoherent
states.

## Strategy

In order of preference (per Phase 3a in `REBUILD_PLAN.md`):

1. **Suppress** the country-level aggregate entirely for countries with no
   single coherent climate. The web frontend renders these as an admin-1
   mosaic at country zoom rather than a single coloured polygon.
2. For countries kept at country level, **filter to a mainland whitelist**
   (opt-in, ISO-3166-2 admin-1 codes). A new overseas territory added to a
   future boundary refresh therefore stays excluded by default — the only
   way a region can contaminate its parent's aggregate is to be added to
   the whitelist explicitly.
3. **Area-weighted averaging** for the polygons that remain — exactextract
   does this by default via fractional cell coverage.

## Boundary vintage (revised August 2026)

The whitelist codes are tied to the Natural Earth admin-1 vintage, and the
original table was written against the wrong one. It listed region-level codes
(`FR-ARA`, `GB-ENG`, post-2020 `NO-42`) that do not occur in the layer the
pipeline downloads, so **every whitelisted country matched nothing and silently
fell back to a naive aggregate** — the filtering described below was specified
but never actually applied.

Two things changed as a result:

* admin-1 now comes from Natural Earth **1:10m** rather than 1:50m. The 50m
  layer only subdivides nine countries, which left most of the world with no
  admin-1 polygon at all and made the "mosaic" resolution below impossible for
  Argentina, Chile and Kazakhstan.
* the whitelist is **generated**, not hand-written — see
  `scripts/generate_mainland_whitelist.py`, which derives it from Natural
  Earth's own `type_en` / `region` attributes. Regenerate and review the diff
  whenever the boundary vintage changes.

At 10m the units are finer than the table below originally assumed: France is
101 departments rather than 13 regions, Spain 52 provinces rather than 17
autonomous communities, the UK 232 districts rather than 4 countries.

## Reference-country review (20 polygons)

The "before / after" scores below show the free-tier "great weather in
April" default: temp 18-28 °C, precip 0-80 mm/month, sunshine 6-13 h/day
(`DEFAULT_PREFERENCES` in `processing/scoring.py`). Score is 0..3.

Rationale for the rule decision is the load-bearing column — the actual
numerical scores will be re-run against real ERA5 once Phase 2 has
populated `pipeline/data/raw/era5/`. This document already locks in the
structural decision; only the score deltas are TBD.

| ISO | Country     | Naive April score | After-rules April score | Decision     | Reason |
|-----|-------------|------------------:|------------------------:|--------------|--------|
| US  | United States | TBD             | TBD (mosaic)            | suppress     | Alaska + Hawaii + Puerto Rico + 50 states span every climate band. Mosaic at country zoom. |
| FR  | France        | TBD             | TBD (Paris-like)        | whitelist    | DOM-TOM (Guyane / Réunion / Martinique / Guadeloupe / Mayotte) drag the mean to "tropical" in April. Whitelist the 96 metropolitan departments; NE types the 5 overseas ones "Overseas department". |
| ES  | Spain         | TBD             | TBD (Iberia-like)       | whitelist    | Canarias + Ceuta + Melilla raise mean April temperature. Whitelist 48 peninsular + Balearic provinces. |
| GB  | United Kingdom| TBD             | TBD (UK-like)           | none         | **Revised** — all 232 UK admin-1 units in the 10m layer are domestic. Gibraltar, the Falklands and the other BOTs are separate admin-0 entries with their own ISO codes, so nothing needs filtering. |
| NL  | Netherlands   | TBD             | TBD (NW-Europe-like)    | whitelist    | Caribbean Netherlands (Bonaire/Saba/Sint Eustatius) shifts April toward "tropical". Whitelist 12 European provinces. |
| DK  | Denmark       | TBD             | TBD (Jutland-like)      | whitelist    | Greenland and Færøerne are separate ISO countries in Natural Earth. Whitelist the 5 metro regions; the entry stays so inclusion is opt-in. |
| PT  | Portugal      | TBD             | TBD (Iberia-like)       | whitelist    | Açores + Madeira are mid-Atlantic. Whitelist 18 mainland districts. |
| NO  | Norway        | TBD             | TBD (Scandinavia-like)  | whitelist    | Svalbard + Bouvet Island are arctic/sub-antarctic outliers. Whitelist 19 mainland counties. |
| CL  | Chile         | TBD             | TBD (mosaic)            | suppress     | Atacama (driest desert) → Tierra del Fuego (sub-polar) → Easter Island. No coherent country mean exists. Mosaic. |
| EC  | Ecuador       | TBD             | TBD (Quito/coast-like)  | whitelist    | Galápagos has its own climate. Whitelist 23 continental provinces. |
| RU  | Russia        | TBD             | TBD (mosaic)            | suppress     | Moscow ≠ Sochi ≠ Vladivostok. Span 11 time zones. Mosaic. |
| CA  | Canada        | TBD             | TBD (mosaic)            | suppress     | Vancouver / Halifax / Iqaluit have nothing in common in April. Mosaic. |
| AU  | Australia     | TBD             | TBD (mosaic)            | suppress     | Tropical Darwin + Mediterranean Perth + cool-temperate Hobart. Mosaic. |
| BR  | Brazil        | TBD             | TBD (mosaic)            | suppress     | Amazon + cerrado + sub-tropical south. Mosaic. |
| CN  | China         | TBD             | TBD (mosaic)            | suppress     | Sanya (tropical) ≠ Harbin (sub-arctic) ≠ Lhasa (high alpine). Mosaic. |
| IN  | India         | TBD             | TBD (mosaic)            | suppress     | Kashmir snow + Kerala monsoon edge + Rajasthan desert. Mosaic. |
| AR  | Argentina     | TBD             | TBD (mosaic)            | suppress     | Salta sub-tropical + Ushuaia sub-polar. Mosaic. |
| KZ  | Kazakhstan    | TBD             | TBD (mosaic)            | suppress     | Caspian coast vs. continental steppe vs. Tian Shan. Mosaic. |
| BE  | Belgium       | TBD             | TBD (NW-Europe-like)    | none         | Coherent climate, no overseas territory. Default aggregation. |
| CH  | Switzerland   | TBD             | TBD (Alpine-like)       | none         | Coherent (with elevation gradient encoded by admin-2 detail later). Default aggregation. |

## Why "TBD" for numbers right now

Phase 3a runs alongside Phase 2 (data acquisition) — when this document
was written, ERA5 had not yet been downloaded against the ERA5 CDS
account. The structural decisions and whitelists are committed up-front so
that the moment Phase 2 finishes the only remaining work is to run
`wtg process aggregate --level all --years 2016-2025` and fill in the
score columns. The unit tests in
[`tests/test_country_rules.py`](../tests/test_country_rules.py) ensure
the rules themselves do not regress.

## Locked-in unit tests

* Every suppressed country answers `is_suppressed("XX") is True`.
* Every whitelisted country has `admin1_contributes(…)` filtering with at
  least one expected admin-1 code in the whitelist and at least one
  expected exclusion (e.g. FR-75 in, FR-GF out; ES-M in, ES-GC out).
* Whitelist sizes are pinned per country, so a table written against the
  wrong boundary vintage fails loudly instead of matching nothing.
* `filter_admin1_codes` is exercised round-trip.
* Suppressed countries always return `False` from `admin1_contributes`,
  guaranteeing zero contribution to the country aggregate even if a
  caller forgets to check `is_suppressed` first.

## How to refresh after first real ERA5 run

1. Run `wtg process aggregate --level all --years 2016-2025`.
2. Run `wtg process percentiles --level all`.
3. Use the helper script to materialise the 20-row table — see
   `pipeline/scripts/qa_country_scores.py` (TBD; trivial: load
   `intermediate/percentiles/country.parquet`, filter to the 20 ISOs,
   compute April p50 score, render).
4. Replace the TBDs in the table above; commit.
5. Any future change that flips a number for one of the 20 reference
   countries must be reviewed by the project owner before merging — this
   is enforced by the golden-file test that consumes this table.
