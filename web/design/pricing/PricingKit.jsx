/* global React, window */
// Pricing kit — shared primitives used by every pricing page variation.
// Atlas tokens: ink #0F1B2D, paper #F7F6F2, surface #FFFFFF, border #D9D5C8, accent #B8763E, surface2 #ECEAE3.

const { useState: usePK } = React;

// ─── Atoms ────────────────────────────────────────────────────────
const COLORS = {
  ink: '#0F1B2D', inkMuted: '#4A5568', inkSubtle: '#6B7280',
  paper: '#F7F6F2', surface: '#FFFFFF', surface2: '#ECEAE3',
  border: '#D9D5C8', borderStrong: '#B8B3A2',
  accent: '#B8763E', accentDeep: '#8A4A1E', accentSoft: '#F3E7D4',
  perfect: '#0B6E5F', good: '#0072B2',
  danger: '#7A2E2E',
};
window.PRICING_COLORS = COLORS;

function Eyebrow({ children, color = COLORS.inkMuted, style }) {
  return (
    <div style={{
      fontSize: 10.5, letterSpacing: '0.16em', color,
      fontWeight: 600, textTransform: 'uppercase',
      ...style,
    }}>{children}</div>
  );
}
window.Eyebrow = Eyebrow;

// ─── Check / dash cells ───────────────────────────────────────────
function Check({ color = COLORS.perfect, size = 14 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-label="Included">
      <path d="M5 12.5l4 4 10-10" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}
function Dash({ color = '#BDB7A4', size = 14 }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" aria-label="Not included"><path d="M6 12h12" stroke={color} strokeWidth="2" strokeLinecap="round"/></svg>;
}
window.Check = Check; window.Dash = Dash;

// ─── Billing toggle (monthly / yearly) ────────────────────────────
function BillingToggle({ value, onChange, accent = COLORS.ink }) {
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: 0,
      background: COLORS.surface, border: `1px solid ${COLORS.border}`,
      borderRadius: 999, padding: 4, fontFamily: "'IBM Plex Sans'",
    }}>
      {['monthly', 'yearly'].map(k => (
        <button key={k} onClick={() => onChange(k)} style={{
          background: value === k ? accent : 'transparent',
          color: value === k ? '#FFFFFF' : COLORS.ink,
          border: 'none', padding: '7px 16px', borderRadius: 999,
          fontSize: 13, fontWeight: 500, cursor: 'pointer',
          fontFamily: 'inherit', letterSpacing: '0.01em',
        }}>
          {k === 'monthly' ? 'Monthly' : 'Yearly'}
          {k === 'yearly' && (
            <span style={{ marginLeft: 6, fontSize: 10, fontWeight: 600, color: value === k ? '#E0C98A' : COLORS.accent }}>−33%</span>
          )}
        </button>
      ))}
    </div>
  );
}
window.BillingToggle = BillingToggle;

// ─── Price display ────────────────────────────────────────────────
function Price({ tier, billing, size = 'md' }) {
  const sizeMap = { sm: 26, md: 36, lg: 48 };
  const mainSize = sizeMap[size];
  const currencySize = mainSize * 0.5;
  const suffixSize = 13;

  if (tier.priceDisplay) {
    return (
      <div style={{ fontFamily: "'IBM Plex Serif'", fontSize: mainSize, fontWeight: 500, color: COLORS.ink, lineHeight: 1 }}>
        {tier.priceDisplay}
      </div>
    );
  }
  const amount = billing === 'yearly'
    ? (tier.id === 'premium' ? 2 : Math.round(tier.price.yearly / 12))
    : tier.price.monthly;
  const isZero = amount === 0;

  if (isZero) {
    return <div style={{ fontFamily: "'IBM Plex Serif'", fontSize: mainSize, fontWeight: 500, color: COLORS.ink, lineHeight: 1 }}>Free</div>;
  }

  // Premium yearly shows €2/mo, with footnote; others show their real monthly equivalent
  const displayAmount = (tier.id === 'premium' && billing === 'yearly') ? '2' : (amount % 1 === 0 ? amount.toFixed(0) : amount.toFixed(2));

  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, color: COLORS.ink, fontFamily: "'IBM Plex Serif'" }}>
      <span style={{ fontSize: currencySize, fontWeight: 500 }}>€</span>
      <span style={{ fontSize: mainSize, fontWeight: 500, lineHeight: 1, letterSpacing: '-0.02em' }}>{displayAmount}</span>
      <span style={{ fontSize: suffixSize, fontFamily: "'IBM Plex Sans'", fontWeight: 400, color: COLORS.inkMuted, marginLeft: 2 }}>
        {tier.price.suffix || '/mo'}
      </span>
    </div>
  );
}
window.Price = Price;

// ─── Button ───────────────────────────────────────────────────────
function TierButton({ kind = 'primary', children, onClick, size = 'md' }) {
  const sizes = {
    sm: { pad: '7px 12px', font: 12.5 },
    md: { pad: '10px 14px', font: 13.5 },
    lg: { pad: '12px 18px', font: 14 },
  };
  const s = sizes[size];
  const styles = {
    primary: { background: COLORS.ink, color: '#FFFFFF', border: `1px solid ${COLORS.ink}` },
    outline: { background: 'transparent', color: COLORS.ink, border: `1px solid ${COLORS.ink}` },
    ghost:   { background: 'transparent', color: COLORS.ink, border: `1px solid ${COLORS.border}` },
    accent:  { background: COLORS.accent, color: '#FFFFFF', border: `1px solid ${COLORS.accent}` },
  };
  return (
    <button onClick={onClick} style={{
      ...styles[kind],
      borderRadius: 4, padding: s.pad, fontSize: s.font, fontWeight: 500,
      cursor: 'pointer', fontFamily: "'IBM Plex Sans'", letterSpacing: '0.005em',
      width: '100%',
    }}>{children}</button>
  );
}
window.TierButton = TierButton;

// ─── Tier card ────────────────────────────────────────────────────
// variant: 'default' | 'featured' | 'compact' | 'dense'
function TierCard({ tier, billing, variant = 'default', featuredAccent = COLORS.ink }) {
  const featured = variant === 'featured';
  const compact = variant === 'compact';
  const dense = variant === 'dense';

  const bg = featured ? COLORS.ink : COLORS.surface;
  const fg = featured ? '#FFFFFF' : COLORS.ink;
  const muted = featured ? 'rgba(247,246,242,0.72)' : COLORS.inkMuted;
  const borderCol = featured ? COLORS.ink : COLORS.border;
  const subtleBorder = featured ? 'rgba(247,246,242,0.14)' : COLORS.border;
  const accent = featured ? '#E0C98A' : COLORS.accent;

  return (
    <div style={{
      background: bg, color: fg,
      border: `1px solid ${borderCol}`,
      borderRadius: compact ? 4 : 6,
      padding: dense ? '18px 18px 16px' : (compact ? '16px 16px' : '22px 22px 18px'),
      fontFamily: "'IBM Plex Sans'",
      boxShadow: featured ? '0 12px 32px rgba(15,27,45,0.18)' : 'none',
      position: 'relative',
      display: 'flex', flexDirection: 'column', gap: dense ? 12 : 14,
      minHeight: compact ? 0 : 480,
    }}>
      {featured && (
        <div style={{
          position: 'absolute', top: -10, left: 22,
          background: accent, color: COLORS.ink,
          padding: '3px 10px', borderRadius: 2,
          fontSize: 10, fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase',
        }}>Most travellers</div>
      )}

      {/* Header */}
      <div>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 6 }}>
          <Eyebrow color={muted}>{tier.name}</Eyebrow>
          {!featured && tier.eyebrow && (
            <div style={{ fontSize: 11, color: COLORS.inkSubtle, fontStyle: 'italic', fontFamily: "'IBM Plex Serif'" }}>{tier.eyebrow}</div>
          )}
        </div>
        <Price tier={tier} billing={billing} size={featured ? 'lg' : 'md'} />
        {tier.seats && (
          <div style={{ fontSize: 11.5, color: muted, marginTop: 4, fontFamily: "'IBM Plex Mono'" }}>{tier.seats}</div>
        )}
        {tier.id === 'premium' && billing === 'yearly' && (
          <div style={{ fontSize: 11.5, color: accent, marginTop: 4 }}>{tier.yearlyNote}</div>
        )}
        {tier.id === 'premium' && billing === 'monthly' && (
          <div style={{ fontSize: 11.5, color: muted, marginTop: 4 }}>or €24/yr · <span style={{ color: accent }}>save 33%</span></div>
        )}
      </div>

      {/* Premium headline + featured bullets */}
      {featured && (
        <div style={{ padding: '12px 0 8px', borderTop: `1px solid ${subtleBorder}` }}>
          <div style={{ fontFamily: "'IBM Plex Serif'", fontSize: 19, fontWeight: 500, lineHeight: 1.25, marginBottom: 10 }}>
            {window.PRICING.premiumCopy.headline}
          </div>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {tier.featuredBullets.map(b => (
              <li key={b} style={{ display: 'flex', gap: 8, fontSize: 13, lineHeight: 1.4 }}>
                <span style={{ color: accent, fontFamily: "'IBM Plex Mono'", flexShrink: 0, marginTop: 1 }}>◆</span>
                <span>{b}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* CTA (moved above full feature list for featured, below for others) */}
      {featured && <TierButton kind="accent">{tier.cta.label}</TierButton>}

      {/* Subline + full features */}
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 12, color: muted, marginBottom: 10 }}>{tier.subline}</div>
        <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: dense ? 6 : 7 }}>
          {tier.features.map(f => (
            <li key={f} style={{ display: 'flex', gap: 8, fontSize: 12.5, lineHeight: 1.45, color: featured ? 'rgba(247,246,242,0.88)' : COLORS.ink }}>
              <span style={{ flexShrink: 0, marginTop: 3 }}>
                <Check color={featured ? accent : COLORS.perfect} size={12} />
              </span>
              <span>{f}</span>
            </li>
          ))}
        </ul>
      </div>

      {!featured && <TierButton kind={tier.cta.kind}>{tier.cta.label}</TierButton>}
    </div>
  );
}
window.TierCard = TierCard;

// ─── Comparison table ─────────────────────────────────────────────
function ComparisonTable({ compact = false }) {
  const data = window.PRICING.comparison;
  const tiers = window.PRICING.tiers;

  const cell = (v) => {
    if (v === true) return <Check color={COLORS.perfect} />;
    if (v === false) return <Dash />;
    return <span style={{ fontFamily: "'IBM Plex Mono'", fontSize: 12, color: COLORS.ink }}>{v}</span>;
  };

  return (
    <div style={{ border: `1px solid ${COLORS.border}`, borderRadius: 6, overflow: 'hidden', background: COLORS.surface, fontFamily: "'IBM Plex Sans'" }}>
      {/* Header */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr repeat(5, 1fr)', background: COLORS.surface2, borderBottom: `1px solid ${COLORS.border}` }}>
        <div style={{ padding: '14px 20px' }}>
          <Eyebrow>Compare all features</Eyebrow>
        </div>
        {tiers.map(t => (
          <div key={t.id} style={{
            padding: '14px 10px', textAlign: 'center',
            borderLeft: `1px solid ${COLORS.border}`,
            background: t.id === 'premium' ? COLORS.ink : 'transparent',
            color: t.id === 'premium' ? '#FFFFFF' : COLORS.ink,
          }}>
            <div style={{ fontSize: 12.5, fontWeight: 600, letterSpacing: '-0.005em' }}>{t.shortName || t.name}</div>
            <div style={{ fontSize: 10.5, color: t.id === 'premium' ? 'rgba(247,246,242,0.7)' : COLORS.inkMuted, fontFamily: "'IBM Plex Mono'", marginTop: 2 }}>
              {t.id === 'enterprise' ? 'Custom' : t.id === 'free' ? 'Free' : `€${t.price.monthly}/mo`}
            </div>
          </div>
        ))}
      </div>

      {/* Groups */}
      {data.groups.map(g => (
        <React.Fragment key={g.title}>
          <div style={{ padding: '10px 20px', background: '#FAF9F5', borderBottom: `1px solid ${COLORS.border}` }}>
            <Eyebrow color={COLORS.ink}>{g.title}</Eyebrow>
          </div>
          {g.rows.map(([label, vals], idx) => (
            <div key={label} style={{
              display: 'grid', gridTemplateColumns: '2fr repeat(5, 1fr)',
              borderBottom: idx === g.rows.length - 1 ? 'none' : `1px solid ${COLORS.border}`,
              background: idx % 2 === 0 ? COLORS.surface : '#FCFBF8',
            }}>
              <div style={{ padding: '11px 20px', fontSize: 13, color: COLORS.ink }}>{label}</div>
              {vals.map((v, i) => (
                <div key={i} style={{
                  padding: '11px 10px',
                  borderLeft: `1px solid ${COLORS.border}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: i === 1 ? 'rgba(15,27,45,0.03)' : 'transparent',
                }}>{cell(v)}</div>
              ))}
            </div>
          ))}
        </React.Fragment>
      ))}
    </div>
  );
}
window.ComparisonTable = ComparisonTable;

// ─── Trust band ───────────────────────────────────────────────────
function TrustBand({ style = 'grid' }) {
  const signals = window.PRICING.trust.signals;
  if (style === 'strip') {
    return (
      <div style={{ display: 'flex', gap: 36, flexWrap: 'wrap', alignItems: 'flex-start', fontFamily: "'IBM Plex Sans'", color: COLORS.ink }}>
        {signals.map(s => (
          <div key={s.title} style={{ flex: '1 1 240px', minWidth: 240 }}>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 3 }}>{s.title}</div>
            <div style={{ fontSize: 12, color: COLORS.inkMuted, lineHeight: 1.45 }}>{s.sub}</div>
          </div>
        ))}
      </div>
    );
  }
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1, background: COLORS.border, border: `1px solid ${COLORS.border}`, borderRadius: 6, overflow: 'hidden', fontFamily: "'IBM Plex Sans'" }}>
      {signals.map(s => (
        <div key={s.title} style={{ background: COLORS.surface, padding: '20px 22px' }}>
          <div style={{ fontSize: 13.5, fontWeight: 600, color: COLORS.ink, marginBottom: 4 }}>{s.title}</div>
          <div style={{ fontSize: 12, color: COLORS.inkMuted, lineHeight: 1.45 }}>{s.sub}</div>
        </div>
      ))}
    </div>
  );
}
window.TrustBand = TrustBand;

// ─── FAQ ──────────────────────────────────────────────────────────
function FAQ({ initialOpen = 0 }) {
  const [open, setOpen] = usePK(initialOpen);
  const items = window.PRICING.faq;
  return (
    <div style={{ border: `1px solid ${COLORS.border}`, borderRadius: 6, overflow: 'hidden', background: COLORS.surface, fontFamily: "'IBM Plex Sans'" }}>
      {items.map((it, i) => (
        <div key={i} style={{ borderBottom: i === items.length - 1 ? 'none' : `1px solid ${COLORS.border}` }}>
          <button onClick={() => setOpen(open === i ? null : i)} style={{
            width: '100%', background: 'transparent', border: 'none', cursor: 'pointer',
            padding: '18px 22px', textAlign: 'left', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            fontFamily: 'inherit', color: COLORS.ink,
          }}>
            <span style={{ fontSize: 14.5, fontWeight: 500 }}>{it.q}</span>
            <span style={{ color: COLORS.inkMuted, transform: open === i ? 'rotate(45deg)' : 'rotate(0)', transition: 'transform .2s' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>
            </span>
          </button>
          {open === i && (
            <div style={{ padding: '0 22px 20px', fontSize: 13.5, color: COLORS.inkMuted, lineHeight: 1.6, maxWidth: 760 }}>
              {it.a}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
window.FAQ = FAQ;

// ─── Final CTA band ───────────────────────────────────────────────
function FinalCTA({ variant = 'default' }) {
  const bg = variant === 'dark' ? COLORS.ink : COLORS.surface2;
  const fg = variant === 'dark' ? '#FFFFFF' : COLORS.ink;
  const muted = variant === 'dark' ? 'rgba(247,246,242,0.72)' : COLORS.inkMuted;
  return (
    <div style={{ background: bg, color: fg, padding: '48px 56px', borderRadius: 8, fontFamily: "'IBM Plex Sans'", display: 'flex', alignItems: 'center', gap: 32, justifyContent: 'space-between' }}>
      <div style={{ maxWidth: 520 }}>
        <Eyebrow color={variant === 'dark' ? '#E0C98A' : COLORS.accent}>Start free</Eyebrow>
        <div style={{ fontFamily: "'IBM Plex Serif'", fontSize: 30, fontWeight: 500, lineHeight: 1.18, marginTop: 6 }}>
          Plan your next trip around the weather you actually like.
        </div>
        <div style={{ fontSize: 14, color: muted, marginTop: 8, lineHeight: 1.5 }}>
          No card required. Upgrade to Premium whenever you want more depth.
        </div>
      </div>
      <div style={{ display: 'flex', gap: 10 }}>
        <button style={{ background: variant === 'dark' ? '#E0C98A' : COLORS.ink, color: variant === 'dark' ? COLORS.ink : '#FFFFFF', border: 'none', padding: '12px 20px', borderRadius: 4, fontSize: 14, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}>Open the map</button>
        <button style={{ background: 'transparent', color: fg, border: `1px solid ${variant === 'dark' ? 'rgba(255,255,255,0.2)' : COLORS.border}`, padding: '12px 18px', borderRadius: 4, fontSize: 14, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}>Try Premium · €2.99</button>
      </div>
    </div>
  );
}
window.FinalCTA = FinalCTA;

// ─── Page header / footer shell ───────────────────────────────────
function PageHeader({ dense = false }) {
  return (
    <div style={{
      height: dense ? 56 : 64, background: COLORS.surface, borderBottom: `1px solid ${COLORS.border}`,
      display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 40px',
      fontFamily: "'IBM Plex Sans'", color: COLORS.ink,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <div style={{ width: 28, height: 28, borderRadius: 4, background: COLORS.ink, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="4" fill="#E0C98A"/><circle cx="12" cy="12" r="9" stroke="#E0C98A" strokeWidth="1.5" strokeDasharray="2 3"/></svg>
        </div>
        <div style={{ fontSize: 15, fontWeight: 600, letterSpacing: '-0.005em' }}>Where to Go for Great Weather</div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 22, fontSize: 13, color: COLORS.inkMuted }}>
        <span>Map</span>
        <span>Countries</span>
        <span style={{ color: COLORS.ink, fontWeight: 500 }}>Pricing</span>
        <span>Agencies</span>
        <span style={{ padding: '6px 12px', border: `1px solid ${COLORS.border}`, borderRadius: 4, color: COLORS.ink }}>Sign in</span>
      </div>
    </div>
  );
}
window.PageHeader = PageHeader;

function PageFooter() {
  return (
    <div style={{ borderTop: `1px solid ${COLORS.border}`, padding: '32px 56px', background: COLORS.surface, fontFamily: "'IBM Plex Sans'", fontSize: 12, color: COLORS.inkMuted, display: 'flex', justifyContent: 'space-between' }}>
      <div>© 2026 Atlas Weather · Where to Go for Great Weather</div>
      <div style={{ display: 'flex', gap: 18 }}>
        <span>Data: ECMWF ERA5 · ReliefWeb</span>
        <span>Privacy</span>
        <span>Terms</span>
        <span>Contact</span>
      </div>
    </div>
  );
}
window.PageFooter = PageFooter;
