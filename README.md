# Where to Go for Great Weather — v2

Travel-climate map: shows how well each country/region matches a user's weather
preferences for a given month, based on 10 years of ERA5 data, overlaid with
travel advisories from five governments.

See `REBUILD_PLAN.md` for the full architecture and rebuild plan.
See `CLAUDE.md` for day-to-day commands and conventions.

## Quickstart

```bash
cp .env.example .env          # fill in the blanks
docker compose up -d          # boot full stack
curl http://localhost/api/health   # -> {"status":"ok"}
curl http://localhost/         # -> web hello
```
