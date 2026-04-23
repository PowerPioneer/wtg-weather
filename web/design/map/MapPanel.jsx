/* global React, window */
// Shared, lightweight map + legend + layer engine used by all three variations.
// Exposes: window.MapSurface, window.LegendRamp, window.useMapState

const { useState, useMemo, useEffect } = React;

function useMapState() {
  const [layer, setLayer] = useState('preferences');
  const [month, setMonth] = useState(3); // April
  const [hovered, setHovered] = useState(null);
  const [selected, setSelected] = useState(null);
  const [showUpsell, setShowUpsell] = useState(false);
  return { layer, setLayer, month, setMonth, hovered, setHovered, selected, setSelected, showUpsell, setShowUpsell };
}

function MapSurface({ state, bg = '#EFE9DB', water = '#DED6BF', stroke = '#0F1B2D', strokeOpacity = 0.22, compact = false }) {
  const layer = window.MAP_LAYERS[state.layer];
  const countries = window.MAP_COUNTRIES;

  const fillFor = (c) => {
    const idx = c.b[state.layer];
    return layer.bins[idx]?.hex || '#ccc';
  };

  return (
    <svg viewBox="60 40 820 420" style={{ width: '100%', height: '100%', display: 'block', background: water }}>
      {/* Subtle graticule */}
      <defs>
        <pattern id="grat" x="0" y="0" width="40" height="40" patternUnits="userSpaceOnUse">
          <path d="M 40 0 L 0 0 0 40" fill="none" stroke={stroke} strokeOpacity="0.05" strokeWidth="0.5"/>
        </pattern>
      </defs>
      <rect x="60" y="40" width="820" height="420" fill="url(#grat)" />
      {/* Land backdrop (a single blob for continents for the purposes of mock) */}
      <g fill={bg} stroke={stroke} strokeOpacity={strokeOpacity} strokeWidth="0.75">
        <path d="M70,70 L400,70 L410,200 L380,270 L340,310 L395,320 L410,420 L330,440 L280,410 L180,270 L80,180 Z" />
        <path d="M420,115 L810,120 L820,250 L700,260 L660,330 L605,345 L580,410 L520,430 L495,380 L460,330 L435,265 L430,170 Z" />
        <path d="M505,270 L630,275 L660,370 L580,430 L510,420 L490,350 Z" opacity="0.9" />
        <path d="M720,360 L870,370 L855,440 L740,430 Z" />
        <path d="M860,420 L885,422 L880,445 L863,442 Z" />
      </g>
      {/* Country polygons coloured by active layer */}
      <g>
        {countries.map((c) => {
          const isHover = state.hovered === c.id;
          const isSel = state.selected === c.id;
          return (
            <path
              key={c.id}
              d={c.d}
              fill={fillFor(c)}
              stroke={isSel ? '#0F1B2D' : (isHover ? '#0F1B2D' : stroke)}
              strokeOpacity={isSel ? 1 : (isHover ? 0.8 : 0.35)}
              strokeWidth={isSel ? 1.5 : (isHover ? 1 : 0.6)}
              style={{ cursor: 'pointer', transition: 'stroke-opacity .15s' }}
              onMouseEnter={() => state.setHovered(c.id)}
              onMouseLeave={() => state.setHovered(null)}
              onClick={() => state.setSelected(c.id)}
            />
          );
        })}
      </g>
      {/* Hovered country label */}
      {state.hovered && !compact && (() => {
        const c = countries.find(x => x.id === state.hovered);
        if (!c) return null;
        const bin = layer.bins[c.b[state.layer]];
        return (
          <g style={{ pointerEvents: 'none' }}>
            <rect x={c.cx + 8} y={c.cy - 22} rx="3" ry="3" width={Math.max(110, c.name.length * 7)} height="36"
                  fill="#0F1B2D" opacity="0.94" />
            <text x={c.cx + 16} y={c.cy - 8} fill="#fff" fontSize="11" fontFamily="'IBM Plex Sans', system-ui" fontWeight="500">
              {c.name}
            </text>
            <text x={c.cx + 16} y={c.cy + 6} fill={bin.hex} fontSize="10" fontFamily="'IBM Plex Mono', monospace">
              {bin.label}
            </text>
          </g>
        );
      })()}
    </svg>
  );
}

function LegendRamp({ state, variant = 'default' }) {
  const layer = window.MAP_LAYERS[state.layer];
  const kind = layer.kind;

  // Qualitative layouts (preferences) → discrete pills
  if (kind === 'qualitative' || variant === 'pills') {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        background: '#FFFFFF',
        border: '1px solid #D9D5C8',
        borderRadius: 10,
        padding: '8px 10px',
        boxShadow: '0 1px 2px rgba(15,27,45,0.06), 0 1px 3px rgba(15,27,45,0.06)',
        fontFamily: "'IBM Plex Sans', system-ui",
      }}>
        <div style={{ fontSize: 10, letterSpacing: '0.12em', color: '#4A5568', fontWeight: 500, textTransform: 'uppercase', paddingRight: 4, borderRight: '1px solid #D9D5C8' }}>
          {layer.legendTitle}
        </div>
        {layer.bins.map((b) => (
          <div key={b.label} style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '4px 10px',
            background: b.hex, color: b.fg,
            borderRadius: 4, fontSize: 12, fontWeight: 500, letterSpacing: '0.01em',
          }}>{b.label}</div>
        ))}
      </div>
    );
  }

  // Sequential / diverging / ordinal → continuous ramp with tick labels
  return (
    <div style={{
      background: '#FFFFFF',
      border: '1px solid #D9D5C8',
      borderRadius: 10,
      padding: '10px 14px',
      boxShadow: '0 1px 2px rgba(15,27,45,0.06), 0 1px 3px rgba(15,27,45,0.06)',
      fontFamily: "'IBM Plex Sans', system-ui",
      minWidth: 360,
    }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 6 }}>
        <div style={{ fontSize: 10, letterSpacing: '0.12em', color: '#4A5568', fontWeight: 500, textTransform: 'uppercase' }}>
          {layer.legendTitle}
        </div>
        <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: '#6B7280' }}>
          {layer.legendSub}
        </div>
      </div>
      <div style={{ display: 'flex', borderRadius: 4, overflow: 'hidden', border: '1px solid #D9D5C8' }}>
        {layer.bins.map((b) => (
          <div key={b.label} style={{
            flex: 1, background: b.hex, height: 16,
          }} />
        ))}
      </div>
      <div style={{ display: 'flex', marginTop: 4 }}>
        {layer.bins.map((b) => (
          <div key={b.label} style={{
            flex: 1, textAlign: 'center',
            fontFamily: "'IBM Plex Mono', monospace",
            fontSize: 10.5, color: '#0F1B2D',
          }}>{b.label}</div>
        ))}
      </div>
    </div>
  );
}

function PremiumUpsell({ onDismiss, variant = 'inline' }) {
  const body = (
    <>
      <div style={{ fontSize: 10, letterSpacing: '0.14em', color: '#B8763E', fontWeight: 600, textTransform: 'uppercase' }}>
        Premium
      </div>
      <div style={{ fontFamily: "'IBM Plex Serif', serif", fontSize: 20, fontWeight: 500, color: '#0F1B2D', marginTop: 4, lineHeight: 1.25 }}>
        Zoom into region-level climate
      </div>
      <div style={{ fontSize: 13, color: '#4A5568', marginTop: 6, lineHeight: 1.5 }}>
        Admin-2 detail — see Cusco vs Lima, not just Peru. Plus percentile bands, saved trips, and no ads for €2.99/mo.
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
        <button style={{
          background: '#0F1B2D', color: '#fff', border: 'none', borderRadius: 4,
          padding: '8px 14px', fontSize: 13, fontWeight: 500, cursor: 'pointer',
          fontFamily: "'IBM Plex Sans', system-ui",
        }}>Try Premium</button>
        <button onClick={onDismiss} style={{
          background: 'transparent', color: '#4A5568', border: 'none',
          padding: '8px 10px', fontSize: 13, fontWeight: 500, cursor: 'pointer',
          fontFamily: "'IBM Plex Sans', system-ui",
        }}>Not now</button>
      </div>
    </>
  );
  return (
    <div style={{
      background: '#FFFFFF', border: '1px solid #D9D5C8', borderRadius: 8,
      padding: 16, width: 320,
      boxShadow: '0 12px 24px rgba(15,27,45,0.08), 0 24px 48px rgba(15,27,45,0.08)',
    }}>
      {body}
    </div>
  );
}

Object.assign(window, { MapSurface, LegendRamp, PremiumUpsell, useMapState });
