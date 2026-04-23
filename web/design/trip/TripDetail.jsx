/* global React, window */
// Trip detail page — owner + public variations on a design canvas.
// Reuses CountryKit. Print-friendly via @media print.

function TripDetail({ mode = 'owner' }) {
  const C = window.CK_COLORS;
  const isOwner = mode === 'owner';
  const isPublic = mode === 'public';

  const trip = {
    id: 'trp_8h2k9p',
    title: 'Honeymoon · Andes & Sacred Valley',
    months: ['April', 'May'],
    country: 'Peru',
    owner: { kind: 'agency', agency: 'Cordillera Voyages', client: 'M. & A. Westfield', plan: 'Agency Pro' },
    createdAt: 'Apr 12, 2026', updatedAt: 'Apr 22, 2026',
    shareUrl: 'atlasweather.io/t/8h2k9p-honeymoon',
    score: 87,
    prefs: {
      free: [
        { key: 'temp',     label: 'Temperature',  range: '14 – 22 °C',  icon: 'temp' },
        { key: 'rain',     label: 'Rainfall',     range: '< 60 mm / mo', icon: 'rain' },
        { key: 'sun',      label: 'Sunshine',     range: '> 6 hr / day', icon: 'sun'  },
        { key: 'wind',     label: 'Wind speed',   range: '< 25 km/h',    icon: 'wind' },
        { key: 'safety',   label: 'Safety',       range: 'Level 2 or safer', icon: 'shield' },
      ],
      premium: [
        { key: 'snow',     label: 'Snow depth',     range: '0 cm at lodging' },
        { key: 'sst',      label: 'Sea surface',    range: '> 18 °C (Pacific)' },
        { key: 'heat',     label: 'Heat index',     range: '< 30 °C feels-like' },
        { key: 'humidity', label: 'Humidity',       range: '40 – 70 %' },
      ],
    },
    destinations: [
      { rank: 1, region: 'Cusco',        country: 'Peru', score: 93, t: '13 / 20 °C', r: '52 mm', s: '7.0 hr', tag: 'Sacred Valley · Machu Picchu' },
      { rank: 2, region: 'Arequipa',     country: 'Peru', score: 91, t: '11 / 22 °C', r: '8 mm',  s: '8.4 hr', tag: 'Colca Canyon · white city' },
      { rank: 3, region: 'Moquegua',     country: 'Peru', score: 89, t: '12 / 23 °C', r: '4 mm',  s: '8.6 hr', tag: 'Quiet south coast' },
      { rank: 4, region: 'Apurímac',     country: 'Peru', score: 88, t: '10 / 21 °C', r: '32 mm', s: '7.3 hr', tag: 'Choquequirao trek' },
      { rank: 5, region: 'Tacna',        country: 'Peru', score: 87, t: '14 / 23 °C', r: '0 mm',  s: '8.7 hr', tag: 'Border desert' },
      { rank: 6, region: 'Ayacucho',     country: 'Peru', score: 86, t: '11 / 22 °C', r: '38 mm', s: '7.0 hr', tag: 'Colonial highland' },
      { rank: 7, region: 'Huancavelica', country: 'Peru', score: 85, t: '6 / 17 °C',  r: '46 mm', s: '6.8 hr', tag: 'High páramo' },
      { rank: 8, region: 'Áncash',       country: 'Peru', score: 84, t: '10 / 21 °C', r: '40 mm', s: '6.9 hr', tag: 'Cordillera Blanca · Huaraz' },
      { rank: 9, region: 'Junín',        country: 'Peru', score: 83, t: '6 / 18 °C',  r: '60 mm', s: '6.6 hr', tag: 'Mantaro valley' },
      { rank:10, region: 'Puno',         country: 'Peru', score: 82, t: '4 / 17 °C',  r: '38 mm', s: '7.2 hr', tag: 'Lake Titicaca · altiplano' },
    ],
  };

  // ─── Stylized static map ───────────────────────────────
  // Peru-ish silhouette with destination polygons coloured by score.
  const StaticMap = () => {
    const colorFor = s => s >= 90 ? C.perfect : s >= 85 ? C.good : s >= 75 ? C.accent : C.warm;
    // Synthetic admin-1 polygons positioned roughly along the spine of the country
    const regions = [
      { name: 'Tumbes',       d: 'M70 70 L98 64 L102 86 L80 92 Z', score: 73 },
      { name: 'Piura',        d: 'M80 92 L116 84 L122 116 L88 124 Z', score: 70 },
      { name: 'Lambayeque',   d: 'M88 124 L122 116 L126 142 L98 150 Z', score: 72 },
      { name: 'La Libertad',  d: 'M98 150 L132 138 L142 168 L112 178 Z', score: 76 },
      { name: 'Áncash',       d: 'M112 178 L156 168 L168 204 L130 210 Z', score: 84, big: true },
      { name: 'Lima',         d: 'M130 210 L172 204 L184 244 L150 250 Z', score: 74 },
      { name: 'Ica',          d: 'M150 250 L188 244 L196 282 L162 290 Z', score: 78 },
      { name: 'Arequipa',     d: 'M162 290 L208 280 L222 322 L182 330 Z', score: 91, big: true },
      { name: 'Moquegua',     d: 'M182 330 L222 322 L228 354 L196 360 Z', score: 89 },
      { name: 'Tacna',        d: 'M196 360 L228 354 L234 384 L208 388 Z', score: 87 },
      { name: 'Cajamarca',    d: 'M122 116 L160 108 L168 140 L132 148 Z', score: 79 },
      { name: 'Amazonas',     d: 'M160 108 L200 102 L210 134 L168 140 Z', score: 71 },
      { name: 'San Martín',   d: 'M200 102 L246 100 L252 138 L210 134 Z', score: 68 },
      { name: 'Loreto',       d: 'M210 134 L286 124 L308 184 L226 196 Z', score: 62 },
      { name: 'Ucayali',      d: 'M226 196 L308 184 L312 244 L240 254 Z', score: 66 },
      { name: 'Huánuco',      d: 'M156 168 L210 162 L218 198 L168 204 Z', score: 77 },
      { name: 'Pasco',        d: 'M168 204 L218 198 L226 226 L184 234 Z', score: 81 },
      { name: 'Junín',        d: 'M184 234 L226 226 L232 256 L196 262 Z', score: 83, big: true },
      { name: 'Huancavelica', d: 'M188 244 L222 240 L226 268 L196 282 Z', score: 85 },
      { name: 'Ayacucho',     d: 'M196 282 L232 268 L242 296 L208 308 Z', score: 86 },
      { name: 'Apurímac',     d: 'M208 308 L242 296 L248 322 L222 322 Z', score: 88 },
      { name: 'Cusco',        d: 'M222 322 L268 304 L280 340 L242 348 Z', score: 93, big: true, label: 'Cusco' },
      { name: 'Madre de Dios',d: 'M240 254 L312 244 L324 296 L268 304 Z', score: 64 },
      { name: 'Puno',         d: 'M242 348 L296 332 L302 372 L256 380 Z', score: 82 },
    ];

    return (
      <svg width="100%" viewBox="0 0 400 420" style={{ display: 'block', background: '#FCFBF8', borderRadius: 4 }}>
        {/* graticule */}
        <defs>
          <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M40 0H0V40" fill="none" stroke={C.border} strokeWidth="0.4"/>
          </pattern>
        </defs>
        <rect width="400" height="420" fill="url(#grid)" opacity="0.7"/>
        {/* ocean tint */}
        <path d="M0 0 H140 L40 420 H0 Z" fill="#EEF2F4" opacity="0.6"/>
        {/* country fill */}
        <g>
          {regions.map(r => (
            <g key={r.name}>
              <path d={r.d} fill={colorFor(r.score)} fillOpacity={r.score >= 85 ? 0.85 : r.score >= 75 ? 0.55 : 0.32}
                    stroke="#FFF" strokeWidth="0.8"/>
            </g>
          ))}
        </g>
        {/* destination markers — top 10 */}
        {[
          { x: 250, y: 326, r: 1, name: 'Cusco' },
          { x: 200, y: 308, r: 2, name: 'Arequipa' },
          { x: 208, y: 342, r: 3, name: 'Moquegua' },
          { x: 230, y: 312, r: 4, name: 'Apurímac' },
          { x: 218, y: 374, r: 5, name: 'Tacna' },
          { x: 222, y: 290, r: 6, name: 'Ayacucho' },
          { x: 210, y: 256, r: 7, name: 'Huancavelica' },
          { x: 145, y: 192, r: 8, name: 'Áncash' },
          { x: 210, y: 246, r: 9, name: 'Junín' },
          { x: 274, y: 358, r:10, name: 'Puno' },
        ].map(p => (
          <g key={p.r}>
            <circle cx={p.x} cy={p.y} r="11" fill="#FFF" stroke={C.ink} strokeWidth="1.2"/>
            <text x={p.x} y={p.y + 3.5} textAnchor="middle" fontSize="10" fontWeight="600" fontFamily="'IBM Plex Mono'" fill={C.ink}>{p.r}</text>
          </g>
        ))}
        {/* compass + scale */}
        <g transform="translate(360 30)" fontFamily="'IBM Plex Mono'" fontSize="8" fill={C.inkMuted}>
          <circle r="12" fill="none" stroke={C.border}/>
          <path d="M0 -10 L0 10 M-10 0 L10 0" stroke={C.border} strokeWidth="0.6"/>
          <text x="0" y="-14" textAnchor="middle" fill={C.ink} fontWeight="600">N</text>
        </g>
        <g transform="translate(20 400)" fontFamily="'IBM Plex Mono'" fontSize="8" fill={C.inkMuted}>
          <line x1="0" y1="0" x2="60" y2="0" stroke={C.ink} strokeWidth="1"/>
          <line x1="0" y1="-3" x2="0" y2="3" stroke={C.ink}/>
          <line x1="60" y1="-3" x2="60" y2="3" stroke={C.ink}/>
          <text x="30" y="14" textAnchor="middle">200 km</text>
        </g>
        {/* watermark / static-snapshot tag */}
        <text x="380" y="412" textAnchor="end" fontSize="8" fill={C.inkSubtle} fontFamily="'IBM Plex Mono'">snapshot · ERA5 · Apr–May 2026</text>
      </svg>
    );
  };

  // ─── Pref icons ────────────────────────────────────────
  const PrefIcon = ({ kind }) => {
    const s = { width: 16, height: 16, stroke: C.ink, strokeWidth: 1.5, fill: 'none', strokeLinecap: 'round', strokeLinejoin: 'round' };
    switch (kind) {
      case 'temp':   return <svg viewBox="0 0 24 24" {...s}><path d="M14 14V5a2 2 0 1 0-4 0v9a4 4 0 1 0 4 0z"/><circle cx="12" cy="17" r="1.5" fill={C.ink} stroke="none"/></svg>;
      case 'rain':   return <svg viewBox="0 0 24 24" {...s}><path d="M7 16a5 5 0 1 1 9-4 4 4 0 0 1-1 8H8a3 3 0 0 1-1-4z"/><path d="M9 20l-1 2M13 20l-1 2M17 20l-1 2"/></svg>;
      case 'sun':    return <svg viewBox="0 0 24 24" {...s}><circle cx="12" cy="12" r="4"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4L7 17M17 7l1.4-1.4"/></svg>;
      case 'wind':   return <svg viewBox="0 0 24 24" {...s}><path d="M3 8h12a3 3 0 1 0-3-3M3 14h16a3 3 0 1 1-3 3M3 11h8"/></svg>;
      case 'shield': return <svg viewBox="0 0 24 24" {...s}><path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6l8-3z"/></svg>;
      default: return null;
    }
  };

  // ─── Param card ───────────────────────────────────────
  const ParamRow = ({ label, range, icon, premium }) => (
    <div style={{
      display: 'grid', gridTemplateColumns: '24px 1fr auto', alignItems: 'center', gap: 14,
      padding: '13px 0', borderBottom: `1px dotted ${C.border}`,
      opacity: premium && isPublic ? 0.6 : 1,
    }}>
      <div style={{ display: 'flex', alignItems: 'center' }}>
        {icon && <PrefIcon kind={icon} />}
        {premium && (
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke={C.accent} strokeWidth="1.6"><path d="M6 11V8a6 6 0 1 1 12 0v3m-14 0h16v10H4V11z" strokeLinejoin="round"/></svg>
        )}
      </div>
      <div>
        <div style={{ fontSize: 13, fontWeight: 500, color: C.ink, display: 'flex', alignItems: 'center', gap: 8 }}>
          {label}
          {premium && (
            <span style={{
              fontSize: 9, fontFamily: "'IBM Plex Mono'", letterSpacing: '0.14em',
              color: C.accent, background: '#FBF3DC', border: `1px solid ${C.accent}`,
              padding: '1px 6px', borderRadius: 2,
            }}>PRO</span>
          )}
        </div>
        <div style={{ fontSize: 11, color: C.inkSubtle, fontFamily: "'IBM Plex Mono'", marginTop: 2 }}>{range}</div>
      </div>
      <div style={{ fontSize: 11, color: premium && isPublic ? C.inkSubtle : C.perfect, fontFamily: "'IBM Plex Mono'" }}>
        {premium && isPublic ? '— locked' : '✓ matched'}
      </div>
    </div>
  );

  // ─── Action button ────────────────────────────────────
  const ActionBtn = ({ icon, label, danger, primary, sub }) => (
    <button style={{
      display: 'flex', alignItems: 'center', gap: 12, width: '100%',
      background: primary ? C.ink : 'transparent',
      color: primary ? '#FFF' : danger ? '#7A2E2E' : C.ink,
      border: primary ? 'none' : `1px solid ${C.border}`,
      borderRadius: 4, padding: '11px 14px', fontFamily: "'IBM Plex Sans'",
      fontSize: 13, fontWeight: 500, cursor: 'pointer', textAlign: 'left',
    }}>
      <span style={{ width: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', color: primary ? '#FFF' : danger ? '#7A2E2E' : C.inkMuted }}>{icon}</span>
      <span style={{ flex: 1 }}>{label}</span>
      {sub && <span style={{ fontSize: 10.5, color: primary ? 'rgba(255,255,255,0.7)' : C.inkSubtle, fontFamily: "'IBM Plex Mono'" }}>{sub}</span>}
    </button>
  );
  const I = {
    edit:   <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M14 4l6 6L10 20H4v-6L14 4z"/></svg>,
    bell:   <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M6 16V11a6 6 0 1 1 12 0v5l2 2H4l2-2zM10 21h4"/></svg>,
    share:  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="6" r="2.5"/><circle cx="18" cy="18" r="2.5"/><path d="M8 11l8-4M8 13l8 4"/></svg>,
    pdf:    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M6 3h9l5 5v13H6z"/><path d="M14 3v6h6"/></svg>,
    trash:  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M4 7h16M9 7V4h6v3M6 7l1 14h10l1-14"/></svg>,
    copy:   <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><rect x="8" y="8" width="12" height="12" rx="1"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/></svg>,
    plus:   <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M12 5v14M5 12h14"/></svg>,
  };

  // ─── Page ──────────────────────────────────────────────
  return (
    <div style={{ width: 1440, background: C.paper, color: C.ink, fontFamily: "'IBM Plex Sans'" }} className={`trip trip-${mode}`}>
      <window.CKPageHeader />

      {/* Mode banner — public */}
      {isPublic && (
        <div className="no-print" style={{ background: '#FBF3DC', borderBottom: `1px solid ${C.accent}`, padding: '10px 80px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 12, color: C.ink, fontFamily: "'IBM Plex Mono'" }}>
          <div>
            <span style={{ color: C.accent, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase' }}>Shared trip</span>
            <span style={{ margin: '0 10px', color: C.borderStrong }}>·</span>
            Read-only view from <strong style={{ fontFamily: "'IBM Plex Sans'", color: C.ink }}>Cordillera Voyages</strong>
            <span style={{ margin: '0 10px', color: C.borderStrong }}>·</span>
            atlasweather.io/t/8h2k9p
          </div>
          <a href="/signup" style={{ color: C.accent, textDecoration: 'none', fontWeight: 600 }}>Save a copy →</a>
        </div>
      )}

      {/* Owner mode strip */}
      {isOwner && (
        <div className="no-print" style={{ background: C.ink, color: '#FFF', padding: '8px 80px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 11.5, fontFamily: "'IBM Plex Mono'" }}>
          <div>
            <span style={{ color: '#E0C98A', letterSpacing: '0.14em', textTransform: 'uppercase', fontWeight: 600 }}>Your trip</span>
            <span style={{ margin: '0 10px', color: 'rgba(255,255,255,0.4)' }}>·</span>
            Saved {trip.createdAt} · Updated {trip.updatedAt} · {trip.id}
          </div>
          <div style={{ display: 'flex', gap: 18 }}>
            <span>● Auto-sync on</span>
            <span style={{ color: 'rgba(255,255,255,0.6)' }}>Last alert · Apr 18 (rainfall ↑ Cusco)</span>
          </div>
        </div>
      )}

      {/* ─── HERO ─────────────────────────────────── */}
      <div style={{ padding: '48px 80px 24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 18 }}>
          <window.CKEyebrow>{isOwner ? 'Saved trip' : 'Shared trip · read-only'}</window.CKEyebrow>
          <div style={{ flex: 1, height: 1, background: C.border }} />
          <div style={{ fontSize: 11, color: C.inkMuted, fontFamily: "'IBM Plex Mono'" }}>{trip.country.toUpperCase()} · {trip.months.join(' – ').toUpperCase()} · 2026</div>
        </div>

        {/* For-client subtitle */}
        {trip.owner.kind === 'agency' && (
          <div style={{ fontSize: 13, color: C.inkMuted, fontFamily: "'IBM Plex Sans'", marginBottom: 6, display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontFamily: "'IBM Plex Mono'", fontSize: 11, color: C.accent, letterSpacing: '0.12em', textTransform: 'uppercase' }}>For</span>
            <span style={{ fontFamily: "'IBM Plex Serif'", fontStyle: 'italic', fontSize: 18, color: C.ink }}>{trip.owner.client}</span>
            <span style={{ color: C.borderStrong }}>·</span>
            <span>prepared by {trip.owner.agency}</span>
          </div>
        )}

        {/* Title — inline-editable for owner */}
        {isOwner ? (
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
            <h1
              contentEditable
              suppressContentEditableWarning
              spellCheck={false}
              style={{
                fontFamily: "'IBM Plex Serif'", fontSize: 64, fontWeight: 400, lineHeight: 1.05,
                letterSpacing: '-0.022em', margin: '6px 0 0', color: C.ink, flex: 1,
                outline: 'none', borderRadius: 4, padding: '4px 8px', marginLeft: -8,
                cursor: 'text',
              }}
              onFocus={e => e.currentTarget.style.background = '#FBF3DC'}
              onBlur={e => e.currentTarget.style.background = 'transparent'}
            >{trip.title}</h1>
            <div className="no-print" style={{ marginTop: 18, fontSize: 11, color: C.inkSubtle, fontFamily: "'IBM Plex Mono'", display: 'flex', alignItems: 'center', gap: 6, padding: '4px 8px', border: `1px dashed ${C.border}`, borderRadius: 3 }}>
              {I.edit} click to edit
            </div>
          </div>
        ) : (
          <h1 style={{
            fontFamily: "'IBM Plex Serif'", fontSize: 64, fontWeight: 400, lineHeight: 1.05,
            letterSpacing: '-0.022em', margin: '6px 0 0', color: C.ink,
          }}>{trip.title}</h1>
        )}

        {/* Meta strip */}
        <div style={{ display: 'flex', gap: 22, marginTop: 22, fontSize: 13, color: C.inkMuted, fontFamily: "'IBM Plex Sans'", alignItems: 'center', flexWrap: 'wrap' }}>
          <span><strong style={{ color: C.ink, fontWeight: 500 }}>{trip.country}</strong> · all regions</span>
          <span style={{ color: C.borderStrong }}>·</span>
          <span><strong style={{ color: C.ink, fontWeight: 500 }}>{trip.months.join(' & ')}</strong> 2026 · ~6 weeks window</span>
          <span style={{ color: C.borderStrong }}>·</span>
          <span><strong style={{ color: C.ink, fontWeight: 500 }}>{trip.destinations.length}</strong> matching destinations</span>
          <span style={{ color: C.borderStrong }}>·</span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            Overall fit
            <window.ScoreBadge score={trip.score} size="md" />
          </span>
        </div>
      </div>

      {/* ─── MAP + SIDE COLUMN ──────────────────── */}
      <div style={{ padding: '24px 80px 56px', display: 'grid', gridTemplateColumns: '1.55fr 1fr', gap: 32 }}>

        {/* Map */}
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 6, padding: 22 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 14 }}>
            <window.CKEyebrow>Snapshot · destinations matching this trip</window.CKEyebrow>
            <a href="/map?trip=trp_8h2k9p" className="no-print" style={{ fontSize: 12, color: C.accent, textDecoration: 'none', fontFamily: "'IBM Plex Sans'" }}>Open interactive map →</a>
          </div>
          <StaticMap />
          {/* legend */}
          <div style={{ marginTop: 14, display: 'flex', gap: 18, alignItems: 'center', fontSize: 11, color: C.inkMuted, fontFamily: "'IBM Plex Mono'", flexWrap: 'wrap' }}>
            <span style={{ letterSpacing: '0.12em', textTransform: 'uppercase' }}>Match score</span>
            {[
              { c: C.perfect, l: '90 – 100 perfect' },
              { c: C.good,    l: '85 – 89 strong' },
              { c: C.accent,  l: '75 – 84 good' },
              { c: C.warm,    l: '< 75 marginal' },
            ].map(s => (
              <span key={s.l} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 12, height: 12, background: s.c, borderRadius: 2 }} /> {s.l}
              </span>
            ))}
          </div>
        </div>

        {/* Right column = Owner: actions + params · Public: params + CTA */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>

          {/* OWNER actions */}
          {isOwner && (
            <div className="no-print" style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 6, padding: 18 }}>
              <window.CKEyebrow style={{ marginBottom: 12 }}>Owner actions</window.CKEyebrow>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <ActionBtn icon={I.edit}  label="Edit preferences" sub="adjust ranges" />
                <ActionBtn icon={I.bell}  label="Add to alerts"     sub="weekly ⌃" />
                {/* Share — special block */}
                <div style={{ background: '#FCFBF8', border: `1px solid ${C.border}`, borderRadius: 4, padding: '12px 14px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12, color: C.ink, fontWeight: 500, marginBottom: 8 }}>
                    {I.share} Share link
                    <span style={{ marginLeft: 'auto', fontSize: 10, fontFamily: "'IBM Plex Mono'", color: C.perfect, letterSpacing: '0.1em' }}>● PUBLIC</span>
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <input readOnly value={trip.shareUrl} style={{
                      flex: 1, fontFamily: "'IBM Plex Mono'", fontSize: 11, padding: '7px 10px',
                      border: `1px solid ${C.border}`, borderRadius: 3, color: C.inkMuted, background: '#FFF',
                    }}/>
                    <button style={{ background: C.ink, color: '#FFF', border: 'none', borderRadius: 3, padding: '0 12px', fontSize: 11, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>{I.copy} Copy</button>
                  </div>
                </div>
                <ActionBtn icon={I.pdf}   label="Export PDF"      sub="for client" />
                <ActionBtn icon={I.trash} label="Delete trip"     danger />
              </div>
            </div>
          )}

          {/* Trip params (both views) */}
          <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 6, padding: '18px 22px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
              <window.CKEyebrow>Trip parameters</window.CKEyebrow>
              {isOwner && <a href="#" className="no-print" style={{ fontSize: 11, color: C.accent, textDecoration: 'none', fontFamily: "'IBM Plex Sans'" }}>Edit →</a>}
            </div>
            <div style={{ fontSize: 11, color: C.inkSubtle, fontFamily: "'IBM Plex Mono'", marginBottom: 10 }}>
              {isPublic ? '5 free criteria · 4 Premium criteria' : '9 criteria active · all matched'}
            </div>
            {trip.prefs.free.map(p => <ParamRow key={p.key} {...p} />)}
            {/* Premium block */}
            <div style={{ marginTop: 14, paddingTop: 12, borderTop: `1px solid ${C.border}`, marginBottom: 4 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <div style={{ fontSize: 10, fontFamily: "'IBM Plex Mono'", color: C.accent, letterSpacing: '0.16em', textTransform: 'uppercase', fontWeight: 600 }}>Premium parameters</div>
                {isPublic && <a href="/pricing" className="no-print" style={{ fontSize: 11, color: C.accent, textDecoration: 'none' }}>Unlock →</a>}
              </div>
            </div>
            {trip.prefs.premium.map(p => <ParamRow key={p.key} {...p} premium />)}
            {isPublic && (
              <div className="no-print" style={{ marginTop: 14, padding: '12px 14px', background: '#FBF3DC', border: `1px dashed ${C.accent}`, borderRadius: 4, fontSize: 12, color: C.ink, lineHeight: 1.4 }}>
                Premium criteria are visible to the owner ({trip.owner.agency}). <a href="/pricing" style={{ color: C.accent, fontWeight: 600 }}>Get Premium</a> to filter destinations on these too.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ─── TOP DESTINATIONS ───────────────────── */}
      <div style={{ padding: '0 80px 56px' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 4 }}>
          <window.CKEyebrow>Top 10 destinations · ranked by match</window.CKEyebrow>
          <div style={{ fontSize: 11, color: C.inkSubtle, fontFamily: "'IBM Plex Mono'" }}>scoring window: April + May 2026 · default unit metric</div>
        </div>
        <h2 style={{ fontFamily: "'IBM Plex Serif'", fontSize: 30, fontWeight: 400, margin: '8px 0 22px', letterSpacing: '-0.012em' }}>
          Where this trip works best.
        </h2>

        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 6, overflow: 'hidden' }}>
          {/* table head */}
          <div style={{
            display: 'grid', gridTemplateColumns: '40px 1.6fr 1fr 0.7fr 0.7fr 0.7fr 80px 90px',
            padding: '10px 18px', background: '#FCFBF8', borderBottom: `1px solid ${C.border}`,
            fontSize: 10.5, fontFamily: "'IBM Plex Mono'", color: C.inkSubtle, letterSpacing: '0.1em', textTransform: 'uppercase',
          }}>
            <div>#</div>
            <div>Destination</div>
            <div>Itinerary tag</div>
            <div>Temp</div>
            <div>Rain</div>
            <div>Sun</div>
            <div style={{ textAlign: 'right' }}>Score</div>
            <div style={{ textAlign: 'right' }}>Open</div>
          </div>
          {trip.destinations.map((d, i) => (
            <div key={d.rank} style={{
              display: 'grid', gridTemplateColumns: '40px 1.6fr 1fr 0.7fr 0.7fr 0.7fr 80px 90px',
              padding: '14px 18px', alignItems: 'center',
              borderBottom: i === trip.destinations.length - 1 ? 'none' : `1px solid ${C.border}`,
              background: i === 0 ? '#FCFBF8' : 'transparent',
            }}>
              <div style={{ fontFamily: "'IBM Plex Mono'", fontSize: 13, color: C.inkMuted }}>{String(d.rank).padStart(2, '0')}</div>
              <div>
                <div style={{ fontFamily: "'IBM Plex Serif'", fontSize: 18, fontWeight: 500, color: C.ink, letterSpacing: '-0.005em' }}>{d.region}</div>
                <div style={{ fontSize: 11, color: C.inkMuted, fontFamily: "'IBM Plex Mono'", marginTop: 2 }}>{d.country}</div>
              </div>
              <div style={{ fontSize: 12.5, color: C.inkMuted, fontStyle: 'italic', fontFamily: "'IBM Plex Serif'" }}>{d.tag}</div>
              <div style={{ fontFamily: "'IBM Plex Mono'", fontSize: 12, color: C.ink }}>{d.t}</div>
              <div style={{ fontFamily: "'IBM Plex Mono'", fontSize: 12, color: C.ink }}>{d.r}</div>
              <div style={{ fontFamily: "'IBM Plex Mono'", fontSize: 12, color: C.ink }}>{d.s}</div>
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}><window.ScoreBadge score={d.score} size="sm"/></div>
              <div style={{ textAlign: 'right' }}>
                <a href={`/peru/regions/${d.region.toLowerCase()}`} style={{ fontSize: 12, color: C.accent, textDecoration: 'none', fontFamily: "'IBM Plex Sans'" }}>Region →</a>
              </div>
            </div>
          ))}
        </div>

        {/* Add destination — owner only */}
        {isOwner && (
          <button className="no-print" style={{
            marginTop: 12, background: 'transparent', border: `1px dashed ${C.borderStrong}`,
            borderRadius: 4, padding: '12px 16px', width: '100%', cursor: 'pointer',
            color: C.inkMuted, fontFamily: "'IBM Plex Sans'", fontSize: 13,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          }}>{I.plus} Add a destination by hand</button>
        )}
      </div>

      {/* ─── CTA — public only ─────────────────── */}
      {isPublic && (
        <div className="no-print" style={{ padding: '12px 80px 64px' }}>
          <div style={{
            background: C.ink, color: '#FFF', borderRadius: 8,
            padding: '44px 48px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 32,
          }}>
            <div style={{ maxWidth: 560 }}>
              <window.CKEyebrow color="#E0C98A">Plan your own trip</window.CKEyebrow>
              <div style={{ fontFamily: "'IBM Plex Serif'", fontSize: 30, fontWeight: 400, lineHeight: 1.15, marginTop: 10, letterSpacing: '-0.012em' }}>
                Like this layout? Build your own from a country, a month, and the weather you want. Free.
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, flexShrink: 0 }}>
              <a href="/" style={{ background: '#E0C98A', color: C.ink, padding: '13px 22px', borderRadius: 4, fontSize: 14, fontWeight: 600, textDecoration: 'none' }}>Open the map</a>
              <a href="/signup" style={{ background: 'transparent', color: '#FFF', padding: '13px 20px', borderRadius: 4, fontSize: 14, fontWeight: 500, textDecoration: 'none', border: '1px solid rgba(255,255,255,0.28)' }}>Create account</a>
            </div>
          </div>
        </div>
      )}

      {/* ─── PDF/Agency footer ─────────────────── */}
      <div style={{ padding: '24px 80px 48px', borderTop: `1px solid ${C.border}`, background: C.surface, display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 11.5, color: C.inkMuted, fontFamily: "'IBM Plex Mono'" }}>
        <div>
          <strong style={{ color: C.ink, fontFamily: "'IBM Plex Sans'", fontWeight: 600 }}>{trip.owner.agency}</strong> · prepared {trip.updatedAt} · trip {trip.id}
        </div>
        <div>
          Climate · ERA5 reanalysis 2014–2024 · Safety · 5-government rolling consensus
        </div>
        <div>
          Atlas Weather · atlasweather.io
        </div>
      </div>

      <window.CKPageFooter />
    </div>
  );
}

window.TripDetail = TripDetail;
