/**
 * URLs the v1 site published that v2 has no page for.
 *
 * v1's sitemap listed five URLs: `/`, `/about`, `/privacy`, `/terms` and
 * `/cookies`. The first three-of-five exist in v2 unchanged; these two would
 * 404 the moment the apex moves, losing whatever search equity and inbound
 * links they carry. Permanent (308) so search engines transfer it.
 *
 * Imported by `next.config.ts` with a relative path, so no `@/` alias here.
 */
export const LEGACY_REDIRECTS = [
  // v1's About page described the product; v2's landing page is that page.
  { source: "/about", destination: "/", permanent: true },
  // v2 folds the cookie list into the privacy policy's own section.
  { source: "/cookies", destination: "/privacy#cookies", permanent: true },
] as const;
