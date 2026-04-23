/* global React, window */
// Variation C — Editorial (Skyscanner / Lonely Planet feel)
// Serif display on headings, more narrative, richer drawer.

const { useState: useStateC } = React;

function MapVariationEditorial() {
  const state = window.useMapState();
  // Select Peru by default so the editorial drawer is visible
  React.useEffect(() => { if (!state.selected) state.setSelected('PE'); /* eslint-disable-next-line */ }, []);

  const I = (p) => <svg width="16" height="16" viewBox="0 0 24 24" fill="none">{p}</svg>;
  const icons = {
    search: I(<><circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="1.6"/><path d="m20 20-3.5-3.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></>),
    plus:   I(<path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>),
    minus:  I(<path d="M5 12h14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>),
    locate: I(<><circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.5"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></>),
  };

  return (
    <div style={{
      width: 1440, height: 900, background: '#F7F6F2', position: 'relative', overflow: 'hidden',
      fontFamily: "'IBM Plex Sans', system-ui",
      color: '#0F1B2D',
    }}>
      {/* Header - editorial, with tagline prominent */}
      <div style={{
        height: 72, background: '#F7F6F2', borderBottom: '1px solid #D9D5C8',
        display: 'flex', alignItems: 'center', padding: '0 32px', gap: 20,
        position: 'relative', zIndex: 10,
      }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="4" fill="#B8763E"/><circle cx="12" cy="12" r="9" stroke="#0F1B2D" strokeWidth="1.5" strokeDasharray="2 3"/></svg>
            <div style={{ fontFamily: "'IBM Plex Serif', serif", fontSize: 22, fontWeight: 500, letterSpacing: '-0.01em' }}>
              Atlas
            </div>
          </div>
          <div style={{ width: 1, height: 18, background: '#D9D5C8' }} />
          <div>
            <div style={{ fontSize: 13, fontWeight: 500 }}>Where to Go for Great Weather</div>
            <div style={{ fontStyle: 'italic', fontFamily: "'IBM Plex Serif'", fontSize: 12, color: '#4A5568', marginTop: 1 }}>
              Plan smarter. Travel sunnier.
            </div>
          </div>
        </div>

        <div style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10,
            background: '#FFFFFF', border: '1px solid #D9D5C8', borderRadius: 4,
            padding: '9px 14px', width: 420, color: '#4A5568', fontSize: 13,
          }}>
            {icons.search}
            <span>Where would you like to escape to?</span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <a style={{ fontSize: 13, color: '#0F1B2D', fontWeight: 500 }}>Saved trips</a>
          <a style={{ fontSize: 13, color: '#0F1B2D', fontWeight: 500 }}>Journal</a>
          <button style={{
            background: '#0F1B2D', color: '#F7F6F2', border: 'none', borderRadius: 4,
            padding: '8px 14px', fontSize: 12.5, fontWeight: 500, cursor: 'pointer',
            fontFamily: "'IBM Plex Sans'",
          }}>Upgrade · €2.99/mo</button>
          <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#ECEAE3', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 600 }}>MR</div>
        </div>
      </div>

      {/* Body */}
      <div style={{ position: 'absolute', top: 72, left: 0, right: 0, bottom: 0, display: 'flex' }}>
        {/* Sidebar */}
        <div style={{
          width: 320, background: '#F7F6F2', borderRight: '1px solid #D9D5C8',
          display: 'flex', flexDirection: 'column', overflow: 'hidden',
        }}>
          <div style={{ flex: 1, overflowY: 'auto', padding: '24px 22px' }}>
            <div style={{ marginBottom: 24 }}>
              <div style={{ fontFamily: "'IBM Plex Serif'", fontSize: 11, letterSpacing: '0.14em', color: '#4A5568', fontWeight: 500, textTransform: 'uppercase', fontStyle: 'italic' }}>
                CHAPTER I
              </div>
              <div style={{ fontFamily: "'IBM Plex Serif'", fontSize: 22, fontWeight: 500, color: '#0F1B2D', marginTop: 4, lineHeight: 1.2 }}>
                When to go
              </div>
              <div style={{ marginTop: 14 }}>
                <window.MonthSelector state={state} />
              </div>
            </div>

            <div style={{ marginBottom: 24 }}>
              <div style={{ fontFamily: "'IBM Plex Serif'", fontSize: 11, letterSpacing: '0.14em', color: '#4A5568', fontWeight: 500, textTransform: 'uppercase', fontStyle: 'italic' }}>
                CHAPTER II
              </div>
              <div style={{ fontFamily: "'IBM Plex Serif'", fontSize: 22, fontWeight: 500, color: '#0F1B2D', marginTop: 4, lineHeight: 1.2 }}>
                What to see
              </div>
              <div style={{ marginTop: 14 }}>
                <window.DisplayModeToggle state={state} />
              </div>
            </div>

            <div>
              <div style={{ fontFamily: "'IBM Plex Serif'", fontSize: 11, letterSpacing: '0.14em', color: '#4A5568', fontWeight: 500, textTransform: 'uppercase', fontStyle: 'italic' }}>
                CHAPTER III
              </div>
              <div style={{ fontFamily: "'IBM Plex Serif'", fontSize: 22, fontWeight: 500, color: '#0F1B2D', marginTop: 4, lineHeight: 1.2 }}>
                Your ideal climate
              </div>
              <div style={{ marginTop: 14 }}>
                <window.PreferencesPanel disabled={state.layer !== 'preferences'} />
              </div>
            </div>
          </div>
        </div>

        {/* Map */}
        <div style={{ flex: 1, position: 'relative', borderRight: state.selected ? '1px solid #D9D5C8' : 'none' }}>
          <window.MapSurface state={state} bg="#EFE9DB" water="#D6DCE2" />

          {/* Top-center legend */}
          <div style={{ position: 'absolute', top: 20, left: '50%', transform: 'translateX(-50%)', zIndex: 5 }}>
            <window.LegendRamp state={state} />
          </div>

          {/* Zoom bottom-right */}
          <div style={{ position: 'absolute', bottom: 70, right: 20, display: 'flex', flexDirection: 'column', gap: 8, zIndex: 5 }}>
            <div style={{ display: 'flex', flexDirection: 'column', background: '#FFFFFF', border: '1px solid #D9D5C8', borderRadius: 4, overflow: 'hidden' }}>
              <button onClick={() => state.setShowUpsell(true)} style={{ width: 36, height: 36, background: '#FFFFFF', border: 'none', borderBottom: '1px solid #D9D5C8', cursor: 'pointer', color: '#0F1B2D', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{icons.plus}</button>
              <button style={{ width: 36, height: 36, background: '#FFFFFF', border: 'none', cursor: 'pointer', color: '#0F1B2D', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{icons.minus}</button>
            </div>
            <button style={{ background: '#FFFFFF', border: '1px solid #D9D5C8', borderRadius: 4, width: 36, height: 36, cursor: 'pointer', color: '#0F1B2D', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{icons.locate}</button>
          </div>

          {state.showUpsell && !state.selected && (
            <div style={{ position: 'absolute', top: 120, left: '50%', transform: 'translateX(-50%)', zIndex: 6 }}>
              <window.PremiumUpsell onDismiss={() => state.setShowUpsell(false)} />
            </div>
          )}

          <div style={{ position: 'absolute', bottom: 10, right: 20, fontSize: 10, color: '#6B7280', fontFamily: "'IBM Plex Mono', monospace" }}>
            MapLibre · © OpenStreetMap · ERA5 · geoBoundaries
          </div>

          {/* Ad — editorial style; more like a sponsored tip */}
          <div style={{
            position: 'absolute', bottom: 16, left: 20, width: 300,
            background: '#FFFFFF', border: '1px solid #D9D5C8', borderRadius: 4,
            padding: '10px 12px', zIndex: 4,
            display: 'flex', gap: 10,
          }}>
            <div style={{ width: 40, height: 40, background: 'repeating-linear-gradient(45deg, #F7F6F2, #F7F6F2 4px, #ECEAE3 4px, #ECEAE3 8px)', borderRadius: 2, flexShrink: 0 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 9, letterSpacing: '0.14em', color: '#6B7280', fontWeight: 500, textTransform: 'uppercase' }}>Sponsored · Skyscanner</div>
              <div style={{ fontFamily: "'IBM Plex Serif'", fontSize: 13, fontWeight: 500, color: '#0F1B2D', marginTop: 2, lineHeight: 1.3 }}>
                Flights to Lima from €487 in April
              </div>
            </div>
            <button style={{ background: 'none', border: 'none', fontSize: 14, color: '#6B7280', cursor: 'pointer', alignSelf: 'flex-start' }}>×</button>
          </div>
        </div>

        {/* Editorial drawer — different from default */}
        {state.selected && (() => {
          const country = window.MAP_COUNTRIES.find(c => c.id === state.selected);
          const tempMin = [8, 9, 10, 11, 10, 8, 7, 7, 8, 9, 9, 8];
          const tempMax = [18, 19, 19, 19, 18, 16, 15, 16, 17, 18, 19, 18];
          const rain   = [9, 9, 9, 5, 2, 1, 1, 1, 2, 4, 6, 9];
          const sun    = [4, 4, 4, 6, 7, 8, 9, 9, 8, 6, 5, 4];
          const months = window.MONTHS;
          const isPremium = true; // show the full premium experience here
          return (
            <div style={{ width: 440, background: '#F7F6F2', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              {/* Image header */}
              <div style={{ height: 200, background: 'linear-gradient(135deg, #B8763E 0%, #C89844 50%, #E0C98A 100%)', position: 'relative', flexShrink: 0 }}>
                <svg viewBox="0 0 440 200" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0.35 }}>
                  <path d="M0,130 L60,115 L120,125 L180,95 L240,105 L300,80 L360,90 L440,70 L440,200 L0,200 Z" fill="#8A4A1E" />
                  <path d="M0,160 L80,150 L160,160 L240,140 L320,150 L440,130 L440,200 L0,200 Z" fill="#7A2E2E" opacity="0.6" />
                </svg>
                <div style={{ position: 'absolute', top: 16, left: 20, fontSize: 10, letterSpacing: '0.14em', color: '#FFFFFF', fontWeight: 600, textTransform: 'uppercase', fontFamily: "'IBM Plex Mono'" }}>
                  {country.name} · {country.id === 'PE' ? 'Cusco' : 'Country'}
                </div>
                <button onClick={() => state.setSelected(null)} aria-label="Close" style={{ position: 'absolute', top: 12, right: 12, background: 'rgba(15,27,45,0.3)', border: 'none', color: '#FFFFFF', width: 32, height: 32, borderRadius: '50%', fontSize: 20, cursor: 'pointer', lineHeight: 1 }}>×</button>
                <div style={{ position: 'absolute', bottom: 16, left: 20, right: 20 }}>
                  <div style={{ fontFamily: "'IBM Plex Serif'", fontSize: 32, fontWeight: 500, color: '#FFFFFF', lineHeight: 1.1 }}>
                    Cusco
                  </div>
                  <div style={{ fontFamily: "'IBM Plex Serif'", fontSize: 14, fontStyle: 'italic', color: '#F7F6F2', marginTop: 2 }}>
                    Thin air, warm sun, and 11° mornings.
                  </div>
                </div>
              </div>

              <div style={{ flex: 1, overflowY: 'auto', padding: '24px 28px' }}>
                {/* Pull quote */}
                <div style={{ paddingLeft: 14, borderLeft: '2px solid #B8763E', marginBottom: 20 }}>
                  <div style={{ fontFamily: "'IBM Plex Serif'", fontSize: 15, fontStyle: 'italic', color: '#0F1B2D', lineHeight: 1.5 }}>
                    "April is Cusco's gentlest month — dry trails, manageable crowds, and sun from 7am to 5pm."
                  </div>
                  <div style={{ fontSize: 11, color: '#4A5568', marginTop: 6, fontFamily: "'IBM Plex Mono'" }}>
                    — based on 10 years of ERA5 data
                  </div>
                </div>

                {/* Match card */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 14, background: '#FFFFFF', border: '1px solid #D9D5C8', borderRadius: 4, padding: '14px 16px', marginBottom: 22 }}>
                  <div style={{ width: 36, height: 36, borderRadius: 4, background: '#0B6E5F', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#FFFFFF', fontFamily: "'IBM Plex Mono'", fontSize: 13, fontWeight: 600 }}>0.94</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 10, letterSpacing: '0.14em', color: '#4A5568', fontWeight: 500, textTransform: 'uppercase' }}>{months[state.month]} match</div>
                    <div style={{ fontFamily: "'IBM Plex Serif'", fontSize: 16, fontWeight: 600 }}>A near-perfect fit</div>
                  </div>
                </div>

                {/* Mini charts, more condensed + labeled like an almanac */}
                <div style={{ marginBottom: 20 }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 8 }}>
                    <div style={{ fontFamily: "'IBM Plex Serif'", fontSize: 15, fontWeight: 600 }}>Temperature</div>
                    <div style={{ fontFamily: "'IBM Plex Mono'", fontSize: 11, color: '#4A5568' }}>11° – 19° · April</div>
                  </div>
                  <svg viewBox="0 0 380 90" width="100%" height="90">
                    {isPremium && (
                      <polygon
                        points={tempMax.map((v, i) => `${20 + i * 31},${75 - v * 2.2}`).concat(
                          tempMin.slice().reverse().map((v, i) => {
                            const idx = tempMin.length - 1 - i;
                            return `${20 + idx * 31},${75 - v * 2.2}`;
                          })
                        ).join(' ')}
                        fill="#0072B2" fillOpacity="0.1"
                      />
                    )}
                    <polyline points={tempMax.map((v, i) => `${20 + i * 31},${75 - v * 2.2}`).join(' ')} fill="none" stroke="#B8610E" strokeWidth="1.5" />
                    <polyline points={tempMin.map((v, i) => `${20 + i * 31},${75 - v * 2.2}`).join(' ')} fill="none" stroke="#0072B2" strokeWidth="1.5" />
                    {months.map((m, i) => (
                      <text key={m} x={20 + i * 31} y={88} textAnchor="middle" fontSize="8.5" fontFamily="'IBM Plex Mono'" fill={i === state.month ? '#0F1B2D' : '#6B7280'} fontWeight={i === state.month ? 600 : 400}>{m[0]}</text>
                    ))}
                  </svg>
                </div>

                <div style={{ marginBottom: 20 }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 8 }}>
                    <div style={{ fontFamily: "'IBM Plex Serif'", fontSize: 15, fontWeight: 600 }}>Rainfall</div>
                    <div style={{ fontFamily: "'IBM Plex Mono'", fontSize: 11, color: '#4A5568' }}>5 mm/day · April</div>
                  </div>
                  <svg viewBox="0 0 380 90" width="100%" height="90">
                    {rain.map((v, i) => <rect key={i} x={10 + i * 31} y={75 - v * 7} width="20" height={v * 7} fill={i === state.month ? '#1C5A8E' : '#5A93C7'} />)}
                    {months.map((m, i) => (
                      <text key={m} x={20 + i * 31} y={88} textAnchor="middle" fontSize="8.5" fontFamily="'IBM Plex Mono'" fill={i === state.month ? '#0F1B2D' : '#6B7280'}>{m[0]}</text>
                    ))}
                  </svg>
                </div>

                <div>
                  <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 8 }}>
                    <div style={{ fontFamily: "'IBM Plex Serif'", fontSize: 15, fontWeight: 600 }}>Sunshine</div>
                    <div style={{ fontFamily: "'IBM Plex Mono'", fontSize: 11, color: '#4A5568' }}>6 h/day · April</div>
                  </div>
                  <svg viewBox="0 0 380 90" width="100%" height="90">
                    {sun.map((v, i) => <rect key={i} x={10 + i * 31} y={75 - v * 7} width="20" height={v * 7} fill={i === state.month ? '#8A4A1E' : '#C89844'} />)}
                    {months.map((m, i) => (
                      <text key={m} x={20 + i * 31} y={88} textAnchor="middle" fontSize="8.5" fontFamily="'IBM Plex Mono'" fill={i === state.month ? '#0F1B2D' : '#6B7280'}>{m[0]}</text>
                    ))}
                  </svg>
                </div>
              </div>
            </div>
          );
        })()}
      </div>
    </div>
  );
}

window.MapVariationEditorial = MapVariationEditorial;
