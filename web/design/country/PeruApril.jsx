/* global React, window */
// /peru/april — single editorial month page. Matches CountryEditorial direction.
// All-static, SSR-safe. Sortable region table uses radio + CSS sibling selectors.

function PeruApril() {
  const C = window.CK_COLORS;
  const D = window.COUNTRY;
  const monthIdx = 3; // April
  const monthName = 'April';
  const monthShort = 'Apr';
  const prev = { name: 'March', slug: 'march', score: 78 };
  const next = { name: 'May',   slug: 'may',   score: 86 };

  const t = D.climate.t[monthIdx];
  const tMin = D.climate.tMin[monthIdx];
  const tMax = D.climate.tMax[monthIdx];
  const r = D.climate.r[monthIdx];
  const s = D.climate.s[monthIdx];
  const w = D.climate.w[monthIdx];
  const hum = D.climate.hum[monthIdx];

  // Aggregate score for default prefs in April → average of region scores
  const regionScores = D.regions.map(r => r.score);
  const overallScore = 81;  // editorial copy below assumes 81

  const verdict = 'Good for the highlands and coast. Wet in the Amazon basin.';

  // Neighbouring countries — same month
  const neighbours = [
    { slug: 'ecuador',  name: 'Ecuador',  score: 73, sub: 'Wetter, especially the coast' },
    { slug: 'bolivia',  name: 'Bolivia',  score: 80, sub: 'Tail end of the rainy season' },
    { slug: 'colombia', name: 'Colombia', score: 76, sub: 'Caribbean coast at its best' },
    { slug: 'chile',    name: 'Chile',    score: 88, sub: 'Autumn — Atacama, vineyards' },
    { slug: 'brazil',   name: 'Brazil',   score: 79, sub: 'Northeast peak; Amazon wet' },
    { slug: 'argentina',name: 'Argentina',score: 85, sub: 'Autumn across the country' },
  ];

  // ─── Score gauge (semi-circle SVG) ──────────────────────────
  const ScoreGauge = ({ value, size = 200 }) => {
    const R = 80, cx = 100, cy = 100;
    const startAngle = Math.PI; // 180°
    const endAngle = Math.PI * 2; // 360° (semi-circle bottom→top→bottom)
    const a = startAngle + (value / 100) * (endAngle - startAngle);
    const x1 = cx + R * Math.cos(startAngle);
    const y1 = cy + R * Math.sin(startAngle);
    const x2 = cx + R * Math.cos(a);
    const y2 = cy + R * Math.sin(a);
    const xEnd = cx + R * Math.cos(endAngle);
    const yEnd = cy + R * Math.sin(endAngle);
    const valueColor = value >= 85 ? C.perfect : value >= 70 ? C.good : value >= 55 ? C.accent : C.warm;
    return (
      <svg width={size} height={size * 0.62} viewBox="0 0 200 130">
        {/* track */}
        <path d={`M ${x1} ${y1} A ${R} ${R} 0 0 1 ${xEnd} ${yEnd}`} fill="none" stroke={C.border} strokeWidth="14" strokeLinecap="butt"/>
        {/* tick marks every 25 */}
        {[0, 25, 50, 75, 100].map(p => {
          const tA = startAngle + (p / 100) * (endAngle - startAngle);
          const x = cx + (R + 14) * Math.cos(tA);
          const y = cy + (R + 14) * Math.sin(tA);
          return <text key={p} x={x} y={y + 3} textAnchor="middle" fontSize="9" fontFamily="'IBM Plex Mono'" fill={C.inkSubtle}>{p}</text>;
        })}
        {/* value arc */}
        <path d={`M ${x1} ${y1} A ${R} ${R} 0 0 1 ${x2} ${y2}`} fill="none" stroke={valueColor} strokeWidth="14" strokeLinecap="round"/>
        {/* center value */}
        <text x={100} y={86} textAnchor="middle" fontSize="42" fontWeight="500" fontFamily="'IBM Plex Serif'" fill={C.ink} letterSpacing="-0.02em">{value}</text>
        <text x={100} y={104} textAnchor="middle" fontSize="10" fontFamily="'IBM Plex Mono'" fill={C.inkMuted} letterSpacing="0.14em">/ 100</text>
      </svg>
    );
  };

  // ─── Year-comparison sparkline (12 mini bars) ─────────────
  const YearSpark = ({ values, current, color, height = 36, format = v => v }) => {
    const W = 200, padX = 4, padY = 4;
    const max = Math.max(...values), min = Math.min(...values);
    const bw = (W - padX*2) / 12;
    const yOf = v => padY + (height - padY*2) - ((v - min) / (max - min || 1)) * (height - padY*2);
    return (
      <svg width="100%" viewBox={`0 0 ${W} ${height}`}>
        {values.map((v, i) => {
          const isCur = i === current;
          return (
            <rect key={i} x={padX + i * bw + bw*0.18} y={yOf(v)} width={bw * 0.64} height={height - padY - yOf(v)}
                  fill={isCur ? color : C.borderStrong} opacity={isCur ? 1 : 0.65} rx="1"/>
          );
        })}
        {/* current label */}
        <text x={padX + current * bw + bw/2} y={height - 1} textAnchor="middle" fontSize="6.5" fontFamily="'IBM Plex Mono'" fill={color} fontWeight="600">{format(values[current])}</text>
      </svg>
    );
  };

  // ─── Stat card (Free) ──────────────────────────────────────
  const StatCard = ({ label, valueA, valueB, sub, kind, year, current, color, ranking }) => (
    <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 4, padding: '20px 22px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
        <window.CKEyebrow>{label}</window.CKEyebrow>
        <div style={{ fontSize: 10.5, color: C.inkMuted, fontFamily: "'IBM Plex Mono'" }}>{ranking}</div>
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginTop: 4 }}>
        <div style={{ fontFamily: "'IBM Plex Serif'", fontSize: 38, fontWeight: 400, color: C.ink, letterSpacing: '-0.02em', lineHeight: 1 }}>{valueA}</div>
        {valueB && <div style={{ fontFamily: "'IBM Plex Serif'", fontSize: 22, fontWeight: 400, color: C.inkMuted, letterSpacing: '-0.01em' }}>· {valueB}</div>}
      </div>
      <div style={{ fontSize: 12, color: C.inkMuted, marginTop: 6, fontFamily: "'IBM Plex Sans'" }}>{sub}</div>
      <div style={{ marginTop: 14, paddingTop: 12, borderTop: `1px solid ${C.border}` }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
          <div style={{ fontSize: 10.5, color: C.inkSubtle, fontFamily: "'IBM Plex Mono'", letterSpacing: '0.1em', textTransform: 'uppercase' }}>vs. rest of year</div>
          <div style={{ fontSize: 10, color: C.inkSubtle, fontFamily: "'IBM Plex Mono'" }}>J F M A M J J A S O N D</div>
        </div>
        <YearSpark values={year} current={current} color={color} />
      </div>
    </div>
  );

  // ─── Region table (sortable via CSS-only radio sibling trick) ──
  const sortBy = ['score', 'temp', 'name']; // value→label
  const sortLabel = { score: 'April score', temp: 'Temp this month', name: 'A → Z' };
  const sortedByScore = [...D.regions].sort((a, b) => b.score - a.score);
  const sortedByTemp  = [...D.regions].sort((a, b) => b.tl[monthIdx] - a.tl[monthIdx]);
  const sortedByName  = [...D.regions].sort((a, b) => a.name.localeCompare(b.name));

  const RegionTable = () => (
    <div>
      <style>{`
        .rt-radio { display: none; }
        .rt-tab { padding: 6px 12px; border: 1px solid ${C.border}; background: ${C.surface}; cursor: pointer; font-size: 12px; font-family: 'IBM Plex Sans'; color: ${C.inkMuted}; user-select: none; }
        .rt-tab + .rt-tab { border-left: none; }
        .rt-tab:first-of-type { border-radius: 3px 0 0 3px; }
        .rt-tab:last-of-type { border-radius: 0 3px 3px 0; }
        #rt-score:checked ~ .rt-tabs label[for="rt-score"],
        #rt-temp:checked  ~ .rt-tabs label[for="rt-temp"],
        #rt-name:checked  ~ .rt-tabs label[for="rt-name"] { background: ${C.ink}; color: #FFF; border-color: ${C.ink}; }
        .rt-pane { display: none; }
        #rt-score:checked ~ .rt-pane.rt-pane-score,
        #rt-temp:checked  ~ .rt-pane.rt-pane-temp,
        #rt-name:checked  ~ .rt-pane.rt-pane-name { display: grid; }
      `}</style>

      <input className="rt-radio" type="radio" name="rt" id="rt-score" defaultChecked />
      <input className="rt-radio" type="radio" name="rt" id="rt-temp" />
      <input className="rt-radio" type="radio" name="rt" id="rt-name" />

      <div className="rt-tabs" style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, justifyContent: 'space-between' }}>
        <div style={{ display: 'flex' }}>
          <label className="rt-tab" htmlFor="rt-score">Sort: April score</label>
          <label className="rt-tab" htmlFor="rt-temp">Temperature</label>
          <label className="rt-tab" htmlFor="rt-name">A → Z</label>
        </div>
        <div style={{ fontSize: 11, color: C.inkSubtle, fontFamily: "'IBM Plex Mono'" }}>25 departamentos · scored against default prefs · April</div>
      </div>

      {[
        { cls: 'rt-pane-score', list: sortedByScore },
        { cls: 'rt-pane-temp',  list: sortedByTemp },
        { cls: 'rt-pane-name',  list: sortedByName },
      ].map(({ cls, list }) => (
        <div key={cls} className={`rt-pane ${cls}`} style={{ gridTemplateColumns: 'repeat(5, 1fr)', gap: 10 }}>
          {list.map(r => (
            <window.RegionCard key={r.name} region={r} current={monthIdx} href={`/peru/regions/${r.name.toLowerCase().replace(/[^a-z]/g,'-')}/april`} />
          ))}
        </div>
      ))}
    </div>
  );

  return (
    <div style={{ width: 1440, background: C.paper, color: C.ink, fontFamily: "'IBM Plex Sans'" }}>
      <window.CKPageHeader />

      {/* Breadcrumb */}
      <div style={{ padding: '14px 80px', fontSize: 12, color: C.inkMuted, fontFamily: "'IBM Plex Mono'", borderBottom: `1px solid ${C.border}`, display: 'flex', justifyContent: 'space-between' }}>
        <div>
          <a href="/" style={{ color: C.inkMuted, textDecoration: 'none' }}>Home</a> ·{' '}
          <a href="/countries" style={{ color: C.inkMuted, textDecoration: 'none' }}>Countries</a> ·{' '}
          <a href="/peru" style={{ color: C.inkMuted, textDecoration: 'none' }}>Peru</a> ·{' '}
          <span style={{ color: C.ink }}>April</span>
        </div>
        <div style={{ display: 'flex', gap: 14 }}>
          <a href={`/peru/${prev.slug}`} style={{ color: C.accent, textDecoration: 'none' }}>← {prev.name}</a>
          <a href={`/peru/${next.slug}`} style={{ color: C.accent, textDecoration: 'none' }}>{next.name} →</a>
        </div>
      </div>

      {/* HERO */}
      <div style={{ padding: '64px 80px 48px', position: 'relative' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 24 }}>
          <window.CKEyebrow>When to go · Month guide</window.CKEyebrow>
          <div style={{ flex: 1, height: 1, background: C.border }} />
          <div style={{ fontSize: 11, color: C.inkMuted, fontFamily: "'IBM Plex Mono'" }}>10-yr mean · ERA5 2014–2024</div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 64, alignItems: 'end' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 18 }}>
              <window.PeruFlag w={42} h={28} />
              <div style={{ fontSize: 12, color: C.inkMuted, fontFamily: "'IBM Plex Mono'" }}>PE · April · shoulder season</div>
            </div>
            <h1 style={{
              fontFamily: "'IBM Plex Serif'", fontSize: 92, fontWeight: 300, lineHeight: 1.0,
              letterSpacing: '-0.028em', margin: 0, color: C.ink, textWrap: 'balance',
            }}>
              Peru in <span style={{ fontStyle: 'italic', color: C.accentDeep }}>April.</span>
            </h1>
            <div style={{ fontFamily: "'IBM Plex Serif'", fontSize: 22, fontWeight: 400, color: C.ink, fontStyle: 'italic', marginTop: 22, lineHeight: 1.4, maxWidth: 580 }}>
              {verdict}
            </div>
            <div style={{ fontSize: 15, color: C.inkMuted, lineHeight: 1.6, marginTop: 18, maxWidth: 580 }}>
              April is the transition out of the wet season. Highland trekking starts to open up; the coast cools toward autumn. Crowds are still low and prices are at shoulder rates — a good month if you can tolerate occasional showers in Cusco and don’t need to push into the Amazon.
            </div>

            <div style={{ display: 'flex', gap: 10, marginTop: 28 }}>
              <a href={`/map?country=peru&month=april`} style={{ background: C.ink, color: '#FFF', padding: '13px 22px', borderRadius: 4, fontSize: 14, fontWeight: 500, textDecoration: 'none' }}>Plan a trip in April →</a>
              <a href="/peru" style={{ background: 'transparent', color: C.ink, padding: '13px 18px', borderRadius: 4, fontSize: 14, fontWeight: 500, border: `1px solid ${C.border}`, textDecoration: 'none' }}>← Peru year-round</a>
            </div>
          </div>

          {/* Score gauge */}
          <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 6, padding: '24px 28px 22px', textAlign: 'center' }}>
            <window.CKEyebrow>Match score · default prefs</window.CKEyebrow>
            <div style={{ marginTop: 14, marginBottom: 6 }}>
              <ScoreGauge value={overallScore} size={240} />
            </div>
            <div style={{ fontFamily: "'IBM Plex Serif'", fontSize: 18, fontWeight: 500, color: C.ink, letterSpacing: '-0.005em' }}>
              Good — better than 8 of 12 months
            </div>
            <div style={{ fontSize: 12, color: C.inkMuted, marginTop: 4, fontFamily: "'IBM Plex Mono'" }}>
              ranks #4 for Peru · adjust prefs on the map
            </div>
          </div>
        </div>

        {/* Structured-data badge — visualises that JSON-LD TouristTrip lives on this page */}
        <div style={{
          marginTop: 36, padding: '14px 18px',
          background: '#FAF9F5', border: `1px dashed ${C.borderStrong}`, borderRadius: 4,
          display: 'flex', alignItems: 'center', gap: 14, fontFamily: "'IBM Plex Mono'", fontSize: 11.5, color: C.inkMuted,
        }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M12 2l9 5v10l-9 5-9-5V7l9-5z" stroke={C.accent} strokeWidth="1.5"/><path d="M12 12l9-5M12 12L3 7m9 5v10" stroke={C.accent} strokeWidth="1.5"/></svg>
          <div style={{ flex: 1 }}>
            <span style={{ color: C.accent, fontWeight: 600 }}>schema.org/TouristTrip</span>
            <span style={{ margin: '0 10px', color: C.borderStrong }}>·</span>
            JSON-LD embedded · name, touristType, itinerary (12 admin-1 destinations), period (2026-04-01 / 2026-04-30), provider Atlas Weather
            <span style={{ margin: '0 10px', color: C.borderStrong }}>·</span>
            <span style={{ color: C.perfect }}>● Valid</span>
          </div>
          <a href="#sd" style={{ color: C.accent, textDecoration: 'none' }}>View source →</a>
        </div>
      </div>

      {/* CLIMATE STATS — 3 free + locked premium row */}
      <div style={{ padding: '40px 80px 56px', borderTop: `1px solid ${C.border}`, background: C.surface }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 18 }}>
          <div>
            <window.CKEyebrow>Climate · April · national mean</window.CKEyebrow>
            <h2 style={{ fontFamily: "'IBM Plex Serif'", fontSize: 30, fontWeight: 400, margin: '8px 0 0', letterSpacing: '-0.012em' }}>
              What the weather usually does.
            </h2>
          </div>
          <div style={{ fontSize: 11, color: C.inkMuted, fontFamily: "'IBM Plex Mono'" }}>
            Mean of last 10 Aprils · ERA5 0.25°
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 28 }}>
          <StatCard
            label="Average temperature"
            valueA={`${tMin.toFixed(0)}°`}
            valueB={`${tMax.toFixed(0)}°C`}
            sub={`Mean ${t.toFixed(1)}°C · 10/90 percentile range`}
            year={D.climate.t}
            current={monthIdx}
            color={C.warm}
            ranking="#5 coolest of 12 months"
          />
          <StatCard
            label="Rainfall"
            valueA={`${r}`}
            valueB="mm"
            sub="Tail of the wet season · ~9 rainy days"
            year={D.climate.r}
            current={monthIdx}
            color={C.good}
            ranking="#5 wettest of 12 months"
          />
          <StatCard
            label="Sunshine"
            valueA={`${s.toFixed(1)}`}
            valueB="hr / day"
            sub="Improving toward dry season · clearer skies coming"
            year={D.climate.s}
            current={monthIdx}
            color={C.accent}
            ranking="#7 sunniest of 12 months"
          />
        </div>

        {/* Locked Premium row — same treatment as country page */}
        <div>
          <div style={{ marginBottom: 12, fontSize: 12, color: C.inkMuted, fontFamily: "'IBM Plex Mono'", letterSpacing: '0.1em', textTransform: 'uppercase' }}>Premium · 5 more variables for April</div>
          <window.LockedChartGroup>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10 }}>
              <window.ChartCard title="Wind" unit="km/h" kind="line" data={D.climate.w} months={D.climate.months} color={C.inkMuted} locked />
              <window.ChartCard title="Snow depth" unit="cm · Andes" kind="bars" data={D.climate.snow} months={D.climate.months} color="#4A6B85" maxOverride={10} locked />
              <window.ChartCard title="Sea surface" unit="°C · Pacific" kind="line" data={D.climate.sst} months={D.climate.months} color={C.good} locked />
              <window.ChartCard title="Heat index" unit="°C feels-like" kind="line" data={D.climate.heat} months={D.climate.months} color={C.warm} locked />
              <window.ChartCard title="Humidity" unit="%" kind="line" data={D.climate.hum} months={D.climate.months} color="#6B8A6E" locked />
            </div>
          </window.LockedChartGroup>
        </div>
      </div>

      {/* REGION TABLE */}
      <div style={{ padding: '64px 80px 48px' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 8 }}>
          <div>
            <window.CKEyebrow>By region · April</window.CKEyebrow>
            <h2 style={{ fontFamily: "'IBM Plex Serif'", fontSize: 30, fontWeight: 400, margin: '8px 0 0', letterSpacing: '-0.012em' }}>
              Where in Peru this month, exactly.
            </h2>
          </div>
          <a href="/map?country=peru&month=april" style={{ fontSize: 13, color: C.accent, textDecoration: 'none' }}>See on the map →</a>
        </div>
        <div style={{ fontSize: 13, color: C.inkMuted, fontFamily: "'IBM Plex Serif'", fontStyle: 'italic', marginBottom: 24, maxWidth: 720 }}>
          Click a column header to re-sort. Top of the list this month: <strong style={{ color: C.ink, fontStyle: 'normal' }}>Arequipa, Cusco, Moquegua</strong> — high, dry, clear. Bottom: <strong style={{ color: C.ink, fontStyle: 'normal' }}>Loreto and Madre de Dios</strong>, both deep in the Amazon.
        </div>
        <RegionTable />
      </div>

      {/* SAFETY */}
      <div style={{ padding: '32px 80px 56px', background: C.surface, borderTop: `1px solid ${C.border}`, borderBottom: `1px solid ${C.border}` }}>
        <div style={{ marginBottom: 22 }}>
          <window.CKEyebrow>Travel safety · April 2026</window.CKEyebrow>
          <h2 style={{ fontFamily: "'IBM Plex Serif'", fontSize: 30, fontWeight: 400, margin: '8px 0 0', letterSpacing: '-0.012em' }}>
            What the five governments say.
          </h2>
        </div>
        <window.SafetyPanel data={D.advisories} />
      </div>

      {/* PREV / NEXT MONTH for Peru */}
      <div style={{ padding: '64px 80px 32px' }}>
        <window.CKEyebrow style={{ marginBottom: 16 }}>Continue reading · Peru month-by-month</window.CKEyebrow>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          {[
            { dir: '←', meta: 'Previous month', name: prev.name, score: prev.score, slug: prev.slug, blurb: 'Rains tapering, Carnival, Lima warm, Cusco still wet.' },
            { dir: '→', meta: 'Next month',     name: next.name, score: next.score, slug: next.slug, blurb: 'Dry season begins. Cool and clear in the highlands. Great value.' },
          ].map((m, i) => (
            <a key={m.slug} href={`/peru/${m.slug}`} style={{
              display: 'block', background: C.surface, border: `1px solid ${C.border}`, borderRadius: 6,
              padding: '24px 28px', textDecoration: 'none', color: C.ink, fontFamily: "'IBM Plex Sans'",
              textAlign: i === 1 ? 'right' : 'left',
            }}>
              <div style={{ fontSize: 11, color: C.inkMuted, fontFamily: "'IBM Plex Mono'", letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 10 }}>
                {i === 0 ? `${m.dir}  ${m.meta}` : `${m.meta}  ${m.dir}`}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, justifyContent: i === 1 ? 'flex-end' : 'flex-start' }}>
                <div style={{ fontFamily: "'IBM Plex Serif'", fontSize: 36, fontWeight: 400, letterSpacing: '-0.018em' }}>Peru in {m.name}</div>
                <window.ScoreBadge score={m.score} size="md" />
              </div>
              <div style={{ fontSize: 13, color: C.inkMuted, marginTop: 8, lineHeight: 1.5 }}>{m.blurb}</div>
            </a>
          ))}
        </div>
      </div>

      {/* SAME MONTH · NEIGHBOURING COUNTRIES */}
      <div style={{ padding: '32px 80px 56px' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 16 }}>
          <window.CKEyebrow>Same month · neighbouring countries</window.CKEyebrow>
          <a href="/april" style={{ fontSize: 12, color: C.accent, textDecoration: 'none', fontFamily: "'IBM Plex Sans'" }}>All countries in April →</a>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 10 }}>
          {neighbours.map(n => (
            <a key={n.slug} href={`/${n.slug}/april`} style={{
              display: 'block', background: C.surface, border: `1px solid ${C.border}`, borderRadius: 4,
              padding: '14px 16px', textDecoration: 'none', color: C.ink, fontFamily: "'IBM Plex Sans'",
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <div style={{ fontFamily: "'IBM Plex Serif'", fontSize: 18, fontWeight: 500, letterSpacing: '-0.005em' }}>{n.name}</div>
                <window.ScoreBadge score={n.score} size="sm" />
              </div>
              <div style={{ fontSize: 11.5, color: C.inkMuted, lineHeight: 1.4, minHeight: 30 }}>{n.sub}</div>
              <div style={{ fontSize: 10.5, color: C.accent, marginTop: 8, fontFamily: "'IBM Plex Mono'" }}>/{n.slug}/april →</div>
            </a>
          ))}
        </div>
      </div>

      {/* CTA */}
      <div style={{ padding: '24px 80px 64px' }}>
        <div style={{
          background: C.ink, color: '#FFF', borderRadius: 8,
          padding: '48px 48px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 32,
        }}>
          <div style={{ maxWidth: 560 }}>
            <window.CKEyebrow color="#E0C98A">Plan an April trip</window.CKEyebrow>
            <div style={{ fontFamily: "'IBM Plex Serif'", fontSize: 32, fontWeight: 400, lineHeight: 1.15, marginTop: 10, letterSpacing: '-0.012em' }}>
              Open the map with Peru and April pre-selected. See which districts fit your weather.
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10, flexShrink: 0 }}>
            <a href="/map?country=peru&month=april" style={{ background: '#E0C98A', color: C.ink, padding: '13px 22px', borderRadius: 4, fontSize: 14, fontWeight: 600, textDecoration: 'none' }}>Open map · Peru, April</a>
            <a href="/pricing" style={{ background: 'transparent', color: '#FFF', padding: '13px 20px', borderRadius: 4, fontSize: 14, fontWeight: 500, textDecoration: 'none', border: '1px solid rgba(255,255,255,0.28)' }}>Try Premium · €2.99</a>
          </div>
        </div>
      </div>

      <window.CKPageFooter />
    </div>
  );
}

window.PeruApril = PeruApril;
