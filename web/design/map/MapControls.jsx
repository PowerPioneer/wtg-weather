/* global React, window */
// Shared UI pieces: climate drawer, preferences form, month selector, display mode toggle.
// Used by all three variations with slightly different styling.

const { useState } = React;

// ─── Climate drawer (right side, on country click) ──────────────────────────
function ClimateDrawer({ state, onClose, isPremium = false, variant = 'default' }) {
  const country = window.MAP_COUNTRIES.find(c => c.id === state.selected);
  if (!country) return null;

  // Fake 12-month data
  const tempMin = [8, 9, 10, 11, 10, 8, 7, 7, 8, 9, 9, 8];
  const tempMax = [18, 19, 19, 19, 18, 16, 15, 16, 17, 18, 19, 18];
  const rain   = [9, 9, 9, 5, 2, 1, 1, 1, 2, 4, 6, 9];
  const sun    = [4, 4, 4, 6, 7, 8, 9, 9, 8, 6, 5, 4];
  const months = window.MONTHS;
  const activeMonth = state.month;

  const isEditorial = variant === 'editorial';
  const displayFont = isEditorial ? "'IBM Plex Serif', serif" : "'IBM Plex Sans', system-ui";

  return (
    <div style={{
      position: 'absolute', top: 0, right: 0, bottom: 0, width: 420,
      background: '#FFFFFF',
      borderLeft: '1px solid #D9D5C8',
      boxShadow: '0 0 32px rgba(15,27,45,0.06)',
      display: 'flex', flexDirection: 'column',
      zIndex: 12,
      fontFamily: "'IBM Plex Sans', system-ui",
    }}>
      {/* Header */}
      <div style={{ padding: '20px 24px', borderBottom: '1px solid #ECEAE3', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: 10, letterSpacing: '0.14em', color: '#4A5568', fontWeight: 500, textTransform: 'uppercase' }}>
            Climate · 10-year ERA5 reanalysis
          </div>
          <div style={{ fontFamily: displayFont, fontSize: isEditorial ? 34 : 26, fontWeight: 500, color: '#0F1B2D', marginTop: 4, lineHeight: 1.1 }}>
            {country.name}
          </div>
          <div style={{ fontSize: 13, color: '#4A5568', marginTop: 4 }}>
            {country.id === 'PE' ? 'Cusco region selected' : 'Country level'}
          </div>
        </div>
        <button onClick={onClose} aria-label="Close" style={{
          background: 'transparent', border: 'none', cursor: 'pointer',
          color: '#4A5568', fontSize: 20, lineHeight: 1, padding: 4,
        }}>×</button>
      </div>

      {/* Body */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
        {/* Current-month score band */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12,
          background: '#ECEAE3', borderRadius: 6, padding: '12px 14px', marginBottom: 20,
        }}>
          <div style={{ width: 32, height: 32, borderRadius: 6, background: '#0B6E5F' }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 11, letterSpacing: '0.1em', color: '#4A5568', fontWeight: 500, textTransform: 'uppercase' }}>
              {months[activeMonth]} match
            </div>
            <div style={{ fontFamily: displayFont, fontSize: 18, fontWeight: 600, color: '#0F1B2D' }}>Perfect match</div>
          </div>
          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 24, fontWeight: 500, color: '#0F1B2D' }}>
            0.94
          </div>
        </div>

        {/* Temperature */}
        <Chart title="Temperature" unit="°C" isEditorial={isEditorial}>
          <svg viewBox="0 0 340 110" width="100%" height="110" style={{ display: 'block' }}>
            {/* grid */}
            {[0, 1, 2, 3].map(i => (
              <line key={i} x1="28" x2="338" y1={15 + i*24} y2={15 + i*24} stroke="#ECEAE3" strokeWidth="1" />
            ))}
            {/* Premium 10/50/90 band */}
            {isPremium && (
              <polygon
                points={tempMax.map((v, i) => `${28 + i * 26},${90 - v * 2.5}`).concat(
                  tempMin.slice().reverse().map((v, i) => {
                    const idx = tempMin.length - 1 - i;
                    return `${28 + idx * 26},${90 - v * 2.5}`;
                  })
                ).join(' ')}
                fill="#0072B2" fillOpacity="0.12"
              />
            )}
            {/* Max line */}
            <polyline
              points={tempMax.map((v, i) => `${28 + i * 26},${90 - v * 2.5}`).join(' ')}
              fill="none" stroke="#B8610E" strokeWidth="1.5"
            />
            {/* Min line */}
            <polyline
              points={tempMin.map((v, i) => `${28 + i * 26},${90 - v * 2.5}`).join(' ')}
              fill="none" stroke="#0072B2" strokeWidth="1.5"
            />
            {/* Dots */}
            {tempMax.map((v, i) => (
              <circle key={'mx' + i} cx={28 + i * 26} cy={90 - v * 2.5} r={i === activeMonth ? 3.5 : 2} fill="#B8610E" />
            ))}
            {tempMin.map((v, i) => (
              <circle key={'mn' + i} cx={28 + i * 26} cy={90 - v * 2.5} r={i === activeMonth ? 3.5 : 2} fill="#0072B2" />
            ))}
            {/* Month labels */}
            {months.map((m, i) => (
              <text key={m} x={28 + i * 26} y={105} textAnchor="middle" fontSize="8.5" fontFamily="'IBM Plex Mono', monospace" fill={i === activeMonth ? '#0F1B2D' : '#6B7280'} fontWeight={i === activeMonth ? 600 : 400}>{m[0]}</text>
            ))}
          </svg>
          <div style={{ display: 'flex', gap: 14, marginTop: 4, fontSize: 11, fontFamily: "'IBM Plex Sans'", color: '#4A5568' }}>
            <span><span style={{ display: 'inline-block', width: 10, height: 2, background: '#B8610E', marginRight: 6, verticalAlign: 'middle' }} /> Max</span>
            <span><span style={{ display: 'inline-block', width: 10, height: 2, background: '#0072B2', marginRight: 6, verticalAlign: 'middle' }} /> Min</span>
            {isPremium && <span style={{ color: '#8A4A1E' }}><span style={{ display: 'inline-block', width: 10, height: 10, background: '#0072B2', opacity: 0.2, marginRight: 6, verticalAlign: 'middle' }} /> 10–90 percentile</span>}
          </div>
        </Chart>

        {/* Rainfall */}
        <Chart title="Rainfall" unit="mm/day" isEditorial={isEditorial}>
          <svg viewBox="0 0 340 110" width="100%" height="110">
            {[0, 1, 2, 3].map(i => (
              <line key={i} x1="28" x2="338" y1={15 + i*24} y2={15 + i*24} stroke="#ECEAE3" strokeWidth="1" />
            ))}
            {rain.map((v, i) => {
              const h = v * 8;
              const x = 20 + i * 26;
              return <rect key={i} x={x} y={90 - h} width="16" height={h} fill={i === activeMonth ? '#1C5A8E' : '#5A93C7'} />;
            })}
            {months.map((m, i) => (
              <text key={m} x={28 + i * 26} y={105} textAnchor="middle" fontSize="8.5" fontFamily="'IBM Plex Mono', monospace" fill={i === activeMonth ? '#0F1B2D' : '#6B7280'} fontWeight={i === activeMonth ? 600 : 400}>{m[0]}</text>
            ))}
          </svg>
        </Chart>

        {/* Sunshine */}
        <Chart title="Sunshine" unit="h/day" isEditorial={isEditorial}>
          <svg viewBox="0 0 340 110" width="100%" height="110">
            {[0, 1, 2, 3].map(i => (
              <line key={i} x1="28" x2="338" y1={15 + i*24} y2={15 + i*24} stroke="#ECEAE3" strokeWidth="1" />
            ))}
            {sun.map((v, i) => {
              const h = v * 8;
              const x = 20 + i * 26;
              return <rect key={i} x={x} y={90 - h} width="16" height={h} fill={i === activeMonth ? '#8A4A1E' : '#C89844'} />;
            })}
            {months.map((m, i) => (
              <text key={m} x={28 + i * 26} y={105} textAnchor="middle" fontSize="8.5" fontFamily="'IBM Plex Mono', monospace" fill={i === activeMonth ? '#0F1B2D' : '#6B7280'} fontWeight={i === activeMonth ? 600 : 400}>{m[0]}</text>
            ))}
          </svg>
        </Chart>

        {/* Safety band */}
        <div style={{ marginTop: 18, padding: '12px 14px', background: '#F7F6F2', border: '1px solid #ECEAE3', borderRadius: 6 }}>
          <div style={{ fontSize: 11, letterSpacing: '0.1em', color: '#4A5568', fontWeight: 500, textTransform: 'uppercase', marginBottom: 8 }}>
            Travel safety · 5-source consensus
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            {['US', 'UK', 'CA', 'AU', 'DE'].map((src, i) => (
              <div key={src} style={{
                flex: 1, padding: '6px 4px', textAlign: 'center',
                background: i < 3 ? '#4A5568' : '#B8763E',
                color: '#fff', borderRadius: 4,
                fontSize: 10, fontFamily: "'IBM Plex Mono', monospace",
              }}>
                <div style={{ opacity: 0.8 }}>{src}</div>
                <div style={{ fontWeight: 600, fontSize: 11 }}>{i < 3 ? '1' : '2'}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function Chart({ title, unit, children, isEditorial }) {
  const displayFont = isEditorial ? "'IBM Plex Serif', serif" : "'IBM Plex Sans', system-ui";
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 6 }}>
        <div style={{ fontFamily: displayFont, fontSize: 15, fontWeight: 600, color: '#0F1B2D' }}>{title}</div>
        <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: '#4A5568' }}>{unit}</div>
      </div>
      {children}
    </div>
  );
}

// ─── Month selector (4x3 grid) ──────────────────────────────────────────────
function MonthSelector({ state, compact = false }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
      {window.MONTHS.map((m, i) => {
        const active = state.month === i;
        return (
          <button
            key={m}
            onClick={() => state.setMonth(i)}
            style={{
              background: active ? '#0F1B2D' : '#FFFFFF',
              color: active ? '#FFFFFF' : '#0F1B2D',
              border: active ? '1px solid #0F1B2D' : '1px solid #D9D5C8',
              borderRadius: 4,
              padding: compact ? '6px 0' : '9px 0',
              fontSize: 13, fontWeight: 500,
              fontFamily: "'IBM Plex Sans', system-ui",
              cursor: 'pointer',
              transition: 'all .15s',
            }}
          >{m}</button>
        );
      })}
    </div>
  );
}

// ─── Display mode toggle ────────────────────────────────────────────────────
function DisplayModeToggle({ state, orientation = 'grid' }) {
  const layers = ['preferences', 'temp', 'rain', 'safety', 'sun'];
  const isGrid = orientation === 'grid';
  return (
    <div style={{
      display: isGrid ? 'grid' : 'flex',
      gridTemplateColumns: isGrid ? '1fr 1fr' : undefined,
      flexDirection: isGrid ? undefined : 'column',
      gap: 6,
    }}>
      {layers.map((k) => {
        const L = window.MAP_LAYERS[k];
        const active = state.layer === k;
        const isPrefs = k === 'preferences';
        return (
          <button
            key={k}
            onClick={() => state.setLayer(k)}
            style={{
              gridColumn: isPrefs && isGrid ? '1 / -1' : undefined,
              background: active ? '#0F1B2D' : '#FFFFFF',
              color: active ? '#FFFFFF' : '#0F1B2D',
              border: active ? '1px solid #0F1B2D' : '1px solid #D9D5C8',
              borderRadius: 4,
              padding: '10px 12px',
              fontSize: 13, fontWeight: 500,
              fontFamily: "'IBM Plex Sans', system-ui",
              cursor: 'pointer',
              textAlign: 'left',
              display: 'flex', alignItems: 'center', gap: 8,
            }}
          >
            <span style={{
              width: 10, height: 10, borderRadius: 2,
              background: L.bins[Math.floor(L.bins.length / 2)].hex,
              opacity: active ? 1 : 0.9,
              border: '1px solid rgba(0,0,0,0.1)',
            }} />
            {L.label}
          </button>
        );
      })}
    </div>
  );
}

// ─── Preferences panel (sliders) ────────────────────────────────────────────
function PreferencesPanel({ disabled = false }) {
  const sliders = [
    { label: 'Temperature', range: '18° – 28°', unit: '°C / °F', lo: 0.35, hi: 0.75, color: '#B8610E' },
    { label: 'Rainfall',    range: '0 – 3 mm/day',     unit: 'info', lo: 0.0, hi: 0.3, color: '#0072B2' },
    { label: 'Sunshine',    range: '6 – 12 h/day',    unit: 'h',   lo: 0.4, hi: 0.95, color: '#B8763E' },
    { label: 'Wind speed',  range: '0 – 25 km/h',     unit: 'NEW', lo: 0.0, hi: 0.5, color: '#0B6E5F' },
  ];
  return (
    <div style={{ opacity: disabled ? 0.5 : 1 }}>
      {sliders.map((s) => (
        <div key={s.label} style={{ marginBottom: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
            <div style={{ fontSize: 12.5, fontWeight: 500, color: '#0F1B2D' }}>{s.label}</div>
            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: '#4A5568' }}>{s.range}</div>
          </div>
          <div style={{ position: 'relative', height: 6, background: '#ECEAE3', borderRadius: 3 }}>
            <div style={{
              position: 'absolute', left: `${s.lo * 100}%`, width: `${(s.hi - s.lo) * 100}%`,
              top: 0, bottom: 0, background: s.color, borderRadius: 3, opacity: 0.9,
            }} />
            <div style={{
              position: 'absolute', left: `${s.lo * 100}%`, top: -4, width: 14, height: 14,
              background: '#FFFFFF', border: `2px solid ${s.color}`, borderRadius: '50%',
              transform: 'translateX(-50%)',
            }} />
            <div style={{
              position: 'absolute', left: `${s.hi * 100}%`, top: -4, width: 14, height: 14,
              background: '#FFFFFF', border: `2px solid ${s.color}`, borderRadius: '50%',
              transform: 'translateX(-50%)',
            }} />
          </div>
        </div>
      ))}
      {/* Safety level segmented */}
      <div style={{ marginTop: 16 }}>
        <div style={{ fontSize: 12.5, fontWeight: 500, color: '#0F1B2D', marginBottom: 6 }}>Acceptable safety level</div>
        <div style={{ display: 'flex', border: '1px solid #D9D5C8', borderRadius: 4, overflow: 'hidden' }}>
          {['Normal', 'Caution', 'Reconsider', 'DNT'].map((lvl, i) => (
            <div key={lvl} style={{
              flex: 1, padding: '6px 4px', textAlign: 'center',
              background: i === 1 ? '#0F1B2D' : '#FFFFFF',
              color: i === 1 ? '#FFFFFF' : '#0F1B2D',
              fontSize: 11, fontWeight: 500,
              borderRight: i < 3 ? '1px solid #D9D5C8' : 'none',
            }}>{lvl}</div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Small UI atoms ─────────────────────────────────────────────────────────
function SectionLabel({ children }) {
  return <div style={{
    fontSize: 10, letterSpacing: '0.14em', color: '#4A5568',
    fontWeight: 500, textTransform: 'uppercase',
    fontFamily: "'IBM Plex Sans', system-ui",
  }}>{children}</div>;
}

function IconButton({ icon, label, active, onClick, variant = 'floating' }) {
  const styles = variant === 'floating' ? {
    background: active ? '#0F1B2D' : '#FFFFFF',
    color: active ? '#FFFFFF' : '#0F1B2D',
    border: '1px solid #D9D5C8',
    boxShadow: '0 1px 2px rgba(15,27,45,0.06), 0 1px 3px rgba(15,27,45,0.06)',
  } : {
    background: active ? '#ECEAE3' : 'transparent',
    color: '#0F1B2D',
    border: 'none',
  };
  return (
    <button onClick={onClick} title={label} aria-label={label} style={{
      width: 44, height: 44, borderRadius: 6,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      cursor: 'pointer', transition: 'all .15s',
      fontFamily: "'IBM Plex Sans', system-ui",
      ...styles,
    }}>
      {icon}
    </button>
  );
}

Object.assign(window, {
  ClimateDrawer, MonthSelector, DisplayModeToggle, PreferencesPanel, SectionLabel, IconButton
});
