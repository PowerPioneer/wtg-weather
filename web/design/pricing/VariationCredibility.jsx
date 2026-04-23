/* global React, window */
// VARIATION A — Credibility. Serif-forward, dense, methodology panels, citations.
// Designed for agencies & risk-aware travellers. Layout is tight, evidence lives on the page.

function VariationCredibility() {
  const C = window.PRICING_COLORS;
  const [billing, setBilling] = React.useState('yearly');
  const P = window.PRICING;

  return (
    <div style={{ width: 1440, background: C.paper, color: C.ink, fontFamily: "'IBM Plex Sans'" }}>
      <window.PageHeader />

      {/* HERO — editorial masthead */}
      <div style={{ padding: '72px 80px 56px', borderBottom: `1px solid ${C.border}`, background: C.paper, position: 'relative' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr', gap: 64, alignItems: 'end' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 18 }}>
              <window.Eyebrow>Pricing · Atlas Weather</window.Eyebrow>
              <div style={{ flex: 1, height: 1, background: C.border }} />
              <div style={{ fontFamily: "'IBM Plex Mono'", fontSize: 11, color: C.inkMuted }}>Vol. III · Rev. 2026.04</div>
            </div>
            <h1 style={{
              fontFamily: "'IBM Plex Serif'", fontSize: 58, fontWeight: 400, lineHeight: 1.04,
              letterSpacing: '-0.018em', margin: 0, color: C.ink,
              textWrap: 'balance',
            }}>
              Honest climate data.<br/>
              <span style={{ fontStyle: 'italic', color: C.accentDeep }}>Honest pricing.</span>
            </h1>
            <div style={{ fontSize: 16, color: C.inkMuted, lineHeight: 1.55, marginTop: 22, maxWidth: 560 }}>
              Ten years of ECMWF ERA5 reanalysis, five government advisories, and a map that shows variability — not averages pretending to be certainty. Free to explore, €2.99 a month to go deeper.
            </div>

            <div style={{ display: 'flex', gap: 10, marginTop: 28 }}>
              <button style={{ background: C.ink, color: '#FFF', border: 'none', padding: '13px 22px', borderRadius: 4, fontSize: 14, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}>Open the map · Free</button>
              <button style={{ background: C.accent, color: '#FFF', border: 'none', padding: '13px 22px', borderRadius: 4, fontSize: 14, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}>Try Premium · €2.99/mo</button>
            </div>
          </div>

          {/* Right: data-source card */}
          <div style={{ border: `1px solid ${C.border}`, background: C.surface, padding: '22px 24px', borderRadius: 4, fontFamily: "'IBM Plex Mono'", fontSize: 11.5, color: C.inkMuted, lineHeight: 1.7 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10, paddingBottom: 10, borderBottom: `1px solid ${C.border}` }}>
              <span style={{ color: C.ink, fontWeight: 600 }}>DATA PROVENANCE</span>
              <span>Live</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '8px 16px' }}>
              <span>Climate</span><span style={{ color: C.ink }}>ECMWF ERA5 · 2014–2024</span>
              <span>Resolution</span><span style={{ color: C.ink }}>0.25° (~25 km)</span>
              <span>Advisories</span><span style={{ color: C.ink }}>US · UK · CA · AU · DE</span>
              <span>Advisory refresh</span><span style={{ color: C.ink }}>Daily at 04:00 UTC</span>
              <span>Admin levels</span><span style={{ color: C.ink }}>0 · 1 · 2 (GADM v4.1)</span>
              <span>Last climatology</span><span style={{ color: C.ink }}>Apr 01, 2026</span>
            </div>
            <div style={{ marginTop: 14, paddingTop: 12, borderTop: `1px solid ${C.border}`, fontSize: 11, color: C.inkSubtle }}>
              All sources cited on each chart. No proprietary blends.
            </div>
          </div>
        </div>
      </div>

      {/* BILLING TOGGLE + tier intro */}
      <div style={{ padding: '48px 80px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div>
          <div style={{ fontFamily: "'IBM Plex Serif'", fontSize: 30, fontWeight: 400, letterSpacing: '-0.01em', color: C.ink }}>
            Two plans for travellers. Three for agencies.
          </div>
          <div style={{ fontSize: 13, color: C.inkMuted, marginTop: 6 }}>Every plan includes the same honest data. You pay for depth, not access.</div>
        </div>
        <window.BillingToggle value={billing} onChange={setBilling} />
      </div>

      {/* TIER GRID — 5 across, Premium pops */}
      <div style={{ padding: '24px 80px 48px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 14, alignItems: 'stretch' }}>
          {P.tiers.map(t => (
            <window.TierCard key={t.id} tier={t} billing={billing} variant={t.featured ? 'featured' : 'default'} />
          ))}
        </div>
      </div>

      {/* METHODOLOGY / CITATIONS — hallmark of credibility direction */}
      <div style={{ padding: '56px 80px', background: C.surface, borderTop: `1px solid ${C.border}`, borderBottom: `1px solid ${C.border}` }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 56 }}>
          <div>
            <window.Eyebrow>Methodology</window.Eyebrow>
            <h2 style={{ fontFamily: "'IBM Plex Serif'", fontSize: 32, fontWeight: 400, margin: '10px 0 14px', letterSpacing: '-0.01em', lineHeight: 1.15 }}>
              Where the numbers come from.
            </h2>
            <div style={{ fontSize: 14, color: C.inkMuted, lineHeight: 1.6 }}>
              We don’t blend feeds into a proprietary “weather score.” We compute statistics directly from public climate reanalysis, show you the percentile bands, and cite the source beneath every chart.
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1, background: C.border }}>
            {[
              {
                tag: '01 · Climate',
                title: 'ERA5 Reanalysis · 2014 – 2024',
                body: 'Monthly climatologies computed from 10 years of ERA5 hourly data at 0.25° resolution. We report mean, 10th, 50th, and 90th percentile so you can see whether “18°C average” hides 7°C mornings.',
                cite: 'Hersbach et al. (2020), ECMWF. doi:10.1002/qj.3803',
              },
              {
                tag: '02 · Advisories',
                title: 'Five government sources',
                body: 'Scraped daily from travel.state.gov, gov.uk/foreign-travel-advice, travel.gc.ca, smartraveller.gov.au, auswaertiges-amt.de. We store the raw level + the issuing timestamp. Combined view uses the highest level across sources.',
                cite: 'Source URL + fetch timestamp stored per record.',
              },
              {
                tag: '03 · Geography',
                title: 'GADM v4.1 boundaries',
                body: 'Admin-0 (countries), admin-1 (states / regions), admin-2 (districts / counties). Premium unlocks admin-2 — useful for big or climatically diverse countries where the national average misleads.',
                cite: 'Global Administrative Areas, gadm.org',
              },
              {
                tag: '04 · What we don’t do',
                title: 'No forecasts. No blends. No opinions.',
                body: 'We don’t predict your vacation in July 2027. We show you what the last ten Julys looked like, with full distribution, and let you judge. We don’t combine variables into a single score; you weigh them yourself via preferences.',
                cite: 'Design principle. Non-negotiable.',
              },
            ].map(m => (
              <div key={m.tag} style={{ background: C.surface, padding: '26px 28px' }}>
                <div style={{ fontFamily: "'IBM Plex Mono'", fontSize: 10.5, color: C.accent, letterSpacing: '0.12em', marginBottom: 10 }}>{m.tag}</div>
                <div style={{ fontFamily: "'IBM Plex Serif'", fontSize: 18, fontWeight: 500, color: C.ink, marginBottom: 8, lineHeight: 1.3 }}>{m.title}</div>
                <div style={{ fontSize: 13, color: C.inkMuted, lineHeight: 1.55, marginBottom: 12 }}>{m.body}</div>
                <div style={{ fontSize: 11, color: C.inkSubtle, fontFamily: "'IBM Plex Mono'", paddingTop: 10, borderTop: `1px dotted ${C.borderStrong}` }}>{m.cite}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* COMPARISON */}
      <div style={{ padding: '64px 80px 32px' }}>
        <window.Eyebrow>Full feature comparison</window.Eyebrow>
        <h2 style={{ fontFamily: "'IBM Plex Serif'", fontSize: 32, fontWeight: 400, margin: '8px 0 24px', letterSpacing: '-0.01em' }}>
          Every feature, every tier.
        </h2>
        <window.ComparisonTable />
      </div>

      {/* TRUST / PROOF BAND */}
      <div style={{ padding: '48px 80px' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 20 }}>
          <div>
            <window.Eyebrow>What 40+ agencies rely on</window.Eyebrow>
            <h3 style={{ fontFamily: "'IBM Plex Serif'", fontSize: 24, fontWeight: 400, margin: '6px 0 0' }}>Boring, audited, compliant by default.</h3>
          </div>
          <div style={{ fontSize: 12, color: C.inkMuted, fontFamily: "'IBM Plex Mono'" }}>Updated Apr 2026</div>
        </div>
        <window.TrustBand style="grid" />
      </div>

      {/* TESTIMONIAL — single, attributed, no photo bc we don't invent faces */}
      <div style={{ padding: '32px 80px 64px' }}>
        <div style={{ borderLeft: `3px solid ${C.accent}`, paddingLeft: 28, maxWidth: 900 }}>
          <div style={{ fontFamily: "'IBM Plex Serif'", fontSize: 26, fontWeight: 400, lineHeight: 1.35, color: C.ink, fontStyle: 'italic' }}>
            “The per-government advisory view is the feature I didn’t know I needed. Germany will flag a Mexican state the US doesn’t — knowing which, and why, is the whole job.”
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 18, fontSize: 12, color: C.inkMuted, fontFamily: "'IBM Plex Mono'" }}>
            <span style={{ color: C.ink, fontWeight: 600 }}>M. Keller</span>
            <span>·</span>
            <span>Director, Latitude Travel · Munich</span>
            <span>·</span>
            <span>Agency Pro customer since 2024</span>
          </div>
        </div>
      </div>

      {/* FAQ */}
      <div style={{ padding: '56px 80px', background: C.surface, borderTop: `1px solid ${C.border}`, borderBottom: `1px solid ${C.border}` }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 56 }}>
          <div>
            <window.Eyebrow>FAQ</window.Eyebrow>
            <h2 style={{ fontFamily: "'IBM Plex Serif'", fontSize: 32, fontWeight: 400, margin: '8px 0 14px', letterSpacing: '-0.01em', lineHeight: 1.15 }}>
              Things worth checking before you pay.
            </h2>
            <div style={{ fontSize: 13, color: C.inkMuted, lineHeight: 1.6, marginBottom: 18 }}>
              Can’t find your question? Write to <span style={{ color: C.accent }}>hello@atlasweather.eu</span> — a human replies within a business day.
            </div>
          </div>
          <window.FAQ />
        </div>
      </div>

      {/* FINAL CTA */}
      <div style={{ padding: '56px 80px' }}>
        <window.FinalCTA variant="dark" />
      </div>

      <window.PageFooter />
    </div>
  );
}

window.VariationCredibility = VariationCredibility;
