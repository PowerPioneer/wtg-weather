/* global React, window */
// All 4 legend kinds, with consistent fade+slide animation on mode change.
// Exposes: window.Legend (picks kind based on variable)

const { useState, useEffect } = React;

function useSwapAnimation(key, duration = 250) {
  const [current, setCurrent] = useState(key);
  const [entering, setEntering] = useState(false);
  useEffect(() => {
    if (current === key) return;
    setEntering(true);
    const t1 = setTimeout(() => setCurrent(key), 120); // halfway point
    const t2 = setTimeout(() => setEntering(false), duration);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [key, current, duration]);
  return { current, entering };
}

function LegendShell({ children, animKey }) {
  // Consistent wrapper: white card, shadow, fade+slide anim
  const { current } = useSwapAnimation(animKey);
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    setVisible(false);
    const t = setTimeout(() => setVisible(true), 60);
    return () => clearTimeout(t);
  }, [animKey]);
  return (
    <div style={{
      background: '#FFFFFF',
      border: '1px solid #D9D5C8',
      borderRadius: 10,
      padding: '10px 14px',
      boxShadow: '0 1px 2px rgba(15,27,45,0.06), 0 1px 3px rgba(15,27,45,0.06)',
      fontFamily: "'IBM Plex Sans', system-ui",
      opacity: visible ? 1 : 0,
      transform: visible ? 'translateY(0)' : 'translateY(-4px)',
      transition: 'opacity 200ms cubic-bezier(0.4, 0, 0.2, 1), transform 200ms cubic-bezier(0.4, 0, 0.2, 1)',
    }}>
      {children}
    </div>
  );
}

function LegendHeader({ title, sub, showInfo, tooltip }) {
  const [hover, setHover] = useState(false);
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 6, position: 'relative' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <div style={{ fontSize: 10, letterSpacing: '0.12em', color: '#4A5568', fontWeight: 500, textTransform: 'uppercase' }}>
          {title}
        </div>
        {showInfo && (
          <span
            onMouseEnter={() => setHover(true)}
            onMouseLeave={() => setHover(false)}
            style={{ color: '#6B7280', display: 'inline-flex', cursor: 'help' }}
            aria-label="About this measurement"
          >
            {window.renderIcon('info', 12)}
            {hover && (
              <div style={{
                position: 'absolute', top: 22, left: -8, zIndex: 20,
                background: '#0F1B2D', color: '#F7F6F2',
                padding: '8px 10px', borderRadius: 4,
                fontSize: 11.5, lineHeight: 1.4, maxWidth: 260,
                boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
                fontWeight: 400, textTransform: 'none', letterSpacing: 'normal',
              }}>
                {tooltip}
              </div>
            )}
          </span>
        )}
      </div>
      {sub && (
        <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: '#6B7280' }}>{sub}</div>
      )}
    </div>
  );
}

// ─── Qualitative legend (My Preferences) ─────────────────────────────────
function LegendQualitative({ v }) {
  return (
    <LegendShell animKey={v.id}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        fontFamily: "'IBM Plex Sans', system-ui",
      }}>
        <div style={{ fontSize: 10, letterSpacing: '0.12em', color: '#4A5568', fontWeight: 500, textTransform: 'uppercase', paddingRight: 6, borderRight: '1px solid #D9D5C8' }}>
          {v.legend.title}
        </div>
        {v.legend.bins.map((b) => (
          <div key={b.label} style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '4px 10px',
            background: b.hex, color: '#FFFFFF',
            borderRadius: 4, fontSize: 12, fontWeight: 500, letterSpacing: '0.01em',
          }}>{b.label}</div>
        ))}
      </div>
    </LegendShell>
  );
}

// ─── Continuous legend (climate variables) ───────────────────────────────
function LegendContinuous({ v }) {
  const ramp = v.legend.ramp;
  const ticks = v.legend.ticks;
  return (
    <LegendShell animKey={v.id}>
      <div style={{ minWidth: 360 }}>
        <LegendHeader title={v.legend.title} sub={v.legend.sub} showInfo={!!v.infoTooltip} tooltip={v.infoTooltip} />
        <div style={{
          height: 14, borderRadius: 4, border: '1px solid rgba(15,27,45,0.08)',
          background: `linear-gradient(90deg, ${ramp.join(', ')})`,
        }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
          {ticks.map((t, i) => (
            <div key={i} style={{
              fontFamily: "'IBM Plex Mono', monospace",
              fontSize: 10.5, color: '#0F1B2D',
            }}>{t}</div>
          ))}
        </div>
        {v.landMode === 'dimmed' && (
          <div style={{ marginTop: 6, fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, color: '#6B7280', fontStyle: 'italic' }}>
            Land areas dimmed in this view
          </div>
        )}
      </div>
    </LegendShell>
  );
}

// ─── Safety legend (discrete 4 swatches) ─────────────────────────────────
function LegendSafety({ v }) {
  return (
    <LegendShell animKey={v.id}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        fontFamily: "'IBM Plex Sans', system-ui",
      }}>
        <div style={{ fontSize: 10, letterSpacing: '0.12em', color: '#4A5568', fontWeight: 500, textTransform: 'uppercase', paddingRight: 6, borderRight: '1px solid #D9D5C8', maxWidth: 110 }}>
          {v.legend.title}
          <div style={{ fontSize: 9, color: '#6B7280', textTransform: 'none', letterSpacing: 'normal', fontWeight: 400, marginTop: 1 }}>
            {v.legend.sub}
          </div>
        </div>
        {v.legend.bins.map((b) => (
          <div key={b.label} style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '4px 10px',
            background: b.hex, color: '#FFFFFF',
            borderRadius: 4, fontSize: 12, fontWeight: 500, letterSpacing: '0.01em',
            // Subtle pattern overlay to differentiate from Match colours at a glance
            backgroundImage: 'repeating-linear-gradient(135deg, rgba(255,255,255,0.08) 0 2px, transparent 2px 6px)',
          }}>{b.label}</div>
        ))}
      </div>
    </LegendShell>
  );
}

// ─── Dispatcher ──────────────────────────────────────────────────────────
function Legend({ variableId }) {
  const v = window.VARIABLES[variableId];
  if (!v) return null;
  if (v.kind === 'qualitative') return <LegendQualitative v={v} />;
  if (v.kind === 'ordinal-safety') return <LegendSafety v={v} />;
  return <LegendContinuous v={v} />;
}

Object.assign(window, { Legend });
