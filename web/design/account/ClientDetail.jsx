/* global React, window */
// /account/clients/[id] — per-client record, agency agents only.
// Reuses the agency shell nav; adds breadcrumb + client header + 4 tabs.
// Key constraint: client is a RECORD, not a user account.
// No invite/login affordances. "Managed by" language throughout.

function ClientDetail() {
  const C = window.CK_COLORS;

  const client = {
    id: 'cli_westfield_8421',
    name: 'Westfield, Maya & Adam',
    shortName: 'Westfield',
    kind: 'Honeymoon party · 2 pax',
    email: 'maya.westfield@gmail.com',
    phone: '+1 (415) 555-0117',
    city: 'San Francisco, CA',
    since: 'Mar 14, 2026',
    primaryAgent: { name: 'Elena Quiroz', role: 'Owner', email: 'elena@cordillera.tours' },
    tags: ['Honeymoon', 'High-budget', 'Repeat referral'],
    nextTouch: 'May 02 · check in before trip',
    trips: [
      { id: 'trp_8h2k9p', title: 'Honeymoon · Andes & Sacred Valley', country: 'Peru',   months: 'Apr – May', created: 'Apr 12', updated: '2d ago',  agent: 'Elena Quiroz',  score: 87, status: 'shared' },
      { id: 'trp_3p8w2k', title: 'Scouting · Lake District',          country: 'Chile',  months: 'Feb',       created: 'Mar 22', updated: '3w ago',  agent: 'Elena Quiroz',  score: 82, status: 'draft'  },
    ],
    prefs: {
      ranges: [
        { key: 'temp',     label: 'Temperature',   value: '14 – 22 °C daytime', icon: 'temp'   },
        { key: 'rain',     label: 'Rainfall',      value: '< 60 mm / month',    icon: 'rain'   },
        { key: 'sun',      label: 'Sunshine',      value: '≥ 6 hours / day',    icon: 'sun'    },
        { key: 'wind',     label: 'Wind',          value: '< 25 km/h average',  icon: 'wind'   },
        { key: 'safety',   label: 'Safety ceiling',value: 'Level 2 or safer',   icon: 'shield' },
        { key: 'humidity', label: 'Humidity (PRO)',value: '40 – 70 %',          icon: null, pro: true },
        { key: 'heat',     label: 'Heat index (PRO)',value: '< 30 °C feels-like', icon: null, pro: true },
      ],
      restrictions: [
        { l: 'Dietary',   v: 'Vegetarian (Maya) · no pork (Adam)' },
        { l: 'Mobility',  v: 'No issues · both fit, hikers' },
        { l: 'Altitude',  v: 'First time > 3,000 m · acclimatisation day required' },
        { l: 'Flights',   v: 'Economy plus preferred · no red-eyes' },
        { l: 'Budget',    v: '€12,000 · flexible +15%' },
        { l: 'Languages', v: 'English · some French' },
      ],
    },
    // markdown-ish notes (rendered as pre-styled blocks — not live markdown)
    notes: [
      { author: 'Elena Quiroz',  when: 'Apr 22',  kind: 'call',
        body: 'Post-proposal call. Both loved the Sacred Valley option. Flagged: Maya gets altitude headaches — we should plan the Cusco arrival as a rest day, not a tour day. Mention Colca as a softer alternative on Day 6 if needed.\n\nAdam asked about internet on trek — OK to tell them "patchy, assume offline two days".' },
      { author: 'Matías Soto',   when: 'Apr 18',  kind: 'internal',
        body: 'Cross-checked June availability at **Inkaterra Hacienda Urubamba** — held two nights on soft option. Expires **May 10**.' },
      { author: 'Elena Quiroz',  when: 'Apr 12',  kind: 'client',
        body: 'Kickoff · 45 min video. Honeymoon in May, can shift a week either side. Must-haves: Machu Picchu, one hike ≥ half day, zero Lima tourist circuit, finish on a beach somewhere.\n\nTentatively split: 6 nights Sacred Valley + 3 nights Pacific coast. Exploring Máncora vs. Paracas.' },
      { author: 'Renata Ibáñez', when: 'Mar 14',  kind: 'lead',
        body: 'Intake from referral (Patel-Singh). Dates "flexible, Q2 2026". Budget stated 12k€ for two. No agency history.' },
    ],
    activity: [
      { t: '2d ago',     who: 'Elena Quiroz',  act: 'shared trip',           obj: 'Honeymoon · Andes & Sacred Valley',     kind: 'SHARE' },
      { t: '2d ago',     who: 'Elena Quiroz',  act: 'updated prefs',         obj: 'temperature 12–20 → 14–22 °C',          kind: 'EDIT'  },
      { t: '3d ago',     who: 'Matías Soto',   act: 'added note',            obj: 'Inkaterra Hacienda Urubamba hold',      kind: 'NOTE'  },
      { t: '5d ago',     who: 'Elena Quiroz',  act: 'exported PDF',          obj: 'Honeymoon · Andes & Sacred Valley',     kind: 'EXPORT'},
      { t: 'Apr 18',     who: 'Matías Soto',   act: 'viewed trip',           obj: 'Honeymoon · Andes & Sacred Valley',     kind: 'VIEW'  },
      { t: 'Apr 14',     who: 'Elena Quiroz',  act: 'added tag',             obj: '"High-budget"',                         kind: 'TAG'   },
      { t: 'Apr 12',     who: 'Elena Quiroz',  act: 'created trip',          obj: 'Honeymoon · Andes & Sacred Valley',     kind: 'CREATE'},
      { t: 'Apr 12',     who: 'Elena Quiroz',  act: 'added note',            obj: 'Kickoff call summary',                  kind: 'NOTE'  },
      { t: 'Mar 22',     who: 'Elena Quiroz',  act: 'created trip',          obj: 'Scouting · Lake District',              kind: 'CREATE'},
      { t: 'Mar 14',     who: 'Renata Ibáñez', act: 'created client record', obj: '—',                                     kind: 'CREATE'},
      { t: 'Mar 14',     who: 'Renata Ibáñez', act: 'added note',            obj: 'Lead intake',                           kind: 'NOTE'  },
      { t: 'Mar 14',     who: 'System',        act: 'assigned primary agent',obj: 'Elena Quiroz',                          kind: 'SYSTEM'},
    ],
  };

  const org = { name: 'Cordillera Voyages', plan: 'Agency Pro', seatsUsed: 7, seatsCap: 10 };
  const tabs = [
    { id: 'profile',  label: 'Profile',  sub: 'Preferences · restrictions · notes' },
    { id: 'trips',    label: 'Trips',    sub: `${client.trips.length} assigned` },
    { id: 'activity', label: 'Activity', sub: 'Agent actions' },
    { id: 'files',    label: 'Files',    sub: 'Coming soon', badge: 'SOON' },
  ];
  const radioName = 'cl-tab';

  // ─── primitives ─────────────────────────────
  const Eyebrow = ({ children, mt }) => (
    <div style={{ fontSize: 10.5, fontFamily: "'IBM Plex Mono'", color: C.inkSubtle, letterSpacing: '0.14em', textTransform: 'uppercase', marginTop: mt }}>{children}</div>
  );
  const Chip = ({ children, bg = '#FCFBF8', color = C.ink, border = C.border }) => (
    <span style={{ display: 'inline-flex', alignItems: 'center', fontSize: 10, fontFamily: "'IBM Plex Mono'", letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 600, padding: '2px 7px', borderRadius: 2, background: bg, color, border: `1px solid ${border}` }}>{children}</span>
  );
  const Btn = ({ children, primary, danger, ghost, icon }) => (
    <button style={{
      display: 'inline-flex', alignItems: 'center', gap: 7,
      background: primary ? C.ink : ghost ? 'transparent' : '#FFF',
      color: primary ? '#FFF' : danger ? '#7A2E2E' : C.ink,
      border: primary ? 'none' : `1px solid ${C.border}`,
      borderRadius: 3, padding: '7px 12px', cursor: 'pointer',
      fontFamily: "'IBM Plex Sans'", fontSize: 12, fontWeight: 500,
    }}>{icon}{children}</button>
  );

  const Icon = {
    mail:   <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M3 6h18v12H3z"/><path d="M3 6l9 7 9-7"/></svg>,
    phone:  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M5 4h4l2 5-3 2a11 11 0 0 0 5 5l2-3 5 2v4a2 2 0 0 1-2 2A17 17 0 0 1 3 6a2 2 0 0 1 2-2z"/></svg>,
    pin:    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M12 22s7-7 7-12a7 7 0 1 0-14 0c0 5 7 12 7 12z"/><circle cx="12" cy="10" r="2.5"/></svg>,
    plus:   <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M5 12h14"/></svg>,
    ext:    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M5 19L19 5M19 5h-7M19 5v7"/></svg>,
    edit:   <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M14 4l6 6L10 20H4v-6L14 4z"/></svg>,
    check:  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12l4 4L19 6"/></svg>,
    dup:    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><rect x="8" y="8" width="12" height="12" rx="1"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/></svg>,
    arch:   <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M3 6h18v4H3zM5 10v10h14V10M9 14h6"/></svg>,
  };

  // ─── client header ─────────────────────────
  const Header = () => (
    <div style={{ padding: '24px 40px 20px', borderBottom: `1px solid ${C.border}`, background: C.surface }}>
      {/* breadcrumb */}
      <div style={{ fontSize: 11, color: C.inkMuted, fontFamily: "'IBM Plex Mono'", marginBottom: 18, display: 'flex', alignItems: 'center', gap: 6 }}>
        <a href="/account" style={{ color: C.inkMuted, textDecoration: 'none' }}>Account</a>
        <span style={{ color: C.borderStrong }}>›</span>
        <a href="/account?tab=clients" style={{ color: C.inkMuted, textDecoration: 'none' }}>Clients</a>
        <span style={{ color: C.borderStrong }}>›</span>
        <span style={{ color: C.ink }}>{client.shortName}</span>
        <span style={{ color: C.borderStrong, marginLeft: 8 }}>·</span>
        <span style={{ color: C.inkSubtle, fontSize: 10.5 }}>{client.id}</span>
      </div>

      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 24, flexWrap: 'nowrap' }}>
        {/* avatar */}
        <div style={{ width: 56, height: 56, borderRadius: 4, background: '#FBF3DC', border: `1px solid ${C.accent}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontFamily: "'IBM Plex Serif'", fontWeight: 500, fontSize: 22, color: C.accent, letterSpacing: '-0.02em' }}>
          W
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <h1 style={{ fontFamily: "'IBM Plex Serif'", fontSize: 30, fontWeight: 500, margin: 0, letterSpacing: '-0.012em' }}>{client.name}</h1>
            <Chip>{client.kind}</Chip>
            {client.tags.map(t => <Chip key={t} bg="#ECEAE3" color={C.inkMuted} border={C.border}>{t}</Chip>)}
          </div>

          <div style={{ marginTop: 10, display: 'flex', gap: 18, flexWrap: 'wrap', fontSize: 12.5, color: C.inkMuted, fontFamily: "'IBM Plex Sans'" }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>{Icon.mail} <a href={`mailto:${client.email}`} style={{ color: C.ink, textDecoration: 'none', fontFamily: "'IBM Plex Mono'", fontSize: 11.5 }}>{client.email}</a></span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>{Icon.phone} <span style={{ fontFamily: "'IBM Plex Mono'", fontSize: 11.5, color: C.ink }}>{client.phone}</span></span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>{Icon.pin} {client.city}</span>
          </div>

          {/* Non-user clarifier — subtle but unambiguous */}
          <div style={{ marginTop: 14, display: 'inline-flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: '#FBF3DC', border: `1px solid ${C.accent}`, borderRadius: 3, fontSize: 11.5, color: C.ink, maxWidth: 640 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.accent} strokeWidth="1.7"><circle cx="12" cy="12" r="9"/><path d="M12 8v5M12 16.5v.01" strokeLinecap="round"/></svg>
            <span>
              <strong style={{ fontWeight: 600 }}>Managed record.</strong>{' '}
              {client.shortName} does not have a login — this profile exists so your team can plan on their behalf. Email them a shared trip link or export a PDF when you're ready.
            </span>
          </div>
        </div>

        {/* right meta */}
        <div style={{ textAlign: 'right', minWidth: 220, flexShrink: 0 }}>
          <Eyebrow>Primary agent</Eyebrow>
          <div style={{ fontFamily: "'IBM Plex Serif'", fontSize: 18, fontWeight: 500, marginTop: 4, letterSpacing: '-0.005em' }}>{client.primaryAgent.name}</div>
          <div style={{ fontSize: 10.5, fontFamily: "'IBM Plex Mono'", color: C.inkMuted, letterSpacing: '0.08em' }}>{client.primaryAgent.role.toUpperCase()}</div>
          <div style={{ marginTop: 14, fontSize: 11.5, color: C.inkMuted, fontFamily: "'IBM Plex Mono'" }}>Active since {client.since}</div>
          <div style={{ marginTop: 4, fontSize: 11.5, color: C.accent, fontFamily: "'IBM Plex Mono'" }}>Next touch · {client.nextTouch}</div>
          <div style={{ marginTop: 12, display: 'flex', justifyContent: 'flex-end', gap: 6 }}>
            <Btn icon={Icon.plus}>New trip</Btn>
            <button style={{ background: '#FFF', border: `1px solid ${C.border}`, borderRadius: 3, padding: '7px 10px', cursor: 'pointer', color: C.inkMuted }}>⋯</button>
          </div>
        </div>
      </div>

      {/* Tab rail */}
      <div className="cl-tabs" style={{ display: 'flex', gap: 4, marginTop: 24, marginBottom: -21 }}>
        {tabs.map(t => (
          <label key={t.id} htmlFor={`${radioName}-${t.id}`} className={`cl-tab cl-tab-${t.id}`} style={{
            cursor: 'pointer', padding: '10px 16px 14px', borderBottom: '2px solid transparent',
            display: 'flex', gap: 8, alignItems: 'baseline', color: C.inkMuted,
          }}>
            <span style={{ fontSize: 13, fontWeight: 500 }}>{t.label}</span>
            <span style={{ fontSize: 10.5, color: C.inkSubtle, fontFamily: "'IBM Plex Mono'" }}>{t.sub}</span>
            {t.badge && <Chip bg="#FBF3DC" color={C.accent} border={C.accent}>{t.badge}</Chip>}
          </label>
        ))}
      </div>
    </div>
  );

  // ─── PROFILE TAB ────────────────────────────
  const Profile = () => (
    <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 28 }}>

      {/* LEFT: prefs + restrictions */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
          <Eyebrow>Default preferences · used to score trips</Eyebrow>
          <button style={{ background: 'transparent', border: 'none', color: C.accent, cursor: 'pointer', fontSize: 11.5, display: 'inline-flex', alignItems: 'center', gap: 5, padding: 0 }}>{Icon.edit} Edit</button>
        </div>
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 4 }}>
          {client.prefs.ranges.map((p, i) => (
            <div key={p.key} style={{
              display: 'grid', gridTemplateColumns: '32px 1fr auto', gap: 12, alignItems: 'center',
              padding: '12px 16px', borderBottom: i === client.prefs.ranges.length - 1 ? 'none' : `1px solid ${C.border}`,
              opacity: p.pro ? 0.88 : 1,
            }}>
              <div style={{ width: 26, height: 26, borderRadius: 3, background: '#FCFBF8', border: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.inkMuted }}>
                <PrefIcon kind={p.icon} C={C} />
              </div>
              <div>
                <div style={{ fontSize: 12.5, fontWeight: 500, color: C.ink, display: 'flex', alignItems: 'center', gap: 8 }}>
                  {p.label.replace(' (PRO)', '')}
                  {p.pro && <Chip bg="#FBF3DC" color={C.accent} border={C.accent}>PREMIUM</Chip>}
                </div>
              </div>
              <div style={{ fontSize: 11.5, fontFamily: "'IBM Plex Mono'", color: p.pro ? C.inkMuted : C.ink }}>{p.value}</div>
            </div>
          ))}
        </div>

        {/* Restrictions */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', margin: '28px 0 10px' }}>
          <Eyebrow>Travel restrictions & context</Eyebrow>
          <button style={{ background: 'transparent', border: 'none', color: C.accent, cursor: 'pointer', fontSize: 11.5, display: 'inline-flex', alignItems: 'center', gap: 5, padding: 0 }}>{Icon.edit} Edit</button>
        </div>
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 4, padding: '6px 16px' }}>
          {client.prefs.restrictions.map((r, i) => (
            <div key={r.l} style={{ display: 'grid', gridTemplateColumns: '120px 1fr', padding: '11px 0', borderBottom: i === client.prefs.restrictions.length - 1 ? 'none' : `1px dotted ${C.border}`, alignItems: 'center' }}>
              <div style={{ fontSize: 10.5, fontFamily: "'IBM Plex Mono'", color: C.inkSubtle, letterSpacing: '0.12em', textTransform: 'uppercase' }}>{r.l}</div>
              <div style={{ fontSize: 12.5, color: C.ink }}>{r.v}</div>
            </div>
          ))}
        </div>
      </div>

      {/* RIGHT: notes */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
          <Eyebrow>Notes · shared across the team</Eyebrow>
          <Btn icon={Icon.plus}>Add note</Btn>
        </div>

        {/* Draft composer */}
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 4, padding: 14, marginBottom: 14 }}>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 8 }}>
            <div style={{ width: 24, height: 24, borderRadius: 12, background: '#E0C98A', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontFamily: "'IBM Plex Mono'", color: C.ink, fontWeight: 700 }}>EQ</div>
            <div style={{ fontSize: 12, color: C.ink, fontWeight: 500 }}>Elena Quiroz</div>
            <div style={{ fontSize: 10.5, color: C.inkSubtle, fontFamily: "'IBM Plex Mono'" }}>you · just now</div>
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
              {['call','email','meeting','internal','client'].map(t => (
                <Chip key={t} bg={t === 'internal' ? '#FBF3DC' : '#FCFBF8'} color={t === 'internal' ? C.accent : C.inkMuted} border={t === 'internal' ? C.accent : C.border}>{t}</Chip>
              ))}
            </div>
          </div>
          <div contentEditable suppressContentEditableWarning spellCheck={false} style={{
            minHeight: 52, padding: 10, borderRadius: 3, background: '#FCFBF8', border: `1px dashed ${C.border}`,
            fontSize: 12.5, color: C.inkSubtle, fontFamily: "'IBM Plex Sans'", outline: 'none',
          }}>
            Quick note · supports **markdown** · @mention an agent to tag them…
          </div>
          <div style={{ marginTop: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontSize: 10.5, color: C.inkSubtle, fontFamily: "'IBM Plex Mono'" }}>Cmd ⏎ to save</div>
            <div style={{ display: 'flex', gap: 6 }}><Btn ghost>Cancel</Btn><Btn primary>Save note</Btn></div>
          </div>
        </div>

        {/* Note timeline */}
        <div style={{ position: 'relative', paddingLeft: 18 }}>
          <div style={{ position: 'absolute', left: 6, top: 4, bottom: 4, width: 1, background: C.border }}/>
          {client.notes.map(n => (
            <div key={n.when} style={{ position: 'relative', marginBottom: 18 }}>
              <div style={{ position: 'absolute', left: -14, top: 10, width: 9, height: 9, borderRadius: 5, background: '#FFF', border: `2px solid ${n.kind === 'client' ? C.perfect : n.kind === 'internal' ? C.accent : C.inkSubtle}` }}/>
              <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 4, padding: '12px 14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: C.ink }}>{n.author}</span>
                  <span style={{ fontSize: 10.5, color: C.inkSubtle, fontFamily: "'IBM Plex Mono'" }}>{n.when}</span>
                  <Chip bg={n.kind === 'internal' ? '#FBF3DC' : '#FCFBF8'} color={n.kind === 'internal' ? C.accent : C.inkMuted} border={n.kind === 'internal' ? C.accent : C.border}>{n.kind}</Chip>
                </div>
                <div style={{ fontSize: 12.5, color: C.ink, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                  {n.body.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
                    part.startsWith('**') ? <strong key={i} style={{ fontWeight: 600 }}>{part.slice(2, -2)}</strong> : part
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  // ─── TRIPS TAB ──────────────────────────────
  const Trips = () => (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <Eyebrow>All trips assigned to {client.shortName} · sortable</Eyebrow>
        <div style={{ display: 'flex', gap: 8 }}>
          <select style={{ padding: '6px 10px', fontFamily: "'IBM Plex Sans'", fontSize: 12, border: `1px solid ${C.border}`, borderRadius: 3, background: '#FFF' }}>
            <option>Sort · Most recent</option><option>Sort · Month asc</option><option>Sort · Score desc</option>
          </select>
          <Btn primary icon={Icon.plus}>New trip for {client.shortName}</Btn>
        </div>
      </div>

      <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 4, overflow: 'hidden' }}>
        <div style={{
          display: 'grid', gridTemplateColumns: '1fr 110px 130px 120px 130px 60px 70px',
          padding: '10px 16px', background: '#FCFBF8', borderBottom: `1px solid ${C.border}`,
          fontSize: 10.5, fontFamily: "'IBM Plex Mono'", color: C.inkSubtle, letterSpacing: '0.1em', textTransform: 'uppercase',
        }}>
          <div>Trip</div><div>Country</div><div>Month</div><div>Agent</div><div>Last updated</div><div style={{ textAlign: 'right' }}>Score</div><div style={{ textAlign: 'right' }}>Open</div>
        </div>
        {client.trips.map((t, i) => (
          <div key={t.id} style={{
            display: 'grid', gridTemplateColumns: '1fr 110px 130px 120px 130px 60px 70px',
            padding: '12px 16px', alignItems: 'center',
            borderBottom: i === client.trips.length - 1 ? 'none' : `1px solid ${C.border}`,
          }}>
            <div>
              <div style={{ fontFamily: "'IBM Plex Serif'", fontSize: 15, fontWeight: 500, color: C.ink, letterSpacing: '-0.002em' }}>{t.title}</div>
              <div style={{ fontSize: 10.5, color: C.inkSubtle, fontFamily: "'IBM Plex Mono'", marginTop: 3, display: 'flex', gap: 8, alignItems: 'center' }}>
                <span>{t.id}</span>
                <Chip bg={t.status === 'shared' ? '#E8F2E8' : '#FCFBF8'} color={t.status === 'shared' ? C.perfect : C.inkMuted} border={t.status === 'shared' ? C.perfect : C.border}>{t.status}</Chip>
              </div>
            </div>
            <div style={{ fontSize: 12, color: C.ink }}>{t.country}</div>
            <div style={{ fontSize: 12, color: C.ink, fontFamily: "'IBM Plex Mono'" }}>{t.months}</div>
            <div style={{ fontSize: 12, color: C.inkMuted }}>{t.agent}</div>
            <div style={{ fontSize: 11, color: C.inkMuted, fontFamily: "'IBM Plex Mono'" }}>{t.updated}</div>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}><window.ScoreBadge score={t.score} size="sm"/></div>
            <div style={{ textAlign: 'right' }}><a href={`/trips/${t.id}`} style={{ fontSize: 11, color: C.accent, textDecoration: 'none', fontFamily: "'IBM Plex Sans'" }}>Open →</a></div>
          </div>
        ))}
      </div>

      {/* create-from-templates hint */}
      <div style={{ marginTop: 16, padding: '14px 18px', background: '#FCFBF8', border: `1px dashed ${C.borderStrong}`, borderRadius: 4, display: 'flex', alignItems: 'center', gap: 12, fontSize: 12, color: C.inkMuted }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={C.inkSubtle} strokeWidth="1.5"><rect x="4" y="4" width="16" height="16" rx="2"/><path d="M9 9h6M9 13h6M9 17h4"/></svg>
        <span><strong style={{ color: C.ink, fontWeight: 600 }}>Tip.</strong> New trips start from {client.shortName}'s default preferences — edit them on the Profile tab to change the scoring baseline.</span>
      </div>
    </div>
  );

  // ─── ACTIVITY TAB ───────────────────────────
  const kindColor = { CREATE: C.perfect, EDIT: C.inkMuted, SHARE: C.accent, EXPORT: C.good, VIEW: C.inkSubtle, NOTE: '#6B4FAE', TAG: C.warm, SYSTEM: C.inkSubtle };
  const Activity = () => (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <Eyebrow>Agent actions on this client · newest first</Eyebrow>
        <div style={{ display: 'flex', gap: 8 }}>
          <select style={{ padding: '6px 10px', fontFamily: "'IBM Plex Sans'", fontSize: 12, border: `1px solid ${C.border}`, borderRadius: 3, background: '#FFF' }}>
            <option>All actions</option><option>Trips only</option><option>Notes only</option><option>Edits only</option>
          </select>
          <select style={{ padding: '6px 10px', fontFamily: "'IBM Plex Sans'", fontSize: 12, border: `1px solid ${C.border}`, borderRadius: 3, background: '#FFF' }}>
            <option>All agents</option><option>Elena Quiroz</option><option>Matías Soto</option><option>Renata Ibáñez</option>
          </select>
        </div>
      </div>

      <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 4, overflow: 'hidden' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '100px 60px 150px 1fr', padding: '10px 16px', background: '#FCFBF8', borderBottom: `1px solid ${C.border}`, fontSize: 10.5, fontFamily: "'IBM Plex Mono'", color: C.inkSubtle, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
          <div>When</div><div>Kind</div><div>Who</div><div>Action</div>
        </div>
        {client.activity.map((a, i) => (
          <div key={i} style={{ display: 'grid', gridTemplateColumns: '100px 60px 150px 1fr', padding: '10px 16px', borderBottom: i === client.activity.length - 1 ? 'none' : `1px solid ${C.border}`, fontSize: 12, alignItems: 'center' }}>
            <div style={{ fontFamily: "'IBM Plex Mono'", fontSize: 11, color: C.inkMuted }}>{a.t}</div>
            <div><Chip bg="#FCFBF8" color={kindColor[a.kind] || C.inkMuted} border={kindColor[a.kind] || C.border}>{a.kind}</Chip></div>
            <div style={{ color: C.ink, fontWeight: 500, fontSize: 12 }}>{a.who}</div>
            <div style={{ color: C.ink }}>
              {a.act}{' '}
              <span style={{ fontStyle: 'italic', fontFamily: "'IBM Plex Serif'", fontSize: 12.5, color: C.ink }}>{a.obj}</span>
            </div>
          </div>
        ))}
      </div>

      <div style={{ marginTop: 14, fontSize: 11, color: C.inkSubtle, fontFamily: "'IBM Plex Mono'", textAlign: 'right' }}>
        Showing 12 of 47 events · <a href="#" style={{ color: C.accent, textDecoration: 'none' }}>Load older →</a>
      </div>
    </div>
  );

  // ─── FILES TAB (v2 placeholder) ─────────────
  const Files = () => (
    <div style={{
      border: `1px dashed ${C.borderStrong}`, borderRadius: 6, padding: '72px 40px',
      textAlign: 'center', background: '#FCFBF8',
    }}>
      <Chip bg="#FBF3DC" color={C.accent} border={C.accent}>COMING SOON · V2</Chip>
      <div style={{ fontFamily: "'IBM Plex Serif'", fontSize: 26, fontWeight: 500, color: C.ink, letterSpacing: '-0.012em', marginTop: 14 }}>
        Client files
      </div>
      <div style={{ fontSize: 13, color: C.inkMuted, lineHeight: 1.6, maxWidth: 520, margin: '10px auto 22px' }}>
        Passports, insurance certificates, booking confirmations — one place per client. We're working on it for the end of 2026.
      </div>
      <Btn ghost>Get notified when this ships</Btn>
    </div>
  );

  // ─── Shell (agency left-nav, selected = Clients) ────
  return (
    <div style={{ width: 1440, minHeight: 1100, background: C.paper, color: C.ink, fontFamily: "'IBM Plex Sans'" }}>
      <window.CKPageHeader />

      {/* Admin strip */}
      <div style={{ background: '#FCFBF8', borderBottom: `1px solid ${C.border}`, padding: '8px 24px', fontSize: 11, color: C.inkSubtle, fontFamily: "'IBM Plex Mono'", display: 'flex', justifyContent: 'space-between' }}>
        <div>/account/clients/{client.id} · org <span style={{ color: C.ink, fontWeight: 600 }}>{org.name}</span> · {org.plan}</div>
        <div>signed in as Elena Quiroz (Owner) · {org.seatsUsed}/{org.seatsCap} seats</div>
      </div>

      {/* Tab CSS */}
      <style>{`
        input[name="${radioName}"] { display: none; }
        .cl-pane { display: none; }
        ${tabs.map(t => `
          #${radioName}-${t.id}:checked ~ .cl-main .cl-pane-${t.id} { display: block; }
          #${radioName}-${t.id}:checked ~ .cl-header-wrap .cl-tabs .cl-tab-${t.id} {
            color: ${C.ink}; border-bottom-color: ${C.accent};
          }
        `).join('\n')}
      `}</style>

      <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', minHeight: 900 }}>
        {/* Agency nav (Clients active) */}
        <nav style={{ borderRight: `1px solid ${C.border}`, padding: '20px 12px', background: '#FCFBF8' }}>
          <div style={{ padding: '0 8px 12px', borderBottom: `1px solid ${C.border}`, marginBottom: 10 }}>
            <Eyebrow>Agency</Eyebrow>
            <div style={{ fontFamily: "'IBM Plex Serif'", fontSize: 16, fontWeight: 500, marginTop: 3, letterSpacing: '-0.005em' }}>{org.name}</div>
            <div style={{ fontSize: 10.5, color: C.inkMuted, fontFamily: "'IBM Plex Mono'", marginTop: 2 }}>{org.plan}</div>
            <div style={{ marginTop: 6, height: 4, background: '#ECEAE3', borderRadius: 2, overflow: 'hidden' }}>
              <div style={{ width: `${org.seatsUsed / org.seatsCap * 100}%`, height: '100%', background: C.ink }}/>
            </div>
            <div style={{ fontSize: 10, color: C.inkSubtle, fontFamily: "'IBM Plex Mono'", marginTop: 4 }}>{org.seatsUsed}/{org.seatsCap} seats</div>
          </div>

          {[
            { l: 'Overview', href: '/account' },
            { l: 'Clients',  href: '/account?tab=clients', active: true, count: 48 },
            { l: 'Team',     href: '/account?tab=team',  count: `${org.seatsUsed}/${org.seatsCap}` },
            { l: 'Activity', href: '/account?tab=activity' },
            { l: 'Branding', href: '/account?tab=branding', badge: 'SOON' },
            { l: 'Settings', href: '/account?tab=settings' },
            { l: 'Billing',  href: '/account?tab=billing' },
          ].map(item => (
            <a key={item.l} href={item.href} style={{
              display: 'flex', alignItems: 'center', gap: 10, padding: '7px 10px', borderRadius: 3, marginBottom: 1,
              color: item.active ? C.ink : C.inkMuted, textDecoration: 'none',
              background: item.active ? C.surface : 'transparent', border: `1px solid ${item.active ? C.border : 'transparent'}`,
            }}>
              <span style={{ width: 4, height: 16, borderRadius: 2, background: item.active ? C.accent : 'transparent' }}/>
              <span style={{ flex: 1, fontSize: 12.5, fontWeight: 500 }}>{item.l}</span>
              {item.count !== undefined && <span style={{ fontSize: 10, fontFamily: "'IBM Plex Mono'", color: C.inkSubtle }}>{item.count}</span>}
              {item.badge && <Chip bg="#FBF3DC" color={C.accent} border={C.accent}>{item.badge}</Chip>}
            </a>
          ))}

          {/* back-to-clients sublink */}
          <div style={{ marginTop: 18, padding: '10px', background: '#FFF', border: `1px solid ${C.border}`, borderRadius: 3 }}>
            <div style={{ fontSize: 10, fontFamily: "'IBM Plex Mono'", color: C.inkSubtle, letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 4 }}>Viewing client</div>
            <div style={{ fontSize: 12, fontFamily: "'IBM Plex Serif'", fontWeight: 500 }}>{client.shortName}</div>
            <a href="/account?tab=clients" style={{ fontSize: 11, color: C.accent, textDecoration: 'none', display: 'inline-block', marginTop: 6 }}>← All clients</a>
          </div>
        </nav>

        {/* Right = header + tab panes */}
        <div style={{ position: 'relative' }}>
          {tabs.map((t, i) => (
            <input key={t.id} type="radio" name={radioName} id={`${radioName}-${t.id}`} defaultChecked={i === 0} />
          ))}
          <div className="cl-header-wrap"><Header /></div>
          <main className="cl-main" style={{ padding: '28px 40px 56px', maxWidth: 1180 }}>
            <div className="cl-pane cl-pane-profile"><Profile /></div>
            <div className="cl-pane cl-pane-trips"><Trips /></div>
            <div className="cl-pane cl-pane-activity"><Activity /></div>
            <div className="cl-pane cl-pane-files"><Files /></div>
          </main>
        </div>
      </div>
    </div>
  );
}

// Preference icons — match DisplayMode set
function PrefIcon({ kind, C }) {
  const s = { width: 14, height: 14, stroke: 'currentColor', strokeWidth: 1.5, fill: 'none', strokeLinecap: 'round', strokeLinejoin: 'round' };
  switch (kind) {
    case 'temp':   return <svg viewBox="0 0 24 24" {...s}><path d="M14 14V5a2 2 0 1 0-4 0v9a4 4 0 1 0 4 0z"/><circle cx="12" cy="17" r="1.5" fill="currentColor" stroke="none"/></svg>;
    case 'rain':   return <svg viewBox="0 0 24 24" {...s}><path d="M7 16a5 5 0 1 1 9-4 4 4 0 0 1-1 8H8a3 3 0 0 1-1-4z"/><path d="M9 20l-1 2M13 20l-1 2M17 20l-1 2"/></svg>;
    case 'sun':    return <svg viewBox="0 0 24 24" {...s}><circle cx="12" cy="12" r="4"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4L7 17M17 7l1.4-1.4"/></svg>;
    case 'wind':   return <svg viewBox="0 0 24 24" {...s}><path d="M3 8h12a3 3 0 1 0-3-3M3 14h16a3 3 0 1 1-3 3M3 11h8"/></svg>;
    case 'shield': return <svg viewBox="0 0 24 24" {...s}><path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6l8-3z"/></svg>;
    default:       return <svg viewBox="0 0 24 24" {...s}><circle cx="12" cy="12" r="4"/></svg>;
  }
}

window.ClientDetail = ClientDetail;
