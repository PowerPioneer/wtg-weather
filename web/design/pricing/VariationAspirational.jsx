/* global React, window */
// VARIATION B — Aspirational. Mood-first. Imagery leads, cards float, more air.
// Premium sits centered below a photographic hero. For travellers who want the feeling.

function VariationAspirational() {
  const C = window.PRICING_COLORS;
  const [billing, setBilling] = React.useState('yearly');
  const P = window.PRICING;

  // Placeholder imagery — no real photos, so we compose color-field gradients
  // tuned to evoke specific climates. Honest "no slop" placeholders labelled as such.
  const Placeholder = ({ label, gradient, height = 320, children }) => (
    <div style={{
      position: 'relative', height, borderRadius: 6, overflow: 'hidden',
      background: gradient, border: `1px solid ${C.border}`,
    }}>
      <div style={{
        position: 'absolute', inset: 0,
        background: 'radial-gradient(circle at 30% 40%, rgba(255,255,255,0.14), transparent 55%)',
      }} />
      <div style={{
        position: 'absolute', top: 12, left: 14,
        fontFamily: "'IBM Plex Mono'", fontSize: 10, color: 'rgba(255,255,255,0.72)',
        letterSpacing: '0.12em', textTransform: 'uppercase',
        background: 'rgba(15,27,45,0.35)', padding: '4px 8px', borderRadius: 2,
        backdropFilter: 'blur(4px)',
      }}>{label}</div>
      {children}
    </div>
  );

  return (
    <div style={{ width: 1440, background: C.paper, color: C.ink, fontFamily: "'IBM Plex Sans'" }}>
      <window.PageHeader />

      {/* HERO — photographic mood, headline overlaid, no hard edges */}
      <div style={{ position: 'relative', padding: '0', background: C.ink }}>
        <div style={{
          position: 'relative', height: 560,
          background: 'linear-gradient(135deg, #2C4A6B 0%, #1C3452 40%, #3A5A75 70%, #C4996B 100%)',
          overflow: 'hidden',
        }}>
          {/* atmospheric wash */}
          <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at 20% 30%, rgba(224,201,138,0.25), transparent 50%), radial-gradient(ellipse at 80% 80%, rgba(184,118,62,0.28), transparent 55%)' }} />
          <div style={{ position: 'absolute', top: 16, right: 32, fontFamily: "'IBM Plex Mono'", fontSize: 10, color: 'rgba(224,201,138,0.8)', letterSpacing: '0.16em' }}>
            PLACEHOLDER · REAL IMAGERY TBD — LISBON 17:42, APRIL
          </div>

          {/* Hero content */}
          <div style={{ position: 'absolute', inset: 0, padding: '96px 96px', display: 'flex', flexDirection: 'column', justifyContent: 'center', maxWidth: 900 }}>
            <window.Eyebrow color="rgba(224,201,138,0.9)">Atlas Weather · Pricing</window.Eyebrow>
            <h1 style={{
              fontFamily: "'IBM Plex Serif'", fontSize: 78, fontWeight: 300, lineHeight: 1.0,
              letterSpacing: '-0.025em', margin: '18px 0 0', color: '#FFFFFF',
              textWrap: 'balance',
            }}>
              Find the <span style={{ fontStyle: 'italic', color: '#E0C98A' }}>weather</span><br/>
              you came for.
            </h1>
            <div style={{ fontSize: 18, color: 'rgba(247,246,242,0.82)', lineHeight: 1.5, marginTop: 28, maxWidth: 520 }}>
              Not the weather someone else wrote a press release about. Ten years of real climate data, mapped for the way you actually travel.
            </div>
          </div>
        </div>

        {/* Floating stat band overlapping hero + next section */}
        <div style={{
          position: 'relative', margin: '-40px 96px 0',
          background: C.surface, border: `1px solid ${C.border}`, borderRadius: 6,
          padding: '22px 36px', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 32,
          boxShadow: '0 20px 40px rgba(15,27,45,0.12)',
        }}>
          {[
            ['10 yrs', 'of ERA5 climate history'],
            ['5 govs', 'of travel advisories'],
            ['14 days', 'refund, no questions'],
            ['€2.99', 'a month, cancel anytime'],
          ].map(([k, v]) => (
            <div key={k}>
              <div style={{ fontFamily: "'IBM Plex Serif'", fontSize: 28, fontWeight: 400, color: C.ink, letterSpacing: '-0.01em' }}>{k}</div>
              <div style={{ fontSize: 12, color: C.inkMuted, marginTop: 2 }}>{v}</div>
            </div>
          ))}
        </div>
      </div>

      {/* INTRO + billing */}
      <div style={{ padding: '96px 96px 24px', textAlign: 'center', maxWidth: 760, margin: '0 auto' }}>
        <window.Eyebrow>Choose how you travel</window.Eyebrow>
        <h2 style={{ fontFamily: "'IBM Plex Serif'", fontSize: 44, fontWeight: 400, letterSpacing: '-0.015em', margin: '12px 0 14px', lineHeight: 1.1 }}>
          Explore freely. Upgrade when the details matter.
        </h2>
        <div style={{ fontSize: 15, color: C.inkMuted, lineHeight: 1.55, marginBottom: 28 }}>
          Start with the free map — five variables, every country, every month. Premium opens up district-level detail, variability bands, and four more variables for the trips you don’t want to get wrong.
        </div>
        <window.BillingToggle value={billing} onChange={setBilling} />
      </div>

      {/* PREMIUM — centered, large, hero of the pricing story */}
      <div style={{ padding: '24px 96px 20px' }}>
        <div style={{ maxWidth: 560, margin: '0 auto' }}>
          <window.TierCard tier={P.tiers[1]} billing={billing} variant="featured" />
        </div>
      </div>

      {/* Supporting tiers — 4-across, lighter */}
      <div style={{ padding: '32px 96px 72px' }}>
        <div style={{ textAlign: 'center', marginBottom: 20 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 12, color: C.inkMuted, fontSize: 12, fontFamily: "'IBM Plex Mono'", letterSpacing: '0.12em' }}>
            <div style={{ width: 40, height: 1, background: C.border }} />
            OR
            <div style={{ width: 40, height: 1, background: C.border }} />
          </div>
          <div style={{ fontFamily: "'IBM Plex Serif'", fontSize: 22, fontWeight: 400, color: C.ink, marginTop: 8, fontStyle: 'italic' }}>
            a plan for how you travel
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
          {[P.tiers[0], P.tiers[2], P.tiers[3], P.tiers[4]].map(t => (
            <window.TierCard key={t.id} tier={t} billing={billing} variant="default" />
          ))}
        </div>
      </div>

      {/* MOOD BAND — three placeholder "climates" with one-liner promise each */}
      <div style={{ padding: '72px 96px', background: C.surface, borderTop: `1px solid ${C.border}`, borderBottom: `1px solid ${C.border}` }}>
        <div style={{ textAlign: 'center', marginBottom: 36 }}>
          <window.Eyebrow>The map, in three moods</window.Eyebrow>
          <h3 style={{ fontFamily: "'IBM Plex Serif'", fontSize: 36, fontWeight: 400, margin: '10px 0 0', letterSpacing: '-0.012em' }}>
            What you’ll actually see.
          </h3>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20 }}>
          {[
            { label: 'TEMPERATURE · SEVILLE · JULY',
              gradient: 'linear-gradient(160deg, #D14A2E 0%, #E89B4A 55%, #F4D694 100%)',
              title: 'See the heat, not the headline.',
              body: 'Admin-2 zoom shows the coast is 6°C cooler than the inland city. The average hides the trip.' },
            { label: 'RAINFALL · KYOTO · NOVEMBER',
              gradient: 'linear-gradient(160deg, #1C3452 0%, #2A5C7A 55%, #A8C5D8 100%)',
              title: 'Read the percentile bands.',
              body: '“2 rainy days” can mean 0 or 6. Premium shows you the 10th, 50th, 90th — and you plan accordingly.' },
            { label: 'ADVISORIES · OAXACA · APRIL',
              gradient: 'linear-gradient(160deg, #4A2E7A 0%, #8A4A1E 55%, #E0C98A 100%)',
              title: 'Hear all five governments.',
              body: 'Germany says Level 2. The US says Level 1. The map shows you both, and you make the call.' },
          ].map((m, i) => (
            <div key={i}>
              <Placeholder label={m.label} gradient={m.gradient} height={280} />
              <div style={{ marginTop: 18 }}>
                <div style={{ fontFamily: "'IBM Plex Serif'", fontSize: 20, fontWeight: 500, color: C.ink, letterSpacing: '-0.005em', marginBottom: 6 }}>{m.title}</div>
                <div style={{ fontSize: 13, color: C.inkMuted, lineHeight: 1.55 }}>{m.body}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* COMPARISON — tucked below mood, smaller heading */}
      <div style={{ padding: '80px 96px 32px' }}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <window.Eyebrow>Side by side</window.Eyebrow>
          <h2 style={{ fontFamily: "'IBM Plex Serif'", fontSize: 32, fontWeight: 400, margin: '8px 0 0', letterSpacing: '-0.01em' }}>
            Everything, compared.
          </h2>
        </div>
        <window.ComparisonTable />
      </div>

      {/* TRUST — strip style, lighter than credibility variant */}
      <div style={{ padding: '48px 96px' }}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <window.Eyebrow>Why travellers trust it</window.Eyebrow>
        </div>
        <window.TrustBand style="strip" />
      </div>

      {/* FAQ */}
      <div style={{ padding: '56px 96px 64px', maxWidth: 960, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <window.Eyebrow>Questions</window.Eyebrow>
          <h2 style={{ fontFamily: "'IBM Plex Serif'", fontSize: 32, fontWeight: 400, margin: '8px 0 0', letterSpacing: '-0.01em' }}>
            You’re probably wondering.
          </h2>
        </div>
        <window.FAQ />
      </div>

      {/* FINAL CTA — photographic, echoes hero */}
      <div style={{ padding: '0 96px 96px' }}>
        <div style={{
          position: 'relative', borderRadius: 8, overflow: 'hidden',
          background: 'linear-gradient(135deg, #1C3452 0%, #3A5A75 50%, #C4996B 100%)',
          padding: '72px 64px', color: '#FFFFFF',
        }}>
          <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle at 80% 30%, rgba(224,201,138,0.22), transparent 55%)' }} />
          <div style={{ position: 'relative', maxWidth: 700 }}>
            <window.Eyebrow color="rgba(224,201,138,0.9)">Start free · No card required</window.Eyebrow>
            <div style={{ fontFamily: "'IBM Plex Serif'", fontSize: 42, fontWeight: 300, lineHeight: 1.1, letterSpacing: '-0.015em', marginTop: 14, textWrap: 'balance' }}>
              Go somewhere warm. Or cold. Or dry. Just not by accident.
            </div>
            <div style={{ fontSize: 14, color: 'rgba(247,246,242,0.82)', marginTop: 14, lineHeight: 1.5, maxWidth: 520 }}>
              Open the map, pick your preferences, see where on earth fits. Upgrade to Premium when you want to zoom in.
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 28 }}>
              <button style={{ background: '#E0C98A', color: C.ink, border: 'none', padding: '13px 22px', borderRadius: 4, fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: "'IBM Plex Sans'" }}>Open the map</button>
              <button style={{ background: 'transparent', color: '#FFF', border: '1px solid rgba(255,255,255,0.3)', padding: '13px 20px', borderRadius: 4, fontSize: 14, fontWeight: 500, cursor: 'pointer', fontFamily: "'IBM Plex Sans'" }}>Try Premium · €2.99</button>
            </div>
          </div>
        </div>
      </div>

      <window.PageFooter />
    </div>
  );
}

window.VariationAspirational = VariationAspirational;
