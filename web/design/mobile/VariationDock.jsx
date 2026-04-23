/* global React, window */
// Variation B — Unified dock. Tighter, more native-feeling.
// FABs live in a vertical pill at bottom-left; legend chip top-right.

const { useState: useVB } = React;

function MobileVariationDock() {
  const [layer, setLayer] = useVB('temp');  // show a continuous layer by default to demo the chip
  const [sheet, setSheet] = useVB(null);
  const [drawer, setDrawer] = useVB('peek');
  const {
    MobileMapSurface, MobileStatusBar, MobileTopBar, fabIcons,
    MobileLegend, Sheet, MonthSheetContent, PrefsSheetContent, StickyApplyBar,
    ClimatePeekContent, ClimateExpandedContent, Dim, DisplayModeModal,
  } = window;

  const closeSheet = () => setSheet(null);

  // Dock button (tighter, square-rounded, grouped in pill)
  const DockBtn = ({ icon, label, active, onClick, bottom }) => (
    <button onClick={onClick} aria-label={label} style={{
      width: 52, height: 52, background: active ? '#0F1B2D' : 'transparent',
      color: active ? '#FFFFFF' : '#0F1B2D',
      border: 'none',
      borderBottom: bottom ? 'none' : '1px solid rgba(15,27,45,0.08)',
      cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
      flexDirection: 'column', gap: 2, padding: 0,
    }}>
      {icon}
      <div style={{ fontSize: 8.5, fontWeight: 500, letterSpacing: '0.02em' }}>{label}</div>
    </button>
  );

  return (
    <div style={{
      width: 375, height: 812, background: '#E4E8EC',
      position: 'relative', overflow: 'hidden',
      fontFamily: "'IBM Plex Sans'", color: '#0F1B2D',
    }}>
      <MobileStatusBar />
      <MobileTopBar floating />

      {/* Full-bleed map (goes under floating top bar) */}
      <div style={{ position: 'absolute', top: 44, left: 0, right: 0, bottom: 0 }}>
        <MobileMapSurface layerId={layer} />
      </div>

      {/* Legend — compact chip, top-right */}
      <div style={{ position: 'absolute', top: 104, right: 14, zIndex: 4, display: 'flex', justifyContent: 'flex-end' }}>
        <MobileLegend layerId={layer} />
      </div>

      {/* Dock — bottom left, vertical pill */}
      <div style={{
        position: 'absolute', left: 14, bottom: 160, zIndex: 5,
        background: '#FFFFFF', border: '1px solid #D9D5C8', borderRadius: 14,
        boxShadow: '0 4px 14px rgba(15,27,45,0.16)',
        overflow: 'hidden',
      }}>
        <DockBtn icon={fabIcons.calendar} label="APR"   onClick={() => setSheet('month')} />
        <DockBtn icon={fabIcons.layers}   label="Layer" onClick={() => setSheet('display')} />
        <DockBtn icon={fabIcons.sliders}  label="Prefs" onClick={() => setSheet('prefs')} bottom />
      </div>

      {/* Peek drawer */}
      {drawer === 'peek' && sheet === null && (
        <button onClick={() => setDrawer('expanded')} style={{
          position: 'absolute', bottom: 0, left: 0, right: 0,
          background: '#FFFFFF', border: 'none',
          borderTopLeftRadius: 16, borderTopRightRadius: 16,
          boxShadow: '0 -6px 20px rgba(15,27,45,0.14)',
          padding: 0, textAlign: 'left', cursor: 'pointer', zIndex: 10,
        }}>
          <div style={{ display: 'flex', justifyContent: 'center', padding: '8px 0 2px' }}>
            <div style={{ width: 36, height: 4, borderRadius: 2, background: '#D9D5C8' }} />
          </div>
          <ClimatePeekContent />
        </button>
      )}

      {drawer === 'expanded' && sheet === null && (
        <>
          <Dim onClick={() => setDrawer('peek')} />
          <Sheet title="Climate information" subtitle={null} onClose={() => setDrawer('peek')} height={640}>
            <ClimateExpandedContent />
          </Sheet>
        </>
      )}

      {/* Month */}
      {sheet === 'month' && (
        <>
          <Dim onClick={closeSheet} />
          <Sheet title="Month" subtitle="April" onClose={closeSheet} compactHeader>
            <MonthSheetContent />
          </Sheet>
        </>
      )}

  // Prefs uses sticky Apply (chosen direction)
      {sheet === 'prefs' && (
        <>
          <Dim onClick={closeSheet} />
          <Sheet title="Preferences" subtitle="Your ideal weather" onClose={closeSheet} height={640} compactHeader>
            <PrefsSheetContent autoApply={false} />
            <StickyApplyBar />
          </Sheet>
        </>
      )}

      {/* Display mode — dense */}
      {sheet === 'display' && (
        <>
          <Dim onClick={closeSheet} />
          <Sheet title={null} onClose={null} height={760} padX={0}>
            <DisplayModeModal
              layout="mobile"
              activeId={layer}
              onChange={(id) => { setLayer(id); closeSheet(); }}
              isPremium={false}
              onClose={closeSheet}
            />
          </Sheet>
        </>
      )}
    </div>
  );
}

window.MobileVariationDock = MobileVariationDock;
