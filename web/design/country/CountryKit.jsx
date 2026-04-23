/* global React, window */
// CountryKit — all components render to pure HTML/SVG. No JS required at runtime.
// Animations and interactions use native <details> and CSS :checked siblings.

const CK_COLORS = {
  ink: '#0F1B2D', inkMuted: '#4A5568', inkSubtle: '#6B7280',
  paper: '#F7F6F2', surface: '#FFFFFF', surface2: '#ECEAE3',
  border: '#D9D5C8', borderStrong: '#B8B3A2',
  accent: '#B8763E', accentDeep: '#8A4A1E', accentSoft: '#F3E7D4',
  perfect: '#0B6E5F', good: '#0072B2', warm: '#D14A2E',
  safe1: '#2E7D4F', safe2: '#B88A2E', safe3: '#C2571B', safe4: '#7A2E2E',
};
window.CK_COLORS = CK_COLORS;

function CKEyebrow({ children, color = CK_COLORS.inkMuted, style }) {
  return <div style={{ fontSize: 10.5, letterSpacing: '0.16em', color, fontWeight: 600, textTransform: 'uppercase', fontFamily: "'IBM Plex Sans'", ...style }}>{children}</div>;
}
window.CKEyebrow = CKEyebrow;

// ─── Flag (SVG, correct Peru tricolor) ────────────────────────────
function PeruFlag({ w = 48, h = 32 }) {
  return (
    <svg width={w} height={h} viewBox="0 0 60 40" style={{ border: `1px solid ${CK_COLORS.border}`, borderRadius: 2 }}>
      <rect width="20" height="40" fill="#D91023"/>
      <rect x="20" width="20" height="40" fill="#FFFFFF"/>
      <rect x="40" width="20" height="40" fill="#D91023"/>
    </svg>
  );
}
window.PeruFlag = PeruFlag;

// ─── Score badge ──────────────────────────────────────────────────
function ScoreBadge({ score, size = 'md' }) {
  const bg = score >= 85 ? CK_COLORS.perfect : score >= 70 ? CK_COLORS.good : score >= 55 ? CK_COLORS.accent : CK_COLORS.warm;
  const sz = size === 'sm' ? { w: 36, h: 22, fs: 11 } : size === 'lg' ? { w: 56, h: 36, fs: 16 } : { w: 44, h: 26, fs: 13 };
  return (
    <div style={{ width: sz.w, height: sz.h, background: bg, color: '#FFFFFF', borderRadius: 3, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: sz.fs, fontWeight: 600, fontFamily: "'IBM Plex Mono'" }}>
      {score}
    </div>
  );
}
window.ScoreBadge = ScoreBadge;

// ─── Chart card (inline SVG) ──────────────────────────────────────
// kind: 'temp' (with optional bands), 'bars' (rainfall), 'line' (sunshine/wind/sst/heat/humidity), 'snow' (bars short)
function ChartCard({ title, unit, kind, data, bands, months, locked, color = CK_COLORS.ink, source, maxOverride, minOverride, variant = 'default', showBands = false, accent }) {
  const W = 480, H = 180, padL = 36, padR = 12, padT = 16, padB = 28;
  const innerW = W - padL - padR, innerH = H - padT - padB;

  const values = data;
  const max = maxOverride ?? Math.max(...values, ...(bands ? bands.upper : []));
  const min = minOverride ?? Math.min(0, ...values, ...(bands ? bands.lower : []));
  const yOf = v => padT + innerH - ((v - min) / (max - min || 1)) * innerH;
  const xOf = i => padL + (i + 0.5) * (innerW / 12);

  const axisColor = CK_COLORS.border;
  const tickColor = CK_COLORS.inkSubtle;

  // yticks
  const yTicks = [];
  const steps = 4;
  for (let i = 0; i <= steps; i++) {
    const v = min + ((max - min) * i) / steps;
    yTicks.push(v);
  }

  return (
    <div style={{
      background: CK_COLORS.surface, border: `1px solid ${CK_COLORS.border}`,
      borderRadius: 4, padding: '18px 18px 14px', fontFamily: "'IBM Plex Sans'",
      position: 'relative', overflow: 'hidden',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: CK_COLORS.ink, letterSpacing: '-0.005em' }}>{title}</div>
        <div style={{ fontSize: 10.5, color: CK_COLORS.inkMuted, fontFamily: "'IBM Plex Mono'" }}>{unit}</div>
      </div>
      {source && <div style={{ fontSize: 10.5, color: CK_COLORS.inkSubtle, marginBottom: 8, fontFamily: "'IBM Plex Mono'" }}>{source}</div>}

      <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ display: 'block', filter: locked ? 'blur(3px) saturate(0.6)' : 'none', opacity: locked ? 0.55 : 1 }}>
        {/* gridlines */}
        {yTicks.map((v, i) => (
          <g key={i}>
            <line x1={padL} x2={W - padR} y1={yOf(v)} y2={yOf(v)} stroke={axisColor} strokeWidth="0.5" strokeDasharray={i === steps ? '' : '2 3'}/>
            <text x={padL - 6} y={yOf(v) + 3} textAnchor="end" fontSize="9" fill={tickColor} fontFamily="'IBM Plex Mono'">{Math.round(v)}</text>
          </g>
        ))}

        {/* bands (Premium only) */}
        {showBands && bands && (
          <path
            d={`M ${xOf(0)} ${yOf(bands.upper[0])} ${bands.upper.map((v, i) => `L ${xOf(i)} ${yOf(v)}`).join(' ')} ${[...bands.lower].reverse().map((v, i) => `L ${xOf(11 - i)} ${yOf(v)}`).join(' ')} Z`}
            fill={color} fillOpacity="0.14" stroke="none"
          />
        )}

        {/* main data */}
        {kind === 'bars' && values.map((v, i) => {
          const bw = (innerW / 12) * 0.62;
          const h0 = yOf(0);
          const hT = yOf(v);
          return <rect key={i} x={xOf(i) - bw/2} y={Math.min(h0, hT)} width={bw} height={Math.abs(hT - h0)} fill={color} opacity="0.88"/>;
        })}

        {(kind === 'temp' || kind === 'line') && (
          <>
            <path d={`M ${values.map((v, i) => `${xOf(i)} ${yOf(v)}`).join(' L ')}`} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            {values.map((v, i) => <circle key={i} cx={xOf(i)} cy={yOf(v)} r="2.5" fill={CK_COLORS.surface} stroke={color} strokeWidth="1.5"/>)}
          </>
        )}

        {/* month labels */}
        {months.map((m, i) => (
          <text key={m} x={xOf(i)} y={H - 8} textAnchor="middle" fontSize="9" fill={tickColor} fontFamily="'IBM Plex Mono'">{m[0]}</text>
        ))}
      </svg>

      {showBands && !locked && (
        <div style={{ fontSize: 10.5, color: CK_COLORS.accent, fontFamily: "'IBM Plex Mono'", marginTop: 4, display: 'flex', gap: 12 }}>
          <span>— median</span>
          <span>▬ 10 / 90 percentile band</span>
        </div>
      )}
    </div>
  );
}
window.ChartCard = ChartCard;

// ─── Locked-group overlay ─────────────────────────────────────────
// Wraps the 4 Premium charts with a single "Unlock" prompt layered above.
function LockedChartGroup({ children, inline = false }) {
  return (
    <div style={{ position: 'relative' }}>
      <div style={{ position: 'relative', pointerEvents: 'none' }}>{children}</div>
      {/* Scrim */}
      <div style={{
        position: 'absolute', inset: 0,
        background: 'linear-gradient(180deg, rgba(247,246,242,0.05) 0%, rgba(247,246,242,0.55) 50%, rgba(247,246,242,0.9) 100%)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <div style={{
          background: CK_COLORS.surface, border: `1px solid ${CK_COLORS.borderStrong}`,
          borderRadius: 6, padding: '22px 28px', maxWidth: 460, textAlign: 'center',
          boxShadow: '0 20px 40px rgba(15,27,45,0.16)', fontFamily: "'IBM Plex Sans'",
        }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 10.5, fontFamily: "'IBM Plex Mono'", color: CK_COLORS.accent, letterSpacing: '0.14em', marginBottom: 8 }}>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none"><path d="M6 11V8a6 6 0 1 1 12 0v3m-14 0h16v10H4V11z" stroke={CK_COLORS.accent} strokeWidth="1.8"/></svg>
            PREMIUM
          </div>
          <div style={{ fontFamily: "'IBM Plex Serif'", fontSize: 22, fontWeight: 500, color: CK_COLORS.ink, lineHeight: 1.2, letterSpacing: '-0.01em' }}>
            Four more variables. Percentile bands on every chart.
          </div>
          <div style={{ fontSize: 13, color: CK_COLORS.inkMuted, marginTop: 8, lineHeight: 1.5 }}>
            Snow depth, sea-surface temperature, heat index, and humidity — plus 10 / 50 / 90 bands so you see the variability, not just the mean.
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 16 }}>
            <a href="/pricing" style={{ background: CK_COLORS.ink, color: '#FFF', padding: '10px 18px', borderRadius: 3, fontSize: 13, fontWeight: 500, textDecoration: 'none', fontFamily: "'IBM Plex Sans'" }}>Unlock with Premium · €2.99/mo</a>
            <a href="/pricing" style={{ background: 'transparent', color: CK_COLORS.ink, padding: '10px 14px', borderRadius: 3, fontSize: 13, fontWeight: 500, border: `1px solid ${CK_COLORS.border}`, textDecoration: 'none', fontFamily: "'IBM Plex Sans'" }}>Compare plans</a>
          </div>
          <div style={{ fontSize: 11, color: CK_COLORS.inkSubtle, marginTop: 10, fontFamily: "'IBM Plex Mono'" }}>No card to start. 14-day refund.</div>
        </div>
      </div>
    </div>
  );
}
window.LockedChartGroup = LockedChartGroup;

// ─── Region card with sparkline ───────────────────────────────────
function RegionCard({ region, href, current }) {
  const W = 160, H = 28, padY = 4;
  const vals = region.tl;
  const mx = Math.max(...vals), mn = Math.min(...vals);
  const xOf = i => (i + 0.5) * (W / 12);
  const yOf = v => padY + (H - padY*2) - ((v - mn) / (mx - mn || 1)) * (H - padY*2);

  return (
    <a href={href} style={{
      display: 'block', background: CK_COLORS.surface, border: `1px solid ${CK_COLORS.border}`,
      borderRadius: 4, padding: '12px 14px', textDecoration: 'none', color: CK_COLORS.ink,
      fontFamily: "'IBM Plex Sans'",
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <div style={{ fontSize: 13, fontWeight: 500, letterSpacing: '-0.005em' }}>{region.name}</div>
        <ScoreBadge score={region.score} size="sm" />
      </div>
      <svg width="100%" viewBox={`0 0 ${W} ${H}`}>
        <path d={`M ${vals.map((v, i) => `${xOf(i)} ${yOf(v)}`).join(' L ')}`} fill="none" stroke={CK_COLORS.accent} strokeWidth="1.5" strokeLinecap="round"/>
        {/* mark current month */}
        <circle cx={xOf(current)} cy={yOf(vals[current])} r="2.5" fill={CK_COLORS.accent}/>
      </svg>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: CK_COLORS.inkSubtle, fontFamily: "'IBM Plex Mono'", marginTop: 2 }}>
        <span>{vals[current]}°C this mo.</span>
        <span>{mn}–{mx}°C yr</span>
      </div>
    </a>
  );
}
window.RegionCard = RegionCard;

// ─── Safety panel (CSS-only toggle, works with no JS) ─────────────
function SafetyPanel({ data }) {
  const levels = ['Level 1', 'Level 2', 'Level 3', 'Level 4'];
  const levelColor = [CK_COLORS.safe1, CK_COLORS.safe2, CK_COLORS.safe3, CK_COLORS.safe4];
  const toggleId = 'safety-breakdown-toggle';

  return (
    <div style={{ fontFamily: "'IBM Plex Sans'" }}>
      {/* The :checked CSS trick — CSS injected inline below */}
      <style>{`
        #${toggleId} { display: none; }
        #${toggleId} ~ .sp-expanded { display: none; }
        #${toggleId}:checked ~ .sp-expanded { display: block; }
        #${toggleId} ~ label .sp-chev { transition: transform .15s; display: inline-block; }
        #${toggleId}:checked ~ label .sp-chev { transform: rotate(180deg); }
        #${toggleId} ~ label .sp-lbl-show { display: inline; }
        #${toggleId} ~ label .sp-lbl-hide { display: none; }
        #${toggleId}:checked ~ label .sp-lbl-show { display: none; }
        #${toggleId}:checked ~ label .sp-lbl-hide { display: inline; }
      `}</style>

      {/* Combined badge */}
      <div style={{ background: CK_COLORS.surface, border: `1px solid ${CK_COLORS.border}`, borderRadius: 6, padding: '20px 22px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <div style={{
            width: 64, height: 64, borderRadius: 4,
            background: data.combined.color, color: '#FFF',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: "'IBM Plex Serif'", fontSize: 28, fontWeight: 500, flexShrink: 0,
          }}>{data.combined.level}</div>
          <div style={{ flex: 1 }}>
            <CKEyebrow>Combined advisory · most-cautious-wins</CKEyebrow>
            <div style={{ fontFamily: "'IBM Plex Serif'", fontSize: 22, fontWeight: 500, color: CK_COLORS.ink, letterSpacing: '-0.005em', marginTop: 4 }}>
              {data.combined.label}
            </div>
            <div style={{ fontSize: 12, color: CK_COLORS.inkMuted, marginTop: 4, fontFamily: "'IBM Plex Mono'" }}>
              Highest level across 5 governments · Updated {data.lastUpdated}
            </div>
          </div>
        </div>

        <input type="checkbox" id={toggleId} />
        <label htmlFor={toggleId} style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          marginTop: 16, fontSize: 13, fontWeight: 500, color: CK_COLORS.accent,
          cursor: 'pointer', userSelect: 'none',
        }}>
          <span className="sp-lbl-show">See breakdown by country</span>
          <span className="sp-lbl-hide">Hide breakdown</span>
          <svg className="sp-chev" width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
        </label>

        <div className="sp-expanded" style={{ marginTop: 18, paddingTop: 18, borderTop: `1px solid ${CK_COLORS.border}` }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10 }}>
            {data.sources.map(s => (
              <div key={s.gov} style={{ border: `1px solid ${CK_COLORS.border}`, borderRadius: 4, padding: '12px 14px', background: '#FCFBF8' }}>
                <div style={{ fontSize: 11, color: CK_COLORS.inkMuted, fontFamily: "'IBM Plex Mono'", marginBottom: 6 }}>{s.gov}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <div style={{ width: 26, height: 26, borderRadius: 3, background: levelColor[s.level-1], color: '#FFF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 600, fontFamily: "'IBM Plex Mono'" }}>{s.level}</div>
                  <div style={{ fontSize: 10.5, fontWeight: 600, color: levelColor[s.level-1] }}>{levels[s.level-1]}</div>
                </div>
                <div style={{ fontSize: 11.5, color: CK_COLORS.ink, lineHeight: 1.35, minHeight: 32 }}>{s.label}</div>
                <div style={{ fontSize: 10, color: CK_COLORS.inkSubtle, fontFamily: "'IBM Plex Mono'", marginTop: 8, paddingTop: 8, borderTop: `1px dotted ${CK_COLORS.border}` }}>
                  <div>{s.date}</div>
                  <div style={{ color: CK_COLORS.accent, marginTop: 2, wordBreak: 'break-all' }}>{s.url}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
window.SafetyPanel = SafetyPanel;

// ─── Month accordion (native <details>, works with no JS) ─────────
function MonthAccordion({ months, notes, climate, slug, openMonth = 'Jun' }) {
  return (
    <div style={{ border: `1px solid ${CK_COLORS.border}`, borderRadius: 6, overflow: 'hidden', background: CK_COLORS.surface }}>
      {months.map((m, i) => (
        <details key={m} open={m === openMonth} style={{
          borderBottom: i === months.length - 1 ? 'none' : `1px solid ${CK_COLORS.border}`,
        }}>
          <summary style={{
            padding: '16px 22px', cursor: 'pointer', listStyle: 'none',
            display: 'grid', gridTemplateColumns: '80px 1fr 120px 120px 60px', gap: 16,
            alignItems: 'center', fontFamily: "'IBM Plex Sans'",
          }}>
            <div style={{ fontFamily: "'IBM Plex Serif'", fontSize: 18, fontWeight: 500, color: CK_COLORS.ink }}>{m}</div>
            <div style={{ fontSize: 13, color: CK_COLORS.inkMuted, lineHeight: 1.4 }}>{notes[m]}</div>
            <div style={{ fontSize: 12, fontFamily: "'IBM Plex Mono'", color: CK_COLORS.ink }}>
              {climate.t[i].toFixed(0)}°C avg
            </div>
            <div style={{ fontSize: 12, fontFamily: "'IBM Plex Mono'", color: CK_COLORS.ink }}>
              {climate.r[i]}mm rain
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', color: CK_COLORS.accent }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
            </div>
          </summary>
          <div style={{ padding: '0 22px 20px 122px', fontFamily: "'IBM Plex Sans'" }}>
            <div style={{ fontSize: 13.5, color: CK_COLORS.ink, lineHeight: 1.55, marginBottom: 14, maxWidth: 720 }}>
              {notes[m]} Average {climate.t[i].toFixed(1)}°C with {climate.r[i]}mm rainfall and {climate.s[i].toFixed(1)}h of sunshine per day. Range {climate.tMin[i]}°C to {climate.tMax[i]}°C (10th / 90th percentile).
            </div>
            <div style={{ display: 'flex', gap: 24, fontSize: 12, color: CK_COLORS.inkMuted, fontFamily: "'IBM Plex Mono'", marginBottom: 16 }}>
              <span>Temp <span style={{ color: CK_COLORS.ink }}>{climate.t[i].toFixed(1)}°C</span></span>
              <span>Rain <span style={{ color: CK_COLORS.ink }}>{climate.r[i]}mm</span></span>
              <span>Sun <span style={{ color: CK_COLORS.ink }}>{climate.s[i].toFixed(1)}h/d</span></span>
              <span>Wind <span style={{ color: CK_COLORS.ink }}>{climate.w[i].toFixed(1)}km/h</span></span>
              <span>Humidity <span style={{ color: CK_COLORS.ink }}>{climate.hum[i]}%</span></span>
            </div>
            <a href={`/${slug}/${m.toLowerCase()}`} style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              color: CK_COLORS.accent, fontSize: 13, fontWeight: 500, textDecoration: 'none',
            }}>
              Read the full {m} guide for {slug[0].toUpperCase() + slug.slice(1)}
              <span>→</span>
            </a>
          </div>
        </details>
      ))}
    </div>
  );
}
window.MonthAccordion = MonthAccordion;

// ─── Related countries ────────────────────────────────────────────
function RelatedGrid({ items }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 12 }}>
      {items.map(c => (
        <a key={c.slug} href={`/${c.slug}`} style={{
          display: 'block', background: CK_COLORS.surface, border: `1px solid ${CK_COLORS.border}`,
          borderRadius: 4, padding: '16px 16px', textDecoration: 'none', color: CK_COLORS.ink,
          fontFamily: "'IBM Plex Sans'",
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <div style={{ fontFamily: "'IBM Plex Serif'", fontSize: 18, fontWeight: 500, letterSpacing: '-0.005em' }}>{c.name}</div>
            <ScoreBadge score={c.score} size="sm" />
          </div>
          <div style={{ fontSize: 12, color: CK_COLORS.inkMuted, lineHeight: 1.4, minHeight: 34 }}>{c.sub}</div>
          <div style={{ fontSize: 11, color: CK_COLORS.accent, marginTop: 10, fontFamily: "'IBM Plex Mono'" }}>View /{c.slug} →</div>
        </a>
      ))}
    </div>
  );
}
window.RelatedGrid = RelatedGrid;

// ─── Page shell ───────────────────────────────────────────────────
function CKPageHeader() {
  return (
    <div style={{ height: 56, background: CK_COLORS.surface, borderBottom: `1px solid ${CK_COLORS.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 40px', fontFamily: "'IBM Plex Sans'", color: CK_COLORS.ink }}>
      <a href="/" style={{ display: 'flex', alignItems: 'center', gap: 14, textDecoration: 'none', color: 'inherit' }}>
        <div style={{ width: 26, height: 26, borderRadius: 4, background: CK_COLORS.ink, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="4" fill="#E0C98A"/><circle cx="12" cy="12" r="9" stroke="#E0C98A" strokeWidth="1.5" strokeDasharray="2 3"/></svg>
        </div>
        <div style={{ fontSize: 14, fontWeight: 600, letterSpacing: '-0.005em' }}>Where to Go for Great Weather</div>
      </a>
      <nav style={{ display: 'flex', alignItems: 'center', gap: 22, fontSize: 13, color: CK_COLORS.inkMuted }}>
        <a href="/map" style={{ color: 'inherit', textDecoration: 'none' }}>Map</a>
        <a href="/countries" style={{ color: CK_COLORS.ink, fontWeight: 500, textDecoration: 'none' }}>Countries</a>
        <a href="/pricing" style={{ color: 'inherit', textDecoration: 'none' }}>Pricing</a>
        <a href="/agencies" style={{ color: 'inherit', textDecoration: 'none' }}>Agencies</a>
        <a href="/signin" style={{ padding: '6px 12px', border: `1px solid ${CK_COLORS.border}`, borderRadius: 4, color: CK_COLORS.ink, textDecoration: 'none' }}>Sign in</a>
      </nav>
    </div>
  );
}
window.CKPageHeader = CKPageHeader;

function CKPageFooter() {
  const groups = [
    { title: 'Product',   items: ['Map', 'Countries A–Z', 'Pricing', 'For agencies', 'Changelog'] },
    { title: 'By region', items: ['Europe', 'Asia', 'Americas', 'Africa', 'Oceania'] },
    { title: 'By season', items: ['January', 'April', 'July', 'October', 'See all months'] },
    { title: 'Company',   items: ['About', 'Methodology', 'Data sources', 'Privacy', 'Terms'] },
  ];
  return (
    <footer style={{ background: CK_COLORS.surface, borderTop: `1px solid ${CK_COLORS.border}`, padding: '48px 40px 32px', fontFamily: "'IBM Plex Sans'" }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr repeat(4, 1fr)', gap: 40, marginBottom: 32 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            <div style={{ width: 26, height: 26, borderRadius: 4, background: CK_COLORS.ink, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="4" fill="#E0C98A"/><circle cx="12" cy="12" r="9" stroke="#E0C98A" strokeWidth="1.5" strokeDasharray="2 3"/></svg>
            </div>
            <div style={{ fontSize: 14, fontWeight: 600 }}>Atlas Weather</div>
          </div>
          <div style={{ fontSize: 12, color: CK_COLORS.inkMuted, lineHeight: 1.55, maxWidth: 280 }}>
            Plan trips around the weather you actually like. Built on ECMWF ERA5 and five government travel advisories.
          </div>
        </div>
        {groups.map(g => (
          <div key={g.title}>
            <CKEyebrow>{g.title}</CKEyebrow>
            <ul style={{ listStyle: 'none', padding: 0, margin: '12px 0 0', display: 'flex', flexDirection: 'column', gap: 8 }}>
              {g.items.map(i => (
                <li key={i}><a href="#" style={{ fontSize: 13, color: CK_COLORS.inkMuted, textDecoration: 'none' }}>{i}</a></li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 20, borderTop: `1px solid ${CK_COLORS.border}`, fontSize: 11, color: CK_COLORS.inkSubtle, fontFamily: "'IBM Plex Mono'" }}>
        <div>© 2026 Atlas Weather · Made with boring, audited data.</div>
        <div style={{ display: 'flex', gap: 18 }}>
          <span>Climate: ECMWF ERA5</span>
          <span>Advisories: US · UK · CA · AU · DE</span>
          <span>Boundaries: GADM v4.1</span>
        </div>
      </div>
    </footer>
  );
}
window.CKPageFooter = CKPageFooter;
