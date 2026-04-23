/* global React, window */
// Upgrade prompts (3) + empty states (5) — all on one canvas.

function UpgradeEmpty() {
  const C = window.CK_COLORS;

  // ─── shared ───
  const Eyebrow = ({ children, color = C.inkSubtle }) => (
    <div style={{ fontSize: 10.5, fontFamily: "'IBM Plex Mono'", color, letterSpacing: '0.16em', textTransform: 'uppercase', fontWeight: 600 }}>{children}</div>
  );
  const Btn = ({ children, primary, ghost, small }) => (
    <div style={{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
      height: small ? 30 : 40, padding: small ? '0 12px' : '0 18px', borderRadius: 3,
      background: primary ? C.ink : ghost ? 'transparent' : '#FFF',
      color: primary ? '#FFF' : C.ink,
      border: primary ? 'none' : `1px solid ${C.border}`,
      fontSize: small ? 12 : 13.5, fontWeight: 500,
    }}>{children}</div>
  );
  const Chip = ({ children, bg = '#FBF3DC', color = C.accent, border = C.accent }) => (
    <span style={{ display: 'inline-flex', alignItems: 'center', fontSize: 10, fontFamily: "'IBM Plex Mono'", letterSpacing: '0.12em', textTransform: 'uppercase', fontWeight: 600, padding: '2px 7px', borderRadius: 2, background: bg, color, border: `1px solid ${border}` }}>{children}</span>
  );

  const Frame = ({ w, h, children, chrome, bg = C.paper }) => (
    <div style={{ width: w, height: h, background: bg, position: 'relative', overflow: 'hidden', fontFamily: "'IBM Plex Sans'", color: C.ink }}>
      {chrome}
      {children}
    </div>
  );

  const MinimalTopBar = ({ subtitle }) => (
    <div style={{
      height: 52, borderBottom: `1px solid ${C.border}`, background: C.surface,
      display: 'flex', alignItems: 'center', padding: '0 24px', gap: 16,
    }}>
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
        <svg width="20" height="20" viewBox="0 0 32 32"><circle cx="16" cy="16" r="13" stroke={C.ink} strokeWidth="1.5" fill="none"/><path d="M3 16Q16 8 29 16Q16 24 3 16" stroke={C.accent} strokeWidth="1.4" fill="none"/><circle cx="16" cy="16" r="2.2" fill={C.accent}/></svg>
        <div style={{ fontFamily: "'IBM Plex Serif'", fontSize: 15, fontWeight: 500 }}>Atlas Weather</div>
      </div>
      {subtitle && <div style={{ fontSize: 11, fontFamily: "'IBM Plex Mono'", color: C.inkSubtle, marginLeft: 8 }}>· {subtitle}</div>}
      <div style={{ marginLeft: 'auto', display: 'flex', gap: 16, fontSize: 12, color: C.inkMuted, alignItems: 'center' }}>
        <a href="#" style={{ color: 'inherit', textDecoration: 'none' }}>Countries</a>
        <a href="#" style={{ color: 'inherit', textDecoration: 'none' }}>Pricing</a>
        <div style={{ width: 28, height: 28, borderRadius: 14, background: '#E0C98A', fontSize: 11, fontFamily: "'IBM Plex Mono'", display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600 }}>MW</div>
      </div>
    </div>
  );

  // ═════════════ UPGRADE PROMPTS ═════════════

  // ── 1. Inline soft prompt (on the map) ───────────────────────────
  const MapBackdrop = () => (
    <svg viewBox="0 0 1280 648" width="100%" height="100%" style={{ position: 'absolute', inset: 0, display: 'block' }}>
      <rect width="1280" height="648" fill="#F7F6F2"/>
      {/* admin-1 regions — blurry shapes, simulating Peru zoom */}
      <g opacity="0.9">
        <path d="M120 180 L320 120 L480 200 L540 360 L400 460 L220 440 L120 300 Z" fill="#9BC2E6" stroke="#FFF" strokeWidth="2"/>
        <path d="M480 200 L680 180 L780 320 L720 420 L540 360 Z" fill="#F5D17A" stroke="#FFF" strokeWidth="2"/>
        <path d="M680 180 L880 160 L960 280 L880 380 L780 320 Z" fill="#E38F5C" stroke="#FFF" strokeWidth="2"/>
        <path d="M880 160 L1080 200 L1160 360 L960 380 L960 280 Z" fill="#7FB18E" stroke="#FFF" strokeWidth="2"/>
        <path d="M540 360 L720 420 L780 540 L600 580 L400 460 Z" fill="#C3B1D9" stroke="#FFF" strokeWidth="2"/>
        <path d="M220 440 L400 460 L600 580 L500 620 L200 580 L160 500 Z" fill="#D96B6B" stroke="#FFF" strokeWidth="2"/>
      </g>
      {/* stippled "next zoom level" blur overlay */}
      <g opacity="0.35">
        {Array.from({ length: 40 }).map((_, i) => (
          <line key={i} x1={i * 32} y1="0" x2={i * 32 + 30} y2="648" stroke="#FFF" strokeWidth="0.5"/>
        ))}
      </g>
      {/* zoom controls */}
      <g transform="translate(24,24)">
        <rect x="0" y="0" width="36" height="72" fill="#FFF" stroke={C.border} strokeWidth="1" rx="3"/>
        <line x1="0" y1="36" x2="36" y2="36" stroke={C.border}/>
        <text x="18" y="24" textAnchor="middle" fontSize="18" fill={C.ink}>+</text>
        <text x="18" y="58" textAnchor="middle" fontSize="18" fill={C.ink}>−</text>
      </g>
      {/* label */}
      <g transform="translate(70,40)">
        <rect width="120" height="22" fill="#FFF" stroke={C.border} rx="2"/>
        <text x="10" y="15" fontSize="10" fill={C.inkMuted} fontFamily="IBM Plex Mono" letterSpacing="0.08em">ADMIN-1 · ZOOM 5</text>
      </g>
    </svg>
  );

  const InlineUpgradePrompt = () => (
    <Frame w={1280} h={700} chrome={<MinimalTopBar subtitle="Peru · April"/>}>
      <div style={{ position: 'relative', height: 648 }}>
        <MapBackdrop/>

        {/* anchor pin where user tried to zoom */}
        <div style={{ position: 'absolute', left: 720, top: 330, width: 12, height: 12, background: C.accent, borderRadius: 6, boxShadow: `0 0 0 6px rgba(184,138,46,0.2)` }}/>

        {/* the soft prompt */}
        <div style={{
          position: 'absolute', left: 760, top: 300, width: 360,
          background: C.surface, border: `1px solid ${C.border}`, borderRadius: 6,
          boxShadow: '0 1px 2px rgba(15,27,45,0.05), 0 12px 32px rgba(15,27,45,0.14)',
          padding: 20, fontFamily: "'IBM Plex Sans'",
        }}>
          {/* caret */}
          <div style={{ position: 'absolute', left: -8, top: 28, width: 14, height: 14, background: C.surface, border: `1px solid ${C.border}`, borderRight: 'none', borderTop: 'none', transform: 'rotate(45deg)' }}/>

          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
            <div style={{ width: 34, height: 34, borderRadius: 4, background: '#FBF3DC', border: `1px solid ${C.accent}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={C.accent} strokeWidth="1.7"><circle cx="11" cy="11" r="7"/><path d="M21 21l-5-5M8 11h6M11 8v6"/></svg>
            </div>
            <div style={{ flex: 1 }}>
              <Chip>Premium</Chip>
              <div style={{ fontFamily: "'IBM Plex Serif'", fontSize: 17, fontWeight: 500, letterSpacing: '-0.005em', marginTop: 8, lineHeight: 1.25 }}>
                Zoom past provinces.
              </div>
              <div style={{ fontSize: 12.5, color: C.inkMuted, lineHeight: 1.5, marginTop: 4 }}>
                See every district inside Peru, scored against your weather — <strong style={{ color: C.ink, fontWeight: 600 }}>€2.99/mo</strong>.
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8, marginTop: 16, justifyContent: 'space-between', alignItems: 'center' }}>
            <button style={{ background: 'none', border: 'none', color: C.inkSubtle, fontSize: 12, cursor: 'pointer', padding: 0 }}>No thanks</button>
            <div style={{ display: 'flex', gap: 8 }}>
              <Btn small>See plan</Btn>
              <Btn small primary>Try Premium</Btn>
            </div>
          </div>
        </div>

        {/* label of what this is */}
        <div style={{ position: 'absolute', left: 24, bottom: 24, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 3, padding: '10px 14px', fontSize: 11, fontFamily: "'IBM Plex Mono'", color: C.inkMuted, maxWidth: 380 }}>
          <span style={{ color: C.accent, letterSpacing: '0.14em', textTransform: 'uppercase', fontWeight: 600 }}>Inline soft prompt</span> · appears on admin-2 zoom attempt and locked Display Mode variables. Dismissible, re-armed after 7 days.
        </div>
      </div>
    </Frame>
  );

  // ── 2. Modal upgrade prompt (Save trip) ──────────────────────────
  const FakeTripBehind = () => (
    <div style={{ position: 'absolute', inset: 0, padding: 24 }}>
      <MinimalTopBar subtitle="Peru · April · trip draft"/>
      <div style={{ padding: '16px 24px', color: C.inkMuted, fontSize: 12 }}>
        {/* dimmed content lines to suggest a real page behind */}
        <div style={{ height: 40, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 4, marginBottom: 12 }}/>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
          {[1,2,3,4,5,6].map(i => <div key={i} style={{ height: 120, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 4 }}/>)}
        </div>
      </div>
    </div>
  );

  const TierPill = ({ label, price, period, selected, discount }) => (
    <label style={{
      flex: 1, padding: '14px 16px', borderRadius: 4, cursor: 'pointer', background: '#FFF',
      border: `1.5px solid ${selected ? C.ink : C.border}`, boxShadow: selected ? `inset 0 0 0 1px ${C.ink}` : 'none',
      position: 'relative',
    }}>
      {discount && <div style={{ position: 'absolute', top: -9, right: 10 }}><Chip>{discount}</Chip></div>}
      <div style={{ fontSize: 10.5, fontFamily: "'IBM Plex Mono'", color: C.inkSubtle, letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 4 }}>{label}</div>
      <div style={{ fontFamily: "'IBM Plex Serif'", fontSize: 22, fontWeight: 500, letterSpacing: '-0.01em' }}>{price} <span style={{ fontSize: 12, color: C.inkMuted, fontFamily: "'IBM Plex Sans'", fontWeight: 400 }}>{period}</span></div>
    </label>
  );

  const Included = ({ children }) => (
    <li style={{ display: 'flex', gap: 10, padding: '7px 0', alignItems: 'flex-start', fontSize: 13, color: C.ink, lineHeight: 1.45 }}>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.perfect} strokeWidth="2" style={{ flexShrink: 0, marginTop: 3 }}><path d="M5 12l4 4L19 7" strokeLinecap="round"/></svg>
      <span>{children}</span>
    </li>
  );

  const ModalUpgrade = () => (
    <Frame w={1280} h={800} chrome={null} bg="#FFF">
      <FakeTripBehind/>
      {/* dimmer */}
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(15,27,45,0.5)', backdropFilter: 'blur(2px)' }}/>

      {/* modal */}
      <div style={{
        position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%,-50%)',
        width: 640, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8,
        boxShadow: '0 20px 60px rgba(0,0,0,0.25)', overflow: 'hidden', fontFamily: "'IBM Plex Sans'",
      }}>
        {/* close */}
        <button style={{ position: 'absolute', right: 14, top: 14, background: 'none', border: 'none', color: C.inkMuted, fontSize: 20, cursor: 'pointer', width: 28, height: 28 }}>×</button>

        <div style={{ padding: '30px 36px 0' }}>
          <Chip>Premium required</Chip>
          <h2 style={{ fontFamily: "'IBM Plex Serif'", fontSize: 30, fontWeight: 500, letterSpacing: '-0.015em', margin: '14px 0 8px', lineHeight: 1.15 }}>
            Save this trip — and every trip after.
          </h2>
          <div style={{ fontSize: 14, color: C.inkMuted, lineHeight: 1.55, maxWidth: 520 }}>
            Free keeps the map open for anyone. Premium is for travellers who come back — saved trips, alert-me-when-it's-good notifications, and district-level zoom.
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, padding: '22px 36px' }}>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            <Included>Unlimited saved trips + shareable links</Included>
            <Included>Email alerts when a destination matches</Included>
            <Included>Zoom to district level (admin-2)</Included>
            <Included>4 extra climate variables</Included>
            <Included>Percentile bands on every chart</Included>
          </ul>

          <div>
            <Eyebrow>Billing</Eyebrow>
            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <TierPill label="Monthly" price="€2.99" period="/ mo"/>
              <TierPill label="Yearly" price="€29" period="/ yr" selected discount="−20%"/>
            </div>
            <div style={{ fontSize: 11, color: C.inkSubtle, fontFamily: "'IBM Plex Mono'", marginTop: 10 }}>
              Billed by Paddle · cancel anytime · 14-day refund.
            </div>
          </div>
        </div>

        <div style={{ padding: '16px 36px 22px', borderTop: `1px solid ${C.border}`, background: '#FCFBF8', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <button style={{ background: 'none', border: 'none', color: C.inkMuted, fontSize: 13, cursor: 'pointer' }}>Stay on Free</button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ fontSize: 11, color: C.inkSubtle, fontFamily: "'IBM Plex Mono'" }}>No commitment · 1-click cancel</div>
            <Btn primary>Upgrade for €29/yr →</Btn>
          </div>
        </div>
      </div>

      <div style={{ position: 'absolute', left: 24, bottom: 24, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 3, padding: '10px 14px', fontSize: 11, fontFamily: "'IBM Plex Mono'", color: C.inkMuted, maxWidth: 420 }}>
        <span style={{ color: C.accent, letterSpacing: '0.14em', textTransform: 'uppercase', fontWeight: 600 }}>Modal</span> · triggered by Save Trip, Create Alert, Export PDF when on Free. Not shown for read-only features.
      </div>
    </Frame>
  );

  // ── 3. Banner at top of dashboard ─────────────────────────────────
  const AccountShellBehind = () => (
    <div style={{ position: 'absolute', inset: 0, padding: 0 }}>
      <MinimalTopBar subtitle="Your account"/>
      <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', height: 680 }}>
        {/* fake nav */}
        <nav style={{ borderRight: `1px solid ${C.border}`, padding: '20px 12px', background: '#FCFBF8' }}>
          <Eyebrow>Personal</Eyebrow>
          {['Overview','Saved trips','Favourites','Alerts','Settings','Billing'].map((l,i) => (
            <div key={l} style={{
              padding: '7px 10px', borderRadius: 3, marginTop: 8,
              background: i === 0 ? C.surface : 'transparent', border: `1px solid ${i === 0 ? C.border : 'transparent'}`,
              fontSize: 12.5, fontWeight: 500, color: i === 0 ? C.ink : C.inkMuted,
            }}>{l}</div>
          ))}
        </nav>
        {/* fake content */}
        <main style={{ padding: '20px 32px', opacity: 0.45 }}>
          <div style={{ height: 34, width: 200, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 3, marginBottom: 16 }}/>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
            {[1,2,3,4,5,6].map(i => <div key={i} style={{ height: 150, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 4 }}/>)}
          </div>
        </main>
      </div>
    </div>
  );

  const BannerUpgrade = () => (
    <Frame w={1280} h={760} chrome={null}>
      <AccountShellBehind/>
      {/* banner overlaid BELOW the top bar */}
      <div style={{
        position: 'absolute', top: 52, left: 0, right: 0, height: 48,
        background: 'linear-gradient(90deg, #0F1B2D 0%, #14283F 100%)',
        color: '#FFF', display: 'flex', alignItems: 'center', padding: '0 24px', gap: 18,
        fontFamily: "'IBM Plex Sans'", fontSize: 13, borderBottom: `1px solid ${C.accent}`,
      }}>
        <div style={{ width: 26, height: 26, borderRadius: 13, background: C.accent, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#FFF" strokeWidth="2.2"><path d="M6 11V8a6 6 0 1 1 12 0v3m-14 0h16v10H4V11z"/></svg>
        </div>
        <div style={{ flex: 1 }}>
          You're on <strong style={{ fontWeight: 600 }}>Atlas Free</strong>. Unlock saved trips, weather alerts, and district-level zoom
          <span style={{ color: '#F5D17A', marginLeft: 8 }}>— €2.99/mo or €29/yr</span>.
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <a href="#" style={{ color: '#E6E0D4', fontSize: 12, textDecoration: 'none', borderBottom: '1px dotted #888' }}>What's included?</a>
          <div style={{
            display: 'inline-flex', alignItems: 'center', height: 32, padding: '0 14px', borderRadius: 3,
            background: C.accent, color: '#0F1B2D', fontWeight: 600, fontSize: 12,
          }}>Try Premium →</div>
          <button style={{ background: 'none', border: 'none', color: '#BEC9D6', fontSize: 16, cursor: 'pointer', width: 24, height: 24 }}>×</button>
        </div>
      </div>

      <div style={{ position: 'absolute', left: 24, bottom: 24, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 3, padding: '10px 14px', fontSize: 11, fontFamily: "'IBM Plex Mono'", color: C.inkMuted, maxWidth: 480 }}>
        <span style={{ color: C.accent, letterSpacing: '0.14em', textTransform: 'uppercase', fontWeight: 600 }}>Banner</span> · top of /account dashboard for Free users only · dismissible (cookie), returns after 30 days or on next login.
      </div>
    </Frame>
  );

  // ═════════════ EMPTY STATES ═════════════
  const EmptyFrame = ({ title, eyebrow, children, w = 800, h = 520 }) => (
    <div style={{
      width: w, height: h, background: C.paper, fontFamily: "'IBM Plex Sans'", color: C.ink,
      padding: 28, display: 'flex', flexDirection: 'column', gap: 14,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <div>
          <Eyebrow>{eyebrow}</Eyebrow>
          <div style={{ fontFamily: "'IBM Plex Serif'", fontSize: 24, fontWeight: 500, letterSpacing: '-0.01em', marginTop: 4 }}>{title}</div>
        </div>
      </div>
      <div style={{
        flex: 1, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 6,
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 32,
      }}>
        {children}
      </div>
    </div>
  );

  // ── Saved trips illustration
  const IllTrips = () => (
    <svg width="160" height="120" viewBox="0 0 160 120">
      <rect x="12" y="24" width="100" height="70" rx="3" fill="#FCFBF8" stroke={C.border} strokeWidth="1.2" transform="rotate(-5 62 59)"/>
      <rect x="28" y="18" width="100" height="70" rx="3" fill={C.surface} stroke={C.border} strokeWidth="1.2"/>
      {/* map inside top card */}
      <g transform="translate(28 18)">
        <path d="M10 14 L42 8 L70 16 L80 40 L58 54 L24 48 L10 32 Z" fill="#E6E0D4" stroke={C.border} strokeWidth="1"/>
        <circle cx="46" cy="30" r="4" fill={C.accent}/>
        <circle cx="46" cy="30" r="8" fill="none" stroke={C.accent} strokeWidth="1" opacity="0.4"/>
      </g>
      <circle cx="108" cy="22" r="18" fill={C.surface} stroke={C.accent} strokeWidth="1.4"/>
      <text x="108" y="27" textAnchor="middle" fontFamily="IBM Plex Serif" fontSize="14" fontWeight="500" fill={C.ink}>+</text>
      <line x1="20" y1="104" x2="140" y2="104" stroke={C.border} strokeDasharray="2 3"/>
    </svg>
  );
  // ── Favourites
  const IllFav = () => (
    <svg width="160" height="120" viewBox="0 0 160 120">
      <path d="M80 96 C 40 70 28 52 28 40 C 28 28 38 20 50 20 C 60 20 72 28 80 38 C 88 28 100 20 110 20 C 122 20 132 28 132 40 C 132 52 120 70 80 96 Z"
        fill={C.surface} stroke={C.accent} strokeWidth="1.6"/>
      <path d="M80 96 C 40 70 28 52 28 40 C 28 28 38 20 50 20 C 60 20 72 28 80 38 C 88 28 100 20 110 20 C 122 20 132 28 132 40 C 132 52 120 70 80 96 Z"
        fill="none" stroke={C.border} strokeWidth="1" strokeDasharray="3 4"/>
      <circle cx="45" cy="36" r="2" fill={C.accent}/>
      <circle cx="115" cy="36" r="2" fill={C.accent}/>
    </svg>
  );
  // ── Alerts
  const IllAlerts = () => (
    <svg width="160" height="120" viewBox="0 0 160 120">
      <path d="M50 86 Q50 44 80 36 Q110 44 110 86" fill={C.surface} stroke={C.ink} strokeWidth="1.5"/>
      <line x1="40" y1="86" x2="120" y2="86" stroke={C.ink} strokeWidth="1.5" strokeLinecap="round"/>
      <circle cx="80" cy="30" r="4" fill={C.accent}/>
      <path d="M74 96 Q80 102 86 96" fill="none" stroke={C.ink} strokeWidth="1.5" strokeLinecap="round"/>
      {/* ripples */}
      <path d="M30 66 Q20 74 30 82" fill="none" stroke={C.accent} strokeWidth="1.2" opacity="0.5"/>
      <path d="M24 58 Q10 72 24 86" fill="none" stroke={C.accent} strokeWidth="1" opacity="0.3"/>
      <path d="M130 66 Q140 74 130 82" fill="none" stroke={C.accent} strokeWidth="1.2" opacity="0.5"/>
      <path d="M136 58 Q150 72 136 86" fill="none" stroke={C.accent} strokeWidth="1" opacity="0.3"/>
    </svg>
  );
  // ── No matches (empty magnifier over map)
  const IllNoMatch = () => (
    <svg width="180" height="120" viewBox="0 0 180 120">
      <rect x="10" y="18" width="140" height="84" rx="3" fill="#FCFBF8" stroke={C.border} strokeWidth="1.2"/>
      {/* sad blobby map */}
      <path d="M22 40 L55 30 L92 42 L120 38 L138 56 L130 84 L80 90 L28 82 Z" fill="#ECEAE3" stroke={C.border}/>
      {/* legend but all grey */}
      <g transform="translate(22 96)">
        {[0,1,2,3,4].map(i => <rect key={i} x={i*12} y={0} width="10" height="4" fill="#C9C5BB"/>)}
      </g>
      {/* magnifier */}
      <circle cx="110" cy="68" r="22" fill="#FFF" stroke={C.ink} strokeWidth="2"/>
      <line x1="126" y1="84" x2="144" y2="104" stroke={C.ink} strokeWidth="3" strokeLinecap="round"/>
      {/* eyes inside magnifier — "looking" */}
      <path d="M102 66 Q106 74 110 66" fill="none" stroke={C.inkMuted} strokeWidth="1.5" strokeLinecap="round"/>
      <path d="M114 66 Q118 74 122 66" fill="none" stroke={C.inkMuted} strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  );
  // ── Clients
  const IllClients = () => (
    <svg width="180" height="120" viewBox="0 0 180 120">
      {/* empty table */}
      <rect x="10" y="14" width="160" height="94" rx="3" fill={C.surface} stroke={C.border} strokeWidth="1.2"/>
      <rect x="10" y="14" width="160" height="18" fill="#FCFBF8" stroke={C.border} strokeWidth="1.2"/>
      {[18, 30, 42].map(x => <rect key={x} x={x} y={22} width="20" height="4" fill={C.inkSubtle}/>)}
      {[44, 60, 76, 92].map(y => (
        <g key={y}>
          <line x1="10" y1={y} x2="170" y2={y} stroke={C.border} strokeDasharray="2 3"/>
        </g>
      ))}
      {/* dotted person icon in middle */}
      <g transform="translate(68 48)">
        <circle cx="22" cy="14" r="8" fill="none" stroke={C.accent} strokeWidth="1.5" strokeDasharray="3 3"/>
        <path d="M6 42 Q22 26 38 42" fill="none" stroke={C.accent} strokeWidth="1.5" strokeDasharray="3 3"/>
      </g>
    </svg>
  );

  const EmptyCore = ({ illustration, headline, sub, primaryCta, secondaryCta, meta }) => (
    <div style={{ textAlign: 'center', maxWidth: 440 }}>
      <div style={{ marginBottom: 20 }}>{illustration}</div>
      <div style={{ fontFamily: "'IBM Plex Serif'", fontSize: 24, fontWeight: 500, letterSpacing: '-0.01em', color: C.ink, lineHeight: 1.2 }}>{headline}</div>
      <div style={{ fontSize: 13.5, color: C.inkMuted, lineHeight: 1.55, marginTop: 8 }}>{sub}</div>
      <div style={{ marginTop: 22, display: 'flex', justifyContent: 'center', gap: 10 }}>
        <Btn primary>{primaryCta}</Btn>
        {secondaryCta && <Btn>{secondaryCta}</Btn>}
      </div>
      {meta && <div style={{ marginTop: 14, fontSize: 11, color: C.inkSubtle, fontFamily: "'IBM Plex Mono'" }}>{meta}</div>}
    </div>
  );

  const EmptyTrips = () => (
    <EmptyFrame eyebrow="Saved trips · 0" title="Your trips">
      <EmptyCore
        illustration={<IllTrips/>}
        headline="No trips yet."
        sub="Plan one on the map and pin it here. It'll come back across devices."
        primaryCta="Plan your first trip →"
        secondaryCta="Browse countries"
        meta="Premium · unlimited · shared by link"
      />
    </EmptyFrame>
  );

  const EmptyFavs = () => (
    <EmptyFrame eyebrow="Favourites · 0" title="Places you've saved">
      <EmptyCore
        illustration={<IllFav/>}
        headline="Nothing starred yet."
        sub="Tap the heart on any country or region to keep a shortlist here."
        primaryCta="Open the map"
        secondaryCta="Popular this month"
      />
    </EmptyFrame>
  );

  const EmptyAlerts = () => (
    <EmptyFrame eyebrow="Alerts · 0" title="Weather alerts">
      <EmptyCore
        illustration={<IllAlerts/>}
        headline="We'll ping you when it's perfect."
        sub="Set a place + month range. We'll email you when next year's forecast matches your preferences."
        primaryCta="+ New alert"
        secondaryCta="How alerts work"
        meta="Premium · up to 10 active alerts"
      />
    </EmptyFrame>
  );

  const EmptyNoMatch = () => (
    <EmptyFrame eyebrow="0 matches · April · your preferences" title="Where to go in April">
      <div style={{ textAlign: 'center', maxWidth: 520 }}>
        <div style={{ marginBottom: 18 }}><IllNoMatch/></div>
        <div style={{ fontFamily: "'IBM Plex Serif'", fontSize: 24, fontWeight: 500, letterSpacing: '-0.01em', lineHeight: 1.2 }}>Nowhere on Earth fits — this month.</div>
        <div style={{ fontSize: 13.5, color: C.inkMuted, lineHeight: 1.55, marginTop: 8 }}>
          Your preferences are strict for April. Try one of these — we usually find matches in seconds.
        </div>

        {/* suggestion chips */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 18, textAlign: 'left' }}>
          {[
            { l: 'Widen temperature', sub: '12 – 22 °C → 10 – 26 °C', delta: '+41 countries' },
            { l: 'Allow more rain', sub: '< 40 mm → < 80 mm', delta: '+28 countries' },
            { l: 'Try May instead', sub: 'Shift the month forward', delta: '+63 countries' },
          ].map(s => (
            <button key={s.l} style={{
              display: 'flex', alignItems: 'center', gap: 12, background: '#FFF',
              border: `1px solid ${C.border}`, borderRadius: 3, padding: '12px 14px', cursor: 'pointer',
              fontFamily: "'IBM Plex Sans'", textAlign: 'left',
            }}>
              <div style={{ width: 28, height: 28, borderRadius: 3, background: '#FCFBF8', border: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.accent }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14M13 6l6 6-6 6" strokeLinecap="round"/></svg>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: C.ink }}>{s.l}</div>
                <div style={{ fontSize: 11, color: C.inkSubtle, fontFamily: "'IBM Plex Mono'", marginTop: 1 }}>{s.sub}</div>
              </div>
              <div style={{ fontSize: 11, color: C.perfect, fontFamily: "'IBM Plex Mono'", fontWeight: 600 }}>{s.delta}</div>
            </button>
          ))}
        </div>

        <div style={{ marginTop: 16, fontSize: 11.5, color: C.inkSubtle, fontFamily: "'IBM Plex Mono'" }}>
          Or <a href="#" style={{ color: C.accent, textDecoration: 'none' }}>reset preferences</a> · <a href="#" style={{ color: C.accent, textDecoration: 'none' }}>see how we score</a>
        </div>
      </div>
    </EmptyFrame>
  );

  const EmptyClients = () => (
    <EmptyFrame eyebrow="Agency · clients · 0" title="Your clients" w={960} h={560}>
      <div style={{ textAlign: 'center', maxWidth: 540 }}>
        <div style={{ marginBottom: 18 }}><IllClients/></div>
        <div style={{ fontFamily: "'IBM Plex Serif'", fontSize: 26, fontWeight: 500, letterSpacing: '-0.012em', lineHeight: 1.15 }}>Add your first client.</div>
        <div style={{ fontSize: 13.5, color: C.inkMuted, lineHeight: 1.55, marginTop: 8, maxWidth: 440, margin: '8px auto 0' }}>
          A client is a record — no login required. Your team plans trips on their behalf and shares a link when it's ready.
        </div>

        <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginTop: 22 }}>
          <Btn primary>+ New client</Btn>
          <Btn>Import from CSV</Btn>
        </div>

        <div style={{ marginTop: 20, padding: '12px 16px', background: '#FCFBF8', border: `1px dashed ${C.border}`, borderRadius: 4, fontSize: 11.5, color: C.inkMuted, fontFamily: "'IBM Plex Mono'", textAlign: 'left', maxWidth: 440, margin: '20px auto 0' }}>
            <strong style={{ color: C.ink, fontWeight: 600, fontFamily: "'IBM Plex Sans'" }}>CSV format:</strong> Full name, email, phone, country, notes. <a href="#" style={{ color: C.accent }}>Download template →</a>
        </div>
      </div>
    </EmptyFrame>
  );

  // ═════════════ CANVAS ═════════════
  const { DesignCanvas, DCSection, DCArtboard } = window;
  return (
    <DesignCanvas>
      <DCSection id="upgrade" title="Upgrade prompts" subtitle="Three variants · used contextually · all dismissible">
        <DCArtboard id="u-inline" label="1. Inline soft prompt · map zoom gate"   width={1280} height={700}><InlineUpgradePrompt/></DCArtboard>
        <DCArtboard id="u-modal"  label="2. Modal · blocked premium action"        width={1280} height={800}><ModalUpgrade/></DCArtboard>
        <DCArtboard id="u-banner" label="3. Banner · persistent on /account (Free)" width={1280} height={760}><BannerUpgrade/></DCArtboard>
      </DCSection>

      <DCSection id="empty" title="Empty states" subtitle="Warm, helpful, never patronising">
        <DCArtboard id="e-trips"   label="Saved trips · empty"      width={800} height={520}><EmptyTrips/></DCArtboard>
        <DCArtboard id="e-favs"    label="Favourites · empty"       width={800} height={520}><EmptyFavs/></DCArtboard>
        <DCArtboard id="e-alerts"  label="Alerts · empty"           width={800} height={520}><EmptyAlerts/></DCArtboard>
        <DCArtboard id="e-match"   label="No climate matches"       width={800} height={620}><EmptyNoMatch/></DCArtboard>
        <DCArtboard id="e-clients" label="Agency clients · empty"   width={960} height={560}><EmptyClients/></DCArtboard>
      </DCSection>
    </DesignCanvas>
  );
}
window.UpgradeEmpty = UpgradeEmpty;
