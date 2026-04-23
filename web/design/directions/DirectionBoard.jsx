/* global React */
// Renders a single brand direction as a vertical board.
// Consumed by wtg-brand-directions.html inside DCArtboard.

const { useMemo } = React;

function Swatch({ swatch, dark }) {
  return (
    <div className="bd-swatch">
      <div className="bd-swatch-chip" style={{ background: swatch.hex, color: dark ? '#fff' : '#000' }}>
        <span className="bd-swatch-hex">{swatch.hex}</span>
      </div>
      <div className="bd-swatch-meta">
        <div className="bd-swatch-name">{swatch.name}</div>
        {swatch.note && <div className="bd-swatch-note">{swatch.note}</div>}
      </div>
    </div>
  );
}

function ScoreRow({ score }) {
  return (
    <div className="bd-score-row">
      <div className="bd-score-chip" style={{ background: score.hex, color: score.fg }}>
        {score.label}
      </div>
      <div className="bd-score-meta">
        <div className="bd-score-hex">{score.hex}</div>
        <div className="bd-score-note">
          AA {score.ratio}{score.ratio.includes('*') ? '' : ''} · {score.note}
        </div>
      </div>
    </div>
  );
}

function TypeSpecimen({ d }) {
  const fontFor = (t) => {
    if (t === 'display') return d.type.display.family;
    if (t === 'mono') return d.type.mono.family;
    return d.type.body.family;
  };
  return (
    <div className="bd-type">
      {d.scale.map((s) => (
        <div key={s.name} className="bd-type-row" style={{
          fontFamily: `'${fontFor(s.font)}', system-ui, sans-serif`,
          fontSize: s.size,
          lineHeight: s.lh,
          fontWeight: s.weight,
          fontStyle: s.italic ? 'italic' : 'normal',
          letterSpacing: s.tracking ? `${s.tracking}em` : 'normal',
          color: d.palette.text.hex,
        }}>
          <span className="bd-type-label" style={{
            fontFamily: `'${d.type.body.family}', system-ui`,
            fontSize: 11,
            fontWeight: 500,
            letterSpacing: '0.08em',
            color: d.palette.textMuted.hex,
            textTransform: 'uppercase',
            fontStyle: 'normal',
          }}>
            {s.name} · {s.size}/{Math.round(s.size * s.lh)}
          </span>
          <span>Plan smarter. Travel sunnier.</span>
        </div>
      ))}
    </div>
  );
}

function SpacingScale({ d }) {
  const max = Math.max(...d.spacing);
  return (
    <div className="bd-spacing">
      {d.spacing.map((s) => (
        <div key={s} className="bd-spacing-row">
          <div className="bd-spacing-label" style={{ fontFamily: `'${d.type.body.family}', system-ui`, color: d.palette.textMuted.hex }}>
            {s}
          </div>
          <div className="bd-spacing-bar" style={{
            width: `${(s / max) * 100}%`,
            background: d.palette.text.hex,
            opacity: 0.85,
          }} />
        </div>
      ))}
    </div>
  );
}

function RadiiPreview({ d }) {
  const items = [
    { label: 'sm', r: d.radii.sm },
    { label: 'md', r: d.radii.md },
    { label: 'lg', r: d.radii.lg },
    { label: 'pill', r: d.radii.pill },
  ];
  return (
    <div className="bd-radii">
      {items.map((it) => (
        <div key={it.label} className="bd-radii-item">
          <div className="bd-radii-box" style={{
            borderRadius: it.r,
            background: d.palette.surface2.hex,
            border: `1px solid ${d.palette.border.hex}`,
          }} />
          <div className="bd-radii-label" style={{ fontFamily: `'${d.type.body.family}', system-ui`, color: d.palette.textMuted.hex }}>
            {it.label} · {it.r === 999 ? '∞' : `${it.r}px`}
          </div>
        </div>
      ))}
    </div>
  );
}

/* Sample components — a button, card, and badge per direction */
function SampleComponents({ d }) {
  const bodyFont = `'${d.type.body.family}', system-ui, sans-serif`;
  const displayFont = `'${d.type.display.family}', system-ui, sans-serif`;
  const monoFont = `'${d.type.mono.family}', ui-monospace, monospace`;

  // Button treatment varies by direction
  const buttons = (() => {
    if (d.id === 'atlas') {
      return (
        <div className="bd-btns">
          <button className="bd-btn" style={{
            background: d.palette.primary.hex, color: '#fff', borderRadius: d.radii.md,
            fontFamily: bodyFont, fontWeight: 500, fontSize: 14, padding: '10px 18px',
            border: 'none', letterSpacing: '0.01em',
          }}>Open the atlas</button>
          <button className="bd-btn" style={{
            background: 'transparent', color: d.palette.text.hex, borderRadius: d.radii.md,
            fontFamily: bodyFont, fontWeight: 500, fontSize: 14, padding: '10px 18px',
            border: `1px solid ${d.palette.border.hex}`,
          }}>Methodology</button>
        </div>
      );
    }
    if (d.id === 'horizon') {
      return (
        <div className="bd-btns">
          <button className="bd-btn" style={{
            background: d.palette.primary.hex, color: '#fff', borderRadius: d.radii.pill,
            fontFamily: bodyFont, fontWeight: 500, fontSize: 15, padding: '12px 22px',
            border: 'none',
          }}>Plan a trip</button>
          <button className="bd-btn" style={{
            background: d.palette.surface.hex, color: d.palette.text.hex, borderRadius: d.radii.pill,
            fontFamily: bodyFont, fontWeight: 500, fontSize: 15, padding: '12px 22px',
            border: `1px solid ${d.palette.border.hex}`,
          }}>Explore</button>
        </div>
      );
    }
    return (
      <div className="bd-btns">
        <button className="bd-btn" style={{
          background: d.palette.primary.hex, color: '#fff', borderRadius: d.radii.md,
          fontFamily: bodyFont, fontWeight: 600, fontSize: 14, padding: '9px 16px',
          border: 'none', letterSpacing: '-0.005em',
        }}>Open map →</button>
        <button className="bd-btn" style={{
          background: d.palette.surface.hex, color: d.palette.text.hex, borderRadius: d.radii.md,
          fontFamily: bodyFont, fontWeight: 500, fontSize: 14, padding: '9px 16px',
          border: `1px solid ${d.palette.border.hex}`,
        }}>⌘K Search</button>
      </div>
    );
  })();

  // Card — preview of Climate Info panel
  const card = (() => {
    if (d.id === 'atlas') {
      return (
        <div className="bd-card" style={{
          background: d.palette.surface.hex, borderRadius: d.radii.lg,
          border: `1px solid ${d.palette.border.hex}`, padding: 20,
          boxShadow: d.personality.shadow,
        }}>
          <div style={{ fontFamily: monoFont, fontSize: 10, letterSpacing: '0.12em', color: d.palette.accent.hex, textTransform: 'uppercase' }}>
            13.52° S · 71.97° W
          </div>
          <div style={{ fontFamily: displayFont, fontSize: 24, fontWeight: 500, color: d.palette.text.hex, marginTop: 6, lineHeight: 1.15 }}>
            Cusco, Peru
          </div>
          <div style={{ fontFamily: bodyFont, fontSize: 13, color: d.palette.textMuted.hex, marginTop: 4 }}>
            April · 10-year ERA5 climatology
          </div>
          <div style={{ display: 'flex', gap: 16, marginTop: 14, paddingTop: 14, borderTop: `1px solid ${d.palette.border.hex}` }}>
            <div>
              <div style={{ fontFamily: monoFont, fontSize: 18, color: d.palette.text.hex, fontWeight: 500 }}>13°</div>
              <div style={{ fontFamily: bodyFont, fontSize: 11, color: d.palette.textMuted.hex }}>mean</div>
            </div>
            <div>
              <div style={{ fontFamily: monoFont, fontSize: 18, color: d.palette.text.hex, fontWeight: 500 }}>4.8</div>
              <div style={{ fontFamily: bodyFont, fontSize: 11, color: d.palette.textMuted.hex }}>mm/d</div>
            </div>
            <div>
              <div style={{ fontFamily: monoFont, fontSize: 18, color: d.palette.text.hex, fontWeight: 500 }}>6.4</div>
              <div style={{ fontFamily: bodyFont, fontSize: 11, color: d.palette.textMuted.hex }}>h sun</div>
            </div>
          </div>
        </div>
      );
    }
    if (d.id === 'horizon') {
      return (
        <div className="bd-card" style={{
          background: d.palette.surface.hex, borderRadius: d.radii.lg,
          border: `1px solid ${d.palette.border.hex}`, padding: 24,
          boxShadow: d.personality.shadow,
        }}>
          <div style={{ fontFamily: bodyFont, fontSize: 11, letterSpacing: '0.14em', color: d.palette.textMuted.hex, textTransform: 'uppercase' }}>
            Best in April
          </div>
          <div style={{ fontFamily: displayFont, fontStyle: 'italic', fontSize: 36, fontWeight: 400, color: d.palette.text.hex, marginTop: 4, lineHeight: 1.05 }}>
            Cusco, <br/>the Sacred Valley
          </div>
          <div style={{ fontFamily: bodyFont, fontSize: 14, color: d.palette.textMuted.hex, marginTop: 10, lineHeight: 1.5 }}>
            Mild days, dry air, long evenings. Ten Aprils of data say April through early June is the window.
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
            <span style={{
              fontFamily: bodyFont, fontSize: 12, fontWeight: 500,
              padding: '6px 12px', borderRadius: d.radii.pill,
              background: d.scores[0].hex, color: d.scores[0].fg,
            }}>Perfect match</span>
            <span style={{
              fontFamily: bodyFont, fontSize: 12, fontWeight: 500,
              padding: '6px 12px', borderRadius: d.radii.pill,
              background: d.palette.surface2.hex, color: d.palette.text.hex,
            }}>13–19°C</span>
          </div>
        </div>
      );
    }
    return (
      <div className="bd-card" style={{
        background: d.palette.surface.hex, borderRadius: d.radii.lg,
        border: `1px solid ${d.palette.border.hex}`, padding: 18,
        boxShadow: d.personality.shadow,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontFamily: bodyFont, fontSize: 13, fontWeight: 500, color: d.palette.textMuted.hex }}>
            PE-CUS · Cusco
          </div>
          <div style={{
            fontFamily: monoFont, fontSize: 11, fontWeight: 500,
            padding: '3px 7px', borderRadius: d.radii.sm,
            background: d.scores[0].hex, color: d.scores[0].fg,
          }}>0.94</div>
        </div>
        <div style={{ fontFamily: displayFont, fontSize: 22, fontWeight: 600, color: d.palette.text.hex, marginTop: 8, letterSpacing: '-0.01em' }}>
          Match: Perfect
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 1, marginTop: 14, background: d.palette.border.hex, borderRadius: d.radii.md, overflow: 'hidden', border: `1px solid ${d.palette.border.hex}` }}>
          {[
            { label: 'Temp', val: '13°', sub: '±3' },
            { label: 'Rain', val: '4.8', sub: 'mm/d' },
            { label: 'Sun',  val: '6.4', sub: 'h/d' },
          ].map((s) => (
            <div key={s.label} style={{ background: d.palette.surface.hex, padding: 10 }}>
              <div style={{ fontFamily: bodyFont, fontSize: 10, color: d.palette.textMuted.hex, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{s.label}</div>
              <div style={{ fontFamily: monoFont, fontSize: 16, color: d.palette.text.hex, fontWeight: 500, marginTop: 2 }}>{s.val}</div>
              <div style={{ fontFamily: bodyFont, fontSize: 10, color: d.palette.textMuted.hex }}>{s.sub}</div>
            </div>
          ))}
        </div>
      </div>
    );
  })();

  // Badges — full set of 4 score badges
  const badges = (
    <div className="bd-badges">
      {d.scores.map((s) => {
        const pillStyle = d.id === 'atlas'
          ? { borderRadius: d.radii.sm, padding: '5px 10px', fontWeight: 500, fontSize: 12, letterSpacing: '0.02em' }
          : d.id === 'horizon'
            ? { borderRadius: d.radii.pill, padding: '6px 14px', fontWeight: 500, fontSize: 13 }
            : { borderRadius: d.radii.sm, padding: '4px 9px', fontWeight: 600, fontSize: 11, letterSpacing: '-0.005em' };
        return (
          <span key={s.key} style={{
            ...pillStyle,
            background: s.hex, color: s.fg,
            fontFamily: bodyFont, display: 'inline-block',
          }}>
            {s.label}
          </span>
        );
      })}
    </div>
  );

  return (
    <div className="bd-samples">
      <div className="bd-samples-row">
        <div className="bd-samples-label" style={{ fontFamily: bodyFont, color: d.palette.textMuted.hex }}>Buttons</div>
        {buttons}
      </div>
      <div className="bd-samples-row">
        <div className="bd-samples-label" style={{ fontFamily: bodyFont, color: d.palette.textMuted.hex }}>Climate card</div>
        {card}
      </div>
      <div className="bd-samples-row">
        <div className="bd-samples-label" style={{ fontFamily: bodyFont, color: d.palette.textMuted.hex }}>Score badges</div>
        {badges}
      </div>
    </div>
  );
}

function DirectionBoard({ d }) {
  const bodyFont = `'${d.type.body.family}', system-ui, sans-serif`;
  const displayFont = `'${d.type.display.family}', system-ui, sans-serif`;

  const paletteEntries = Object.entries(d.palette).map(([k, v]) => ({ key: k, ...v }));
  const darkChips = new Set(['text', 'primary']);
  // chips that are dark (need white text label)
  const isDark = (k) => darkChips.has(k) || d.palette[k].hex.toLowerCase() === '#0a0a0a' || d.palette[k].hex.toLowerCase() === '#0f1b2d';

  return (
    <div className="bd-board" style={{ background: d.palette.bg.hex, color: d.palette.text.hex, fontFamily: bodyFont }}>
      {/* Header */}
      <header className="bd-header">
        <div className="bd-tag" style={{ fontFamily: bodyFont, color: d.palette.textMuted.hex }}>
          Direction · {d.id.toUpperCase()}
        </div>
        <h1 className="bd-title" style={{
          fontFamily: displayFont,
          fontStyle: d.id === 'horizon' ? 'italic' : 'normal',
          fontWeight: d.id === 'meridian' ? 600 : 500,
          letterSpacing: d.id === 'meridian' ? '-0.02em' : 'normal',
          color: d.palette.text.hex,
        }}>
          {d.name}
        </h1>
        <p className="bd-mood" style={{ color: d.palette.text.hex, fontFamily: bodyFont }}>
          {d.tagline}
        </p>
        <p className="bd-desc" style={{ color: d.palette.textMuted.hex, fontFamily: bodyFont }}>
          {d.description}
        </p>
      </header>

      {/* Palette */}
      <Section title="Palette" d={d}>
        <div className="bd-palette-grid">
          {paletteEntries.map((sw) => <Swatch key={sw.key} swatch={sw} dark={isDark(sw.key)} />)}
        </div>
      </Section>

      {/* Score colors */}
      <Section title="Score colours · WCAG AA + CVD-safe" d={d}>
        <div className="bd-scores">
          {d.scores.map((s) => <ScoreRow key={s.key} score={s} />)}
        </div>
        <div className="bd-cvd-note" style={{ fontFamily: bodyFont, color: d.palette.textMuted.hex }}>
          {d.id === 'atlas'   && 'Teal → blue → burnt → oxblood. Luminance monotonic; distinguishable under deuteranopia and protanopia.'}
          {d.id === 'horizon' && 'Viridis-adjacent sequential ramp. Monotonic luminance is CVD-safe by construction. * Yellow/green use dark text for AA.'}
          {d.id === 'meridian'&& 'Okabe-Ito qualitative palette. Designed by Masataka Okabe & Kei Ito specifically for CVD safety; the most rigorous choice of the three.'}
        </div>
      </Section>

      {/* Advisory colours */}
      <Section title="Safety advisory tier" d={d}>
        <div className="bd-advisory">
          {d.advisory.map((a) => (
            <div key={a.key} className="bd-adv-item">
              <div className="bd-adv-dot" style={{ background: a.hex }} />
              <div className="bd-adv-label" style={{ fontFamily: bodyFont, color: d.palette.text.hex }}>{a.label}</div>
              <div className="bd-adv-hex" style={{ fontFamily: `'${d.type.mono.family}', monospace`, color: d.palette.textMuted.hex }}>{a.hex}</div>
            </div>
          ))}
        </div>
      </Section>

      {/* Typography */}
      <Section title={`Typography · ${d.type.display.family} + ${d.type.body.family}`} d={d}>
        <TypeSpecimen d={d} />
        <div className="bd-type-notes" style={{ fontFamily: bodyFont, color: d.palette.textMuted.hex }}>
          <div><strong style={{ color: d.palette.text.hex }}>Display</strong> · {d.type.display.family} — {d.type.display.note}</div>
          <div><strong style={{ color: d.palette.text.hex }}>Body</strong> · {d.type.body.family} — {d.type.body.note}</div>
          <div><strong style={{ color: d.palette.text.hex }}>Mono</strong> · {d.type.mono.family} — {d.type.mono.note}</div>
        </div>
      </Section>

      {/* Spacing + Radii */}
      <Section title="Spacing scale" d={d}>
        <SpacingScale d={d} />
      </Section>
      <Section title={`Radii · ${d.radii.note}`} d={d}>
        <RadiiPreview d={d} />
      </Section>

      {/* Sample components */}
      <Section title="Sample components" d={d}>
        <SampleComponents d={d} />
        <div className="bd-personality" style={{ fontFamily: bodyFont, color: d.palette.textMuted.hex }}>
          {d.personality.buttonFeel}
        </div>
      </Section>
    </div>
  );
}

function Section({ title, d, children }) {
  return (
    <section className="bd-section">
      <div className="bd-section-title" style={{
        fontFamily: `'${d.type.body.family}', system-ui`,
        color: d.palette.textMuted.hex,
      }}>
        {title}
      </div>
      <div className="bd-section-body">{children}</div>
    </section>
  );
}

window.DirectionBoard = DirectionBoard;
