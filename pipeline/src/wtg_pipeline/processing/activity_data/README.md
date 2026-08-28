# Curated activities — the curator's guide

One JSON file per country, named by lowercase ISO-2 (`pe.json`). This is the
only hand-authored dataset in the pipeline. Everything else here is derived
from ERA5 or scraped from a government; these files are a person asserting a
fact, so the bar for what goes in them is different.

Read `../activities.py` for the schema in code. This file is the rules.

## The one rule

**Every activity carries a source, and the source says the thing.** Not a
homepage, not a general "best time to visit Peru" listicle that happens to
mention the sight — a page that states the specific claim you are encoding. If
you cannot find one, the activity does not go in the file. The loader refuses
an activity with no `sources`, and a `windows` entry with no `reason`, because
those are the two fields a reader checks.

This exists because the previous version of the site told people Machu Picchu
was closed in January. It is open every day of the year. What closes is the
classic Inca Trail, every February. A plausible sentence about a place you have
not checked is the failure mode; a citation is the fix.

## `closed` is not `limited`

| Status | Means | Test |
|---|---|---|
| `closed` | You cannot do it. A gate, a permit season, a road barrier. | Would a travel agent refuse to book it? |
| `limited` | You can, but it is materially degraded. | Would they book it and warn you? |
| `open` | Available, nothing to say. | — |
| `best` | Available and at its seasonal peak. | — |

Wet is not closed. Cold is not closed. Crowded is not closed. Overstating a
closure moves someone's flights, which makes it the expensive error even though
it feels like the cautious one.

## Scope

- No `regions` key → the activity is country-wide. It shows on the country and
  month pages.
- `regions: ["PE-CUS"]` → ISO-3166-2 codes, as spelled in
  `../subdivisions.json`. It shows on those regions' pages *as well*.

Region pages show only activities that genuinely name them. "Peru has an
Amazon" is not a fact about Arequipa, so an unscoped activity does not appear
on every subdivision.

## Coverage is tiered on purpose

Heavily-travelled countries get 6–10 entries; the rest get the 2–4 things they
are actually known for. A country with no file renders no section, which is
correct — a "no data" placeholder reads as a bug, an absent section reads as a
page about something else.

## Keeping it honest

- `reviewed` is the date a human last read the whole file.
- `checked` on each source is when that URL was last verified to say this.
- Dates that move every year (a festival on a lunar calendar, a park's exact
  reopening) should be encoded as the *month*, with the moving part in the
  `reason` as prose. The pipeline republishes yearly; a hard date in a `name`
  will go stale between runs and nothing will notice.
