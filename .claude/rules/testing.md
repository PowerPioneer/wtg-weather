# Testing

- Tests live next to source: `foo.py` → `test_foo.py`; `Foo.tsx` → `Foo.test.tsx`.
- Never hit live external APIs in tests (CDS, Paddle, Stripe, government advisory sites).
  Mock the client or use recorded fixtures.
- Any endpoint touching money / auth / tile-signing must have a failure-path test
  (forged signature, expired session, missing entitlement, double-spent webhook).
- Pipeline scrapers: fixtures in `pipeline/tests/fixtures/`. Never scrape live in tests.
