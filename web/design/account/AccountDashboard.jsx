/* global React, window */
// /account — consumer dashboard. Linear-calm. Single variation.
// Nav uses radio + CSS sibling selectors. Two profile fixtures (Premium + Free) on a canvas.

function AccountDashboard({ profile = 'premium' }) {
  const C = window.CK_COLORS;
  const isFree = profile === 'free';

  const me = isFree
    ? { name: 'Sam Patel',     email: 'sam.patel@hey.com',          plan: 'Free',    since: 'Mar 2026', trips: [], favourites: [], alerts: [] }
    : { name: 'Léa Marchetti', email: 'lea.marchetti@gmail.com',    plan: 'Premium', since: 'Sep 2024', renewsAt: 'Sep 14, 2026', price: '€2.99 / mo',
        trips: [
          { id: 'trp_8h2k9p', title: 'Honeymoon · Andes & Sacred Valley', months: 'Apr – May', country: 'Peru', score: 87, regions: 10, updated: '2d ago' },
          { id: 'trp_4n7q2m', title: 'Backpack Japan',                    months: 'Oct – Nov', country: 'Japan', score: 92, regions: 14, updated: '1w ago' },
          { id: 'trp_2c5x1v', title: 'Family Christmas — somewhere warm', months: 'Dec',       country: 'Multi · 8',  score: 84, regions: 22, updated: '3w ago' },
        ],
        favourites: [
          { slug: 'peru',     name: 'Peru',     sub: 'Andes + coast + Amazon', best: 'Jun – Aug' },
          { slug: 'japan',    name: 'Japan',    sub: 'Honshu temperate',       best: 'Apr · Oct – Nov' },
          { slug: 'portugal', name: 'Portugal', sub: 'Atlantic Mediterranean', best: 'May – Sep' },
          { slug: 'morocco',  name: 'Morocco',  sub: 'Coast & High Atlas',     best: 'Mar – May · Oct' },
          { slug: 'norway',   name: 'Norway',   sub: 'Fjords & Lofoten',        best: 'Jun – Aug' },
        ],
        alerts: [
          { id: 'a1', label: 'Notify me when Cusco scores 90+ for July with my honeymoon prefs', cadence: 'Daily', last: 'Apr 22 · score 87 (no change)', on: true },
          { id: 'a2', label: 'Email me when Peru rainfall in May drops below 30 mm/mo nationally', cadence: 'Weekly', last: 'Apr 19 · 41 mm (above threshold)', on: true },
          { id: 'a3', label: 'Alert if any Level-3 advisory is issued for my favourite countries', cadence: 'Realtime', last: 'No change · 7 countries watched', on: true },
          { id: 'a4', label: 'Tell me when Japan cherry blossom forecast updates', cadence: 'Realtime', last: 'Last forecast Mar 02', on: false },
        ],
      };

  const sections = [
    { id: 'overview',   label: 'Overview',   short: 'Plan, recent activity' },
    { id: 'trips',      label: 'Saved trips', count: me.trips.length },
    { id: 'favourites', label: 'Favourites',  count: me.favourites.length },
    { id: 'alerts',     label: 'Alerts',      count: me.alerts.length },
    { id: 'settings',   label: 'Settings',    short: 'Email, sessions, units' },
    { id: 'billing',    label: 'Billing',     short: isFree ? 'Free plan' : 'Premium · €2.99/mo' },
  ];

  const radioName = `acc-nav-${profile}`;

  // ─── Tiny components ────────────────────────────────
  const SectionHead = ({ eyebrow, title, sub, action }) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', paddingBottom: 16, borderBottom: `1px solid ${C.border}`, marginBottom: 24 }}>
      <div>
        <div style={{ fontSize: 11, fontFamily: "'IBM Plex Mono'", color: C.inkSubtle, letterSpacing: '0.14em', textTransform: 'uppercase' }}>{eyebrow}</div>
        <h2 style={{ fontFamily: "'IBM Plex Serif'", fontSize: 30, fontWeight: 400, margin: '6px 0 0', letterSpacing: '-0.012em' }}>{title}</h2>
        {sub && <div style={{ fontSize: 13, color: C.inkMuted, marginTop: 6 }}>{sub}</div>}
      </div>
      {action}
    </div>
  );

  const Toggle = ({ on }) => (
    <div style={{ width: 32, height: 18, borderRadius: 10, background: on ? C.perfect : '#D9D6CD', position: 'relative', flexShrink: 0 }}>
      <div style={{ position: 'absolute', top: 2, left: on ? 16 : 2, width: 14, height: 14, borderRadius: '50%', background: '#FFF', boxShadow: '0 1px 2px rgba(0,0,0,0.15)' }}/>
    </div>
  );

  const Btn = ({ children, primary, danger, sub, icon, full }) => (
    <button style={{
      display: 'inline-flex', alignItems: 'center', gap: 8,
      background: primary ? C.ink : 'transparent',
      color: primary ? '#FFF' : danger ? '#7A2E2E' : C.ink,
      border: primary ? 'none' : `1px solid ${C.border}`,
      borderRadius: 4, padding: '8px 14px', cursor: 'pointer',
      fontFamily: "'IBM Plex Sans'", fontSize: 12.5, fontWeight: 500,
      width: full ? '100%' : 'auto', justifyContent: full ? 'center' : 'flex-start',
    }}>
      {icon}{children}{sub && <span style={{ fontSize: 11, opacity: 0.7, marginLeft: 4, fontFamily: "'IBM Plex Mono'" }}>{sub}</span>}
    </button>
  );

  // tiny static map sparkline for trip cards
  const MiniMap = ({ score, country }) => {
    const colorFor = s => s >= 90 ? C.perfect : s >= 85 ? C.good : s >= 75 ? C.accent : C.warm;
    const blocks = country === 'Japan'
      ? [[2,1],[3,1],[3,2],[2,2],[2,3],[3,3],[4,2],[4,3],[5,3],[1,4],[2,4],[3,4]]
      : country === 'Multi · 8'
      ? [[1,1],[1,2],[2,1],[2,2],[3,3],[4,3],[5,4],[6,4],[6,5]]
      : [[3,0],[3,1],[3,2],[4,2],[3,3],[4,3],[3,4],[4,4],[3,5],[2,5]];
    return (
      <svg width="100%" viewBox="0 0 80 80" style={{ background: '#FAF9F5', borderRadius: 3, display: 'block' }}>
        {Array.from({ length: 8 }).map((_, x) => Array.from({ length: 8 }).map((_, y) => {
          const filled = blocks.some(b => b[0] === x && b[1] === y);
          return <rect key={`${x}-${y}`} x={x*10} y={y*10} width="10" height="10" fill={filled ? colorFor(score) : 'transparent'} stroke={filled ? '#FFF' : C.border} strokeOpacity={filled ? 1 : 0.5} strokeWidth="0.5" fillOpacity={filled ? 0.85 : 1}/>;
        }))}
      </svg>
    );
  };

  // ─── EMPTY STATES ──────────────────────────────
  const Empty = ({ icon, title, body, primary, secondary }) => (
    <div style={{
      border: `1px dashed ${C.borderStrong}`, borderRadius: 6, padding: '56px 32px',
      textAlign: 'center', background: '#FCFBF8',
    }}>
      <div style={{ width: 44, height: 44, borderRadius: 22, background: '#FFF', border: `1px solid ${C.border}`, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: C.inkMuted, marginBottom: 16 }}>
        {icon}
      </div>
      <div style={{ fontFamily: "'IBM Plex Serif'", fontSize: 22, fontWeight: 500, color: C.ink, letterSpacing: '-0.005em' }}>{title}</div>
      <div style={{ fontSize: 13.5, color: C.inkMuted, lineHeight: 1.55, maxWidth: 440, margin: '8px auto 22px' }}>{body}</div>
      <div style={{ display: 'inline-flex', gap: 8 }}>
        {primary  && <Btn primary>{primary}</Btn>}
        {secondary && <Btn>{secondary}</Btn>}
      </div>
    </div>
  );

  // ─── SECTION CONTENTS ──────────────────────────
  const Overview = () => (
    <div>
      <SectionHead
        eyebrow="Account"
        title={`Hello, ${me.name.split(' ')[0]}.`}
        sub={`Member since ${me.since} · ${me.email}`}
      />
      {/* Plan card */}
      <div style={{
        background: isFree ? '#FCFBF8' : C.ink, color: isFree ? C.ink : '#FFF',
        border: isFree ? `1px solid ${C.border}` : 'none',
        borderRadius: 6, padding: '22px 24px', marginBottom: 24,
        display: 'flex', alignItems: 'center', gap: 24,
      }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 11, fontFamily: "'IBM Plex Mono'", letterSpacing: '0.14em', textTransform: 'uppercase', color: isFree ? C.inkSubtle : '#E0C98A', marginBottom: 6 }}>
            {isFree ? 'Current plan' : 'Premium · active'}
          </div>
          <div style={{ fontFamily: "'IBM Plex Serif'", fontSize: 28, fontWeight: 400, letterSpacing: '-0.012em' }}>
            {isFree ? 'Free' : 'Premium'}
          </div>
          <div style={{ fontSize: 12, color: isFree ? C.inkMuted : 'rgba(255,255,255,0.7)', marginTop: 4, fontFamily: "'IBM Plex Mono'" }}>
            {isFree ? 'Map · 12 months · 6 free variables · 3 saved trips max' : `Renews ${me.renewsAt} · ${me.price} · billed by Paddle`}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {isFree ? <Btn primary>Upgrade · €2.99/mo →</Btn> : <Btn>Manage on Paddle ↗</Btn>}
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 28 }}>
        {[
          { l: 'Saved trips',     v: me.trips.length,      cap: isFree ? '/ 3 on Free'  : '/ unlimited' },
          { l: 'Favourites',      v: me.favourites.length, cap: 'countries & regions' },
          { l: 'Active alerts',   v: me.alerts.filter(a => a.on).length, cap: `${me.alerts.length} total` },
          { l: 'Last sign-in',    v: 'Today', mono: true,  cap: 'Lyon · Safari 17' },
        ].map(s => (
          <div key={s.l} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 4, padding: '14px 16px' }}>
            <div style={{ fontSize: 10.5, color: C.inkSubtle, fontFamily: "'IBM Plex Mono'", letterSpacing: '0.12em', textTransform: 'uppercase' }}>{s.l}</div>
            <div style={{ fontFamily: s.mono ? "'IBM Plex Sans'" : "'IBM Plex Serif'", fontSize: s.mono ? 22 : 30, fontWeight: 400, marginTop: 4, color: C.ink, letterSpacing: '-0.012em' }}>{s.v}</div>
            <div style={{ fontSize: 11, color: C.inkMuted, marginTop: 2, fontFamily: "'IBM Plex Mono'" }}>{s.cap}</div>
          </div>
        ))}
      </div>

      {/* Recent activity */}
      <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 6 }}>
        <div style={{ padding: '12px 18px', borderBottom: `1px solid ${C.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: 11, fontFamily: "'IBM Plex Mono'", color: C.inkSubtle, letterSpacing: '0.12em', textTransform: 'uppercase' }}>Recent activity</div>
          <div style={{ fontSize: 11, fontFamily: "'IBM Plex Mono'", color: C.inkSubtle }}>last 30 days</div>
        </div>
        {(isFree ? [
          { d: 'Today',    t: 'Welcome to Atlas Weather. Magic link sent to sam.patel@hey.com', tag: 'AUTH' },
          { d: 'Today',    t: 'Account created · Free plan', tag: 'PLAN' },
        ] : [
          { d: 'Apr 22',   t: 'Trip "Honeymoon · Andes & Sacred Valley" updated · Cusco moved 2 pts', tag: 'TRIP' },
          { d: 'Apr 19',   t: 'Alert "Peru rainfall in May < 30 mm" checked · 41 mm (above threshold)', tag: 'ALERT' },
          { d: 'Apr 14',   t: 'Favourited Norway', tag: 'FAV' },
          { d: 'Apr 02',   t: 'Trip "Backpack Japan" created from /map?country=japan&month=oct', tag: 'TRIP' },
        ]).map((row, i) => (
          <div key={i} style={{ display: 'grid', gridTemplateColumns: '80px 60px 1fr', gap: 16, padding: '12px 18px', borderBottom: i === (isFree ? 1 : 3) ? 'none' : `1px solid ${C.border}`, alignItems: 'center', fontSize: 13 }}>
            <div style={{ fontFamily: "'IBM Plex Mono'", fontSize: 11.5, color: C.inkSubtle }}>{row.d}</div>
            <div style={{ fontFamily: "'IBM Plex Mono'", fontSize: 9.5, color: C.accent, letterSpacing: '0.12em' }}>{row.tag}</div>
            <div style={{ color: C.ink }}>{row.t}</div>
          </div>
        ))}
      </div>
    </div>
  );

  const Trips = () => (
    <div>
      <SectionHead
        eyebrow="Saved trips"
        title="Your trips"
        sub={isFree ? 'Free plan · save up to 3 trips. They keep updating as climate data refreshes.' : 'Trips re-score whenever ERA5 or advisory data updates.'}
        action={<Btn primary icon={<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#FFF" strokeWidth="2"><path d="M12 5v14M5 12h14"/></svg>}>New trip from map</Btn>}
      />
      {me.trips.length === 0 ? (
        <Empty
          icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M3 7l9-4 9 4v10l-9 4-9-4V7z"/><path d="M3 7l9 4 9-4M12 11v10"/></svg>}
          title="No saved trips yet."
          body="A trip is a saved combination of country, months, and what kind of weather you want. Open the map, set your preferences, hit Save."
          primary="Open the map"
          secondary="See an example trip"
        />
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
          {me.trips.map(t => (
            <a key={t.id} href={`/trips/${t.id}`} style={{
              background: C.surface, border: `1px solid ${C.border}`, borderRadius: 6,
              padding: 16, textDecoration: 'none', color: C.ink, fontFamily: "'IBM Plex Sans'",
              display: 'block',
            }}>
              <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                <div style={{ width: 64, height: 64, flexShrink: 0 }}><MiniMap score={t.score} country={t.country} /></div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: "'IBM Plex Serif'", fontSize: 17, fontWeight: 500, lineHeight: 1.2, letterSpacing: '-0.005em', textWrap: 'balance' }}>{t.title}</div>
                  <div style={{ fontSize: 11, color: C.inkMuted, fontFamily: "'IBM Plex Mono'", marginTop: 6 }}>{t.country} · {t.months}</div>
                </div>
                <window.ScoreBadge score={t.score} size="sm" />
              </div>
              <div style={{ marginTop: 12, paddingTop: 10, borderTop: `1px solid ${C.border}`, display: 'flex', justifyContent: 'space-between', fontSize: 11, color: C.inkSubtle, fontFamily: "'IBM Plex Mono'" }}>
                <span>{t.regions} regions match</span>
                <span>updated {t.updated}</span>
              </div>
            </a>
          ))}
        </div>
      )}
    </div>
  );

  const Favourites = () => (
    <div>
      <SectionHead
        eyebrow="Favourites"
        title="Pinned for quick access"
        sub="Star countries and regions on their pages. They appear here and feed your default alert scope."
      />
      {me.favourites.length === 0 ? (
        <Empty
          icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M12 3l2.6 6 6.4.6-4.9 4.4 1.5 6.4L12 17l-5.6 3.4 1.5-6.4L3 9.6l6.4-.6L12 3z"/></svg>}
          title="No favourites yet."
          body="Tap the star on any country or region page to pin it here. Useful when you have a shortlist of places you keep watching."
          primary="Browse countries"
        />
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
          {me.favourites.map(f => (
            <a key={f.slug} href={`/${f.slug}`} style={{
              background: C.surface, border: `1px solid ${C.border}`, borderRadius: 4,
              padding: '14px 16px', textDecoration: 'none', color: C.ink,
              display: 'flex', alignItems: 'center', gap: 14,
            }}>
              <div style={{ width: 32, height: 22, background: '#ECEAE3', border: `1px solid ${C.border}`, borderRadius: 2 }}/>
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: "'IBM Plex Serif'", fontSize: 17, fontWeight: 500, letterSpacing: '-0.005em' }}>{f.name}</div>
                <div style={{ fontSize: 11, color: C.inkMuted, fontFamily: "'IBM Plex Mono'", marginTop: 2 }}>{f.sub}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 9.5, color: C.inkSubtle, fontFamily: "'IBM Plex Mono'", letterSpacing: '0.1em', textTransform: 'uppercase' }}>Best</div>
                <div style={{ fontSize: 11.5, color: C.ink, fontFamily: "'IBM Plex Mono'", marginTop: 2 }}>{f.best}</div>
              </div>
              <button style={{ background: 'transparent', border: 'none', color: C.accent, cursor: 'pointer', padding: 0 }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill={C.accent} stroke={C.accent} strokeWidth="1.2"><path d="M12 3l2.6 6 6.4.6-4.9 4.4 1.5 6.4L12 17l-5.6 3.4 1.5-6.4L3 9.6l6.4-.6L12 3z"/></svg>
              </button>
            </a>
          ))}
        </div>
      )}
    </div>
  );

  const Alerts = () => (
    <div>
      <SectionHead
        eyebrow="Alerts"
        title="Tell me when conditions change."
        sub="Alerts run on every data refresh. Email by default; SMS available on Premium."
        action={<Btn primary icon={<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#FFF" strokeWidth="2"><path d="M12 5v14M5 12h14"/></svg>}>Create alert</Btn>}
      />
      {me.alerts.length === 0 ? (
        <Empty
          icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M6 16V11a6 6 0 1 1 12 0v5l2 2H4l2-2zM10 21h4"/></svg>}
          title="You don't have any alerts."
          body="Alerts are useful when you have a window in mind but the trip is months away. Set conditions, then forget about it."
          primary="Create your first alert"
        />
      ) : (
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 6, overflow: 'hidden' }}>
          {me.alerts.map((a, i) => (
            <div key={a.id} style={{ display: 'grid', gridTemplateColumns: '1fr 110px 90px 32px', gap: 16, padding: '16px 18px', borderBottom: i === me.alerts.length - 1 ? 'none' : `1px solid ${C.border}`, alignItems: 'center', opacity: a.on ? 1 : 0.55 }}>
              <div>
                <div style={{ fontSize: 13.5, color: C.ink, lineHeight: 1.4, fontWeight: 500, letterSpacing: '-0.002em' }}>{a.label}</div>
                <div style={{ fontSize: 11, color: C.inkSubtle, fontFamily: "'IBM Plex Mono'", marginTop: 4 }}>{a.last}</div>
              </div>
              <div style={{ fontSize: 11, fontFamily: "'IBM Plex Mono'", color: C.inkMuted, letterSpacing: '0.1em', textTransform: 'uppercase' }}>{a.cadence}</div>
              <Toggle on={a.on} />
              <button style={{ background: 'transparent', border: 'none', color: C.inkSubtle, cursor: 'pointer', fontSize: 14 }}>⋯</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  // settings rows
  const SetRow = ({ label, hint, children, danger }) => (
    <div style={{ display: 'grid', gridTemplateColumns: '240px 1fr', gap: 32, padding: '20px 0', borderBottom: `1px solid ${C.border}` }}>
      <div>
        <div style={{ fontSize: 13, fontWeight: 500, color: danger ? '#7A2E2E' : C.ink }}>{label}</div>
        {hint && <div style={{ fontSize: 12, color: C.inkMuted, marginTop: 4, lineHeight: 1.45 }}>{hint}</div>}
      </div>
      <div>{children}</div>
    </div>
  );

  const Settings = () => (
    <div>
      <SectionHead eyebrow="Settings" title="Account preferences" sub="Authentication is magic-link only. We never store passwords." />

      <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 6, padding: '0 22px' }}>
        <SetRow label="Email" hint="Magic-link sign-in goes here. Changing it requires confirming on both addresses.">
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input readOnly value={me.email} style={{ flex: 1, padding: '8px 12px', border: `1px solid ${C.border}`, borderRadius: 3, fontFamily: "'IBM Plex Mono'", fontSize: 12, color: C.ink, background: '#FCFBF8' }}/>
            <Btn>Change email</Btn>
          </div>
          <div style={{ marginTop: 8, fontSize: 11.5, color: C.perfect, fontFamily: "'IBM Plex Mono'", display: 'flex', alignItems: 'center', gap: 6 }}>
            ● Verified · Last magic link sent today
          </div>
        </SetRow>

        <SetRow label="Google sign-in" hint="Optional. Lets you sign in with Google instead of waiting for a magic link.">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', border: `1px solid ${C.border}`, borderRadius: 4, background: '#FCFBF8' }}>
            <svg width="18" height="18" viewBox="0 0 24 24"><path fill="#4285F4" d="M21.6 12.2c0-.7-.1-1.4-.2-2H12v3.8h5.4c-.2 1.2-.9 2.3-2 3v2.5h3.2c1.9-1.7 3-4.3 3-7.3z"/><path fill="#34A853" d="M12 22c2.7 0 5-.9 6.6-2.5l-3.2-2.5c-.9.6-2 1-3.4 1-2.6 0-4.8-1.7-5.6-4.1H3.1v2.6C4.7 19.7 8.1 22 12 22z"/><path fill="#FBBC05" d="M6.4 13.9c-.2-.6-.3-1.2-.3-1.9s.1-1.3.3-1.9V7.5H3.1A10 10 0 0 0 2 12c0 1.6.4 3.1 1.1 4.5l3.3-2.6z"/><path fill="#EA4335" d="M12 5.9c1.5 0 2.8.5 3.8 1.5l2.8-2.8C16.9 2.9 14.7 2 12 2 8.1 2 4.7 4.3 3.1 7.5l3.3 2.6C7.2 7.6 9.4 5.9 12 5.9z"/></svg>
            <div style={{ flex: 1, fontSize: 12.5, color: C.ink }}>
              {isFree ? 'Not connected' : <>Connected as <strong style={{ fontFamily: "'IBM Plex Mono'", fontWeight: 500 }}>{me.email}</strong></>}
            </div>
            <Btn>{isFree ? 'Connect Google' : 'Disconnect'}</Btn>
          </div>
        </SetRow>

        <SetRow label="Active sessions" hint="Signed-in devices. If something looks unfamiliar, sign them out.">
          <div style={{ border: `1px solid ${C.border}`, borderRadius: 4, overflow: 'hidden' }}>
            {[
              { dev: 'MacBook Air · Safari 17', loc: 'Lyon, FR', ip: '88.171.··.··', when: 'now',         current: true },
              { dev: 'iPhone 15 · iOS app 1.4', loc: 'Lyon, FR', ip: '10.0.··.··',  when: '2 hours ago', current: false },
              { dev: 'Chrome 124 · Windows',     loc: 'Paris, FR', ip: '92.153.··.··', when: '3 days ago', current: false },
            ].map((s, i) => (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 110px 110px 60px', padding: '11px 14px', borderBottom: i === 2 ? 'none' : `1px solid ${C.border}`, fontSize: 12, alignItems: 'center', background: s.current ? '#FCFBF8' : 'transparent' }}>
                <div>
                  <div style={{ color: C.ink, fontWeight: 500 }}>{s.dev} {s.current && <span style={{ fontSize: 9.5, fontFamily: "'IBM Plex Mono'", color: C.perfect, marginLeft: 6, letterSpacing: '0.1em' }}>● THIS DEVICE</span>}</div>
                  <div style={{ fontSize: 11, color: C.inkSubtle, fontFamily: "'IBM Plex Mono'", marginTop: 3 }}>{s.loc} · {s.ip}</div>
                </div>
                <div style={{ fontSize: 11, color: C.inkMuted, fontFamily: "'IBM Plex Mono'" }}>{s.when}</div>
                <div></div>
                <div style={{ textAlign: 'right' }}>
                  {!s.current && <button style={{ background: 'transparent', border: 'none', color: C.accent, cursor: 'pointer', fontSize: 11.5, padding: 0 }}>Sign out</button>}
                </div>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 10 }}><Btn danger>Sign out all other devices</Btn></div>
        </SetRow>

        <SetRow label="Language" hint="Affects copy in product, alerts, and email.">
          <select defaultValue="en" style={{ padding: '8px 12px', border: `1px solid ${C.border}`, borderRadius: 3, fontFamily: "'IBM Plex Sans'", fontSize: 12.5, background: '#FFF', minWidth: 220 }}>
            <option value="en">English</option><option value="fr">Français</option><option value="es">Español</option><option value="de">Deutsch</option><option value="ja">日本語</option>
          </select>
        </SetRow>

        <SetRow label="Units" hint="Used everywhere temperatures, distances, and rainfall appear.">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
            {[
              { l: 'Temperature', opts: ['°C', '°F'], val: '°C' },
              { l: 'Distance',    opts: ['km', 'mi'], val: 'km' },
              { l: 'Rainfall',    opts: ['mm', 'in'], val: 'mm' },
            ].map(u => (
              <div key={u.l}>
                <div style={{ fontSize: 10.5, color: C.inkSubtle, fontFamily: "'IBM Plex Mono'", letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4 }}>{u.l}</div>
                <div style={{ display: 'flex', border: `1px solid ${C.border}`, borderRadius: 3, overflow: 'hidden' }}>
                  {u.opts.map(o => (
                    <div key={o} style={{ flex: 1, padding: '7px 10px', textAlign: 'center', fontSize: 12, fontFamily: "'IBM Plex Mono'", background: o === u.val ? C.ink : '#FFF', color: o === u.val ? '#FFF' : C.inkMuted, cursor: 'pointer' }}>{o}</div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </SetRow>

        <SetRow label="Marketing email" hint="Occasional product updates. We never share your address. You'll always receive transactional & alert mail.">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Toggle on={!isFree} />
            <span style={{ fontSize: 12.5, color: C.inkMuted }}>{isFree ? 'Off — only the essentials' : 'On — about one mail per month'}</span>
          </div>
        </SetRow>

        <SetRow label="Delete account" danger hint="Permanently deletes trips, favourites, alerts, and sessions. Active subscriptions are cancelled at end of period via Paddle.">
          <Btn danger>Delete my account</Btn>
        </SetRow>
      </div>
    </div>
  );

  const Billing = () => (
    <div>
      <SectionHead
        eyebrow="Billing"
        title={isFree ? 'You\u2019re on Free.' : 'Premium · €2.99 / month'}
        sub={isFree ? 'Upgrade for unlimited trips, four extra climate variables, and SMS alerts.' : `Renews ${me.renewsAt}. All payment & invoice management lives in Paddle, our payment processor.`}
      />

      {/* Plan summary */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 24 }}>
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 6, padding: '18px 22px' }}>
          <div style={{ fontSize: 11, color: C.inkSubtle, fontFamily: "'IBM Plex Mono'", letterSpacing: '0.12em', textTransform: 'uppercase' }}>Current plan</div>
          <div style={{ fontFamily: "'IBM Plex Serif'", fontSize: 26, fontWeight: 400, marginTop: 6, letterSpacing: '-0.012em' }}>{isFree ? 'Free · Consumer' : 'Premium · Consumer'}</div>
          <div style={{ fontSize: 12, color: C.inkMuted, marginTop: 6, fontFamily: "'IBM Plex Mono'" }}>{isFree ? '€0 · forever' : `€2.99 / month · since ${me.since}`}</div>
        </div>
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 6, padding: '18px 22px' }}>
          <div style={{ fontSize: 11, color: C.inkSubtle, fontFamily: "'IBM Plex Mono'", letterSpacing: '0.12em', textTransform: 'uppercase' }}>{isFree ? 'Status' : 'Next renewal'}</div>
          <div style={{ fontFamily: "'IBM Plex Serif'", fontSize: 26, fontWeight: 400, marginTop: 6, letterSpacing: '-0.012em' }}>{isFree ? 'No active subscription' : me.renewsAt}</div>
          <div style={{ fontSize: 12, color: C.inkMuted, marginTop: 6, fontFamily: "'IBM Plex Mono'" }}>{isFree ? '\u2014' : 'Auto-renew · card ending 4471'}</div>
        </div>
      </div>

      {/* Paddle handoff */}
      <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 6, padding: '24px 28px' }}>
        <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start' }}>
          <div style={{ width: 48, height: 48, borderRadius: 8, background: '#0F1B2D', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontFamily: "'IBM Plex Sans'", fontWeight: 700, color: '#FFF', fontSize: 13, letterSpacing: '0.02em' }}>P</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 11, fontFamily: "'IBM Plex Mono'", color: C.inkSubtle, letterSpacing: '0.12em', textTransform: 'uppercase' }}>Paddle · payment processor</div>
            <div style={{ fontFamily: "'IBM Plex Serif'", fontSize: 22, fontWeight: 500, color: C.ink, marginTop: 4, letterSpacing: '-0.005em' }}>
              {isFree ? 'Subscribe through Paddle' : 'Manage your subscription on Paddle'}
            </div>
            <div style={{ fontSize: 13, color: C.inkMuted, marginTop: 8, lineHeight: 1.55, maxWidth: 580 }}>
              Paddle handles billing for Atlas Weather. The portal opens in a new tab where you can:
            </div>
            <ul style={{ margin: '10px 0 0', paddingLeft: 18, fontSize: 12.5, color: C.ink, lineHeight: 1.7, fontFamily: "'IBM Plex Sans'" }}>
              <li>Update payment method (card, PayPal, Apple Pay, SEPA)</li>
              <li>Download VAT invoices and the receipt history</li>
              <li>Switch between monthly and annual billing</li>
              <li>{isFree ? 'Start a Premium subscription' : 'Cancel · refund within 14 days · pause for up to 3 months'}</li>
            </ul>
            <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
              <Btn primary icon={<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#FFF" strokeWidth="1.6"><path d="M5 19L19 5M19 5h-7M19 5v7"/></svg>}>
                {isFree ? 'Subscribe on Paddle' : 'Manage subscription on Paddle'}
              </Btn>
              {!isFree && <Btn>Email me a receipt</Btn>}
            </div>
            <div style={{ fontSize: 11, color: C.inkSubtle, marginTop: 14, fontFamily: "'IBM Plex Mono'" }}>
              Opens paddle.com in a new tab. You'll be signed in automatically via a one-time link.
            </div>
          </div>
        </div>
      </div>

      {/* Recent invoices */}
      {!isFree && (
        <div style={{ marginTop: 24 }}>
          <div style={{ fontSize: 11, fontFamily: "'IBM Plex Mono'", color: C.inkSubtle, letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 8 }}>Recent invoices · cached from Paddle</div>
          <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 6, overflow: 'hidden' }}>
            {[
              { d: 'Apr 14, 2026', n: 'INV-29841', a: '€2.99', s: 'Paid' },
              { d: 'Mar 14, 2026', n: 'INV-28709', a: '€2.99', s: 'Paid' },
              { d: 'Feb 14, 2026', n: 'INV-27502', a: '€2.99', s: 'Paid' },
              { d: 'Jan 14, 2026', n: 'INV-26301', a: '€2.99', s: 'Paid' },
            ].map((inv, i) => (
              <div key={inv.n} style={{ display: 'grid', gridTemplateColumns: '110px 1fr 80px 80px 80px', padding: '11px 18px', borderBottom: i === 3 ? 'none' : `1px solid ${C.border}`, fontSize: 12, alignItems: 'center' }}>
                <div style={{ fontFamily: "'IBM Plex Mono'", color: C.inkMuted }}>{inv.d}</div>
                <div style={{ fontFamily: "'IBM Plex Mono'", color: C.ink }}>{inv.n}</div>
                <div style={{ fontFamily: "'IBM Plex Mono'", color: C.ink, textAlign: 'right' }}>{inv.a}</div>
                <div style={{ fontSize: 10.5, color: C.perfect, fontFamily: "'IBM Plex Mono'", letterSpacing: '0.1em', textAlign: 'right' }}>● {inv.s.toUpperCase()}</div>
                <div style={{ textAlign: 'right' }}><a href="#" style={{ color: C.accent, fontSize: 11.5, textDecoration: 'none' }}>PDF ↗</a></div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  // ─── Page shell ────────────────────────────────
  return (
    <div style={{ width: 1440, minHeight: 1000, background: C.paper, color: C.ink, fontFamily: "'IBM Plex Sans'" }}>
      <window.CKPageHeader />

      {/* Mode tag */}
      <div style={{ background: '#FCFBF8', borderBottom: `1px solid ${C.border}`, padding: '8px 32px', fontSize: 11, color: C.inkSubtle, fontFamily: "'IBM Plex Mono'", display: 'flex', justifyContent: 'space-between' }}>
        <div>/account · {me.name} · <span style={{ color: isFree ? C.inkMuted : C.accent, fontWeight: 600 }}>{me.plan.toUpperCase()}</span></div>
        <div>signed in via magic link · today</div>
      </div>

      <style>{`
        .acc-${profile} input[name="${radioName}"] { display: none; }
        .acc-${profile} .acc-pane { display: none; }
        ${sections.map(s => `
          #${radioName}-${s.id}:checked ~ .acc-shell .acc-body .acc-pane-${s.id} { display: block; }
          #${radioName}-${s.id}:checked ~ .acc-shell .acc-nav label[for="${radioName}-${s.id}"] {
            background: ${C.surface}; color: ${C.ink}; border-color: ${C.border};
          }
          #${radioName}-${s.id}:checked ~ .acc-shell .acc-nav label[for="${radioName}-${s.id}"] .acc-nav-marker { background: ${C.accent}; }
        `).join('\n')}
        .acc-${profile} .acc-nav label { cursor: pointer; user-select: none; }
      `}</style>

      <div className={`acc-${profile}`} style={{ position: 'relative' }}>
        {sections.map((s, i) => (
          <input key={s.id} type="radio" name={radioName} id={`${radioName}-${s.id}`} defaultChecked={i === 0} />
        ))}

        <div className="acc-shell" style={{ display: 'grid', gridTemplateColumns: '240px 1fr', minHeight: 900 }}>
          {/* LEFT NAV */}
          <nav className="acc-nav" style={{ borderRight: `1px solid ${C.border}`, padding: '24px 14px', background: '#FCFBF8' }}>
            <div style={{ padding: '0 8px 14px', borderBottom: `1px solid ${C.border}`, marginBottom: 10 }}>
              <div style={{ fontSize: 10.5, fontFamily: "'IBM Plex Mono'", color: C.inkSubtle, letterSpacing: '0.14em', textTransform: 'uppercase' }}>Signed in</div>
              <div style={{ fontFamily: "'IBM Plex Serif'", fontSize: 17, fontWeight: 500, marginTop: 4, letterSpacing: '-0.005em' }}>{me.name}</div>
              <div style={{ fontSize: 11, color: C.inkMuted, fontFamily: "'IBM Plex Mono'", marginTop: 2, wordBreak: 'break-all' }}>{me.email}</div>
              <div style={{ marginTop: 8, display: 'inline-block', fontSize: 9.5, fontFamily: "'IBM Plex Mono'", letterSpacing: '0.1em', padding: '2px 7px', borderRadius: 2, background: isFree ? '#ECEAE3' : '#FBF3DC', color: isFree ? C.inkMuted : C.accent, fontWeight: 600 }}>
                {me.plan.toUpperCase()}
              </div>
            </div>

            {sections.map(s => (
              <label key={s.id} htmlFor={`${radioName}-${s.id}`} className="acc-nav-item" style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 4, marginBottom: 2,
                color: C.inkMuted, border: `1px solid transparent`,
              }}>
                <span className="acc-nav-marker" style={{ width: 4, height: 18, borderRadius: 2, background: 'transparent' }}/>
                <span style={{ flex: 1, fontSize: 13, fontWeight: 500 }}>{s.label}</span>
                {s.count !== undefined && <span style={{ fontSize: 10.5, fontFamily: "'IBM Plex Mono'", color: C.inkSubtle }}>{s.count}</span>}
              </label>
            ))}

            <div style={{ marginTop: 24, padding: '0 8px' }}>
              <div style={{ fontSize: 10.5, fontFamily: "'IBM Plex Mono'", color: C.inkSubtle, letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 8 }}>Quick</div>
              <a href="/" style={{ display: 'block', fontSize: 12.5, color: C.ink, textDecoration: 'none', padding: '5px 0' }}>↗ Open the map</a>
              <a href="/help" style={{ display: 'block', fontSize: 12.5, color: C.inkMuted, textDecoration: 'none', padding: '5px 0' }}>Help center</a>
              <a href="#" style={{ display: 'block', fontSize: 12.5, color: C.inkMuted, textDecoration: 'none', padding: '5px 0' }}>Sign out</a>
            </div>
          </nav>

          {/* MAIN */}
          <main className="acc-body" style={{ padding: '40px 56px 64px', maxWidth: 980 }}>
            <div className="acc-pane acc-pane-overview"><Overview /></div>
            <div className="acc-pane acc-pane-trips"><Trips /></div>
            <div className="acc-pane acc-pane-favourites"><Favourites /></div>
            <div className="acc-pane acc-pane-alerts"><Alerts /></div>
            <div className="acc-pane acc-pane-settings"><Settings /></div>
            <div className="acc-pane acc-pane-billing"><Billing /></div>
          </main>
        </div>
      </div>
    </div>
  );
}
window.AccountDashboard = AccountDashboard;
