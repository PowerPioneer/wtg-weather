# Advisory mapping tables

One JSON file per government scraper. These map the source's country/region
identifier onto ISO-3166 codes.

Schema: a flat `{"<source key>": "<ISO-3166-1 alpha-2>"}` map (country) or
`{"<source key>": "<ISO-3166-2 code>"}` (region).

Bootstrap coverage is intentionally narrow — enough to exercise the parser
and tests. The weekly cron logs unmatched keys so missing entries can be
added over time without blocking the build.
