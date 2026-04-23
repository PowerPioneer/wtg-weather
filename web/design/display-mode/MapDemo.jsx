/* global React, window */
// Airy-variation map backdrop — but using the new VARIABLES catalog.
// Supports a `fading` prop for the crossfade demo.

const { useState: useMapDemoState, useEffect: useMapDemoEffect } = React;

// Per-variable bin index for each country (cycled/hand-tuned).
const COUNTRY_BINS = {
  // id: { preferences, temperature, rainfall, sunshine, wind, safety, snow, sst, heat, humidity }
  CA: { preferences: 3, temperature: 0, rainfall: 1, sunshine: 1, wind: 2, safety: 0, snow: 4, sst: 0, heat: 0, humidity: 1 },
  US: { preferences: 1, temperature: 2, rainfall: 2, sunshine: 2, wind: 2, safety: 0, snow: 2, sst: 2, heat: 2, humidity: 2 },
  MX: { preferences: 2, temperature: 3, rainfall: 3, sunshine: 3, wind: 1, safety: 1, snow: 0, sst: 3, heat: 3, humidity: 3 },
  BR: { preferences: 2, temperature: 4, rainfall: 4, sunshine: 3, wind: 1, safety: 1, snow: 0, sst: 4, heat: 4, humidity: 4 },
  AR: { preferences: 0, temperature: 2, rainfall: 1, sunshine: 2, wind: 3, safety: 0, snow: 1, sst: 2, heat: 1, humidity: 2 },
  PE: { preferences: 0, temperature: 1, rainfall: 2, sunshine: 2, wind: 2, safety: 1, snow: 2, sst: 2, heat: 1, humidity: 2 },
  UK: { preferences: 2, temperature: 1, rainfall: 2, sunshine: 1, wind: 3, safety: 0, snow: 1, sst: 1, heat: 0, humidity: 3 },
  FR: { preferences: 1, temperature: 2, rainfall: 1, sunshine: 2, wind: 2, safety: 0, snow: 1, sst: 2, heat: 1, humidity: 2 },
  ES: { preferences: 0, temperature: 2, rainfall: 1, sunshine: 3, wind: 2, safety: 0, snow: 0, sst: 3, heat: 2, humidity: 2 },
  DE: { preferences: 2, temperature: 1, rainfall: 2, sunshine: 1, wind: 2, safety: 0, snow: 2, sst: 1, heat: 0, humidity: 3 },
  IT: { preferences: 0, temperature: 2, rainfall: 1, sunshine: 3, wind: 1, safety: 0, snow: 1, sst: 3, heat: 2, humidity: 2 },
  EG: { preferences: 2, temperature: 4, rainfall: 0, sunshine: 4, wind: 2, safety: 2, snow: 0, sst: 3, heat: 4, humidity: 1 },
  SA: { preferences: 3, temperature: 4, rainfall: 0, sunshine: 4, wind: 2, safety: 2, snow: 0, sst: 4, heat: 4, humidity: 0 },
  IN: { preferences: 1, temperature: 3, rainfall: 3, sunshine: 3, wind: 2, safety: 1, snow: 0, sst: 4, heat: 3, humidity: 3 },
  CN: { preferences: 2, temperature: 2, rainfall: 2, sunshine: 2, wind: 2, safety: 1, snow: 1, sst: 2, heat: 2, humidity: 2 },
  JP: { preferences: 0, temperature: 2, rainfall: 2, sunshine: 2, wind: 2, safety: 0, snow: 2, sst: 2, heat: 1, humidity: 3 },
  AU: { preferences: 1, temperature: 3, rainfall: 1, sunshine: 3, wind: 3, safety: 0, snow: 0, sst: 3, heat: 3, humidity: 2 },
  ID: { preferences: 2, temperature: 3, rainfall: 4, sunshine: 2, wind: 1, safety: 1, snow: 0, sst: 4, heat: 3, humidity: 4 },
  ZA: { preferences: 0, temperature: 2, rainfall: 1, sunshine: 3, wind: 2, safety: 0, snow: 0, sst: 3, heat: 2, humidity: 2 },
  KE: { preferences: 1, temperature: 2, rainfall: 2, sunshine: 2, wind: 2, safety: 1, snow: 0, sst: 3, heat: 2, humidity: 3 },
  MA: { preferences: 0, temperature: 2, rainfall: 0, sunshine: 3, wind: 2, safety: 0, snow: 0, sst: 2, heat: 2, humidity: 1 },
  TR: { preferences: 0, temperature: 2, rainfall: 1, sunshine: 3, wind: 2, safety: 0, snow: 1, sst: 2, heat: 2, humidity: 2 },
  RU: { preferences: 3, temperature: 0, rainfall: 1, sunshine: 1, wind: 2, safety: 2, snow: 4, sst: 0, heat: 0, humidity: 2 },
  NO: { preferences: 3, temperature: 0, rainfall: 2, sunshine: 1, wind: 3, safety: 0, snow: 3, sst: 0, heat: 0, humidity: 3 },
  TH: { preferences: 1, temperature: 3, rainfall: 3, sunshine: 2, wind: 1, safety: 0, snow: 0, sst: 4, heat: 3, humidity: 4 },
  VN: { preferences: 1, temperature: 3, rainfall: 3, sunshine: 2, wind: 1, safety: 0, snow: 0, sst: 4, heat: 3, humidity: 4 },
  NZ: { preferences: 0, temperature: 1, rainfall: 2, sunshine: 2, wind: 3, safety: 0, snow: 2, sst: 1, heat: 0, humidity: 3 },
  IS: { preferences: 3, temperature: 0, rainfall: 2, sunshine: 1, wind: 4, safety: 0, snow: 3, sst: 0, heat: 0, humidity: 3 },
  GR: { preferences: 3, temperature: 0, rainfall: 1, sunshine: 1, wind: 3, safety: 0, snow: 4, sst: 0, heat: 0, humidity: 2 },
};

function paletteFor(v, binIdx) {
  if (v.kind === 'qualitative' || v.kind === 'ordinal-safety') {
    return v.legend.bins[binIdx]?.hex;
  }
  return v.legend.ramp[binIdx];
}

function MapCanvas({ variableId, width = 820, height = 420, water = '#E4E8EC', bg = '#EFE9DB' }) {
  const v = window.VARIABLES[variableId];
  const countries = window.MAP_COUNTRIES;
  const oceanOnly = v.landMode === 'dimmed'; // SST mode

  return (
    <svg viewBox="60 40 820 420" style={{ width: '100%', height: '100%', display: 'block', background: water }}>
      <defs>
        <pattern id={`grat-${variableId}`} x="0" y="0" width="40" height="40" patternUnits="userSpaceOnUse">
          <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#0F1B2D" strokeOpacity="0.05" strokeWidth="0.5"/>
        </pattern>
      </defs>
      <rect x="60" y="40" width="820" height="420" fill={`url(#grat-${variableId})`} />
      {/* Land backdrop */}
      <g fill={oceanOnly ? '#ECEAE3' : bg} stroke="#0F1B2D" strokeOpacity={oceanOnly ? 0.08 : 0.22} strokeWidth="0.75">
        <path d="M70,70 L400,70 L410,200 L380,270 L340,310 L395,320 L410,420 L330,440 L280,410 L180,270 L80,180 Z" />
        <path d="M420,115 L810,120 L820,250 L700,260 L660,330 L605,345 L580,410 L520,430 L495,380 L460,330 L435,265 L430,170 Z" />
        <path d="M505,270 L630,275 L660,370 L580,430 L510,420 L490,350 Z" opacity="0.9" />
        <path d="M720,360 L870,370 L855,440 L740,430 Z" />
      </g>
      {/* Country polygons */}
      <g>
        {countries.map((c) => {
          const bins = COUNTRY_BINS[c.id] || {};
          const binIdx = bins[variableId] ?? 2;
          const fill = oceanOnly ? '#D9D5C8' : (paletteFor(v, binIdx) || '#ccc');
          return (
            <path key={c.id} d={c.d} fill={fill} opacity={oceanOnly ? 0.4 : 1}
              stroke="#0F1B2D" strokeOpacity={oceanOnly ? 0.1 : 0.35} strokeWidth="0.6" />
          );
        })}
      </g>
      {/* SST mode — decorative ocean temp halos */}
      {oceanOnly && (
        <g opacity="0.55">
          <ellipse cx="260" cy="360" rx="140" ry="50" fill="#D97A4E" opacity="0.35" />
          <ellipse cx="580" cy="370" rx="160" ry="55" fill="#5A93C7" opacity="0.3" />
          <ellipse cx="750" cy="330" rx="140" ry="45" fill="#7A2E2E" opacity="0.25" />
          <ellipse cx="450" cy="200" rx="100" ry="35" fill="#1C4270" opacity="0.3" />
        </g>
      )}
    </svg>
  );
}

// Crossfade wrapper — shows prev layer at opacity (1-t), next at opacity t
function CrossfadeMap({ variableId, durationMs = 250, width, height }) {
  const [prev, setPrev] = useMapDemoState(variableId);
  const [t, setT] = useMapDemoState(1); // 1 = showing current fully
  useMapDemoEffect(() => {
    if (variableId === prev) return;
    // start transition
    setT(0);
    const start = performance.now();
    let raf;
    const step = (now) => {
      const progress = Math.min(1, (now - start) / durationMs);
      setT(progress);
      if (progress < 1) raf = requestAnimationFrame(step);
      else setPrev(variableId);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [variableId]);

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <div style={{ position: 'absolute', inset: 0, opacity: 1 - t }}>
        <MapCanvas variableId={prev} width={width} height={height} />
      </div>
      <div style={{ position: 'absolute', inset: 0, opacity: t }}>
        <MapCanvas variableId={variableId} width={width} height={height} />
      </div>
    </div>
  );
}

window.MapCanvas = MapCanvas;
window.CrossfadeMap = CrossfadeMap;
