/* global React, window */
// VARIATION C — Utilitarian. Linear-grade. 5 tiers in a tight row, comparison is the hero.
// Zero decoration. Every pixel has a job. For operators who already know what they want.

function VariationUtilitarian() {
  const C = window.PRICING_COLORS;
  const [billing, setBilling] = React.useState('yearly');
  const P = window.PRICING;

  return (
    <div style={{ width: 1440, background: C.surface, color: C.ink, fontFamily: "'IBM Plex Sans'" }}>
      <window.PageHeader dense />

      {/* HERO — single line, tight */}
      <div style={{ padding: '56px 56px 40px', borderBottom: `1px solid ${C.border}` }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: 48, alignItems: 'end' }}>
          <div>
            <window.Eyebrow>Pricing</window.Eyebrow>
            <h1 style={{
              fontFamily: "'IBM Plex Sans'", fontSize: 40, fontWeight: 500, lineHeight: 1.1,
              letterSpacing: '-0.022em', margin: '10px 0 12px', color: C.ink,
            }}>
              Free to explore. €2.99/mo to go deep. €39+/mo for agencies.
            </h1>
            <div style={{ fontSize: 14, color: C.inkMuted, lineHeight: 1.5, maxWidth: 640 }}>
              10-year ERA5 climate averages. 5-government travel advisories. No trials, no upsells, no surprise charges. Cancel any time from the Paddle portal.
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 14 }}>
            <window.BillingToggle value={billing} onChange={setBilling} />
            <div style={{ fontSize: 11.5, color: C.inkMuted, fontFamily: "'IBM Plex Mono'" }}>EUR shown · VAT handled by Paddle</div>
          </div>
        </div>
      </div>

      {/* TIER STRIP — 5 columns, compact, connected by a single row */}
      <div style={{ padding: '0', borderBottom: `1px solid ${C.border}` }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', borderTop: 'none' }}>
          {P.tiers.map((t, i) => (
            <div key={t.id} style={{
              padding: '28px 24px 24px',
              borderRight: i === 4 ? 'none' : `1px solid ${C.border}`,
              background: t.id === 'premium' ? C.ink : C.surface,
              color: t.id === 'premium' ? '#FFF' : C.ink,
              position: 'relative',
              minHeight: 340,
              display: 'flex', flexDirection: 'column',
            }}>
              {t.featured && (
                <div style={{ position: 'absolute', top: 10, right: 14, fontFamily: "'IBM Plex Mono'", fontSize: 9.5, color: '#E0C98A', letterSpacing: '0.14em', background: 'rgba(224,201,138,0.12)', padding: '2px 6px', borderRadius: 2 }}>RECOMMENDED</div>
              )}
              <div style={{ fontSize: 12, fontWeight: 600, letterSpacing: '-0.005em', marginBottom: 8, color: t.id === 'premium' ? '#FFF' : C.ink }}>
                {t.shortName || t.name}
              </div>
              <div style={{ marginBottom: 6 }}>
                <window.Price tier={t} billing={billing} size="md" />
              </div>
              <div style={{ fontSize: 11.5, color: t.id === 'premium' ? 'rgba(247,246,242,0.65)' : C.inkMuted, fontFamily: "'IBM Plex Mono'", marginBottom: 16, minHeight: 14 }}>
                {t.seats || (t.id === 'free' ? '1 seat' : t.id === 'premium' ? '1 seat' : '')}
              </div>
              <div style={{ flex: 1, fontSize: 12, color: t.id === 'premium' ? 'rgba(247,246,242,0.85)' : C.inkMuted, lineHeight: 1.5, marginBottom: 16 }}>
                {t.id === 'free' && 'Country + admin-1 zoom. 5 display modes. 10-year averages. Ad-supported.'}
                {t.id === 'premium' && 'Admin-2 zoom. 10/50/90 bands. Four extra variables. Saved trips. No ads.'}
                {t.id === 'starter' && 'Everything in Premium for 3 seats. Client mgmt, shared workspace, branded pages.'}
                {t.id === 'pro' && 'Starter for 10 seats. Priority support. Advanced filters and export.'}
                {t.id === 'enterprise' && 'Pro + unlimited seats, API, SLA, dedicated support. White-label 2026.'}
              </div>
              <button style={{
                width: '100%', padding: '10px 0', borderRadius: 3, fontSize: 13, fontWeight: 500,
                fontFamily: 'inherit', cursor: 'pointer',
                background: t.featured ? '#E0C98A' : (t.id === 'free' ? 'transparent' : C.ink),
                color: t.featured ? C.ink : (t.id === 'free' ? C.ink : '#FFF'),
                border: t.id === 'free' ? `1px solid ${C.border}` : `1px solid ${t.featured ? '#E0C98A' : C.ink}`,
              }}>{t.cta.label.replace('Try Premium · ', '').replace('Start free', 'Start free →').replace('Contact sales', 'Contact sales →').replace('Start 14-day trial', 'Start trial →')}</button>
            </div>
          ))}
        </div>
      </div>

      {/* PREMIUM VALUE STRIP — what the €2.99 actually buys, as a data-dense grid */}
      <div style={{ padding: '36px 56px', background: '#FAF9F5', borderBottom: `1px solid ${C.border}` }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 18 }}>
          <div>
            <window.Eyebrow color={C.accent}>What €2.99/mo buys you</window.Eyebrow>
            <div style={{ fontSize: 22, fontWeight: 500, letterSpacing: '-0.012em', marginTop: 6, fontFamily: "'IBM Plex Sans'" }}>{P.premiumCopy.headline}</div>
          </div>
          <div style={{ fontSize: 11, fontFamily: "'IBM Plex Mono'", color: C.inkMuted }}>vs. Free</div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 1, background: C.border, border: `1px solid ${C.border}` }}>
          {[
            ['Admin level',        'admin-1', 'admin-2 (districts)', 'city-scale detail'],
            ['Advisory view',      'combined', 'per-government',      'see divergence'],
            ['Distribution',       'mean',     '10 / 50 / 90',         'see variability'],
            ['Variables',          '5',         '9',                    '+snow, SST, humidity, heat'],
            ['Trips & alerts',     '—',         'unlimited',            'email on new matches'],
          ].map(([label, free, prem, note], i) => (
            <div key={label} style={{ background: C.surface, padding: '18px 18px' }}>
              <div style={{ fontFamily: "'IBM Plex Mono'", fontSize: 10, color: C.inkMuted, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 10 }}>{label}</div>
              <div style={{ fontSize: 12, color: C.inkSubtle, textDecoration: 'line-through', marginBottom: 4 }}>{free}</div>
              <div style={{ fontSize: 15, fontWeight: 600, color: C.ink, letterSpacing: '-0.005em', marginBottom: 6 }}>{prem}</div>
              <div style={{ fontSize: 11.5, color: C.accent, fontFamily: "'IBM Plex Mono'" }}>→ {note}</div>
            </div>
          ))}
        </div>
      </div>

      {/* COMPARISON — the star of this variation, given maximum space */}
      <div style={{ padding: '40px 56px 24px' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 16 }}>
          <div>
            <window.Eyebrow>Compare</window.Eyebrow>
            <div style={{ fontSize: 24, fontWeight: 500, letterSpacing: '-0.015em', marginTop: 4 }}>Full feature matrix</div>
          </div>
          <div style={{ display: 'flex', gap: 18, fontSize: 11.5, color: C.inkMuted, fontFamily: "'IBM Plex Mono'" }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><window.Check size={12} color={C.perfect}/> included</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><window.Dash size={12}/> not included</span>
          </div>
        </div>
        <window.ComparisonTable />
      </div>

      {/* FAQ + Trust side by side — tight */}
      <div style={{ padding: '40px 56px 24px', borderTop: `1px solid ${C.border}`, marginTop: 32 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 48 }}>
          <div>
            <window.Eyebrow>Questions</window.Eyebrow>
            <div style={{ fontSize: 22, fontWeight: 500, letterSpacing: '-0.012em', marginTop: 4, marginBottom: 20 }}>FAQ</div>
            <window.FAQ />
          </div>
          <div>
            <window.Eyebrow>Fine print</window.Eyebrow>
            <div style={{ fontSize: 22, fontWeight: 500, letterSpacing: '-0.012em', marginTop: 4, marginBottom: 20 }}>Boring. Compliant.</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 0, border: `1px solid ${C.border}`, borderRadius: 4, background: C.surface }}>
              {P.trust.signals.map((s, i) => (
                <div key={s.title} style={{
                  padding: '14px 18px',
                  borderBottom: i === P.trust.signals.length - 1 ? 'none' : `1px solid ${C.border}`,
                  display: 'grid', gridTemplateColumns: '1fr 1.8fr', gap: 16, alignItems: 'baseline',
                }}>
                  <div style={{ fontSize: 12.5, fontWeight: 600, color: C.ink }}>{s.title}</div>
                  <div style={{ fontSize: 12, color: C.inkMuted, lineHeight: 1.5 }}>{s.sub}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* FINAL CTA — single row, bar style */}
      <div style={{ padding: '48px 56px 56px' }}>
        <div style={{
          border: `1px solid ${C.border}`, borderRadius: 4, padding: '24px 28px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 24,
          background: C.surface,
        }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 600, color: C.ink, letterSpacing: '-0.005em' }}>Ready when you are.</div>
            <div style={{ fontSize: 13, color: C.inkMuted, marginTop: 3 }}>Free forever. Upgrade any time. 14-day refund. No card to start.</div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button style={{ background: 'transparent', color: C.ink, border: `1px solid ${C.border}`, padding: '10px 16px', borderRadius: 3, fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}>Open the map</button>
            <button style={{ background: C.ink, color: '#FFF', border: 'none', padding: '10px 18px', borderRadius: 3, fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}>Try Premium · €2.99/mo</button>
            <button style={{ background: 'transparent', color: C.ink, border: `1px solid ${C.border}`, padding: '10px 16px', borderRadius: 3, fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}>Agency trial →</button>
          </div>
        </div>
      </div>

      <window.PageFooter />
    </div>
  );
}

window.VariationUtilitarian = VariationUtilitarian;
