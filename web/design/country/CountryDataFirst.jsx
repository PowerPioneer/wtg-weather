/* global React, window */
// VARIATION 2 — Data-first / Wikipedia-style. Right-rail infobox, dense typography,
// rules not boxes. Same no-JS compliance, same content inventory.

function CountryDataFirst() {
  const C = window.CK_COLORS;
  const D = window.COUNTRY;
  const isPremium = false;
  const currentMonthIdx = 3;
  const tempBands = { lower: D.climate.tMin, upper: D.climate.tMax };

  const fulls = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  const shorts = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const notesFull = {}; fulls.forEach((f, i) => notesFull[f] = D.monthNotes[shorts[i]]);

  const Rule = ({ label, children }) => (
    <tr>
      <th style={{ textAlign: 'left', padding: '8px 14px 8px 0', fontSize: 12, color: C.inkMuted, fontWeight: 500, fontFamily: "'IBM Plex Sans'", verticalAlign: 'top', width: 140 }}>{label}</th>
      <td style={{ padding: '8px 0', fontSize: 12.5, color: C.ink, fontFamily: "'IBM Plex Mono'", verticalAlign: 'top' }}>{children}</td>
    </tr>
  );

  return (
    <div style={{ width: 1440, background: C.surface, color: C.ink, fontFamily: "'IBM Plex Sans'" }}>
      <window.CKPageHeader />

      {/* Breadcrumb + ToC strip */}
      <div style={{ padding: '10px 56px', fontSize: 11.5, color: C.inkMuted, fontFamily: "'IBM Plex Mono'", borderBottom: `1px solid ${C.border}`, display: 'flex', justifyContent: 'space-between' }}>
        <div>
          <a href="/" style={{ color: C.inkMuted, textDecoration: 'none' }}>Home</a> ·{' '}
          <a href="/countries" style={{ color: C.inkMuted, textDecoration: 'none' }}>Countries</a> ·{' '}
          <a href="#" style={{ color: C.inkMuted, textDecoration: 'none' }}>South America</a> ·{' '}
          <span style={{ color: C.ink }}>Peru</span>
        </div>
        <div style={{ display: 'flex', gap: 14 }}>
          <a href="#climate" style={{ color: C.accent, textDecoration: 'none' }}>§ Climate</a>
          <a href="#regions" style={{ color: C.accent, textDecoration: 'none' }}>§ Regions</a>
          <a href="#months" style={{ color: C.accent, textDecoration: 'none' }}>§ Months</a>
          <a href="#safety" style={{ color: C.accent, textDecoration: 'none' }}>§ Safety</a>
          <a href="#related" style={{ color: C.accent, textDecoration: 'none' }}>§ Related</a>
        </div>
      </div>

      {/* HERO + Infobox */}
      <div style={{ padding: '40px 56px 32px', display: 'grid', gridTemplateColumns: '1fr 380px', gap: 40 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 14 }}>
            <window.PeruFlag w={42} h={28} />
            <window.CKEyebrow>Country guide</window.CKEyebrow>
          </div>
          <h1 style={{ fontFamily: "'IBM Plex Serif'", fontSize: 56, fontWeight: 400, margin: 0, letterSpacing: '-0.02em', lineHeight: 1.05, color: C.ink }}>
            Peru <span style={{ fontSize: 22, color: C.inkMuted, fontWeight: 400, fontStyle: 'italic', marginLeft: 8 }}>{D.nameLocal}</span>
          </h1>
          <div style={{ display: 'flex', gap: 16, marginTop: 12, fontSize: 12, color: C.inkMuted, fontFamily: "'IBM Plex Mono'", paddingBottom: 18, borderBottom: `1px solid ${C.border}` }}>
            <span>ISO: PE</span><span>·</span><span>Capital: {D.capital}</span><span>·</span><span>Pop: {D.population}</span><span>·</span><span>Area: {D.area}</span>
          </div>
          <p style={{ fontSize: 15, color: C.ink, lineHeight: 1.62, marginTop: 18, fontFamily: "'IBM Plex Serif'" }}>
            {D.summary}
          </p>

          {/* Best months — compact pill row */}
          <div style={{ marginTop: 22 }}>
            <window.CKEyebrow>Best months to visit</window.CKEyebrow>
            <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
              {D.bestMonths.map((b, i) => (
                <div key={b.month} style={{
                  border: `1px solid ${i === 0 ? C.ink : C.border}`, borderRadius: 3,
                  padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 10,
                  background: i === 0 ? 'rgba(15,27,45,0.04)' : 'transparent',
                }}>
                  <div style={{ fontFamily: "'IBM Plex Mono'", fontSize: 11, color: C.accent }}>#{i+1}</div>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>{b.month}</div>
                  <window.ScoreBadge score={b.score} size="sm" />
                  <div style={{ fontSize: 11.5, color: C.inkMuted, fontStyle: 'italic' }}>{b.note}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Infobox */}
        <aside style={{ border: `1px solid ${C.border}`, background: '#FAF9F5' }}>
          <div style={{
            background: 'linear-gradient(180deg, #2C4A6B 0%, #8A6B4A 100%)', height: 160,
            display: 'flex', alignItems: 'flex-end', padding: '10px 14px',
            fontFamily: "'IBM Plex Mono'", fontSize: 10, color: 'rgba(247,246,242,0.85)',
          }}>PLACEHOLDER · Peru landscape</div>
          <div style={{ padding: '16px 18px', borderBottom: `1px solid ${C.border}` }}>
            <window.CKEyebrow>Quick facts</window.CKEyebrow>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', padding: '0 18px' }}>
            <tbody>
              <tr><td colSpan="2" style={{ padding: '4px 18px 0' }}/></tr>
              {[
                ['Capital', D.capital],
                ['Region', D.region],
                ['Coastline', 'Yes (Pacific, 2,414 km)'],
                ['Languages', D.language],
                ['Currency', `${D.currency} (Sol)`],
                ['Timezone', D.tz],
                ['Area', D.area],
                ['Population', D.population],
                ['Admin-1', '25 departamentos'],
                ['Admin-2', '196 provincias'],
              ].map(([k,v]) => (
                <tr key={k}><th style={{ textAlign: 'left', padding: '6px 18px 6px 18px', fontSize: 11.5, color: C.inkMuted, fontWeight: 500, borderBottom: `1px dotted ${C.border}`, width: 110 }}>{k}</th><td style={{ padding: '6px 18px 6px 0', fontSize: 12, color: C.ink, fontFamily: "'IBM Plex Mono'", borderBottom: `1px dotted ${C.border}` }}>{v}</td></tr>
              ))}
            </tbody>
          </table>
          <div style={{ padding: '14px 18px', background: C.surface, borderTop: `1px solid ${C.border}` }}>
            <window.CKEyebrow>Current advisory</window.CKEyebrow>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8 }}>
              <div style={{ width: 34, height: 34, background: D.advisories.combined.color, color: '#FFF', borderRadius: 3, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'IBM Plex Serif'", fontSize: 18, fontWeight: 500 }}>{D.advisories.combined.level}</div>
              <div>
                <div style={{ fontSize: 12.5, fontWeight: 600 }}>{D.advisories.combined.label}</div>
                <div style={{ fontSize: 10.5, color: C.inkMuted, fontFamily: "'IBM Plex Mono'" }}>5 govs · most cautious · {D.advisories.lastUpdated}</div>
              </div>
            </div>
          </div>
          <div style={{ padding: '14px 18px', borderTop: `1px solid ${C.border}` }}>
            <a href="/map?country=peru" style={{ display: 'block', background: C.ink, color: '#FFF', padding: '10px 14px', borderRadius: 3, fontSize: 12.5, fontWeight: 500, textDecoration: 'none', textAlign: 'center' }}>Open /peru on the interactive map →</a>
          </div>
        </aside>
      </div>

      {/* CLIMATE */}
      <div id="climate" style={{ padding: '32px 56px 48px', borderTop: `2px solid ${C.ink}`, marginTop: 16 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 6, marginTop: 16 }}>
          <h2 style={{ fontFamily: "'IBM Plex Serif'", fontSize: 28, fontWeight: 500, margin: 0, letterSpacing: '-0.01em' }}>
            §1&nbsp;&nbsp;Climate
          </h2>
          <div style={{ fontSize: 11, color: C.inkMuted, fontFamily: "'IBM Plex Mono'" }}>ERA5 · 2014–2024 · national aggregate · 0.25°</div>
        </div>
        <div style={{ width: 60, height: 2, background: C.accent, marginBottom: 20 }} />

        {/* Free charts */}
        <div style={{ marginBottom: 8, fontSize: 12.5, color: C.inkMuted, fontFamily: "'IBM Plex Mono'", letterSpacing: '0.04em' }}>1.1 · Free tier — four variables</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 28 }}>
          <window.ChartCard title="Temperature" unit="°C" kind="temp" data={D.climate.t} bands={tempBands} months={D.climate.months} color={C.warm} source="Mean" showBands={isPremium} />
          <window.ChartCard title="Rainfall" unit="mm" kind="bars" data={D.climate.r} months={D.climate.months} color={C.good} source="Monthly total" />
          <window.ChartCard title="Sunshine" unit="hr/d" kind="line" data={D.climate.s} months={D.climate.months} color={C.accent} source="Daily mean" />
          <window.ChartCard title="Wind speed" unit="km/h" kind="line" data={D.climate.w} months={D.climate.months} color={C.inkMuted} source="10m surface" />
        </div>

        <div style={{ marginBottom: 10, fontSize: 12.5, color: C.inkMuted, fontFamily: "'IBM Plex Mono'", letterSpacing: '0.04em' }}>1.2 · Premium tier — four additional variables + percentile bands</div>
        <window.LockedChartGroup>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
            <window.ChartCard title="Snow depth" unit="cm · Andes" kind="bars" data={D.climate.snow} months={D.climate.months} color="#4A6B85" maxOverride={10} locked />
            <window.ChartCard title="Sea surface temp." unit="°C · Pacific" kind="line" data={D.climate.sst} months={D.climate.months} color={C.good} locked />
            <window.ChartCard title="Heat index" unit="°C feels-like" kind="line" data={D.climate.heat} months={D.climate.months} color={C.warm} locked />
            <window.ChartCard title="Humidity" unit="%" kind="line" data={D.climate.hum} months={D.climate.months} color="#6B8A6E" locked />
          </div>
        </window.LockedChartGroup>
      </div>

      {/* REGIONS */}
      <div id="regions" style={{ padding: '32px 56px 48px', borderTop: `2px solid ${C.ink}` }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 6, marginTop: 16 }}>
          <h2 style={{ fontFamily: "'IBM Plex Serif'", fontSize: 28, fontWeight: 500, margin: 0, letterSpacing: '-0.01em' }}>
            §2&nbsp;&nbsp;Regions · admin-1
          </h2>
          <div style={{ fontSize: 11, color: C.inkMuted, fontFamily: "'IBM Plex Mono'" }}>25 departamentos · scores for April vs. default prefs</div>
        </div>
        <div style={{ width: 60, height: 2, background: C.accent, marginBottom: 20 }} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 8 }}>
          {D.regions.map(r => (
            <window.RegionCard key={r.name} region={r} current={currentMonthIdx} href={`/peru/regions/${r.name.toLowerCase().replace(/[^a-z]/g,'-')}`} />
          ))}
        </div>
      </div>

      {/* MONTHS */}
      <div id="months" style={{ padding: '32px 56px 48px', borderTop: `2px solid ${C.ink}` }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 6, marginTop: 16 }}>
          <h2 style={{ fontFamily: "'IBM Plex Serif'", fontSize: 28, fontWeight: 500, margin: 0, letterSpacing: '-0.01em' }}>
            §3&nbsp;&nbsp;Month by month
          </h2>
          <div style={{ fontSize: 11, color: C.inkMuted, fontFamily: "'IBM Plex Mono'" }}>Each expands; links to /peru/&lt;month&gt;</div>
        </div>
        <div style={{ width: 60, height: 2, background: C.accent, marginBottom: 20 }} />
        <window.MonthAccordion months={fulls} notes={notesFull} climate={D.climate} slug={D.slug} openMonth="June" />
      </div>

      {/* SAFETY */}
      <div id="safety" style={{ padding: '32px 56px 48px', borderTop: `2px solid ${C.ink}` }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 6, marginTop: 16 }}>
          <h2 style={{ fontFamily: "'IBM Plex Serif'", fontSize: 28, fontWeight: 500, margin: 0, letterSpacing: '-0.01em' }}>
            §4&nbsp;&nbsp;Travel safety
          </h2>
          <div style={{ fontSize: 11, color: C.inkMuted, fontFamily: "'IBM Plex Mono'" }}>5 govs · updated {D.advisories.lastUpdated}</div>
        </div>
        <div style={{ width: 60, height: 2, background: C.accent, marginBottom: 20 }} />
        <window.SafetyPanel data={D.advisories} />
      </div>

      {/* RELATED */}
      <div id="related" style={{ padding: '32px 56px 48px', borderTop: `2px solid ${C.ink}` }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 6, marginTop: 16 }}>
          <h2 style={{ fontFamily: "'IBM Plex Serif'", fontSize: 28, fontWeight: 500, margin: 0, letterSpacing: '-0.01em' }}>
            §5&nbsp;&nbsp;Related destinations
          </h2>
          <div style={{ fontSize: 11, color: C.inkMuted, fontFamily: "'IBM Plex Mono'" }}>Similar climate signatures</div>
        </div>
        <div style={{ width: 60, height: 2, background: C.accent, marginBottom: 20 }} />
        <window.RelatedGrid items={D.related} />
      </div>

      {/* CTA */}
      <div style={{ padding: '32px 56px 48px', borderTop: `2px solid ${C.ink}` }}>
        <div style={{ border: `1px solid ${C.border}`, padding: '28px 32px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#FAF9F5' }}>
          <div>
            <div style={{ fontFamily: "'IBM Plex Serif'", fontSize: 22, fontWeight: 500, letterSpacing: '-0.01em' }}>Open /peru on the interactive map</div>
            <div style={{ fontSize: 13, color: C.inkMuted, marginTop: 4 }}>Admin-2 zoom, all variables, your preferences. Free to start.</div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <a href="/map?country=peru" style={{ background: C.ink, color: '#FFF', padding: '11px 18px', borderRadius: 3, fontSize: 13, fontWeight: 500, textDecoration: 'none' }}>Open map</a>
            <a href="/pricing" style={{ background: 'transparent', color: C.ink, padding: '11px 16px', borderRadius: 3, fontSize: 13, fontWeight: 500, border: `1px solid ${C.border}`, textDecoration: 'none' }}>Try Premium · €2.99</a>
          </div>
        </div>
      </div>

      <window.CKPageFooter />
    </div>
  );
}

window.CountryDataFirst = CountryDataFirst;
