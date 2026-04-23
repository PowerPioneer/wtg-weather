/* global React, window */
// Variation A — Airy (Linear / Vercel feel)
// Lots of whitespace, restrained type, generous panels.

const { useState: useStateA } = React;

function MapVariationAiry() {
  const state = window.useMapState();
  const [collapsed, setCollapsed] = useStateA(false);
  const sidebarW = collapsed ? 56 : 320;
  const isZoomed = state.showUpsell;

  const icons = {
    search: <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="1.6"/><path d="m20 20-3.5-3.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></svg>,
    chevron: (open) => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ transform: open ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform .2s' }}><path d="m9 6 6 6-6 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>,
    locate: <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.5"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>,
    plus: <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>,
    minus: <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M5 12h14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>,
  };

  return (
    <div style={{
      width: 1440, height: 900, background: '#F7F6F2', position: 'relative', overflow: 'hidden',
      fontFamily: "'IBM Plex Sans', system-ui",
      color: '#0F1B2D',
    }}>
      {/* Header */}
      <div style={{
        height: 56, background: '#FFFFFF', borderBottom: '1px solid #ECEAE3',
        display: 'flex', alignItems: 'center', padding: '0 24px', gap: 16,
        position: 'relative', zIndex: 10,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 28, height: 28, borderRadius: 4, background: '#0F1B2D', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="4" fill="#E0C98A"/><circle cx="12" cy="12" r="9" stroke="#E0C98A" strokeWidth="1.5" strokeDasharray="2 3"/></svg>
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, letterSpacing: '-0.01em' }}>Atlas</div>
          </div>
          <div style={{ width: 1, height: 20, background: '#ECEAE3', margin: '0 8px' }} />
          <div style={{ fontSize: 12.5, color: '#4A5568' }}>Where to Go for Great Weather</div>
        </div>

        <div style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            background: '#F7F6F2', border: '1px solid #ECEAE3', borderRadius: 6,
            padding: '7px 12px', width: 380, color: '#4A5568', fontSize: 13,
          }}>
            {icons.search}
            <span>Search a city or country…</span>
            <span style={{ marginLeft: 'auto', fontFamily: "'IBM Plex Mono'", fontSize: 11, color: '#6B7280', background: '#FFFFFF', padding: '2px 6px', borderRadius: 3, border: '1px solid #ECEAE3' }}>⌘K</span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button style={{
            background: 'transparent', border: 'none', color: '#4A5568',
            fontSize: 13, cursor: 'pointer', padding: '6px 10px',
          }}>Upgrade</button>
          <div style={{
            width: 32, height: 32, borderRadius: '50%', background: '#ECEAE3',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 12, fontWeight: 600, color: '#0F1B2D',
          }}>MR</div>
        </div>
      </div>

      {/* Body */}
      <div style={{ position: 'absolute', top: 56, left: 0, right: 0, bottom: 0, display: 'flex' }}>
        {/* Sidebar */}
        <div style={{
          width: sidebarW, background: '#FFFFFF', borderRight: '1px solid #ECEAE3',
          transition: 'width .2s', display: 'flex', flexDirection: 'column', overflow: 'hidden',
        }}>
          {/* Collapse button */}
          <button onClick={() => setCollapsed(!collapsed)} style={{
            height: 40, display: 'flex', alignItems: 'center', justifyContent: collapsed ? 'center' : 'flex-end',
            padding: '0 16px', background: 'transparent', border: 'none', borderBottom: '1px solid #ECEAE3',
            color: '#4A5568', cursor: 'pointer',
          }}>
            <span style={{ transform: collapsed ? 'rotate(0)' : 'rotate(180deg)', display: 'flex' }}>{icons.chevron(true)}</span>
          </button>

          {!collapsed && (
            <div style={{ flex: 1, overflowY: 'auto', padding: '24px 20px' }}>
              <div style={{ marginBottom: 28 }}>
                <window.SectionLabel>Month</window.SectionLabel>
                <div style={{ marginTop: 10 }}>
                  <window.MonthSelector state={state} />
                </div>
              </div>

              <div style={{ marginBottom: 28 }}>
                <window.SectionLabel>Display mode</window.SectionLabel>
                <div style={{ marginTop: 10 }}>
                  <window.DisplayModeToggle state={state} />
                </div>
              </div>

              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                  <window.SectionLabel>Preferences</window.SectionLabel>
                  <span style={{ fontSize: 11, color: '#4A5568', fontFamily: "'IBM Plex Mono', monospace" }}>°C</span>
                </div>
                <window.PreferencesPanel disabled={state.layer !== 'preferences'} />
              </div>
            </div>
          )}
        </div>

        {/* Map area */}
        <div style={{ flex: 1, position: 'relative' }}>
          <window.MapSurface state={state} bg="#EFE9DB" water="#E4E8EC" />

          {/* Floating legend, top-center */}
          <div style={{ position: 'absolute', top: 20, left: '50%', transform: 'translateX(-50%)', zIndex: 5 }}>
            <window.LegendRamp state={state} />
          </div>

          {/* Zoom + locate, bottom-right */}
          <div style={{ position: 'absolute', bottom: 80, right: 20, display: 'flex', flexDirection: 'column', gap: 8, zIndex: 5 }}>
            <div style={{ display: 'flex', flexDirection: 'column', background: '#FFFFFF', border: '1px solid #ECEAE3', borderRadius: 6, overflow: 'hidden', boxShadow: '0 1px 2px rgba(15,27,45,0.06)' }}>
              <button onClick={() => state.setShowUpsell(true)} style={{ width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#FFFFFF', border: 'none', borderBottom: '1px solid #ECEAE3', cursor: 'pointer', color: '#0F1B2D' }}>{icons.plus}</button>
              <button style={{ width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#FFFFFF', border: 'none', cursor: 'pointer', color: '#0F1B2D' }}>{icons.minus}</button>
            </div>
            <div style={{ background: '#FFFFFF', border: '1px solid #ECEAE3', borderRadius: 6, width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#0F1B2D', boxShadow: '0 1px 2px rgba(15,27,45,0.06)' }}>{icons.locate}</div>
          </div>

          {/* Upsell (on zoom past admin-1) */}
          {state.showUpsell && !state.selected && (
            <div style={{ position: 'absolute', top: 100, left: '50%', transform: 'translateX(-50%)', zIndex: 6 }}>
              <window.PremiumUpsell onDismiss={() => state.setShowUpsell(false)} />
            </div>
          )}

          {/* Attribution */}
          <div style={{ position: 'absolute', bottom: 8, right: 12, fontSize: 10, color: '#6B7280', fontFamily: "'IBM Plex Mono', monospace", zIndex: 5 }}>
            MapLibre · © OpenStreetMap · ERA5 · geoBoundaries
          </div>

          {/* Ad slot — free tier, subtle */}
          <div style={{
            position: 'absolute', bottom: 0, left: 0, right: 0, height: 56,
            background: '#FFFFFF', borderTop: '1px solid #ECEAE3',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16, zIndex: 4,
          }}>
            <span style={{ fontSize: 10, letterSpacing: '0.14em', color: '#6B7280', fontWeight: 500, textTransform: 'uppercase' }}>Sponsored</span>
            <div style={{ width: 320, height: 40, background: 'repeating-linear-gradient(45deg, #F7F6F2, #F7F6F2 6px, #ECEAE3 6px, #ECEAE3 12px)', borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'IBM Plex Mono'", fontSize: 10, color: '#6B7280' }}>728×90 ad placement</div>
            <button style={{ background: 'transparent', border: 'none', color: '#4A5568', fontSize: 12, cursor: 'pointer', textDecoration: 'underline' }}>Remove ads →</button>
          </div>

          {/* Drawer */}
          {state.selected && (
            <window.ClimateDrawer state={state} onClose={() => state.setSelected(null)} />
          )}
        </div>
      </div>
    </div>
  );
}

window.MapVariationAiry = MapVariationAiry;
