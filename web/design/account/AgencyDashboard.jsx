/* global React, window */
// /account (agency mode) — B2B dense. Single variation, Notion/Linear density.

function AgencyDashboard({ tier = 'pro' }) {
  const C = window.CK_COLORS;
  const plans = {
    starter:    { name: 'Agency Starter',    seatsCap: 3,  price: 49,  mrrLabel: '€49 / mo',  nextTier: 'Agency Pro' },
    pro:        { name: 'Agency Pro',        seatsCap: 10, price: 149, mrrLabel: '€149 / mo', nextTier: 'Agency Enterprise', prevTier: 'Agency Starter' },
    enterprise: { name: 'Agency Enterprise', seatsCap: 50, price: 499, mrrLabel: '€499 / mo', prevTier: 'Agency Pro' },
  };
  const plan = plans[tier];

  const org = { name: 'Cordillera Voyages', slug: 'cordillera', members: 7, clients: 48, tripsYTD: 312, plan: plan.name, since: 'Feb 2024', owner: 'Elena Quiroz' };
  const seatsUsed = 7;

  const sections = [
    { id: 'overview',   label: 'Overview' },
    { id: 'clients',    label: 'Clients',  count: 48 },
    { id: 'team',       label: 'Team',     count: `${seatsUsed}/${plan.seatsCap}` },
    { id: 'activity',   label: 'Activity' },
    { id: 'branding',   label: 'Branding', badge: 'SOON' },
    { id: 'settings',   label: 'Settings' },
    { id: 'billing',    label: 'Billing' },
  ];

  const team = [
    { name: 'Elena Quiroz',    email: 'elena@cordillera.tours',    role: 'Owner',   last: '2 min ago',   trips: 87, status: 'active', you: true },
    { name: 'Matías Soto',     email: 'matias@cordillera.tours',   role: 'Admin',   last: '14 min ago',  trips: 64, status: 'active' },
    { name: 'Renata Ibáñez',   email: 'renata@cordillera.tours',   role: 'Agent',   last: '1 hr ago',    trips: 58, status: 'active' },
    { name: 'Carlos Mendez',   email: 'carlos@cordillera.tours',   role: 'Agent',   last: 'Yesterday',   trips: 41, status: 'active' },
    { name: 'Sofía Huamán',    email: 'sofia@cordillera.tours',    role: 'Agent',   last: '3d ago',      trips: 34, status: 'active' },
    { name: 'Javier Rosales',  email: 'javier@cordillera.tours',   role: 'Agent',   last: '5d ago',      trips: 22, status: 'active' },
    { name: 'Lucía Bermúdez',  email: 'lucia@cordillera.tours',    role: 'Viewer',  last: 'Never',       trips: 0,  status: 'invited' },
  ];
  const clients = [
    { name: 'Westfield, M. & A.',  country: 'Peru',      trips: 1, last: '2d ago',   agent: 'Elena Quiroz',   tag: 'Honeymoon' },
    { name: 'Hartwell family',     country: 'Japan',     trips: 3, last: '4d ago',   agent: 'Matías Soto',    tag: 'Family' },
    { name: 'Okafor, T.',          country: 'Morocco',   trips: 2, last: '1w ago',   agent: 'Renata Ibáñez',  tag: 'Solo' },
    { name: 'Lindqvist party',     country: 'Norway',    trips: 1, last: '1w ago',   agent: 'Carlos Mendez',  tag: 'Group · 6' },
    { name: 'Dubois, C.',          country: 'Portugal',  trips: 2, last: '2w ago',   agent: 'Sofía Huamán',   tag: 'Retirement' },
    { name: 'Patel-Singh',         country: 'Peru',      trips: 4, last: '3w ago',   agent: 'Elena Quiroz',   tag: 'Return client' },
    { name: 'Yamamoto, K.',        country: 'Peru',      trips: 1, last: '3w ago',   agent: 'Matías Soto',    tag: 'Corporate' },
    { name: 'Nguyen & Tran',       country: 'Peru',      trips: 2, last: 'Apr 01',   agent: 'Renata Ibáñez',  tag: 'Honeymoon' },
    { name: 'Brightman, R.',       country: 'Colombia',  trips: 1, last: 'Mar 28',   agent: 'Carlos Mendez',  tag: 'Solo' },
    { name: 'Al-Fassi, N.',        country: 'Bolivia',   trips: 3, last: 'Mar 22',   agent: 'Elena Quiroz',   tag: 'Group · 4' },
    { name: 'O\u2019Connor, D.',   country: 'Chile',     trips: 1, last: 'Mar 18',   agent: 'Sofía Huamán',   tag: 'Solo' },
    { name: 'Weissman, H.',        country: 'Ecuador',   trips: 2, last: 'Mar 12',   agent: 'Javier Rosales', tag: 'Anniversary' },
  ];
  const activity = [
    { t: '2 min ago',   who: 'Elena Quiroz',   act: 'shared trip', obj: 'Honeymoon · Andes & Sacred Valley',     ctx: 'for Westfield, M. & A.',        kind: 'SHARE' },
    { t: '14 min ago',  who: 'Matías Soto',    act: 'updated prefs on',  obj: 'Osaka & Kyoto — Nov',                ctx: 'temp range 10–22 °C',            kind: 'EDIT' },
    { t: '58 min ago',  who: 'Renata Ibáñez',  act: 'created trip',      obj: 'Marrakech & Atlas — Oct',           ctx: 'for Okafor, T.',                 kind: 'CREATE' },
    { t: '1 hr ago',    who: 'Carlos Mendez',  act: 'exported PDF',      obj: 'Arctic Circle · Lofoten',           ctx: 'Lindqvist party · 12 pp',        kind: 'EXPORT' },
    { t: '2 hr ago',    who: 'Elena Quiroz',   act: 'invited',           obj: 'lucia@cordillera.tours',            ctx: 'role: Viewer',                   kind: 'TEAM' },
    { t: '3 hr ago',    who: 'Matías Soto',    act: 'archived client',   obj: 'Feldman, E.',                       ctx: 'trip completed Apr 04',          kind: 'CLIENT' },
    { t: 'Yesterday',   who: 'Sofía Huamán',   act: 'created trip',      obj: 'Douro Valley — Sep',                ctx: 'for Dubois, C.',                 kind: 'CREATE' },
    { t: 'Yesterday',   who: 'Renata Ibáñez',  act: 'added alert to',    obj: 'Morocco coastal swell — Oct',       ctx: 'weekly · SST > 22 °C',           kind: 'ALERT' },
    { t: '2d ago',      who: 'Elena Quiroz',   act: 'upgraded plan',     obj: 'Agency Starter → Agency Pro',       ctx: '€149 / mo · +7 seats',           kind: 'BILLING' },
    { t: '2d ago',      who: 'Carlos Mendez',  act: 'modified safety threshold', obj: 'Colombia · Brightman, R.',   ctx: 'Level 2 → Level 3 accepted',     kind: 'EDIT' },
    { t: '3d ago',      who: 'Matías Soto',    act: 'duplicated trip',   obj: 'Cusco Apr 2025 → Cusco Apr 2026',   ctx: 'for Patel-Singh',                kind: 'CREATE' },
    { t: '3d ago',      who: 'Elena Quiroz',   act: 'changed role',      obj: 'Javier Rosales',                    ctx: 'Agent → Agent (no change logged)', kind: 'TEAM' },
  ];
  const kindColor = { SHARE: C.accent, EDIT: C.inkMuted, CREATE: C.perfect, EXPORT: C.good, TEAM: '#6B4FAE', CLIENT: C.inkMuted, ALERT: C.warm, BILLING: C.ink };

  // ─── Primitives ────────────────────────────────────
  const Eyebrow = ({ children }) => (
    <div style={{ fontSize: 10.5, fontFamily: "'IBM Plex Mono'", color: C.inkSubtle, letterSpacing: '0.14em', textTransform: 'uppercase' }}>{children}</div>
  );
  const SectionHead = ({ eyebrow, title, sub, action }) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', paddingBottom: 14, borderBottom: `1px solid ${C.border}`, marginBottom: 20 }}>
      <div>
        <Eyebrow>{eyebrow}</Eyebrow>
        <h2 style={{ fontFamily: "'IBM Plex Serif'", fontSize: 26, fontWeight: 400, margin: '6px 0 0', letterSpacing: '-0.012em' }}>{title}</h2>
        {sub && <div style={{ fontSize: 13, color: C.inkMuted, marginTop: 4 }}>{sub}</div>}
      </div>
      {action}
    </div>
  );
  const Btn = ({ children, primary, danger, ghost, sub, icon }) => (
    <button style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      background: primary ? C.ink : ghost ? 'transparent' : '#FFF',
      color: primary ? '#FFF' : danger ? '#7A2E2E' : C.ink,
      border: primary ? 'none' : `1px solid ${C.border}`,
      borderRadius: 3, padding: '7px 12px', cursor: 'pointer',
      fontFamily: "'IBM Plex Sans'", fontSize: 12, fontWeight: 500,
    }}>{icon}{children}{sub && <span style={{ fontSize: 10.5, opacity: 0.7, marginLeft: 4, fontFamily: "'IBM Plex Mono'" }}>{sub}</span>}</button>
  );
  const Chip = ({ children, color = C.inkMuted, bg = '#FCFBF8' }) => (
    <span style={{ display: 'inline-block', fontSize: 10, fontFamily: "'IBM Plex Mono'", letterSpacing: '0.1em', color, background: bg, border: `1px solid ${C.border}`, padding: '1px 6px', borderRadius: 2, fontWeight: 600 }}>{children}</span>
  );

  // seat meter
  const SeatMeter = ({ used, cap }) => (
    <div style={{ display: 'flex', gap: 3 }}>
      {Array.from({ length: cap }).map((_, i) => (
        <div key={i} style={{ width: 10, height: 16, background: i < used ? C.ink : '#E8E5DC', borderRadius: 1 }}/>
      ))}
    </div>
  );

  // ─── Overview ──────────────────────────────────────
  const Overview = () => (
    <div>
      <SectionHead eyebrow="Organization" title={org.name} sub={`Owner: ${org.owner} · Member since ${org.since} · atlasweather.io/o/${org.slug}`} action={<Btn>Org settings</Btn>} />

      {/* Plan card */}
      <div style={{ background: C.ink, color: '#FFF', borderRadius: 6, padding: '22px 24px', marginBottom: 18, display: 'grid', gridTemplateColumns: '1.3fr 1fr 1fr', gap: 28, alignItems: 'center' }}>
        <div>
          <div style={{ fontSize: 10.5, fontFamily: "'IBM Plex Mono'", letterSpacing: '0.14em', textTransform: 'uppercase', color: '#E0C98A' }}>Current plan</div>
          <div style={{ fontFamily: "'IBM Plex Serif'", fontSize: 26, fontWeight: 400, marginTop: 4, letterSpacing: '-0.012em' }}>{plan.name}</div>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', marginTop: 4, fontFamily: "'IBM Plex Mono'" }}>{plan.mrrLabel} · renews May 14 · VAT invoiced</div>
        </div>
        <div>
          <div style={{ fontSize: 10.5, fontFamily: "'IBM Plex Mono'", letterSpacing: '0.14em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.55)', marginBottom: 6 }}>Seats</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 6 }}>
            <div style={{ fontFamily: "'IBM Plex Serif'", fontSize: 26, fontWeight: 400 }}>{seatsUsed}</div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', fontFamily: "'IBM Plex Mono'" }}>/ {plan.seatsCap} · {plan.seatsCap - seatsUsed} available</div>
          </div>
          <SeatMeter used={seatsUsed} cap={plan.seatsCap}/>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 10.5, fontFamily: "'IBM Plex Mono'", letterSpacing: '0.14em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.55)', marginBottom: 6 }}>Plan path</div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            {plan.prevTier && <button style={{ background: 'transparent', color: 'rgba(255,255,255,0.8)', border: '1px solid rgba(255,255,255,0.22)', borderRadius: 3, padding: '7px 12px', fontSize: 12, cursor: 'pointer', fontFamily: "'IBM Plex Sans'" }}>← {plan.prevTier}</button>}
            {plan.nextTier && <button style={{ background: '#E0C98A', color: C.ink, border: 'none', borderRadius: 3, padding: '7px 12px', fontSize: 12, cursor: 'pointer', fontWeight: 600, fontFamily: "'IBM Plex Sans'" }}>{plan.nextTier} →</button>}
          </div>
          <div style={{ fontSize: 10.5, color: 'rgba(255,255,255,0.5)', fontFamily: "'IBM Plex Mono'", marginTop: 8 }}>All changes via Paddle · prorated</div>
        </div>
      </div>

      {/* KPI tiles */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8, marginBottom: 20 }}>
        {[
          { l: 'Active clients', v: 48, cap: '3 archived this month' },
          { l: 'Trips YTD',      v: 312, cap: '+28 vs. prior 110d' },
          { l: 'Active trips',   v: 84, cap: 'shared in last 30d' },
          { l: 'Avg turnaround', v: '2.3d', cap: 'client request → share' },
          { l: 'MRR commit',     v: plan.mrrLabel.replace(' / mo', ''), cap: `${plan.seatsCap} seats · €${(plan.price/plan.seatsCap).toFixed(0)}/seat` },
        ].map(k => (
          <div key={k.l} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 4, padding: '12px 14px' }}>
            <Eyebrow>{k.l}</Eyebrow>
            <div style={{ fontFamily: "'IBM Plex Serif'", fontSize: 24, fontWeight: 400, color: C.ink, marginTop: 4, letterSpacing: '-0.012em' }}>{k.v}</div>
            <div style={{ fontSize: 10.5, color: C.inkMuted, fontFamily: "'IBM Plex Mono'", marginTop: 2 }}>{k.cap}</div>
          </div>
        ))}
      </div>

      {/* Two-col: top agents + recent activity preview */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 6 }}>
          <div style={{ padding: '10px 16px', borderBottom: `1px solid ${C.border}`, display: 'flex', justifyContent: 'space-between' }}>
            <Eyebrow>Top agents · last 30d</Eyebrow>
            <span style={{ fontSize: 10.5, color: C.inkSubtle, fontFamily: "'IBM Plex Mono'" }}>by trips authored</span>
          </div>
          {team.filter(m => m.status === 'active').slice(0, 5).map((m, i) => {
            const max = Math.max(...team.map(t => t.trips));
            return (
              <div key={m.email} style={{ display: 'grid', gridTemplateColumns: '20px 1fr 120px 40px', alignItems: 'center', gap: 12, padding: '9px 16px', borderBottom: i === 4 ? 'none' : `1px solid ${C.border}`, fontSize: 12.5 }}>
                <div style={{ fontFamily: "'IBM Plex Mono'", color: C.inkSubtle, fontSize: 10.5 }}>{String(i+1).padStart(2,'0')}</div>
                <div>{m.name}</div>
                <div style={{ height: 4, background: '#ECEAE3', borderRadius: 2, overflow: 'hidden' }}><div style={{ width: `${m.trips/max*100}%`, height: '100%', background: C.accent }}/></div>
                <div style={{ fontFamily: "'IBM Plex Mono'", color: C.ink, textAlign: 'right' }}>{m.trips}</div>
              </div>
            );
          })}
        </div>
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 6 }}>
          <div style={{ padding: '10px 16px', borderBottom: `1px solid ${C.border}`, display: 'flex', justifyContent: 'space-between' }}>
            <Eyebrow>Activity · latest</Eyebrow>
            <a href="#" style={{ fontSize: 11, color: C.accent, textDecoration: 'none' }}>View feed →</a>
          </div>
          {activity.slice(0, 5).map((a, i) => (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: '70px 56px 1fr', gap: 10, padding: '9px 16px', borderBottom: i === 4 ? 'none' : `1px solid ${C.border}`, fontSize: 12.5, alignItems: 'baseline' }}>
              <div style={{ fontFamily: "'IBM Plex Mono'", fontSize: 10.5, color: C.inkSubtle }}>{a.t}</div>
              <Chip color={kindColor[a.kind]} bg="#FCFBF8">{a.kind}</Chip>
              <div style={{ lineHeight: 1.4 }}><span style={{ color: C.ink, fontWeight: 500 }}>{a.who}</span> <span style={{ color: C.inkMuted }}>{a.act}</span> <span style={{ color: C.ink }}>{a.obj}</span></div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  // ─── Clients table ─────────────────────────────────
  const Clients = () => (
    <div>
      <SectionHead
        eyebrow="Clients"
        title={`${clients.length} clients`}
        sub="Clients are the people you build trips for. Each trip links back to a client record."
        action={<div style={{ display: 'flex', gap: 8 }}><Btn>Import CSV</Btn><Btn primary icon={<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#FFF" strokeWidth="2"><path d="M12 5v14M5 12h14"/></svg>}>New client</Btn></div>}
      />

      {/* Filter bar */}
      <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr auto auto auto', gap: 8, marginBottom: 12 }}>
        <div style={{ position: 'relative' }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.inkSubtle} strokeWidth="2" style={{ position: 'absolute', left: 10, top: 10 }}><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg>
          <input placeholder="Search clients, trips, countries…" style={{ width: '100%', padding: '8px 12px 8px 32px', border: `1px solid ${C.border}`, borderRadius: 3, fontSize: 12.5, fontFamily: "'IBM Plex Sans'" }}/>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {['All', 'Active', 'Archived', 'Assigned to me'].map((f, i) => (
            <button key={f} style={{ padding: '7px 11px', border: `1px solid ${C.border}`, borderRadius: 3, background: i === 0 ? C.ink : '#FFF', color: i === 0 ? '#FFF' : C.inkMuted, fontSize: 11.5, cursor: 'pointer', fontFamily: "'IBM Plex Sans'" }}>{f}</button>
          ))}
        </div>
        <Btn icon={<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 5h18M6 12h12M10 19h4"/></svg>}>Filter · Country</Btn>
        <Btn icon={<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 5h18M6 12h12M10 19h4"/></svg>}>Agent</Btn>
        <Btn>Sort · Last active ↓</Btn>
      </div>

      <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 6, overflow: 'hidden' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '28px 1.4fr 1.2fr 80px 1fr 1.1fr 90px', gap: 0, padding: '9px 14px', background: '#FCFBF8', borderBottom: `1px solid ${C.border}`, fontSize: 10.5, fontFamily: "'IBM Plex Mono'", color: C.inkSubtle, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
          <div><input type="checkbox" /></div><div>Client</div><div>Country · tag</div><div style={{ textAlign: 'right' }}>Trips</div><div>Last activity</div><div>Owner agent</div><div style={{ textAlign: 'right' }}>Actions</div>
        </div>
        {clients.map((c, i) => (
          <div key={c.name} style={{ display: 'grid', gridTemplateColumns: '28px 1.4fr 1.2fr 80px 1fr 1.1fr 90px', gap: 0, padding: '11px 14px', borderBottom: i === clients.length - 1 ? 'none' : `1px solid ${C.border}`, fontSize: 12.5, alignItems: 'center' }}>
            <div><input type="checkbox" /></div>
            <div>
              <a href={`/account/clients/${i+1}`} style={{ color: C.ink, textDecoration: 'none', fontWeight: 500 }}>{c.name}</a>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ color: C.ink, fontFamily: "'IBM Plex Mono'" }}>{c.country}</span>
              <Chip>{c.tag.toUpperCase()}</Chip>
            </div>
            <div style={{ fontFamily: "'IBM Plex Mono'", color: C.ink, textAlign: 'right' }}>{c.trips}</div>
            <div style={{ fontFamily: "'IBM Plex Mono'", fontSize: 11.5, color: C.inkMuted }}>{c.last}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: C.ink }}>
              <span style={{ width: 20, height: 20, borderRadius: 10, background: '#ECEAE3', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 9.5, fontFamily: "'IBM Plex Mono'", color: C.inkMuted, fontWeight: 600 }}>{c.agent.split(' ').map(n=>n[0]).join('')}</span>
              <span style={{ fontSize: 12 }}>{c.agent}</span>
            </div>
            <div style={{ textAlign: 'right', display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
              <a href="#" style={{ color: C.accent, fontSize: 11.5, textDecoration: 'none' }}>Open</a>
              <span style={{ color: C.border }}>·</span>
              <button style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: C.inkSubtle, fontSize: 14 }}>⋯</button>
            </div>
          </div>
        ))}
        <div style={{ padding: '10px 14px', borderTop: `1px solid ${C.border}`, background: '#FCFBF8', display: 'flex', justifyContent: 'space-between', fontSize: 11, fontFamily: "'IBM Plex Mono'", color: C.inkMuted }}>
          <span>Showing 12 of {clients.length + 36} · 0 selected</span>
          <span>Page 1 / 4 · ← →</span>
        </div>
      </div>
    </div>
  );

  // ─── Team table ────────────────────────────────────
  const Team = () => {
    const seatsLeft = plan.seatsCap - seatsUsed;
    return (
      <div>
        <SectionHead
          eyebrow="Team"
          title={`${seatsUsed} members · ${seatsLeft} seats available`}
          sub="Seats include Owners, Admins, Agents, and Viewers. Only Admins and Owners can modify billing."
          action={<Btn primary icon={<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#FFF" strokeWidth="2"><path d="M12 5v14M5 12h14"/></svg>}>Invite agent</Btn>}
        />

        {/* Seats gauge */}
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 6, padding: '14px 18px', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 20 }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 6 }}>
              <div style={{ fontFamily: "'IBM Plex Serif'", fontSize: 24, fontWeight: 400, letterSpacing: '-0.012em' }}>{seatsUsed}<span style={{ color: C.inkMuted, fontSize: 18 }}> / {plan.seatsCap}</span></div>
              <div style={{ fontSize: 11.5, fontFamily: "'IBM Plex Mono'", color: C.inkMuted, letterSpacing: '0.1em', textTransform: 'uppercase' }}>seats · {plan.name}</div>
            </div>
            <div style={{ height: 6, background: '#ECEAE3', borderRadius: 3, overflow: 'hidden', display: 'flex', gap: 1 }}>
              <div style={{ flex: seatsUsed, background: C.ink }}/>
              <div style={{ flex: seatsLeft, background: 'transparent' }}/>
            </div>
            <div style={{ fontSize: 11, color: C.inkSubtle, fontFamily: "'IBM Plex Mono'", marginTop: 6 }}>
              {seatsLeft > 0 ? `${seatsLeft} free seat${seatsLeft === 1 ? '' : 's'} remaining` : 'Plan cap reached · upgrade to invite more'}
            </div>
          </div>
          {plan.nextTier && (
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 11, color: C.inkSubtle, fontFamily: "'IBM Plex Mono'", marginBottom: 4 }}>Need more?</div>
              <Btn>Upgrade to {plan.nextTier} →</Btn>
            </div>
          )}
        </div>

        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 6, overflow: 'hidden' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1.6fr 100px 110px 110px 90px 90px', padding: '9px 14px', background: '#FCFBF8', borderBottom: `1px solid ${C.border}`, fontSize: 10.5, fontFamily: "'IBM Plex Mono'", color: C.inkSubtle, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
            <div>Name</div><div>Email</div><div>Role</div><div>Last login</div><div style={{ textAlign: 'right' }}>Trips authored</div><div>Status</div><div style={{ textAlign: 'right' }}>Actions</div>
          </div>
          {team.map((m, i) => (
            <div key={m.email} style={{ display: 'grid', gridTemplateColumns: '1.3fr 1.6fr 100px 110px 110px 90px 90px', padding: '11px 14px', borderBottom: i === team.length - 1 ? 'none' : `1px solid ${C.border}`, fontSize: 12.5, alignItems: 'center', opacity: m.status === 'invited' ? 0.62 : 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ width: 22, height: 22, borderRadius: 11, background: '#ECEAE3', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 9.5, fontFamily: "'IBM Plex Mono'", color: C.inkMuted, fontWeight: 600 }}>{m.name.split(' ').map(n=>n[0]).join('')}</span>
                <span style={{ color: C.ink, fontWeight: 500 }}>{m.name}</span>
                {m.you && <Chip color={C.accent} bg="#FBF3DC">YOU</Chip>}
              </div>
              <div style={{ fontFamily: "'IBM Plex Mono'", color: C.inkMuted, fontSize: 11.5 }}>{m.email}</div>
              <div><Chip color={m.role === 'Owner' ? C.accent : m.role === 'Admin' ? '#6B4FAE' : C.inkMuted} bg={m.role === 'Owner' ? '#FBF3DC' : '#FCFBF8'}>{m.role.toUpperCase()}</Chip></div>
              <div style={{ fontFamily: "'IBM Plex Mono'", fontSize: 11.5, color: C.inkMuted }}>{m.last}</div>
              <div style={{ fontFamily: "'IBM Plex Mono'", color: C.ink, textAlign: 'right' }}>{m.trips}</div>
              <div>
                {m.status === 'active'
                  ? <span style={{ fontSize: 10.5, color: C.perfect, fontFamily: "'IBM Plex Mono'", letterSpacing: '0.08em' }}>● ACTIVE</span>
                  : <span style={{ fontSize: 10.5, color: C.warm,    fontFamily: "'IBM Plex Mono'", letterSpacing: '0.08em' }}>◐ INVITED</span>}
              </div>
              <div style={{ textAlign: 'right' }}>
                {!m.you && <a href="#" style={{ color: C.accent, fontSize: 11.5, textDecoration: 'none' }}>Manage</a>}
                {m.you && <span style={{ fontSize: 11, color: C.inkSubtle, fontFamily: "'IBM Plex Mono'" }}>—</span>}
              </div>
            </div>
          ))}
        </div>

        <div style={{ marginTop: 14, padding: '12px 16px', background: '#FCFBF8', border: `1px solid ${C.border}`, borderRadius: 4, fontSize: 12, color: C.inkMuted, lineHeight: 1.5, display: 'flex', gap: 14, alignItems: 'flex-start' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={C.accent} strokeWidth="1.6" style={{ flexShrink: 0, marginTop: 1 }}><circle cx="12" cy="12" r="9"/><path d="M12 8v5M12 16h0"/></svg>
          <div>
            <strong style={{ color: C.ink, fontWeight: 600 }}>Seat billing is prorated.</strong> Adding a member mid-cycle charges the fractional difference via Paddle at the next renewal. Viewers count as a seat but can’t create or edit trips.
          </div>
        </div>
      </div>
    );
  };

  // ─── Activity feed ─────────────────────────────────
  const Activity = () => (
    <div>
      <SectionHead
        eyebrow="Activity"
        title="Org audit trail"
        sub="Every action taken by any team member. Retained 24 months · exportable on Enterprise."
        action={<div style={{ display: 'flex', gap: 8 }}><Btn>Export CSV</Btn><Btn>Filter</Btn></div>}
      />

      {/* filter chips */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
        {['All', 'CREATE', 'EDIT', 'SHARE', 'EXPORT', 'ALERT', 'TEAM', 'CLIENT', 'BILLING'].map((f, i) => (
          <button key={f} style={{ padding: '5px 10px', border: `1px solid ${C.border}`, borderRadius: 3, background: i === 0 ? C.ink : '#FFF', color: i === 0 ? '#FFF' : f === 'All' ? C.ink : (kindColor[f] || C.inkMuted), fontSize: 10.5, cursor: 'pointer', fontFamily: "'IBM Plex Mono'", letterSpacing: '0.08em', fontWeight: 600 }}>{f}</button>
        ))}
        <div style={{ flex: 1 }}/>
        <Btn ghost>Last 7d</Btn><Btn ghost>30d</Btn><Btn ghost>90d</Btn><Btn>Custom…</Btn>
      </div>

      <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 6, overflow: 'hidden' }}>
        {activity.map((a, i) => (
          <div key={i} style={{ display: 'grid', gridTemplateColumns: '90px 70px 1fr 70px', gap: 14, padding: '12px 16px', borderBottom: i === activity.length - 1 ? 'none' : `1px solid ${C.border}`, fontSize: 12.5, alignItems: 'center' }}>
            <div style={{ fontFamily: "'IBM Plex Mono'", fontSize: 10.5, color: C.inkSubtle }}>{a.t}</div>
            <Chip color={kindColor[a.kind]} bg="#FCFBF8">{a.kind}</Chip>
            <div style={{ lineHeight: 1.5 }}>
              <span style={{ color: C.ink, fontWeight: 500 }}>{a.who}</span>{' '}
              <span style={{ color: C.inkMuted }}>{a.act}</span>{' '}
              <span style={{ color: C.ink, fontFamily: a.obj.includes('@') ? "'IBM Plex Mono'" : undefined }}>{a.obj}</span>{' '}
              <span style={{ color: C.inkSubtle, fontSize: 11.5, fontStyle: 'italic' }}>· {a.ctx}</span>
            </div>
            <div style={{ textAlign: 'right' }}><a href="#" style={{ color: C.accent, fontSize: 11.5, textDecoration: 'none' }}>Details →</a></div>
          </div>
        ))}
        <div style={{ padding: '10px 14px', background: '#FCFBF8', borderTop: `1px solid ${C.border}`, fontSize: 11, fontFamily: "'IBM Plex Mono'", color: C.inkMuted, textAlign: 'center' }}>
          Loading earlier events… · 482 events in the last 30 days
        </div>
      </div>
    </div>
  );

  // ─── Branding (locked) ─────────────────────────────
  const Branding = () => (
    <div>
      <SectionHead
        eyebrow="Branding"
        title="White-label client deliverables"
        sub="Stamp your logo, palette, and domain on shared trips and PDF exports. In development."
        action={<Chip color={C.warm} bg="#FBF3DC">COMING · 2026 Q3</Chip>}
      />

      <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 6, padding: 2, position: 'relative' }}>
        {/* The "disabled" fieldset */}
        <fieldset disabled style={{ border: 'none', padding: 24, margin: 0, opacity: 0.45 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '240px 1fr', gap: 28, alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 500, color: C.ink, marginBottom: 4 }}>Logo</div>
              <div style={{ fontSize: 11.5, color: C.inkMuted, lineHeight: 1.5 }}>Displayed on shared trip pages and PDF exports. SVG preferred.</div>
            </div>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <div style={{ width: 80, height: 80, borderRadius: 4, border: `1px dashed ${C.border}`, background: '#FCFBF8', display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.inkSubtle, fontSize: 10.5, fontFamily: "'IBM Plex Mono'" }}>SVG / PNG</div>
              <button disabled style={{ padding: '7px 12px', border: `1px solid ${C.border}`, borderRadius: 3, background: '#FFF', color: C.inkMuted, fontSize: 12, fontFamily: "'IBM Plex Sans'" }}>Upload…</button>
            </div>

            <div style={{ marginTop: 20 }}>
              <div style={{ fontSize: 12, fontWeight: 500, color: C.ink, marginBottom: 4 }}>Primary colour</div>
              <div style={{ fontSize: 11.5, color: C.inkMuted, lineHeight: 1.5 }}>Used for accent elements, CTAs in client-facing pages.</div>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 20 }}>
              <div style={{ width: 28, height: 28, borderRadius: 3, background: '#2B4A6B', border: `1px solid ${C.border}` }}/>
              <input value="#2B4A6B" readOnly style={{ padding: '7px 10px', border: `1px solid ${C.border}`, borderRadius: 3, fontFamily: "'IBM Plex Mono'", fontSize: 12, width: 110 }}/>
            </div>

            <div style={{ marginTop: 20 }}>
              <div style={{ fontSize: 12, fontWeight: 500, color: C.ink, marginBottom: 4 }}>Custom domain</div>
              <div style={{ fontSize: 11.5, color: C.inkMuted, lineHeight: 1.5 }}>Serve shared trips from trips.your-agency.com instead of atlasweather.io/t/…</div>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 20 }}>
              <input value="trips." readOnly style={{ padding: '7px 10px', border: `1px solid ${C.border}`, borderRadius: 3, fontFamily: "'IBM Plex Mono'", fontSize: 12, width: 60, textAlign: 'right' }}/>
              <input placeholder="your-agency.com" readOnly style={{ padding: '7px 10px', border: `1px solid ${C.border}`, borderRadius: 3, fontFamily: "'IBM Plex Mono'", fontSize: 12, flex: 1 }}/>
            </div>

            <div style={{ marginTop: 20 }}>
              <div style={{ fontSize: 12, fontWeight: 500, color: C.ink, marginBottom: 4 }}>Remove "Atlas Weather" footer</div>
              <div style={{ fontSize: 11.5, color: C.inkMuted, lineHeight: 1.5 }}>Enterprise only.</div>
            </div>
            <div style={{ marginTop: 20 }}>
              <div style={{ width: 32, height: 18, borderRadius: 10, background: '#D9D6CD', position: 'relative' }}><div style={{ position: 'absolute', top: 2, left: 2, width: 14, height: 14, borderRadius: '50%', background: '#FFF' }}/></div>
            </div>
          </div>
        </fieldset>

        {/* Overlay note */}
        <div style={{ position: 'absolute', top: 14, right: 14, background: '#FBF3DC', border: `1px solid ${C.accent}`, borderRadius: 3, padding: '6px 10px', fontSize: 11, color: C.ink, fontFamily: "'IBM Plex Sans'", display: 'flex', alignItems: 'center', gap: 6 }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={C.accent} strokeWidth="1.8"><path d="M6 11V8a6 6 0 1 1 12 0v3m-14 0h16v10H4V11z"/></svg>
          <span>Preview of the v2 white-label flow · not yet editable</span>
        </div>
      </div>

      <div style={{ marginTop: 16, padding: '14px 18px', background: C.surface, border: `1px solid ${C.border}`, borderRadius: 4, display: 'flex', gap: 20, alignItems: 'center' }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, color: C.ink, fontWeight: 500, marginBottom: 3 }}>Want early access?</div>
          <div style={{ fontSize: 12, color: C.inkMuted, lineHeight: 1.5 }}>We're onboarding Agency Pro and Enterprise customers to the private beta in late 2026 Q2. Your feedback shapes the feature.</div>
        </div>
        <Btn>Join the waitlist</Btn>
      </div>
    </div>
  );

  // ─── Settings (abbreviated, org-level) ─────────────
  const Settings = () => (
    <div>
      <SectionHead eyebrow="Settings" title="Organization settings" sub="Applies to all members. Per-member preferences (units, language) live in each agent's own account." />
      <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 6, padding: '0 22px' }}>
        {[
          { l: 'Organization name',      v: org.name, kind: 'text' },
          { l: 'Public slug',            v: org.slug, kind: 'text', hint: 'Appears in shared URLs: atlasweather.io/o/' + org.slug },
          { l: 'Default trip units',     v: '°C · km · mm', kind: 'units' },
          { l: 'Client share link TTL',  v: '90 days', kind: 'ttl', hint: 'Shared trip links expire after this period.' },
          { l: 'SSO (SAML 2.0)',         v: 'Enterprise only', kind: 'sso', locked: tier !== 'enterprise' },
          { l: 'Data region',            v: 'EU · Frankfurt', kind: 'region' },
        ].map((row, i) => (
          <div key={row.l} style={{ display: 'grid', gridTemplateColumns: '240px 1fr', gap: 32, padding: '18px 0', borderBottom: i === 5 ? 'none' : `1px solid ${C.border}`, alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 500, color: row.locked ? C.inkMuted : C.ink }}>{row.l}</div>
              {row.hint && <div style={{ fontSize: 11.5, color: C.inkMuted, marginTop: 4 }}>{row.hint}</div>}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <input readOnly value={row.v} style={{ flex: 1, padding: '7px 12px', border: `1px solid ${C.border}`, borderRadius: 3, fontFamily: "'IBM Plex Mono'", fontSize: 12, color: row.locked ? C.inkMuted : C.ink, background: row.locked ? '#FCFBF8' : '#FFF' }}/>
              {row.locked ? <Chip color={C.accent} bg="#FBF3DC">ENTERPRISE</Chip> : <Btn>Edit</Btn>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  // ─── Billing (agency) ──────────────────────────────
  const Billing = () => (
    <div>
      <SectionHead
        eyebrow="Billing"
        title={`${plan.name} · ${plan.mrrLabel}`}
        sub={`Org billing via Paddle. Renews May 14, 2026. VAT handled per jurisdiction. Invoice recipient: finance@${org.slug}.tours.`}
        action={<Btn primary icon={<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#FFF" strokeWidth="1.6"><path d="M5 19L19 5M19 5h-7M19 5v7"/></svg>}>Manage on Paddle</Btn>}
      />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 16 }}>
        {[
          { l: 'Current commitment', v: plan.mrrLabel, cap: `MRR · ${plan.seatsCap} seats` },
          { l: 'Next invoice',       v: '€' + plan.price, cap: 'May 14 · auto · card **4471' },
          { l: 'YTD billed',         v: '€' + (plan.price * 4),  cap: '4 invoices · all paid' },
        ].map(b => (
          <div key={b.l} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 4, padding: '14px 16px' }}>
            <Eyebrow>{b.l}</Eyebrow>
            <div style={{ fontFamily: "'IBM Plex Serif'", fontSize: 22, fontWeight: 400, marginTop: 4, letterSpacing: '-0.012em' }}>{b.v}</div>
            <div style={{ fontSize: 11, color: C.inkMuted, fontFamily: "'IBM Plex Mono'", marginTop: 2 }}>{b.cap}</div>
          </div>
        ))}
      </div>

      {/* Plan ladder */}
      <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 6, padding: '16px 18px', marginBottom: 14 }}>
        <Eyebrow>Plan path</Eyebrow>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginTop: 10 }}>
          {[plans.starter, plans.pro, plans.enterprise].map((p, i) => {
            const isCurrent = p.name === plan.name;
            return (
              <div key={p.name} style={{ border: isCurrent ? `2px solid ${C.ink}` : `1px solid ${C.border}`, borderRadius: 4, padding: '12px 14px', position: 'relative', background: isCurrent ? '#FCFBF8' : '#FFF' }}>
                {isCurrent && <div style={{ position: 'absolute', top: -8, left: 12, fontSize: 9.5, letterSpacing: '0.14em', fontFamily: "'IBM Plex Mono'", background: C.ink, color: '#FFF', padding: '1px 6px', borderRadius: 2 }}>CURRENT</div>}
                <div style={{ fontSize: 11, fontFamily: "'IBM Plex Mono'", color: C.inkSubtle, letterSpacing: '0.1em', textTransform: 'uppercase' }}>{p.name.replace('Agency ', '')}</div>
                <div style={{ fontFamily: "'IBM Plex Serif'", fontSize: 22, fontWeight: 400, margin: '4px 0 2px', letterSpacing: '-0.012em' }}>€{p.price} <span style={{ fontSize: 13, color: C.inkMuted }}>/ mo</span></div>
                <div style={{ fontSize: 11.5, color: C.inkMuted, fontFamily: "'IBM Plex Mono'" }}>{p.seatsCap} seats · €{(p.price/p.seatsCap).toFixed(0)} / seat</div>
                {!isCurrent && <button style={{ marginTop: 10, background: 'transparent', border: `1px solid ${C.border}`, borderRadius: 3, padding: '6px 10px', fontSize: 11.5, cursor: 'pointer', fontFamily: "'IBM Plex Sans'", color: C.ink, width: '100%' }}>{i < Object.keys(plans).indexOf(tier) ? 'Downgrade' : 'Upgrade'}</button>}
              </div>
            );
          })}
        </div>
      </div>

      {/* Invoice history */}
      <Eyebrow>Invoice history · cached from Paddle</Eyebrow>
      <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 6, overflow: 'hidden', marginTop: 8 }}>
        {[
          { d: 'Apr 14, 2026', n: 'INV-AG-01421', a: plan.price, s: 'Paid', note: '7 seats × €' + (plan.price/plan.seatsCap).toFixed(0) + ' + unused buffer' },
          { d: 'Mar 14, 2026', n: 'INV-AG-01198', a: plan.price, s: 'Paid' },
          { d: 'Feb 14, 2026', n: 'INV-AG-00985', a: plan.price, s: 'Paid' },
          { d: 'Jan 14, 2026', n: 'INV-AG-00772', a: plan.price, s: 'Paid' },
        ].map((inv, i) => (
          <div key={inv.n} style={{ display: 'grid', gridTemplateColumns: '110px 130px 1fr 90px 80px 80px', padding: '11px 18px', borderBottom: i === 3 ? 'none' : `1px solid ${C.border}`, fontSize: 12, alignItems: 'center' }}>
            <div style={{ fontFamily: "'IBM Plex Mono'", color: C.inkMuted }}>{inv.d}</div>
            <div style={{ fontFamily: "'IBM Plex Mono'", color: C.ink }}>{inv.n}</div>
            <div style={{ fontSize: 11.5, color: C.inkSubtle, fontStyle: 'italic' }}>{inv.note || '—'}</div>
            <div style={{ fontFamily: "'IBM Plex Mono'", color: C.ink, textAlign: 'right' }}>€{inv.a}</div>
            <div style={{ fontSize: 10.5, color: C.perfect, fontFamily: "'IBM Plex Mono'", letterSpacing: '0.1em', textAlign: 'right' }}>● {inv.s.toUpperCase()}</div>
            <div style={{ textAlign: 'right' }}><a href="#" style={{ color: C.accent, fontSize: 11.5, textDecoration: 'none' }}>PDF ↗</a></div>
          </div>
        ))}
      </div>
    </div>
  );

  // ─── Shell with CSS-only nav ───────────────────────
  const radioName = `ag-nav-${tier}`;
  return (
    <div style={{ width: 1440, minHeight: 1000, background: C.paper, color: C.ink, fontFamily: "'IBM Plex Sans'" }}>
      <window.CKPageHeader />

      {/* Org switcher strip */}
      <div style={{ background: '#FCFBF8', borderBottom: `1px solid ${C.border}`, padding: '8px 32px', fontSize: 11, color: C.inkSubtle, fontFamily: "'IBM Plex Mono'", display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ letterSpacing: '0.14em', textTransform: 'uppercase' }}>/account · org</span>
          <span style={{ color: C.borderStrong }}>·</span>
          <button style={{ background: '#FFF', border: `1px solid ${C.border}`, borderRadius: 3, padding: '3px 10px', fontSize: 11, cursor: 'pointer', fontFamily: "'IBM Plex Sans'", color: C.ink, display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 14, height: 14, borderRadius: 2, background: C.ink, color: '#E0C98A', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 8, fontWeight: 700 }}>CV</span>
            {org.name}
            <span style={{ color: C.inkSubtle, fontSize: 10 }}>▾</span>
          </button>
          <span style={{ color: C.borderStrong }}>·</span>
          <span>signed in as {org.owner} (OWNER)</span>
        </div>
        <div>{plan.name} · {plan.mrrLabel} · {seatsUsed}/{plan.seatsCap} seats</div>
      </div>

      <style>{`
        .ag-${tier} input[name="${radioName}"] { display: none; }
        .ag-${tier} .ag-pane { display: none; }
        ${sections.map(s => `
          #${radioName}-${s.id}:checked ~ .ag-shell .ag-body .ag-pane-${s.id} { display: block; }
          #${radioName}-${s.id}:checked ~ .ag-shell .ag-nav label[for="${radioName}-${s.id}"] {
            background: ${C.surface}; color: ${C.ink}; border-color: ${C.border};
          }
          #${radioName}-${s.id}:checked ~ .ag-shell .ag-nav label[for="${radioName}-${s.id}"] .ag-nav-marker { background: ${C.accent}; }
        `).join('\n')}
        .ag-${tier} .ag-nav label { cursor: pointer; user-select: none; }
      `}</style>

      <div className={`ag-${tier}`} style={{ position: 'relative' }}>
        {sections.map((s, i) => (
          <input key={s.id} type="radio" name={radioName} id={`${radioName}-${s.id}`} defaultChecked={i === 0} />
        ))}

        <div className="ag-shell" style={{ display: 'grid', gridTemplateColumns: '240px 1fr', minHeight: 900 }}>
          {/* LEFT NAV */}
          <nav className="ag-nav" style={{ borderRight: `1px solid ${C.border}`, padding: '20px 12px', background: '#FCFBF8' }}>
            <div style={{ padding: '0 8px 12px', borderBottom: `1px solid ${C.border}`, marginBottom: 10 }}>
              <Eyebrow>Agency</Eyebrow>
              <div style={{ fontFamily: "'IBM Plex Serif'", fontSize: 16, fontWeight: 500, marginTop: 3, letterSpacing: '-0.005em' }}>{org.name}</div>
              <div style={{ fontSize: 10.5, color: C.inkMuted, fontFamily: "'IBM Plex Mono'", marginTop: 2 }}>{plan.name}</div>
              <div style={{ marginTop: 6, height: 4, background: '#ECEAE3', borderRadius: 2, overflow: 'hidden' }}>
                <div style={{ width: `${seatsUsed/plan.seatsCap*100}%`, height: '100%', background: C.ink }}/>
              </div>
              <div style={{ fontSize: 10, color: C.inkSubtle, fontFamily: "'IBM Plex Mono'", marginTop: 4 }}>{seatsUsed}/{plan.seatsCap} seats</div>
            </div>

            {sections.map(s => (
              <label key={s.id} htmlFor={`${radioName}-${s.id}`} style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '7px 10px', borderRadius: 3, marginBottom: 1,
                color: C.inkMuted, border: `1px solid transparent`,
              }}>
                <span className="ag-nav-marker" style={{ width: 4, height: 16, borderRadius: 2, background: 'transparent' }}/>
                <span style={{ flex: 1, fontSize: 12.5, fontWeight: 500 }}>{s.label}</span>
                {s.count !== undefined && <span style={{ fontSize: 10, fontFamily: "'IBM Plex Mono'", color: C.inkSubtle }}>{s.count}</span>}
                {s.badge && <Chip color={C.warm} bg="#FBF3DC">{s.badge}</Chip>}
              </label>
            ))}

            <div style={{ marginTop: 20, padding: '0 8px' }}>
              <Eyebrow>Quick</Eyebrow>
              <a href="/" style={{ display: 'block', fontSize: 12, color: C.ink, textDecoration: 'none', padding: '4px 0', marginTop: 6 }}>↗ Map</a>
              <a href="#" style={{ display: 'block', fontSize: 12, color: C.inkMuted, textDecoration: 'none', padding: '4px 0' }}>Help center</a>
              <a href="#" style={{ display: 'block', fontSize: 12, color: C.inkMuted, textDecoration: 'none', padding: '4px 0' }}>Switch to personal</a>
              <a href="#" style={{ display: 'block', fontSize: 12, color: C.inkMuted, textDecoration: 'none', padding: '4px 0' }}>Sign out</a>
            </div>
          </nav>

          {/* MAIN */}
          <main className="ag-body" style={{ padding: '32px 40px 56px', maxWidth: 1180 }}>
            <div className="ag-pane ag-pane-overview"><Overview /></div>
            <div className="ag-pane ag-pane-clients"><Clients /></div>
            <div className="ag-pane ag-pane-team"><Team /></div>
            <div className="ag-pane ag-pane-activity"><Activity /></div>
            <div className="ag-pane ag-pane-branding"><Branding /></div>
            <div className="ag-pane ag-pane-settings"><Settings /></div>
            <div className="ag-pane ag-pane-billing"><Billing /></div>
          </main>
        </div>
      </div>
    </div>
  );
}
window.AgencyDashboard = AgencyDashboard;
