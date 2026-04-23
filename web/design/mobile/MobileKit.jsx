/* global React, window */
// Mobile map kit — shared chrome, sheets, map. Uses desktop's MAP_LAYERS + MAP_COUNTRIES.

const { useState: useMS } = React;

// ─── Compact stylised map for mobile (tighter viewBox, no hover labels) ──
function MobileMapSurface({ layerId, dark = false }) {
  const layer = window.MAP_LAYERS[layerId];
  const countries = window.MAP_COUNTRIES;
  const fillFor = (c) => layer.bins[c.b[layerId] || 0]?.hex || '#ccc';

  const bg = dark ? '#1E2A3D' : '#EFE9DB';
  const water = dark ? '#0B1420' : '#E4E8EC';
  const stroke = dark ? '#FFFFFF' : '#0F1B2D';
  const sop = dark ? 0.18 : 0.22;

  // Viewbox focused on Europe/Africa + Americas for good mobile framing
  return (
    <svg viewBox="100 60 750 400" preserveAspectRatio="xMidYMid slice" style={{ width: '100%', height: '100%', display: 'block', background: water }}>
      <defs>
        <pattern id="gratM" x="0" y="0" width="40" height="40" patternUnits="userSpaceOnUse">
          <path d="M 40 0 L 0 0 0 40" fill="none" stroke={stroke} strokeOpacity={dark ? 0.04 : 0.05} strokeWidth="0.5"/>
        </pattern>
      </defs>
      <rect x="60" y="40" width="820" height="420" fill="url(#gratM)" />
      <g fill={bg} stroke={stroke} strokeOpacity={sop} strokeWidth="0.75">
        <path d="M70,70 L400,70 L410,200 L380,270 L340,310 L395,320 L410,420 L330,440 L280,410 L180,270 L80,180 Z" />
        <path d="M420,115 L810,120 L820,250 L700,260 L660,330 L605,345 L580,410 L520,430 L495,380 L460,330 L435,265 L430,170 Z" />
        <path d="M505,270 L630,275 L660,370 L580,430 L510,420 L490,350 Z" opacity="0.9" />
        <path d="M720,360 L870,370 L855,440 L740,430 Z" />
      </g>
      <g>
        {countries.map(c => (
          <path key={c.id} d={c.d} fill={fillFor(c)} stroke={stroke} strokeOpacity={0.35} strokeWidth={0.6} />
        ))}
      </g>
      {/* pinned selected country = Peru, for the peek sheet scenario */}
      {(() => {
        const pe = countries.find(c => c.id === 'PE');
        return <circle cx={pe.cx} cy={pe.cy} r={6} fill="#0F1B2D" stroke="#FFFFFF" strokeWidth={2} />;
      })()}
    </svg>
  );
}

// ─── Status bar ───────────────────────────────────────────────────
function MobileStatusBar({ dark = false }) {
  return (
    <div style={{
      height: 44, background: dark ? 'rgba(15,27,45,0.92)' : 'rgba(255,255,255,0.92)',
      backdropFilter: 'blur(10px)',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '0 24px', fontSize: 14, fontWeight: 600,
      color: dark ? '#F7F6F2' : '#0F1B2D',
      fontFamily: "'IBM Plex Sans'", flexShrink: 0,
    }}>
      <span>10:44</span>
      <span style={{ fontFamily: "'IBM Plex Mono'", fontSize: 11, letterSpacing: '0.02em' }}>●●●●● 5G 71%</span>
    </div>
  );
}

// ─── Top bar ──────────────────────────────────────────────────────
function MobileTopBar({ floating = false, dark = false }) {
  const bg = floating
    ? (dark ? 'rgba(15,27,45,0.88)' : 'rgba(255,255,255,0.88)')
    : (dark ? '#0F1B2D' : '#FFFFFF');
  const color = dark ? '#F7F6F2' : '#0F1B2D';
  return (
    <div style={{
      height: 48, background: bg, backdropFilter: 'blur(12px)',
      borderBottom: floating ? 'none' : (dark ? '1px solid rgba(255,255,255,0.08)' : '1px solid #ECEAE3'),
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '0 14px', color, flexShrink: 0,
      fontFamily: "'IBM Plex Sans'",
      ...(floating ? { position: 'absolute', top: 44, left: 10, right: 10, borderRadius: 10, border: dark ? '1px solid rgba(255,255,255,0.1)' : '1px solid rgba(15,27,45,0.08)', zIndex: 5, boxShadow: '0 2px 10px rgba(15,27,45,0.12)' } : {}),
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
        <div style={{ width: 26, height: 26, borderRadius: 5, background: '#0F1B2D', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="4" fill="#E0C98A"/><circle cx="12" cy="12" r="9" stroke="#E0C98A" strokeWidth="1.5" strokeDasharray="2 3"/></svg>
        </div>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, letterSpacing: '-0.01em' }}>Atlas</div>
        </div>
      </div>
      <button aria-label="Menu" style={{ width: 36, height: 36, background: 'transparent', border: 'none', color, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>
      </button>
    </div>
  );
}

// ─── FAB ──────────────────────────────────────────────────────────
function FAB({ icon, label, active, onClick, variant = 'round', showLabel = false }) {
  const round = variant === 'round';
  return (
    <button onClick={onClick} aria-label={label} style={{
      width: 48, height: 48, borderRadius: round ? 24 : 10,
      background: active ? '#0F1B2D' : '#FFFFFF',
      color: active ? '#FFFFFF' : '#0F1B2D',
      border: '1px solid ' + (active ? '#0F1B2D' : '#D9D5C8'),
      boxShadow: '0 2px 8px rgba(15,27,45,0.14)',
      cursor: 'pointer',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      flexDirection: 'column', gap: 1, padding: 0,
      fontFamily: "'IBM Plex Sans'", flexShrink: 0,
    }}>
      {icon}
      {showLabel && <div style={{ fontSize: 8.5, fontWeight: 500, letterSpacing: '0.02em', marginTop: 1 }}>{label}</div>}
    </button>
  );
}

// mini icons as SVG
const fabIcons = {
  calendar: <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><rect x="4" y="5" width="16" height="16" rx="2" stroke="currentColor" strokeWidth="1.6"/><path d="M4 10h16M9 3v4M15 3v4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></svg>,
  layers: <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M12 3L2 8l10 5 10-5-10-5z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round"/><path d="M2 13l10 5 10-5" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round"/></svg>,
  sliders: <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M4 7h9M17 7h3M4 17h3M11 17h9M4 12h16" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/><circle cx="15" cy="7" r="2" fill="currentColor"/><circle cx="9" cy="17" r="2" fill="currentColor"/></svg>,
};

// ─── Mobile compact legend (continuous collapses to chip) ─────────
function MobileLegend({ layerId, expandedByDefault = false, compact = true }) {
  const [expanded, setExpanded] = useMS(expandedByDefault);
  const layer = window.MAP_LAYERS[layerId];
  const kind = layer.kind;

  // Qualitative / ordinal — fit into 2 rows of pills
  if (kind === 'qualitative' || kind === 'ordinal') {
    return (
      <div style={{
        background: '#FFFFFF', border: '1px solid #D9D5C8', borderRadius: 22,
        padding: '5px 6px 5px 10px',
        boxShadow: '0 2px 8px rgba(15,27,45,0.1)',
        fontFamily: "'IBM Plex Sans'", display: 'flex', alignItems: 'center', gap: 4,
      }}>
        <div style={{ fontSize: 9.5, letterSpacing: '0.12em', color: '#4A5568', fontWeight: 500, textTransform: 'uppercase', paddingRight: 4, borderRight: '1px solid #D9D5C8', marginRight: 2 }}>
          {kind === 'qualitative' ? 'Match' : 'Advisory'}
        </div>
        {layer.bins.map(b => (
          <div key={b.label} title={b.label} style={{
            width: 20, height: 20, borderRadius: 10, background: b.hex,
            backgroundImage: kind === 'ordinal' ? 'repeating-linear-gradient(135deg, rgba(255,255,255,0.1) 0 2px, transparent 2px 5px)' : 'none',
          }} />
        ))}
      </div>
    );
  }

  // Continuous — chip vs expanded
  if (!expanded && compact) {
    return (
      <button onClick={() => setExpanded(true)} style={{
        background: '#FFFFFF', border: '1px solid #D9D5C8', borderRadius: 22,
        padding: '5px 11px 5px 6px', cursor: 'pointer',
        boxShadow: '0 2px 8px rgba(15,27,45,0.1)',
        display: 'flex', alignItems: 'center', gap: 8, fontFamily: "'IBM Plex Sans'",
      }}>
        <div style={{ width: 52, height: 12, borderRadius: 6, display: 'flex', overflow: 'hidden', border: '1px solid rgba(15,27,45,0.08)' }}>
          {layer.bins.map(b => <div key={b.label} style={{ flex: 1, background: b.hex }} />)}
        </div>
        <div style={{ fontSize: 11.5, fontWeight: 500, color: '#0F1B2D' }}>{layer.legendTitle}</div>
        <div style={{ fontFamily: "'IBM Plex Mono'", fontSize: 10, color: '#6B7280' }}>{layer.legendSub.replace('April · ', '')}</div>
      </button>
    );
  }

  // Expanded continuous
  return (
    <div style={{
      background: '#FFFFFF', border: '1px solid #D9D5C8', borderRadius: 10,
      padding: '8px 10px', width: 320,
      boxShadow: '0 2px 10px rgba(15,27,45,0.12)',
      fontFamily: "'IBM Plex Sans'",
    }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 5 }}>
        <div style={{ fontSize: 10, letterSpacing: '0.12em', color: '#4A5568', fontWeight: 500, textTransform: 'uppercase' }}>{layer.legendTitle}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ fontFamily: "'IBM Plex Mono'", fontSize: 10, color: '#6B7280' }}>{layer.legendSub}</div>
          {compact && (
            <button onClick={() => setExpanded(false)} style={{ background: 'transparent', border: 'none', padding: 0, color: '#4A5568', cursor: 'pointer' }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M6 6l12 12M6 18L18 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
            </button>
          )}
        </div>
      </div>
      <div style={{ display: 'flex', borderRadius: 3, overflow: 'hidden', border: '1px solid rgba(15,27,45,0.06)' }}>
        {layer.bins.map(b => <div key={b.label} style={{ flex: 1, height: 12, background: b.hex }} />)}
      </div>
      <div style={{ display: 'flex', marginTop: 3 }}>
        {layer.bins.map(b => (
          <div key={b.label} style={{ flex: 1, textAlign: 'center', fontFamily: "'IBM Plex Mono'", fontSize: 9.5, color: '#0F1B2D' }}>{b.label}</div>
        ))}
      </div>
    </div>
  );
}

// ─── Bottom sheet shell ───────────────────────────────────────────
function Sheet({ title, subtitle, onClose, children, height = 'auto', compactHeader = false, padX = 18 }) {
  return (
    <div style={{
      position: 'absolute', bottom: 0, left: 0, right: 0,
      background: '#FFFFFF',
      borderTopLeftRadius: 16, borderTopRightRadius: 16,
      boxShadow: '0 -8px 24px rgba(15,27,45,0.18)',
      height, maxHeight: '90%',
      display: 'flex', flexDirection: 'column',
      fontFamily: "'IBM Plex Sans'", color: '#0F1B2D',
      zIndex: 30,
    }}>
      <div style={{ display: 'flex', justifyContent: 'center', padding: '8px 0 2px', flexShrink: 0 }}>
        <div style={{ width: 36, height: 4, borderRadius: 2, background: '#D9D5C8' }} />
      </div>
      {title && (
        <div style={{ padding: compactHeader ? `4px ${padX}px 10px` : `8px ${padX}px 14px`, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexShrink: 0 }}>
          <div>
            <div style={{ fontSize: 10, letterSpacing: '0.14em', color: '#4A5568', fontWeight: 500, textTransform: 'uppercase' }}>{title}</div>
            {subtitle && <div style={{ fontFamily: "'IBM Plex Serif'", fontSize: compactHeader ? 16 : 19, fontWeight: 500, marginTop: 2, lineHeight: 1.2 }}>{subtitle}</div>}
          </div>
          {onClose && (
            <button onClick={onClose} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#4A5568', padding: 4 }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M6 6l12 12M6 18L18 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
            </button>
          )}
        </div>
      )}
      <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>{children}</div>
    </div>
  );
}

// ─── Month picker content ─────────────────────────────────────────
function MonthSheetContent({ month = 3, onChange = () => {} }) {
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return (
    <div style={{ padding: '4px 18px 24px' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
        {months.map((m, i) => {
          const active = month === i;
          return (
            <button key={m} onClick={() => onChange(i)} style={{
              height: 52, background: active ? '#0F1B2D' : '#FFFFFF',
              color: active ? '#FFFFFF' : '#0F1B2D',
              border: '1px solid ' + (active ? '#0F1B2D' : '#D9D5C8'),
              borderRadius: 8, fontSize: 14, fontWeight: 500, cursor: 'pointer',
              fontFamily: "'IBM Plex Sans'",
            }}>{m}</button>
          );
        })}
      </div>
      <div style={{ marginTop: 16, fontSize: 11.5, color: '#4A5568', lineHeight: 1.5 }}>
        Selecting a month re-colours every country. Climatology uses a 10-year ERA5 mean.
      </div>
    </div>
  );
}

// ─── Preferences content ──────────────────────────────────────────
function PrefsSheetContent({ autoApply = true }) {
  const sliders = [
    { label: 'Temperature', val: '18° – 28°', lo: 0.35, hi: 0.75, color: '#B8610E' },
    { label: 'Rainfall',    val: '0 – 3 mm/day', lo: 0.0, hi: 0.3, color: '#1C5A8E' },
    { label: 'Sunshine',    val: '6 – 12 h/day', lo: 0.4, hi: 0.95, color: '#B8763E' },
    { label: 'Wind speed',  val: '0 – 25 km/h', lo: 0.0, hi: 0.5, color: '#3D7A6E' },
  ];
  return (
    <div style={{ padding: autoApply ? '4px 18px 24px' : '4px 18px 96px' }}>
      {sliders.map(s => (
        <div key={s.label} style={{ marginBottom: 18 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
            <div style={{ fontSize: 13.5, fontWeight: 500 }}>{s.label}</div>
            <div style={{ fontFamily: "'IBM Plex Mono'", fontSize: 12, color: '#4A5568' }}>{s.val}</div>
          </div>
          <div style={{ position: 'relative', height: 6, background: '#ECEAE3', borderRadius: 3 }}>
            <div style={{ position: 'absolute', left: `${s.lo*100}%`, width: `${(s.hi-s.lo)*100}%`, top: 0, bottom: 0, background: s.color, borderRadius: 3 }} />
            <div style={{ position: 'absolute', left: `${s.lo*100}%`, top: -6, width: 18, height: 18, background: '#FFFFFF', border: `2px solid ${s.color}`, borderRadius: '50%', transform: 'translateX(-50%)', boxShadow: '0 1px 3px rgba(0,0,0,0.15)' }} />
            <div style={{ position: 'absolute', left: `${s.hi*100}%`, top: -6, width: 18, height: 18, background: '#FFFFFF', border: `2px solid ${s.color}`, borderRadius: '50%', transform: 'translateX(-50%)', boxShadow: '0 1px 3px rgba(0,0,0,0.15)' }} />
          </div>
        </div>
      ))}
      <div style={{ marginTop: 18 }}>
        <div style={{ fontSize: 13.5, fontWeight: 500, marginBottom: 9 }}>Acceptable safety level</div>
        <div style={{ display: 'flex', border: '1px solid #D9D5C8', borderRadius: 8, overflow: 'hidden' }}>
          {['Normal', 'Caution', 'Reconsider', 'DNT'].map((lvl, i) => (
            <div key={lvl} style={{ flex: 1, padding: '9px 4px', textAlign: 'center', background: i === 1 ? '#0F1B2D' : '#FFFFFF', color: i === 1 ? '#FFFFFF' : '#0F1B2D', fontSize: 12, fontWeight: 500, borderRight: i < 3 ? '1px solid #D9D5C8' : 'none' }}>{lvl}</div>
          ))}
        </div>
      </div>
      <div style={{ marginTop: 18, padding: '10px 12px', background: '#F7F6F2', border: '1px solid #ECEAE3', borderRadius: 6, fontSize: 11.5, color: '#4A5568', lineHeight: 1.5 }}>
        {autoApply ? (
          <><strong style={{ color: '#0F1B2D' }}>Auto-apply on release</strong> — the map repaints the moment you lift your thumb, with a subtle flash. Fewer taps, more exploration. <span style={{ color: '#B8610E', fontWeight: 500 }}>Recommended.</span></>
        ) : (
          <><strong style={{ color: '#0F1B2D' }}>Staged · tap Apply</strong> — changes sit pending until you commit them. Safer for slow connections but adds friction.</>
        )}
      </div>
    </div>
  );
}

// Sticky Apply CTA (used when autoApply=false)
function StickyApplyBar() {
  return (
    <div style={{
      position: 'absolute', bottom: 0, left: 0, right: 0,
      background: '#FFFFFF', borderTop: '1px solid #ECEAE3',
      padding: '10px 18px 22px', display: 'flex', gap: 8,
      fontFamily: "'IBM Plex Sans'",
    }}>
      <button style={{ flex: 0, background: 'transparent', border: 'none', color: '#4A5568', fontSize: 13, padding: '10px 12px', cursor: 'pointer' }}>Reset</button>
      <button style={{ flex: 1, background: '#0F1B2D', color: '#FFFFFF', border: 'none', borderRadius: 6, padding: '12px', fontSize: 14, fontWeight: 500, cursor: 'pointer' }}>Apply changes</button>
    </div>
  );
}

// ─── Climate drawer peek vs expanded ──────────────────────────────
function ClimatePeekContent() {
  return (
    <div style={{ padding: '4px 18px 20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ width: 38, height: 38, borderRadius: 6, background: '#0B6E5F', color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'IBM Plex Mono'", fontSize: 12, fontWeight: 600, flexShrink: 0 }}>0.94</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 9.5, letterSpacing: '0.14em', color: '#4A5568', fontWeight: 500, textTransform: 'uppercase' }}>Peru · Cusco</div>
          <div style={{ fontFamily: "'IBM Plex Serif'", fontSize: 18, fontWeight: 500, lineHeight: 1.2 }}>Perfect match in April</div>
        </div>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" style={{ color: '#4A5568', flexShrink: 0 }}><path d="m6 15 6-6 6 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
      </div>
      <div style={{ fontSize: 12.5, color: '#4A5568', marginTop: 10, lineHeight: 1.5 }}>
        11°–19°&nbsp;·&nbsp; 5 mm rain/day&nbsp;·&nbsp; 6 h sun.&nbsp; <span style={{ color: '#0F1B2D', fontWeight: 500 }}>Swipe up for full climate →</span>
      </div>
    </div>
  );
}

function ClimateExpandedContent() {
  const months = ['J','F','M','A','M','J','J','A','S','O','N','D'];
  const charts = [
    { title: 'Temperature', unit: '11°–19° in April', kind: 'range', lo: [8,9,10,11,10,8,7,7,8,9,9,8], hi: [18,19,19,19,18,16,15,16,17,18,19,18] },
    { title: 'Rainfall',    unit: '5 mm/day in April', kind: 'bar', data: [9,9,9,5,2,1,1,1,2,4,6,9], color: '#5A93C7', activeColor: '#1C5A8E' },
    { title: 'Sunshine',    unit: '6 h/day in April',  kind: 'bar', data: [4,4,4,6,7,8,9,9,8,6,5,4], color: '#C89844', activeColor: '#8A4A1E' },
  ];
  return (
    <div style={{ padding: '0 0 28px' }}>
      {/* Hero card */}
      <div style={{ padding: '0 18px 14px', borderBottom: '1px solid #ECEAE3', marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 44, height: 44, borderRadius: 6, background: '#0B6E5F', color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'IBM Plex Mono'", fontSize: 14, fontWeight: 600, flexShrink: 0 }}>0.94</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 10, letterSpacing: '0.14em', color: '#4A5568', fontWeight: 500, textTransform: 'uppercase' }}>Peru · Cusco region</div>
            <div style={{ fontFamily: "'IBM Plex Serif'", fontSize: 20, fontWeight: 500, lineHeight: 1.2 }}>Perfect match in April</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6, marginTop: 12, flexWrap: 'wrap' }}>
          {[
            ['Temp', '15°', '#B8610E'],
            ['Rain', '5 mm', '#1C5A8E'],
            ['Sun', '6 h', '#B8763E'],
            ['Safety', 'Caution', '#B8763E'],
          ].map(([k, v, c]) => (
            <div key={k} style={{ padding: '6px 9px', background: '#F7F6F2', border: '1px solid #ECEAE3', borderRadius: 4, fontSize: 11.5 }}>
              <span style={{ color: '#4A5568', letterSpacing: '0.06em', textTransform: 'uppercase', fontSize: 9.5, fontWeight: 500 }}>{k}</span>
              <span style={{ color: c, fontFamily: "'IBM Plex Mono'", fontWeight: 500, marginLeft: 6 }}>{v}</span>
            </div>
          ))}
        </div>
      </div>
      {/* Charts */}
      <div style={{ padding: '0 18px' }}>
        <div style={{ fontSize: 10, letterSpacing: '0.14em', color: '#4A5568', fontWeight: 500, textTransform: 'uppercase', marginBottom: 10 }}>Climate · 10-year ERA5 mean</div>
        {charts.map(c => (
          <div key={c.title} style={{ marginBottom: 14 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 4 }}>
              <div style={{ fontSize: 13, fontWeight: 600 }}>{c.title}</div>
              <div style={{ fontFamily: "'IBM Plex Mono'", fontSize: 10.5, color: '#4A5568' }}>{c.unit}</div>
            </div>
            <svg viewBox="0 0 336 70" width="100%" height="70" style={{ display: 'block' }}>
              {c.kind === 'range' ? (
                <>
                  {/* band */}
                  <path d={`M${c.lo.map((v, i) => `${14+i*28},${60-v*2.3}`).join(' L')} L${c.hi.map((v, i) => `${14+(c.hi.length-1-i)*28},${60-v*2.3}`).reverse().join(' L')} Z`} fill="#B8610E" opacity="0.1" />
                  <polyline points={c.hi.map((v, i) => `${14+i*28},${60-v*2.3}`).join(' ')} fill="none" stroke="#B8610E" strokeWidth="1.5" />
                  <polyline points={c.lo.map((v, i) => `${14+i*28},${60-v*2.3}`).join(' ')} fill="none" stroke="#0072B2" strokeWidth="1.5" />
                  <circle cx={14+3*28} cy={60-c.hi[3]*2.3} r="3" fill="#B8610E" />
                  <circle cx={14+3*28} cy={60-c.lo[3]*2.3} r="3" fill="#0072B2" />
                </>
              ) : (
                c.data.map((v, i) => <rect key={i} x={7+i*28} y={60-v*5.5} width="14" height={v*5.5} fill={i === 3 ? c.activeColor : c.color} rx="1" />)
              )}
              {months.map((m, i) => <text key={i} x={14+i*28} y={68} textAnchor="middle" fontSize="8.5" fontFamily="'IBM Plex Mono'" fill={i === 3 ? '#0F1B2D' : '#8C8A85'} fontWeight={i === 3 ? 600 : 400}>{m}</text>)}
            </svg>
          </div>
        ))}
        <button style={{ width: '100%', marginTop: 8, padding: 12, background: '#0F1B2D', color: '#FFFFFF', border: 'none', borderRadius: 6, fontSize: 13.5, fontWeight: 500, cursor: 'pointer', fontFamily: "'IBM Plex Sans'" }}>Save Cusco, April →</button>
      </div>
    </div>
  );
}

// ─── Dim overlay ─────────────────────────────────────────────────
function Dim({ onClick }) {
  return <div onClick={onClick} style={{ position: 'absolute', inset: 0, background: 'rgba(15,27,45,0.36)', zIndex: 25 }} />;
}

Object.assign(window, {
  MobileMapSurface, MobileStatusBar, MobileTopBar, FAB, fabIcons,
  MobileLegend, Sheet, MonthSheetContent, PrefsSheetContent, StickyApplyBar,
  ClimatePeekContent, ClimateExpandedContent, Dim,
});
