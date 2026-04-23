/* global React, window */
// The refined Display Mode modal. Fits desktop AND mobile bottom-sheet.
// Props: activeId, onChange, isPremium, onUpgrade, layout ('desktop'|'mobile')

const { useState, useState: useModalState } = React;

function VariableTile({ v, active, locked, layout, onClick, onLockClick, popoverOpen }) {
  const [hover, setHover] = useState(false);
  const isHero = v.id === 'preferences';
  const isSafety = v.id === 'safety';

  // Dimensions
  const padding = layout === 'mobile' ? '14px 12px' : '14px 14px';
  const heroPadding = layout === 'mobile' ? '16px' : '18px';

  // Sample-swatch (small colour pip to suggest the palette)
  const paletteStrip = () => {
    if (v.kind === 'qualitative' || v.kind === 'ordinal-safety') {
      return (
        <div style={{ display: 'flex', gap: 2, borderRadius: 2, overflow: 'hidden' }}>
          {v.legend.bins.map((b, i) => (
            <div key={i} style={{ width: 8, height: 4, background: b.hex }} />
          ))}
        </div>
      );
    }
    return (
      <div style={{
        width: 36, height: 4, borderRadius: 2,
        background: `linear-gradient(90deg, ${v.legend.ramp.join(', ')})`,
      }} />
    );
  };

  // Colors
  const activeBg = '#0F1B2D';
  const activeFg = '#FFFFFF';
  const idleBg = '#FFFFFF';
  const idleFg = locked ? '#6B7280' : '#0F1B2D';
  const idleBorder = active ? '#0F1B2D' : (popoverOpen ? '#B8763E' : '#D9D5C8');

  const tileStyle = {
    position: 'relative',
    background: active ? activeBg : idleBg,
    color: active ? activeFg : idleFg,
    border: `1px solid ${idleBorder}`,
    borderRadius: 6,
    padding: isHero ? heroPadding : padding,
    cursor: 'pointer',
    textAlign: 'left',
    fontFamily: "'IBM Plex Sans', system-ui",
    transition: 'background 200ms cubic-bezier(0.4,0,0.2,1), border-color 150ms, box-shadow 150ms',
    boxShadow: hover && !active ? '0 1px 3px rgba(15,27,45,0.08)' : 'none',
    minHeight: layout === 'mobile' ? 72 : (isHero ? 80 : 88),
    display: 'flex',
    flexDirection: isHero ? 'row' : 'column',
    alignItems: isHero ? 'center' : 'flex-start',
    justifyContent: isHero ? 'flex-start' : 'space-between',
    gap: isHero ? 14 : 10,
    width: '100%',
    outline: 'none',
  };

  return (
    <button
      style={tileStyle}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onClick={() => locked ? onLockClick() : onClick()}
      aria-pressed={active}
    >
      {/* Icon row */}
      {isHero ? (
        <>
          <div style={{
            width: 40, height: 40, borderRadius: 6,
            background: active ? 'rgba(255,255,255,0.14)' : '#ECEAE3',
            color: active ? '#E0C98A' : '#0F1B2D',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}>
            {window.renderIcon('preferences', 22)}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 600, letterSpacing: '-0.005em' }}>{v.label}</div>
            <div style={{ fontSize: 12, color: active ? 'rgba(247,246,242,0.75)' : '#4A5568', marginTop: 2, lineHeight: 1.4 }}>
              Your ideal weather score map
            </div>
          </div>
          {/* Hero palette strip */}
          <div style={{ display: 'flex', gap: 3, flexShrink: 0 }}>
            {v.legend.bins.map((b, i) => (
              <div key={i} style={{
                width: 16, height: 16, borderRadius: 3, background: b.hex,
                border: active ? '1px solid rgba(255,255,255,0.2)' : '1px solid rgba(15,27,45,0.08)',
              }} />
            ))}
          </div>
          {active && (
            <div style={{
              position: 'absolute', top: 10, right: 12,
              fontSize: 9, letterSpacing: '0.14em', color: '#E0C98A',
              fontWeight: 600, textTransform: 'uppercase',
            }}>Active</div>
          )}
        </>
      ) : (
        <>
          {/* Top row: icon + lock */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
            <div style={{
              width: 28, height: 28, borderRadius: 5,
              background: active ? 'rgba(255,255,255,0.14)' : (isSafety ? '#ECEAE3' : '#F7F6F2'),
              color: active ? '#FFFFFF' : (locked ? '#6B7280' : '#0F1B2D'),
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              {window.renderIcon(v.icon, 16)}
            </div>
            {locked ? (
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: 4,
                padding: '2px 6px', borderRadius: 3,
                background: '#ECEAE3', color: '#B8763E',
                fontSize: 9, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase',
              }}>
                {window.renderIcon('lock', 10, '#B8763E')}
                PRO
              </div>
            ) : active ? (
              <div style={{
                fontSize: 9, letterSpacing: '0.14em', color: '#E0C98A',
                fontWeight: 600, textTransform: 'uppercase',
              }}>Active</div>
            ) : null}
          </div>

          {/* Label */}
          <div style={{ fontSize: 13, fontWeight: 500, lineHeight: 1.25, width: '100%' }}>
            {v.label}
          </div>

          {/* Palette strip */}
          <div style={{ opacity: active ? 0.9 : 1 }}>
            {paletteStrip()}
          </div>
        </>
      )}
    </button>
  );
}

// ─── Inline upgrade popover ──────────────────────────────────────────────
function UpgradePopover({ v, onDismiss, onUpgrade, anchor = 'center' }) {
  // A mini preview — show the variable's palette as a stylised map thumbnail
  return (
    <div style={{
      position: 'absolute',
      zIndex: 30,
      ...(anchor === 'center' ? { left: '50%', transform: 'translateX(-50%)', top: 'calc(100% + 8px)' } :
         anchor === 'right' ? { right: 0, top: 'calc(100% + 8px)' } :
         { left: 0, top: 'calc(100% + 8px)' }),
      width: 300,
      background: '#FFFFFF',
      border: '1px solid #D9D5C8',
      borderRadius: 8,
      padding: 14,
      boxShadow: '0 8px 24px rgba(15,27,45,0.12), 0 16px 40px rgba(15,27,45,0.08)',
      fontFamily: "'IBM Plex Sans', system-ui",
      color: '#0F1B2D',
      animation: 'wtgPopoverIn 200ms cubic-bezier(0.4,0,0.2,1)',
    }}>
      <style>{`
        @keyframes wtgPopoverIn {
          from { opacity: 0; transform: translate(-50%, -4px); }
          to   { opacity: 1; transform: translate(-50%, 0); }
        }
      `}</style>

      {/* Preview thumbnail */}
      <div style={{
        height: 72, borderRadius: 4, marginBottom: 10,
        background: '#E4E8EC',
        position: 'relative', overflow: 'hidden',
        border: '1px solid rgba(15,27,45,0.06)',
      }}>
        {/* Land blob recoloured by the variable's ramp */}
        <svg viewBox="0 0 300 72" style={{ width: '100%', height: '100%' }}>
          <defs>
            <linearGradient id={`grad-${v.id}`} x1="0" y1="0" x2="1" y2="0">
              {v.legend.ramp && v.legend.ramp.map((c, i) => (
                <stop key={i} offset={`${(i / (v.legend.ramp.length - 1)) * 100}%`} stopColor={c} />
              ))}
            </linearGradient>
          </defs>
          <path d="M20,20 L120,18 L140,40 L100,55 L40,52 Z" fill={`url(#grad-${v.id})`} opacity="0.95" />
          <path d="M150,15 L270,20 L265,50 L180,55 L160,40 Z" fill={`url(#grad-${v.id})`} opacity="0.95" />
          <path d="M175,55 L235,55 L225,66 L185,65 Z" fill={`url(#grad-${v.id})`} opacity="0.95" />
        </svg>
        <div style={{ position: 'absolute', top: 6, left: 6, display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 6px', background: 'rgba(255,255,255,0.92)', borderRadius: 2, fontSize: 9, fontFamily: "'IBM Plex Mono'", color: '#0F1B2D', letterSpacing: '0.08em', fontWeight: 500, textTransform: 'uppercase' }}>
          Preview · {v.label}
        </div>
      </div>

      {/* Copy */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
        {window.renderIcon('sparkle', 12, '#B8763E', '#B8763E')}
        <div style={{ fontSize: 10, letterSpacing: '0.14em', color: '#B8763E', fontWeight: 600, textTransform: 'uppercase' }}>
          Premium
        </div>
      </div>
      <div style={{ fontFamily: "'IBM Plex Serif', serif", fontSize: 16, fontWeight: 500, lineHeight: 1.25 }}>
        {v.label}
      </div>
      <div style={{ fontSize: 12.5, color: '#4A5568', marginTop: 4, lineHeight: 1.45 }}>
        {v.desc}
      </div>

      {/* CTAs */}
      <div style={{ display: 'flex', gap: 6, marginTop: 12 }}>
        <button onClick={onUpgrade} style={{
          flex: 1, background: '#0F1B2D', color: '#FFFFFF', border: 'none',
          borderRadius: 4, padding: '8px 10px', fontSize: 12.5, fontWeight: 500,
          cursor: 'pointer', fontFamily: "'IBM Plex Sans'",
        }}>Try Premium · €2.99/mo</button>
        <button onClick={onDismiss} style={{
          background: 'transparent', color: '#4A5568', border: 'none',
          borderRadius: 4, padding: '8px 10px', fontSize: 12.5, fontWeight: 500,
          cursor: 'pointer', fontFamily: "'IBM Plex Sans'",
        }}>Dismiss</button>
      </div>
    </div>
  );
}

// ─── Main modal ──────────────────────────────────────────────────────────
function DisplayModeModal({ activeId, onChange, isPremium = false, layout = 'desktop', title = 'Display mode', subtitle = 'Choose what the map shows', onClose }) {
  const [popoverFor, setPopoverFor] = useModalState(null);

  const groups = window.VARIABLE_GROUPS;
  const hero = groups.find(g => g.id === 'hero');
  const climate = groups.find(g => g.id === 'climate');
  const safety = groups.find(g => g.id === 'safety');
  const premium = groups.find(g => g.id === 'premium');

  const cols = layout === 'mobile' ? 2 : 3;

  const tile = (id) => {
    const v = window.VARIABLES[id];
    const locked = v.tier === 'premium' && !isPremium;
    const active = activeId === id;
    return (
      <div key={id} style={{ position: 'relative' }}>
        <VariableTile
          v={v}
          active={active}
          locked={locked}
          layout={layout}
          popoverOpen={popoverFor === id}
          onClick={() => { setPopoverFor(null); onChange(id); }}
          onLockClick={() => setPopoverFor(popoverFor === id ? null : id)}
        />
        {popoverFor === id && (
          <UpgradePopover
            v={v}
            anchor={layout === 'mobile' ? 'center' : 'center'}
            onDismiss={() => setPopoverFor(null)}
            onUpgrade={() => setPopoverFor(null)}
          />
        )}
      </div>
    );
  };

  const sectionLabel = (label, right) => (
    <div style={{
      display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
      marginTop: 18, marginBottom: 10,
    }}>
      <div style={{ fontSize: 10, letterSpacing: '0.14em', color: '#4A5568', fontWeight: 500, textTransform: 'uppercase' }}>
        {label}
      </div>
      {right && (
        <div style={{ fontSize: 11, color: '#6B7280', fontFamily: "'IBM Plex Mono'" }}>{right}</div>
      )}
    </div>
  );

  return (
    <div style={{
      fontFamily: "'IBM Plex Sans', system-ui",
      color: '#0F1B2D',
      padding: layout === 'mobile' ? 18 : 20,
      background: '#FFFFFF',
      width: '100%',
      maxWidth: layout === 'mobile' ? 'none' : 460,
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14 }}>
        <div>
          <div style={{ fontSize: 10, letterSpacing: '0.14em', color: '#4A5568', fontWeight: 500, textTransform: 'uppercase' }}>
            {title}
          </div>
          <div style={{ fontFamily: "'IBM Plex Serif', serif", fontSize: 20, fontWeight: 500, color: '#0F1B2D', marginTop: 2, lineHeight: 1.15 }}>
            {subtitle}
          </div>
        </div>
        {onClose && (
          <button onClick={onClose} aria-label="Close" style={{
            background: 'transparent', border: 'none', color: '#4A5568',
            width: 32, height: 32, borderRadius: 4, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            {window.renderIcon('close', 16)}
          </button>
        )}
      </div>

      {/* Hero */}
      <div>{tile('preferences')}</div>

      {/* Climate */}
      {sectionLabel(climate.label)}
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: 8 }}>
        {climate.items.map(tile)}
      </div>

      {/* Safety (full-width distinct row) */}
      {sectionLabel(safety.label, 'Not a climate variable')}
      <div>{tile('safety')}</div>

      {/* Premium */}
      {sectionLabel(premium.label, isPremium ? 'Unlocked' : 'Upgrade to unlock')}
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: 8 }}>
        {premium.items.map(tile)}
      </div>

      {/* Footer note */}
      {!isPremium && (
        <div style={{
          marginTop: 16,
          padding: '10px 12px',
          background: '#F7F6F2',
          border: '1px solid #ECEAE3',
          borderRadius: 4,
          fontSize: 11.5,
          color: '#4A5568',
          lineHeight: 1.45,
        }}>
          Unlock all 10 variables, saved trips, percentile bands, and no ads for <strong style={{ color: '#0F1B2D' }}>€2.99/mo</strong>.
        </div>
      )}
    </div>
  );
}

window.DisplayModeModal = DisplayModeModal;
window.UpgradePopover = UpgradePopover;
