/* global React, window */
// VARIATION 1 — Editorial / travel-magazine.
// Serif-led hero, wide imagery placeholders, editorial rhythm. All SSR-safe.

function CountryEditorial() {
  const C = window.CK_COLORS;
  const D = window.COUNTRY;
  const isPremium = false; // SSR-equivalent: assume anonymous / Free for SEO page
  const currentMonthIdx = 3; // April — renders as "current" in spark marks

  const tempBands = { lower: D.climate.tMin, upper: D.climate.tMax };

  return (
    <div style={{ width: 1440, background: C.paper, color: C.ink, fontFamily: "'IBM Plex Sans'" }}>
      <window.CKPageHeader />

      {/* Breadcrumb */}
      <div style={{ padding: '14px 80px', fontSize: 12, color: C.inkMuted, fontFamily: "'IBM Plex Mono'", borderBottom: `1px solid ${C.border}` }}>
        <a href="/" style={{ color: C.inkMuted, textDecoration: 'none' }}>Home</a>
        <span style={{ margin: '0 8px' }}>·</span>
        <a href="/countries" style={{ color: C.inkMuted, textDecoration: 'none' }}>Countries</a>
        <span style={{ margin: '0 8px' }}>·</span>
        <a href="#" style={{ color: C.inkMuted, textDecoration: 'none' }}>South America</a>
        <span style={{ margin: '0 8px' }}>·</span>
        <span style={{ color: C.ink }}>Peru</span>
      </div>

      {/* HERO — magazine masthead */}
      <div style={{ padding: '64px 80px 48px', position: 'relative' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 24 }}>
          <window.CKEyebrow>When to go · Climate guide</window.CKEyebrow>
          <div style={{ flex: 1, height: 1, background: C.border }} />
          <div style={{ fontSize: 11, color: C.inkMuted, fontFamily: "'IBM Plex Mono'" }}>Vol. III · Rev. 2026.04</div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1.35fr 1fr', gap: 56, alignItems: 'end' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 18 }}>
              <window.PeruFlag w={52} h={36} />
              <div style={{ fontSize: 12, color: C.inkMuted, fontFamily: "'IBM Plex Mono'" }}>
                PE · {D.capital} · {D.tz} · {D.area}
              </div>
            </div>
            <h1 style={{
              fontFamily: "'IBM Plex Serif'", fontSize: 96, fontWeight: 300, lineHeight: 0.98,
              letterSpacing: '-0.03em', margin: 0, color: C.ink, textWrap: 'balance',
            }}>
              Peru, <span style={{ fontStyle: 'italic', color: C.accentDeep }}>when<br/>to go.</span>
            </h1>
            <div style={{ fontSize: 16, color: C.inkMuted, lineHeight: 1.6, marginTop: 28, maxWidth: 580, fontFamily: "'IBM Plex Serif'" }}>
              {D.summary}
            </div>
          </div>

          {/* Hero image placeholder — atmospheric gradient */}
          <div style={{
            position: 'relative', height: 380, borderRadius: 4, overflow: 'hidden',
            background: 'linear-gradient(180deg, #3A5A75 0%, #8A6B4A 55%, #C4996B 100%)',
            border: `1px solid ${C.border}`,
          }}>
            <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at 30% 20%, rgba(247,246,242,0.35), transparent 45%), radial-gradient(ellipse at 75% 80%, rgba(15,27,45,0.28), transparent 50%)' }} />
            <div style={{ position: 'absolute', top: 14, left: 16, fontFamily: "'IBM Plex Mono'", fontSize: 10, color: 'rgba(247,246,242,0.85)', letterSpacing: '0.14em', background: 'rgba(15,27,45,0.4)', padding: '4px 8px', borderRadius: 2 }}>PLACEHOLDER · Sacred Valley, 06:24</div>
            <div style={{ position: 'absolute', bottom: 14, right: 16, fontFamily: "'IBM Plex Mono'", fontSize: 10, color: 'rgba(247,246,242,0.75)' }}>Photo: TBD</div>
          </div>
        </div>
      </div>

      {/* BEST MONTHS pill row */}
      <div style={{ padding: '8px 80px 56px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginBottom: 16 }}>
          <window.CKEyebrow>Best months to visit</window.CKEyebrow>
          <div style={{ fontSize: 12, color: C.inkMuted, fontStyle: 'italic', fontFamily: "'IBM Plex Serif'" }}>ranked against default preferences · adjust on the map</div>
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          {D.bestMonths.map((b, i) => (
            <div key={b.month} style={{
              background: i === 0 ? C.ink : C.surface, color: i === 0 ? '#FFF' : C.ink,
              border: `1px solid ${i === 0 ? C.ink : C.border}`, borderRadius: 4,
              padding: '16px 22px 14px', minWidth: 220, display: 'flex', alignItems: 'center', gap: 18,
            }}>
              <div style={{
                fontFamily: "'IBM Plex Mono'", fontSize: 20, fontWeight: 500,
                color: i === 0 ? '#E0C98A' : C.accent, width: 32,
              }}>#{i+1}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: "'IBM Plex Serif'", fontSize: 22, fontWeight: 500, letterSpacing: '-0.01em' }}>{b.month}</div>
                <div style={{ fontSize: 11.5, color: i === 0 ? 'rgba(247,246,242,0.72)' : C.inkMuted, marginTop: 2 }}>{b.note}</div>
              </div>
              <window.ScoreBadge score={b.score} size="md" />
            </div>
          ))}
          <a href="#months" style={{
            alignSelf: 'stretch', display: 'flex', alignItems: 'center', gap: 6,
            padding: '0 22px', fontSize: 13, color: C.accent, textDecoration: 'none',
            fontFamily: "'IBM Plex Sans'",
          }}>See every month →</a>
        </div>
      </div>

      {/* CLIMATE AT A GLANCE */}
      <div style={{ padding: '56px 80px', background: C.surface, borderTop: `1px solid ${C.border}`, borderBottom: `1px solid ${C.border}` }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 8 }}>
          <div>
            <window.CKEyebrow>Climate at a glance</window.CKEyebrow>
            <h2 style={{ fontFamily: "'IBM Plex Serif'", fontSize: 36, fontWeight: 400, margin: '8px 0 0', letterSpacing: '-0.015em' }}>
              A decade of weather, in one page.
            </h2>
          </div>
          <div style={{ fontSize: 11, color: C.inkMuted, fontFamily: "'IBM Plex Mono'", textAlign: 'right' }}>
            ECMWF ERA5 · 2014–2024 monthly mean<br/>0.25° resolution · national aggregate
          </div>
        </div>
        <div style={{ fontSize: 13, color: C.inkMuted, fontStyle: 'italic', fontFamily: "'IBM Plex Serif'", marginBottom: 24, maxWidth: 760 }}>
          These are national averages. For district-level detail, use the map. Cusco at 3,400 m does not behave like Iquitos at 100 m — the average is a polite fiction.
        </div>

        {/* Free: 4 charts in a row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 28 }}>
          <window.ChartCard title="Temperature" unit="°C" kind="temp" data={D.climate.t} bands={tempBands} months={D.climate.months} color={C.warm} source="Mean · ERA5" showBands={isPremium} />
          <window.ChartCard title="Rainfall" unit="mm/month" kind="bars" data={D.climate.r} months={D.climate.months} color={C.good} source="Total · ERA5" />
          <window.ChartCard title="Sunshine" unit="hr / day" kind="line" data={D.climate.s} months={D.climate.months} color={C.accent} source="Daily mean · ERA5" />
          <window.ChartCard title="Wind speed" unit="km/h" kind="line" data={D.climate.w} months={D.climate.months} color={C.inkMuted} source="10m surface · ERA5" />
        </div>

        {/* Locked group: 4 Premium charts */}
        <window.LockedChartGroup>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
            <window.ChartCard title="Snow depth" unit="cm · Andean stations" kind="bars" data={D.climate.snow} months={D.climate.months} color="#4A6B85" maxOverride={10} locked />
            <window.ChartCard title="Sea surface temp." unit="°C · Pacific coast" kind="line" data={D.climate.sst} months={D.climate.months} color={C.good} locked />
            <window.ChartCard title="Heat index" unit="°C feels-like" kind="line" data={D.climate.heat} months={D.climate.months} color={C.warm} locked />
            <window.ChartCard title="Humidity" unit="%" kind="line" data={D.climate.hum} months={D.climate.months} color="#6B8A6E" locked />
          </div>
        </window.LockedChartGroup>
      </div>

      {/* REGIONS */}
      <div style={{ padding: '72px 80px 56px' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 8 }}>
          <div>
            <window.CKEyebrow>By region · 25 departamentos</window.CKEyebrow>
            <h2 style={{ fontFamily: "'IBM Plex Serif'", fontSize: 36, fontWeight: 400, margin: '8px 0 0', letterSpacing: '-0.015em' }}>
              Peru, taken apart.
            </h2>
          </div>
          <a href="/map?country=peru" style={{ fontSize: 13, color: C.accent, textDecoration: 'none' }}>See on the map →</a>
        </div>
        <div style={{ fontSize: 13, color: C.inkMuted, fontFamily: "'IBM Plex Serif'", fontStyle: 'italic', marginBottom: 28, maxWidth: 640 }}>
          Scores for <strong style={{ color: C.ink, fontStyle: 'normal' }}>this month (April)</strong> against default preferences. Sparkline shows year-round temperature.
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10 }}>
          {D.regions.map(r => (
            <window.RegionCard key={r.name} region={r} current={currentMonthIdx} href={`/peru/regions/${r.name.toLowerCase().replace(/[^a-z]/g,'-')}`} />
          ))}
        </div>
      </div>

      {/* MONTHS */}
      <div id="months" style={{ padding: '56px 80px', background: C.surface, borderTop: `1px solid ${C.border}`, borderBottom: `1px solid ${C.border}` }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 28 }}>
          <div>
            <window.CKEyebrow>Month by month</window.CKEyebrow>
            <h2 style={{ fontFamily: "'IBM Plex Serif'", fontSize: 36, fontWeight: 400, margin: '8px 0 0', letterSpacing: '-0.015em' }}>
              Twelve months, twelve answers.
            </h2>
          </div>
          <div style={{ fontSize: 12, color: C.inkMuted, fontFamily: "'IBM Plex Mono'" }}>Each links to /peru/[month]</div>
        </div>
        <window.MonthAccordion months={D.climate.months.map(m => ({Jan:'January',Feb:'February',Mar:'March',Apr:'April',May:'May',Jun:'June',Jul:'July',Aug:'August',Sep:'September',Oct:'October',Nov:'November',Dec:'December'}[m]))} notes={
          (() => {
            const out = {};
            const fulls = ['January','February','March','April','May','June','July','August','September','October','November','December'];
            const shorts = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
            fulls.forEach((f, i) => out[f] = D.monthNotes[shorts[i]]);
            return out;
          })()
        } climate={D.climate} slug={D.slug} openMonth="June" />
      </div>

      {/* SAFETY */}
      <div style={{ padding: '72px 80px 56px' }}>
        <div style={{ marginBottom: 28 }}>
          <window.CKEyebrow>Travel safety</window.CKEyebrow>
          <h2 style={{ fontFamily: "'IBM Plex Serif'", fontSize: 36, fontWeight: 400, margin: '8px 0 10px', letterSpacing: '-0.015em' }}>
            Five governments. One honest view.
          </h2>
          <div style={{ fontSize: 14, color: C.inkMuted, fontFamily: "'IBM Plex Serif'", fontStyle: 'italic', maxWidth: 720 }}>
            We show the most-cautious consensus by default. Expand to see where governments agree — and where they don’t.
          </div>
        </div>
        <window.SafetyPanel data={D.advisories} />
      </div>

      {/* RELATED */}
      <div style={{ padding: '56px 80px', background: C.surface, borderTop: `1px solid ${C.border}`, borderBottom: `1px solid ${C.border}` }}>
        <div style={{ marginBottom: 24 }}>
          <window.CKEyebrow>If you liked Peru</window.CKEyebrow>
          <h2 style={{ fontFamily: "'IBM Plex Serif'", fontSize: 32, fontWeight: 400, margin: '8px 0 0', letterSpacing: '-0.015em' }}>
            Similar climates, elsewhere.
          </h2>
        </div>
        <window.RelatedGrid items={D.related} />
      </div>

      {/* CTA */}
      <div style={{ padding: '64px 80px' }}>
        <div style={{
          background: C.ink, color: '#FFF', borderRadius: 8,
          padding: '56px 56px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 32,
        }}>
          <div style={{ maxWidth: 560 }}>
            <window.CKEyebrow color="#E0C98A">Open this country on the map</window.CKEyebrow>
            <div style={{ fontFamily: "'IBM Plex Serif'", fontSize: 32, fontWeight: 400, lineHeight: 1.15, marginTop: 10, letterSpacing: '-0.012em' }}>
              Drop into Peru, admin-2 deep. Pick your preferences, see which district fits.
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <a href="/map?country=peru" style={{ background: '#E0C98A', color: C.ink, padding: '13px 22px', borderRadius: 4, fontSize: 14, fontWeight: 600, textDecoration: 'none', fontFamily: "'IBM Plex Sans'" }}>Open Peru on the map</a>
            <a href="/pricing" style={{ background: 'transparent', color: '#FFF', padding: '13px 20px', borderRadius: 4, fontSize: 14, fontWeight: 500, textDecoration: 'none', border: '1px solid rgba(255,255,255,0.28)', fontFamily: "'IBM Plex Sans'" }}>Try Premium · €2.99</a>
          </div>
        </div>
      </div>

      <window.CKPageFooter />
    </div>
  );
}

window.CountryEditorial = CountryEditorial;
