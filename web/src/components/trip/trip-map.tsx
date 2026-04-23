import { SCORE_HEX } from "@/lib/scoring";

const REGIONS = [
  { name: "Tumbes", d: "M70 70 L98 64 L102 86 L80 92 Z", score: 73 },
  { name: "Piura", d: "M80 92 L116 84 L122 116 L88 124 Z", score: 70 },
  { name: "Lambayeque", d: "M88 124 L122 116 L126 142 L98 150 Z", score: 72 },
  { name: "La Libertad", d: "M98 150 L132 138 L142 168 L112 178 Z", score: 76 },
  { name: "Áncash", d: "M112 178 L156 168 L168 204 L130 210 Z", score: 84 },
  { name: "Lima", d: "M130 210 L172 204 L184 244 L150 250 Z", score: 74 },
  { name: "Ica", d: "M150 250 L188 244 L196 282 L162 290 Z", score: 78 },
  { name: "Arequipa", d: "M162 290 L208 280 L222 322 L182 330 Z", score: 91 },
  { name: "Moquegua", d: "M182 330 L222 322 L228 354 L196 360 Z", score: 89 },
  { name: "Tacna", d: "M196 360 L228 354 L234 384 L208 388 Z", score: 87 },
  { name: "Cajamarca", d: "M122 116 L160 108 L168 140 L132 148 Z", score: 79 },
  { name: "Amazonas", d: "M160 108 L200 102 L210 134 L168 140 Z", score: 71 },
  { name: "San Martín", d: "M200 102 L246 100 L252 138 L210 134 Z", score: 68 },
  { name: "Loreto", d: "M210 134 L286 124 L308 184 L226 196 Z", score: 62 },
  { name: "Ucayali", d: "M226 196 L308 184 L312 244 L240 254 Z", score: 66 },
  { name: "Huánuco", d: "M156 168 L210 162 L218 198 L168 204 Z", score: 77 },
  { name: "Pasco", d: "M168 204 L218 198 L226 226 L184 234 Z", score: 81 },
  { name: "Junín", d: "M184 234 L226 226 L232 256 L196 262 Z", score: 83 },
  { name: "Huancavelica", d: "M188 244 L222 240 L226 268 L196 282 Z", score: 85 },
  { name: "Ayacucho", d: "M196 282 L232 268 L242 296 L208 308 Z", score: 86 },
  { name: "Apurímac", d: "M208 308 L242 296 L248 322 L222 322 Z", score: 88 },
  { name: "Cusco", d: "M222 322 L268 304 L280 340 L242 348 Z", score: 93 },
  { name: "Madre de Dios", d: "M240 254 L312 244 L324 296 L268 304 Z", score: 64 },
  { name: "Puno", d: "M242 348 L296 332 L302 372 L256 380 Z", score: 82 },
] as const;

const MARKERS = [
  { x: 250, y: 326, r: 1 }, { x: 200, y: 308, r: 2 }, { x: 208, y: 342, r: 3 },
  { x: 230, y: 312, r: 4 }, { x: 218, y: 374, r: 5 }, { x: 222, y: 290, r: 6 },
  { x: 210, y: 256, r: 7 }, { x: 145, y: 192, r: 8 }, { x: 210, y: 246, r: 9 },
  { x: 274, y: 358, r: 10 },
] as const;

function colorFor(s: number): string {
  if (s >= 90) return SCORE_HEX.perfect;
  if (s >= 80) return SCORE_HEX.good;
  if (s >= 70) return SCORE_HEX.acceptable;
  return SCORE_HEX.avoid;
}

/**
 * Stylized snapshot map. This is deliberately not the interactive MapLibre
 * view — it ships as a print-friendly, JS-free SVG so the shared/public link
 * renders identically in a screenshot, PDF, or OG preview.
 */
export function TripMap({ tripId }: { tripId: string }) {
  return (
    <div className="rounded-md border border-border bg-surface p-5">
      <div className="mb-3.5 flex items-baseline justify-between">
        <span className="font-mono text-[10.5px] font-semibold uppercase tracking-[0.16em] text-text-muted">
          Snapshot · destinations matching this trip
        </span>
        <a href={`/map?trip=${tripId}`} className="text-[12px] text-accent hover:underline">
          Open interactive map →
        </a>
      </div>
      <svg
        viewBox="0 0 400 420"
        role="img"
        aria-label="Peru regions shaded by match score; top destinations numbered 1–10"
        className="block w-full rounded-sm"
        style={{ background: "#FCFBF8" }}
      >
        <defs>
          <pattern id="trip-grid" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M40 0H0V40" fill="none" stroke="var(--color-border)" strokeWidth="0.4" />
          </pattern>
        </defs>
        <rect width="400" height="420" fill="url(#trip-grid)" opacity="0.7" />
        <path d="M0 0 H140 L40 420 H0 Z" fill="#EEF2F4" opacity="0.6" />
        <g>
          {REGIONS.map((r) => (
            <path
              key={r.name}
              d={r.d}
              fill={colorFor(r.score)}
              fillOpacity={r.score >= 85 ? 0.85 : r.score >= 75 ? 0.55 : 0.32}
              stroke="#FFF"
              strokeWidth="0.8"
            />
          ))}
        </g>
        {MARKERS.map((p) => (
          <g key={p.r}>
            <circle cx={p.x} cy={p.y} r="11" fill="#FFF" stroke="var(--color-primary)" strokeWidth="1.2" />
            <text
              x={p.x}
              y={p.y + 3.5}
              textAnchor="middle"
              fontSize="10"
              fontWeight="600"
              fontFamily="var(--font-mono)"
              fill="var(--color-primary)"
            >
              {p.r}
            </text>
          </g>
        ))}
        <g transform="translate(360 30)" fontFamily="var(--font-mono)" fontSize="8" fill="var(--color-text-muted)">
          <circle r="12" fill="none" stroke="var(--color-border)" />
          <path d="M0 -10 L0 10 M-10 0 L10 0" stroke="var(--color-border)" strokeWidth="0.6" />
          <text x="0" y="-14" textAnchor="middle" fill="var(--color-primary)" fontWeight="600">
            N
          </text>
        </g>
        <g transform="translate(20 400)" fontFamily="var(--font-mono)" fontSize="8" fill="var(--color-text-muted)">
          <line x1="0" y1="0" x2="60" y2="0" stroke="var(--color-primary)" strokeWidth="1" />
          <line x1="0" y1="-3" x2="0" y2="3" stroke="var(--color-primary)" />
          <line x1="60" y1="-3" x2="60" y2="3" stroke="var(--color-primary)" />
          <text x="30" y="14" textAnchor="middle">
            200 km
          </text>
        </g>
      </svg>
      <div className="mt-3.5 flex flex-wrap items-center gap-4 font-mono text-[11px] text-text-muted">
        <span className="uppercase tracking-[0.12em]">Match score</span>
        {[
          { c: SCORE_HEX.perfect, l: "90 – 100 perfect" },
          { c: SCORE_HEX.good, l: "80 – 89 strong" },
          { c: SCORE_HEX.acceptable, l: "70 – 79 acceptable" },
          { c: SCORE_HEX.avoid, l: "< 70 avoid" },
        ].map((s) => (
          <span key={s.l} className="inline-flex items-center gap-1.5">
            <span className="inline-block h-3 w-3 rounded-sm" style={{ background: s.c }} />
            {s.l}
          </span>
        ))}
      </div>
    </div>
  );
}
