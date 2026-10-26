/**
 * The header's sun mark, for `ImageResponse`.
 *
 * It is an SVG rather than the `☀` glyph the OG images used to print, because
 * Satori treats U+2600 as an emoji and fetches its artwork from
 * cdn.jsdelivr.net at render time. The web container sits on the internal-only
 * network with no external DNS, so that fetch failed, the emoji path does not
 * catch it, and every OG image answered 502 — 3,266 "failed to pipe response"
 * events before anyone looked. `brand-mark.test.tsx` keeps emoji out of every
 * `opengraph-image.tsx`.
 */
export function OgBrandMark() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="4" fill="#E0C98A" />
      <circle cx="12" cy="12" r="9" stroke="#E0C98A" strokeWidth="1.5" strokeDasharray="2 3" />
    </svg>
  );
}
