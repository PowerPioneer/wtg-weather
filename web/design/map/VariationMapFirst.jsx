/* global React, window */
// Variation B — Map-first (Felt / Mapbox Studio feel)
// Minimal chrome, icon-only rail; panels slide in only when invoked.

const { useState: useStateB } = React;

function MapVariationMapFirst() {
  const state = window.useMapState();
  const [openPanel, setOpenPanel] = useStateB('month'); // 'month' | 'mode' | 'prefs' | null

  const I = (p) => <svg width="20" height="20" viewBox="0 0 24 24" fill="none">{p}</svg>;
  const icons = {
    month: I(<><rect x="4" y="5" width="16" height="15" rx="1.5" stroke="currentColor" strokeWidth="1.5"/><path d="M4 9h16M9 3v4M15 3v4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></>),
    mode:  I(<><path d="M4 6h16M4 12h16M4 18h16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/><circle cx="8" cy="6" r="2" fill="currentColor"/><circle cx="16" cy="12" r="2" fill="currentColor"/><circle cx="10" cy="18" r="2" fill="currentColor"/></>),
    prefs: I(<><circle cx="6" cy="7" r="2" stroke="currentColor" strokeWidth="1.5"/><circle cx="18" cy="12" r="2" stroke="currentColor" strokeWidth="1.5"/><circle cx="6" cy="17" r="2" stroke="currentColor" strokeWidth="1.5"/><path d="M8 7h12M4 12h12M8 17h12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></>),
    locate:I(<><circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.5"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></>),
    search:I(<><circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="1.6"/><path d="m20 20-3.5-3.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></>),
    plus:  I(<path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>),
    minus: I(<path d="M5 12h14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>),
    layers: I(<><path d="m12 3 9 5-9 5-9-5 9-5zM3 13l9 5 9-5M3 18l9 5 9-5" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/></>),
  };

  return (
    <div style={{
      width: 1440, height: 900, background: '#0F1B2D', position: 'relative', overflow: 'hidden',
      fontFamily: "'IBM Plex Sans', system-ui",
      color: '#F7F6F2',
    }}>
      {/* Full-bleed map */}
      <div style={{ position: 'absolute', inset: 0 }}>
        <window.MapSurface state={state} bg="#1E2A3D" water="#0B1420" stroke="#4A5568" strokeOpacity={0.4} />
      </div>

      {/* Icon rail (left, floating) */}
      <div style={{
        position: 'absolute', top: 16, left: 16, bottom: 16,
        display: 'flex', flexDirection: 'column', gap: 8, zIndex: 10,
      }}>
        <div style={{
          background: '#FFFFFF', border: '1px solid #D9D5C8', borderRadius: 6,
          padding: 6, display: 'flex', flexDirection: 'column', gap: 4,
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)', color: '#0F1B2D',
        }}>
          <div style={{ padding: '8px 4px', textAlign: 'center' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="4" fill="#0F1B2D"/><circle cx="12" cy="12" r="9" stroke="#0F1B2D" strokeWidth="1.5" strokeDasharray="2 3"/></svg>
          </div>
          <div style={{ height: 1, background: '#ECEAE3', margin: '0 4px' }} />
          <window.IconButton icon={icons.month} label="Month" active={openPanel === 'month'} onClick={() => setOpenPanel(openPanel === 'month' ? null : 'month')} />
          <window.IconButton icon={icons.mode} label="Display mode" active={openPanel === 'mode'} onClick={() => setOpenPanel(openPanel === 'mode' ? null : 'mode')} />
          <window.IconButton icon={icons.prefs} label="Preferences" active={openPanel === 'prefs'} onClick={() => setOpenPanel(openPanel === 'prefs' ? null : 'prefs')} />
        </div>

        <div style={{ flex: 1 }} />

        {/* Locate + Search compact */}
        <div style={{
          background: '#FFFFFF', border: '1px solid #D9D5C8', borderRadius: 6,
          padding: 6, display: 'flex', flexDirection: 'column', gap: 4, color: '#0F1B2D',
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
        }}>
          <window.IconButton icon={icons.locate} label="Locate me" />
          <window.IconButton icon={icons.layers} label="Layer options" />
        </div>
      </div>

      {/* Pop-out panel (adjacent to rail) */}
      {openPanel && (
        <div style={{
          position: 'absolute', top: 16, left: 80, width: 320,
          background: '#FFFFFF', border: '1px solid #D9D5C8', borderRadius: 6,
          padding: 20, zIndex: 9, color: '#0F1B2D',
          boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
        }}>
          {openPanel === 'month' && (
            <>
              <window.SectionLabel>Month</window.SectionLabel>
              <div style={{ marginTop: 12 }}><window.MonthSelector state={state} /></div>
            </>
          )}
          {openPanel === 'mode' && (
            <>
              <window.SectionLabel>Display mode</window.SectionLabel>
              <div style={{ marginTop: 12 }}><window.DisplayModeToggle state={state} /></div>
            </>
          )}
          {openPanel === 'prefs' && (
            <>
              <window.SectionLabel>Preferences</window.SectionLabel>
              <div style={{ marginTop: 12 }}><window.PreferencesPanel /></div>
            </>
          )}
        </div>
      )}

      {/* Search (top-center, floating) */}
      <div style={{ position: 'absolute', top: 16, left: '50%', transform: 'translateX(-50%)', zIndex: 10, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          background: '#FFFFFF', border: '1px solid #D9D5C8', borderRadius: 24,
          padding: '10px 18px', width: 380, color: '#0F1B2D', fontSize: 13,
          boxShadow: '0 4px 16px rgba(0,0,0,0.2)',
        }}>
          {icons.search}
          <span style={{ color: '#4A5568', flex: 1 }}>Search destinations, cities, countries…</span>
          <span style={{ fontFamily: "'IBM Plex Mono'", fontSize: 10, color: '#6B7280', background: '#F7F6F2', padding: '2px 6px', borderRadius: 3 }}>⌘K</span>
        </div>
        <window.LegendRamp state={state} />
      </div>

      {/* Account badge (top-right) */}
      <div style={{ position: 'absolute', top: 16, right: 16, zIndex: 10, display: 'flex', gap: 8, alignItems: 'center' }}>
        <button style={{
          background: '#FFFFFF', border: '1px solid #D9D5C8', borderRadius: 24,
          padding: '8px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer',
          color: '#B8763E', boxShadow: '0 4px 12px rgba(0,0,0,0.15)', fontFamily: "'IBM Plex Sans'",
        }}>✦ Upgrade</button>
        <div style={{
          width: 40, height: 40, borderRadius: '50%', background: '#FFFFFF',
          border: '1px solid #D9D5C8', display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 13, fontWeight: 600, color: '#0F1B2D', boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
        }}>MR</div>
      </div>

      {/* Zoom controls (bottom-right) */}
      <div style={{ position: 'absolute', bottom: 60, right: 16, zIndex: 10 }}>
        <div style={{
          background: '#FFFFFF', border: '1px solid #D9D5C8', borderRadius: 6,
          display: 'flex', flexDirection: 'column', color: '#0F1B2D', overflow: 'hidden',
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
        }}>
          <button onClick={() => state.setShowUpsell(true)} style={{ width: 40, height: 40, background: 'none', border: 'none', borderBottom: '1px solid #ECEAE3', cursor: 'pointer', color: '#0F1B2D', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{icons.plus}</button>
          <button style={{ width: 40, height: 40, background: 'none', border: 'none', cursor: 'pointer', color: '#0F1B2D', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{icons.minus}</button>
        </div>
      </div>

      {/* Attribution */}
      <div style={{ position: 'absolute', bottom: 10, right: 72, fontSize: 10, color: '#ECEAE3', fontFamily: "'IBM Plex Mono', monospace", zIndex: 10, opacity: 0.7 }}>
        MapLibre · © OpenStreetMap · ERA5 · geoBoundaries
      </div>

      {/* Ad — bottom centered, pill-shaped, tiny */}
      <div style={{
        position: 'absolute', bottom: 16, left: '50%', transform: 'translateX(-50%)', zIndex: 10,
        background: 'rgba(255,255,255,0.92)', border: '1px solid #D9D5C8', borderRadius: 24,
        padding: '6px 12px', display: 'flex', alignItems: 'center', gap: 10, color: '#0F1B2D',
        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
      }}>
        <span style={{ fontSize: 9, letterSpacing: '0.14em', color: '#6B7280', fontWeight: 500, textTransform: 'uppercase' }}>AD</span>
        <span style={{ fontSize: 12 }}>Travel insurance from €12 · explore plans →</span>
        <button style={{ background: 'none', border: 'none', fontSize: 12, color: '#4A5568', cursor: 'pointer' }}>×</button>
      </div>

      {/* Upsell */}
      {state.showUpsell && !state.selected && (
        <div style={{ position: 'absolute', top: 100, left: '50%', transform: 'translateX(-50%)', zIndex: 12 }}>
          <window.PremiumUpsell onDismiss={() => state.setShowUpsell(false)} />
        </div>
      )}

      {/* Drawer */}
      {state.selected && <window.ClimateDrawer state={state} onClose={() => state.setSelected(null)} />}
    </div>
  );
}

window.MapVariationMapFirst = MapVariationMapFirst;
