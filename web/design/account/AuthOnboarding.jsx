/* global React, window */
// Auth & Onboarding — Atlas brand — all screens in one canvas
// Uses window.CK_COLORS for palette consistency with rest of app.

function AuthOnboarding() {
  const C = window.CK_COLORS;
  const S = window.CK_COLORS.surface;

  // ───────── shared primitives ─────────
  const Frame = ({ children, w = 1280, h = 800, bg = C.paper, chrome }) => (
    <div style={{
      width: w, height: h, background: bg, position: 'relative',
      fontFamily: "'IBM Plex Sans'", color: C.ink, overflow: 'hidden',
      display: 'flex', flexDirection: 'column',
    }}>
      {chrome}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{children}</div>
    </div>
  );

  const Wordmark = ({ small }) => (
    <a href="/" style={{ display: 'inline-flex', alignItems: 'center', gap: 10, textDecoration: 'none', color: C.ink }}>
      <svg width={small ? 22 : 26} height={small ? 22 : 26} viewBox="0 0 32 32" fill="none">
        <circle cx="16" cy="16" r="14" stroke={C.ink} strokeWidth="1.5"/>
        <path d="M2 16 Q16 8 30 16 Q16 24 2 16" stroke={C.accent} strokeWidth="1.5" fill="none"/>
        <circle cx="16" cy="16" r="2.5" fill={C.accent}/>
      </svg>
      <div style={{ lineHeight: 1 }}>
        <div style={{ fontFamily: "'IBM Plex Serif'", fontSize: small ? 15 : 17, fontWeight: 500, letterSpacing: '-0.01em' }}>Atlas Weather</div>
        <div style={{ fontSize: 9.5, fontFamily: "'IBM Plex Mono'", color: C.inkSubtle, letterSpacing: '0.12em', marginTop: 2 }}>WHERETOGOFORGREATWEATHER</div>
      </div>
    </a>
  );

  const MinimalChrome = ({ right }) => (
    <div style={{
      height: 56, borderBottom: `1px solid ${C.border}`, background: S,
      display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 32px', flexShrink: 0,
    }}>
      <Wordmark/>
      <div style={{ fontSize: 12, color: C.inkMuted, display: 'flex', gap: 20, alignItems: 'center' }}>{right}</div>
    </div>
  );

  const Eyebrow = ({ children, color = C.inkSubtle }) => (
    <div style={{ fontSize: 10.5, fontFamily: "'IBM Plex Mono'", color, letterSpacing: '0.16em', textTransform: 'uppercase', fontWeight: 600 }}>{children}</div>
  );

  const Input = ({ placeholder, value, prefix, autoFocus }) => (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8, padding: '0 14px',
      height: 44, background: '#FFF', border: `1px solid ${C.border}`, borderRadius: 3,
      fontSize: 14, color: C.ink, boxShadow: autoFocus ? `0 0 0 3px rgba(11,61,102,0.10)` : 'none',
      borderColor: autoFocus ? C.accent : C.border,
    }}>
      {prefix && <span style={{ color: C.inkSubtle, fontFamily: "'IBM Plex Mono'", fontSize: 12 }}>{prefix}</span>}
      <span style={{ flex: 1, color: value ? C.ink : C.inkSubtle }}>{value || placeholder}</span>
      {autoFocus && <span style={{ width: 1.5, height: 16, background: C.accent, animation: 'none' }}/>}
    </div>
  );

  const Btn = ({ children, primary, ghost, full, icon, muted }) => (
    <div style={{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
      height: 44, padding: '0 18px', borderRadius: 3,
      background: primary ? C.ink : ghost ? 'transparent' : '#FFF',
      color: primary ? '#FFF' : muted ? C.inkMuted : C.ink,
      border: primary ? 'none' : `1px solid ${C.border}`,
      fontSize: 13.5, fontWeight: 500,
      width: full ? '100%' : 'auto', cursor: 'default',
    }}>{icon}{children}</div>
  );

  const Divider = ({ label }) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '18px 0' }}>
      <div style={{ flex: 1, height: 1, background: C.border }}/>
      <div style={{ fontSize: 10.5, fontFamily: "'IBM Plex Mono'", color: C.inkSubtle, letterSpacing: '0.16em' }}>{label}</div>
      <div style={{ flex: 1, height: 1, background: C.border }}/>
    </div>
  );

  const Card = ({ children, w = 440, title, subtitle, header }) => (
    <div style={{
      width: w, background: S, border: `1px solid ${C.border}`, borderRadius: 6,
      padding: 36, boxShadow: '0 1px 2px rgba(15,27,45,0.04), 0 8px 24px rgba(15,27,45,0.05)',
    }}>
      {header}
      {title && <div style={{ fontFamily: "'IBM Plex Serif'", fontSize: 26, fontWeight: 500, letterSpacing: '-0.012em', marginBottom: 6 }}>{title}</div>}
      {subtitle && <div style={{ fontSize: 13.5, color: C.inkMuted, lineHeight: 1.55, marginBottom: 22 }}>{subtitle}</div>}
      {children}
    </div>
  );

  const Footer = () => (
    <div style={{ padding: '20px 32px', borderTop: `1px solid ${C.border}`, background: S, display: 'flex', justifyContent: 'space-between', fontSize: 11, color: C.inkSubtle, fontFamily: "'IBM Plex Mono'", flexShrink: 0 }}>
      <div>© 2026 Atlas Weather · v2.0</div>
      <div style={{ display: 'flex', gap: 18 }}>
        <a href="#" style={{ color: C.inkMuted, textDecoration: 'none' }}>Privacy</a>
        <a href="#" style={{ color: C.inkMuted, textDecoration: 'none' }}>Terms</a>
        <a href="#" style={{ color: C.inkMuted, textDecoration: 'none' }}>Status</a>
      </div>
    </div>
  );

  const Step = ({ cur, total }) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 20 }}>
      {Array.from({ length: total }).map((_, i) => (
        <div key={i} style={{
          height: 3, flex: 1, borderRadius: 2,
          background: i < cur ? C.ink : i === cur ? C.accent : C.border,
        }}/>
      ))}
    </div>
  );

  const GoogleIcon = (
    <svg width="16" height="16" viewBox="0 0 24 24">
      <path d="M22.5 12.3c0-.8-.1-1.5-.2-2.2H12v4.2h5.9a5 5 0 0 1-2.2 3.3v2.7h3.5c2-1.9 3.3-4.7 3.3-8z" fill="#4285F4"/>
      <path d="M12 23c3 0 5.5-1 7.3-2.7l-3.5-2.7a7 7 0 0 1-10.5-3.6H1.6v2.8A11 11 0 0 0 12 23z" fill="#34A853"/>
      <path d="M5.3 14a7 7 0 0 1 0-4.3V6.8H1.6a11 11 0 0 0 0 9.9l3.7-2.8z" fill="#FBBC04"/>
      <path d="M12 5.6a6 6 0 0 1 4.2 1.6l3.1-3A11 11 0 0 0 1.6 6.8L5.3 9.6A7 7 0 0 1 12 5.6z" fill="#EA4335"/>
    </svg>
  );

  // ══════════════════════════ 1. /login ═════════════════════════════
  const Login = () => (
    <Frame chrome={<MinimalChrome right={<span>Don't have an account? <a href="#" style={{ color: C.accent, textDecoration: 'none', fontWeight: 500, marginLeft: 4 }}>Create free</a></span>}/>}>
      <Card
        title="Welcome back"
        subtitle="We'll send a one-time sign-in link to your email. No passwords — ever."
      >
        <div style={{ marginBottom: 6 }}><Eyebrow>Email address</Eyebrow></div>
        <Input placeholder="you@example.com" value="maya.westfield@gmail.com" autoFocus/>
        <div style={{ height: 14 }}/>
        <Btn primary full>Send magic link →</Btn>

        <Divider label="OR"/>

        <Btn full icon={GoogleIcon}>Continue with Google</Btn>

        <div style={{ marginTop: 26, paddingTop: 18, borderTop: `1px solid ${C.border}`, fontSize: 11.5, color: C.inkSubtle, lineHeight: 1.55 }}>
          By continuing, you agree to our <a href="#" style={{ color: C.inkMuted }}>terms</a> and <a href="#" style={{ color: C.inkMuted }}>privacy policy</a>. Having trouble? <a href="#" style={{ color: C.accent }}>Email support.</a>
        </div>
      </Card>
      <Footer/>
    </Frame>
  );

  // ══════════════════════════ 2. /login/sent ════════════════════════
  const LoginSent = () => (
    <Frame chrome={<MinimalChrome right={<span>Need help? <a href="#" style={{ color: C.accent, textDecoration: 'none', fontWeight: 500 }}>Contact support</a></span>}/>}>
      <Card
        header={
          <div style={{ width: 48, height: 48, borderRadius: 4, background: '#FBF3DC', border: `1px solid ${C.accent}`, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={C.accent} strokeWidth="1.6"><path d="M3 6h18v12H3z"/><path d="M3 6l9 7 9-7"/></svg>
          </div>
        }
        title="Check your inbox"
        subtitle={<>We sent a sign-in link to <strong style={{ color: C.ink, fontFamily: "'IBM Plex Mono'", fontSize: 12.5 }}>maya.westfield@gmail.com</strong>. Click it from the same browser to finish signing in. The link expires in 15 minutes.</>}
      >
        <div style={{ background: '#FCFBF8', border: `1px solid ${C.border}`, borderRadius: 4, padding: '14px 16px', marginBottom: 18 }}>
          <Eyebrow>Waiting for you to click</Eyebrow>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 10 }}>
            <div style={{ width: 22, height: 22, borderRadius: 11, border: `2px solid ${C.border}`, borderTopColor: C.accent, transform: 'rotate(30deg)' }}/>
            <div style={{ fontSize: 13, color: C.ink }}>Listening for sign-in…</div>
          </div>
          <div style={{ fontSize: 11, color: C.inkSubtle, fontFamily: "'IBM Plex Mono'", marginTop: 10 }}>This page will continue automatically once you click the link.</div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <a href="/login" style={{ fontSize: 12.5, color: C.inkMuted, textDecoration: 'none' }}>← Wrong email? Go back</a>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
            <div style={{ fontSize: 11.5, color: C.inkSubtle, fontFamily: "'IBM Plex Mono'" }}>Resend in 47s</div>
            <div style={{ opacity: 0.4 }}><Btn muted>Resend link</Btn></div>
          </div>
        </div>
      </Card>
      <Footer/>
    </Frame>
  );

  // ═══════════════════════ 3. Magic-link landing ════════════════════
  const MagicLanding = () => (
    <Frame chrome={<MinimalChrome right={<span style={{ fontFamily: "'IBM Plex Mono'", fontSize: 11, color: C.inkSubtle }}>wheretogoforgreatweather.com/auth/verify?t=8f4…</span>}/>}>
      <div style={{ width: 440, textAlign: 'center' }}>
        <div style={{ width: 56, height: 56, borderRadius: '50%', margin: '0 auto 24px', background: S, border: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
          <svg width="56" height="56" viewBox="0 0 56 56" style={{ position: 'absolute', inset: 0 }}>
            <circle cx="28" cy="28" r="25" fill="none" stroke={C.border} strokeWidth="2"/>
            <circle cx="28" cy="28" r="25" fill="none" stroke={C.accent} strokeWidth="2"
              strokeDasharray="157" strokeDashoffset="78" transform="rotate(-90 28 28)" strokeLinecap="round"/>
          </svg>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={C.ink} strokeWidth="2"><path d="M5 12l4 4L19 7" strokeLinecap="round"/></svg>
        </div>
        <div style={{ fontFamily: "'IBM Plex Serif'", fontSize: 26, fontWeight: 500, letterSpacing: '-0.012em' }}>Signing you in…</div>
        <div style={{ fontSize: 13.5, color: C.inkMuted, lineHeight: 1.55, marginTop: 8 }}>
          Verifying your magic link and opening your account.
        </div>

        <div style={{ marginTop: 28, background: S, border: `1px solid ${C.border}`, borderRadius: 4, padding: '14px 16px', textAlign: 'left', fontFamily: "'IBM Plex Mono'", fontSize: 11.5, color: C.inkMuted, lineHeight: 1.8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>✓ Link verified</span><span style={{ color: C.perfect }}>ok</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>✓ Session created</span><span style={{ color: C.perfect }}>ok</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>… Loading your preferences</span><span>·</span>
          </div>
        </div>

        <div style={{ fontSize: 11, color: C.inkSubtle, fontFamily: "'IBM Plex Mono'", marginTop: 20 }}>
          Redirecting to <span style={{ color: C.accent }}>/onboarding</span> (first sign-in)…
        </div>
      </div>
      <Footer/>
    </Frame>
  );

  // ═══════════════════ Onboarding wizard shell ═══════════════════════
  const WizardShell = ({ kind, step, total, title, subtitle, premium, children, footer }) => (
    <Frame chrome={<MinimalChrome right={
      <>
        <span style={{ fontFamily: "'IBM Plex Mono'", fontSize: 11 }}>{kind}</span>
        <a href="#" style={{ color: C.inkMuted, textDecoration: 'none' }}>Sign out</a>
      </>
    }/>}>
      <div style={{ width: 560 }}>
        {premium && (
          <div style={{
            background: 'linear-gradient(180deg, #FBF3DC 0%, #F7EBC8 100%)', border: `1px solid ${C.accent}`, borderRadius: 6,
            padding: '18px 22px', marginBottom: 24, display: 'flex', alignItems: 'center', gap: 16, position: 'relative', overflow: 'hidden',
          }}>
            <div style={{ width: 40, height: 40, borderRadius: 20, background: C.accent, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#FFF" strokeWidth="2"><path d="M5 12l4 4L19 7" strokeLinecap="round"/></svg>
            </div>
            <div style={{ flex: 1 }}>
              <Eyebrow color={C.accent}>Welcome to {premium}</Eyebrow>
              <div style={{ fontFamily: "'IBM Plex Serif'", fontSize: 18, fontWeight: 500, marginTop: 3, letterSpacing: '-0.005em' }}>Your subscription is active.</div>
              <div style={{ fontSize: 12, color: C.inkMuted, marginTop: 2 }}>Receipt sent to your email. You can manage billing any time from Settings → Billing.</div>
            </div>
            <svg width="60" height="60" viewBox="0 0 60 60" style={{ opacity: 0.18, flexShrink: 0 }}>
              <circle cx="30" cy="30" r="28" fill="none" stroke={C.accent} strokeWidth="1"/>
              <path d="M2 30 Q30 14 58 30 Q30 46 2 30" fill="none" stroke={C.accent} strokeWidth="1"/>
            </svg>
          </div>
        )}

        <Step cur={step} total={total}/>
        <Eyebrow>Step {step + 1} of {total}</Eyebrow>
        <h1 style={{ fontFamily: "'IBM Plex Serif'", fontSize: 32, fontWeight: 500, letterSpacing: '-0.015em', margin: '6px 0 8px' }}>{title}</h1>
        {subtitle && <div style={{ fontSize: 14, color: C.inkMuted, lineHeight: 1.55, marginBottom: 26 }}>{subtitle}</div>}
        {children}
        {footer && <div style={{ marginTop: 26, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>{footer}</div>}
      </div>
    </Frame>
  );

  // ═══════════════════ 4. Consumer onboarding (3 steps) ══════════════
  const OptionTile = ({ label, sub, selected }) => (
    <div style={{
      flex: 1, padding: '14px 14px', borderRadius: 4,
      border: `1.5px solid ${selected ? C.ink : C.border}`, background: selected ? S : 'transparent',
      boxShadow: selected ? `inset 0 0 0 1px ${C.ink}` : 'none',
    }}>
      <div style={{ fontFamily: "'IBM Plex Serif'", fontSize: 20, fontWeight: 500, letterSpacing: '-0.005em' }}>{label}</div>
      <div style={{ fontSize: 11, color: C.inkSubtle, fontFamily: "'IBM Plex Mono'", marginTop: 2 }}>{sub}</div>
    </div>
  );

  const ConsumerStep1 = () => (
    <WizardShell
      kind="Onboarding · Consumer (Premium)"
      step={0} total={3}
      premium="Premium"
      title="Pick your units"
      subtitle="We'll use these everywhere — charts, legends, trip cards. You can change them any time in Settings."
      footer={<><a href="#" style={{ fontSize: 12, color: C.inkSubtle, textDecoration: 'none' }}>Skip — use metric</a><Btn primary>Continue →</Btn></>}
    >
      <div>
        <div style={{ marginBottom: 10 }}><Eyebrow>Temperature</Eyebrow></div>
        <div style={{ display: 'flex', gap: 10, marginBottom: 18 }}>
          <OptionTile label="°C" sub="Celsius" selected/>
          <OptionTile label="°F" sub="Fahrenheit"/>
        </div>

        <div style={{ marginBottom: 10 }}><Eyebrow>Distance</Eyebrow></div>
        <div style={{ display: 'flex', gap: 10, marginBottom: 18 }}>
          <OptionTile label="km" sub="Kilometres" selected/>
          <OptionTile label="mi" sub="Miles"/>
        </div>

        <div style={{ marginBottom: 10 }}><Eyebrow>Rainfall</Eyebrow></div>
        <div style={{ display: 'flex', gap: 10 }}>
          <OptionTile label="mm" sub="Millimetres" selected/>
          <OptionTile label="in" sub="Inches"/>
        </div>
      </div>
    </WizardShell>
  );

  const PrefRow = ({ icon, label, sub, value, pro }) => (
    <div style={{ display: 'grid', gridTemplateColumns: '28px 1fr 200px', gap: 14, alignItems: 'center', padding: '14px 16px', borderBottom: `1px solid ${C.border}`, opacity: pro ? 0.6 : 1 }}>
      <div style={{ width: 26, height: 26, borderRadius: 3, background: '#FCFBF8', border: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.inkMuted }}>{icon}</div>
      <div>
        <div style={{ fontSize: 13, fontWeight: 500, display: 'inline-flex', gap: 8, alignItems: 'center' }}>
          {label}
          {pro && <span style={{ fontSize: 9.5, fontFamily: "'IBM Plex Mono'", color: C.accent, border: `1px solid ${C.accent}`, padding: '1px 5px', borderRadius: 2, letterSpacing: '0.1em' }}>PREMIUM</span>}
        </div>
        <div style={{ fontSize: 11, color: C.inkSubtle, marginTop: 2 }}>{sub}</div>
      </div>
      <div style={{ fontSize: 12, fontFamily: "'IBM Plex Mono'", color: C.ink }}>{value}</div>
    </div>
  );

  const iconT = <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M14 14V5a2 2 0 1 0-4 0v9a4 4 0 1 0 4 0z"/><circle cx="12" cy="17" r="1.5" fill="currentColor" stroke="none"/></svg>;
  const iconR = <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M7 16a5 5 0 1 1 9-4 4 4 0 0 1-1 8H8a3 3 0 0 1-1-4z"/><path d="M9 20l-1 2M13 20l-1 2M17 20l-1 2"/></svg>;
  const iconS = <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="12" cy="12" r="4"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4L7 17M17 7l1.4-1.4"/></svg>;
  const iconW = <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M3 8h12a3 3 0 1 0-3-3M3 14h16a3 3 0 1 1-3 3M3 11h8"/></svg>;
  const iconShield = <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6l8-3z"/></svg>;

  const ConsumerStep2 = () => (
    <WizardShell
      kind="Onboarding · Consumer"
      step={1} total={3}
      title="Set your ideal weather"
      subtitle="Optional — we'll use these as defaults when you score destinations. Skip and set them later from Settings."
      footer={<><a href="#" style={{ fontSize: 12, color: C.inkMuted, textDecoration: 'none' }}>I'll set these later →</a><div style={{ display: 'flex', gap: 8 }}><Btn>Back</Btn><Btn primary>Looks good →</Btn></div></>}
    >
      <div style={{ background: S, border: `1px solid ${C.border}`, borderRadius: 4 }}>
        <PrefRow icon={iconT} label="Temperature"   sub="Daytime highs, in the range you enjoy" value="16 – 24 °C"/>
        <PrefRow icon={iconR} label="Rainfall"      sub="Monthly total you'll tolerate"          value="< 80 mm / month"/>
        <PrefRow icon={iconS} label="Sunshine"      sub="Hours of daylight you want per day"    value="≥ 6 hours / day"/>
        <PrefRow icon={iconW} label="Wind"          sub="Average wind speed ceiling"            value="< 30 km/h"/>
        <PrefRow icon={iconShield} label="Safety ceiling" sub="Travel-advisory threshold"       value="Level 2 or safer"/>
        <div style={{ padding: '10px 16px', background: '#FCFBF8', fontSize: 11, color: C.inkSubtle, fontFamily: "'IBM Plex Mono'", borderTop: `1px solid ${C.border}` }}>
          + Humidity & heat-index are <span style={{ color: C.accent }}>Premium</span> — unlock later from Settings.
        </div>
      </div>
    </WizardShell>
  );

  const ConsumerStep3 = () => (
    <WizardShell
      kind="Onboarding · Consumer"
      step={2} total={3}
      title="You're all set."
      subtitle="Let's find somewhere with your kind of weather."
    >
      <div style={{
        background: S, border: `1px solid ${C.border}`, borderRadius: 6, padding: '32px 28px',
        display: 'grid', gridTemplateColumns: '1fr auto', gap: 24, alignItems: 'center',
      }}>
        <div>
          <Eyebrow>Recommended next step</Eyebrow>
          <div style={{ fontFamily: "'IBM Plex Serif'", fontSize: 22, fontWeight: 500, letterSpacing: '-0.01em', marginTop: 8 }}>
            Plan your first trip
          </div>
          <div style={{ fontSize: 13, color: C.inkMuted, lineHeight: 1.55, marginTop: 6 }}>
            Open the world map, set a month, and we'll rank every country on how well its weather matches yours.
          </div>
          <div style={{ marginTop: 18, display: 'flex', gap: 10 }}>
            <Btn primary>Open the map →</Btn>
            <Btn>Browse countries</Btn>
          </div>
        </div>
        <div style={{ width: 120, height: 120 }}>
          <svg viewBox="0 0 120 120" width="100%" height="100%">
            <circle cx="60" cy="60" r="50" fill="none" stroke={C.border} strokeWidth="1"/>
            <circle cx="60" cy="60" r="50" fill="none" stroke={C.accent} strokeWidth="2"
              strokeDasharray="314" strokeDashoffset="100" transform="rotate(-90 60 60)" strokeLinecap="round"/>
            <text x="60" y="58" fontFamily="'IBM Plex Serif'" fontSize="26" fontWeight="500" textAnchor="middle" fill={C.ink}>68%</text>
            <text x="60" y="74" fontFamily="'IBM Plex Mono'" fontSize="9" textAnchor="middle" fill={C.inkSubtle} letterSpacing="0.14em">SETUP</text>
          </svg>
        </div>
      </div>

      <div style={{ marginTop: 18, fontSize: 12, color: C.inkSubtle, textAlign: 'center', fontFamily: "'IBM Plex Mono'" }}>
        Tip · you can edit units and preferences from <a href="#" style={{ color: C.accent, textDecoration: 'none' }}>Settings</a> any time.
      </div>
    </WizardShell>
  );

  // ═══════════════════ 5. Agency onboarding (4 steps) ════════════════
  const AgencyStep1 = () => (
    <WizardShell
      kind="Onboarding · Agency Pro"
      step={0} total={4}
      premium="Agency Pro"
      title="Name your organisation"
      subtitle="This is what your clients and teammates will see on shared trips, invoices, and the sign-in page."
      footer={<><a href="#" style={{ fontSize: 12, color: C.inkSubtle, textDecoration: 'none' }}>&nbsp;</a><Btn primary>Continue →</Btn></>}
    >
      <div style={{ marginBottom: 6 }}><Eyebrow>Organisation name</Eyebrow></div>
      <Input value="Cordillera Voyages" autoFocus/>
      <div style={{ height: 18 }}/>

      <div style={{ marginBottom: 6 }}><Eyebrow>Public URL slug</Eyebrow></div>
      <Input prefix="wtg.com/org/" value="cordillera-voyages"/>
      <div style={{ fontSize: 11, color: C.inkSubtle, fontFamily: "'IBM Plex Mono'", marginTop: 6 }}>Used for shared trip links. Change any time in Settings.</div>

      <div style={{ height: 22 }}/>

      <div style={{ marginBottom: 6 }}><Eyebrow>Primary region you operate in</Eyebrow></div>
      <Input value="South America · Andean region"/>
    </WizardShell>
  );

  const HouseStyle = ({ label, sub, selected, icon }) => (
    <label style={{
      display: 'flex', alignItems: 'flex-start', gap: 12, padding: 14, borderRadius: 4,
      border: `1.5px solid ${selected ? C.ink : C.border}`, background: selected ? S : 'transparent',
      cursor: 'pointer',
    }}>
      <div style={{ width: 36, height: 36, borderRadius: 3, background: '#FCFBF8', border: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: C.inkMuted }}>{icon}</div>
      <div>
        <div style={{ fontSize: 13, fontWeight: 600 }}>{label}</div>
        <div style={{ fontSize: 11.5, color: C.inkSubtle, marginTop: 3, lineHeight: 1.45 }}>{sub}</div>
      </div>
    </label>
  );

  const AgencyStep2 = () => (
    <WizardShell
      kind="Onboarding · Agency Pro"
      step={1} total={4}
      title="Your house style"
      subtitle="Agencies usually serve one or two dominant traveller profiles. Pre-selecting a house style sets sensible defaults when you create new client trips — you can always override per client."
      footer={<><a href="#" style={{ fontSize: 12, color: C.inkMuted, textDecoration: 'none' }}>Skip — set per client →</a><div style={{ display: 'flex', gap: 8 }}><Btn>Back</Btn><Btn primary>Continue →</Btn></div></>}
    >
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <HouseStyle
          icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M3 20l3-12 4 8 4-6 7 10"/><circle cx="17" cy="6" r="2.5"/></svg>}
          label="Adventure · trekking" sub="Cool to mild temps, low rain, tolerant of wind. Andes, Nepal, Patagonia." selected/>
        <HouseStyle
          icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M2 18c3-2 6-2 10 0s7 2 10 0"/><circle cx="18" cy="7" r="3"/><path d="M6 18V9M10 18V13"/></svg>}
          label="Luxury beach" sub="Warm, dry, sunny. Maldives, Turks & Caicos, Seychelles."/>
        <HouseStyle
          icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="4" y="7" width="16" height="13" rx="1"/><path d="M9 7V4h6v3M4 12h16"/></svg>}
          label="Cultural city-break" sub="Mild, low rain. Rome, Kyoto, Istanbul, Lisbon."/>
        <HouseStyle
          icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M3 18l6-10 4 6 3-4 5 8"/><circle cx="19" cy="6" r="2"/></svg>}
          label="Safari & wildlife" sub="Dry season only, moderate heat. Tanzania, Botswana, Kenya."/>
        <HouseStyle
          icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M4 18l4-8 4 6 4-10 4 12"/></svg>}
          label="Ski & alpine" sub="Cold, snowy, clear. Alps, Rockies, Hokkaido."/>
        <HouseStyle
          icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="12" cy="12" r="9"/><path d="M12 3a15 15 0 0 1 0 18M3 12h18"/></svg>}
          label="Bespoke · no preset" sub="I'll set weather defaults manually per client."/>
      </div>
    </WizardShell>
  );

  const InviteRow = ({ email, role }) => (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 140px 28px', gap: 10, alignItems: 'center', marginBottom: 8 }}>
      <Input value={email}/>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        height: 44, padding: '0 14px', background: '#FFF', border: `1px solid ${C.border}`, borderRadius: 3, fontSize: 13,
      }}>
        {role}
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke={C.inkMuted} strokeWidth="2"><path d="M6 9l6 6 6-6"/></svg>
      </div>
      <button style={{ height: 44, width: 28, border: 'none', background: 'transparent', color: C.inkSubtle, cursor: 'pointer' }}>×</button>
    </div>
  );

  const AgencyStep3 = () => (
    <WizardShell
      kind="Onboarding · Agency Pro"
      step={2} total={4}
      title="Invite your team"
      subtitle="Add agents who'll use Atlas Weather with you. They'll receive a magic-link invite and count toward your seats (3 of 10 used after this step)."
      footer={<><a href="#" style={{ fontSize: 12, color: C.inkMuted, textDecoration: 'none' }}>Skip — invite later from dashboard →</a><div style={{ display: 'flex', gap: 8 }}><Btn>Back</Btn><Btn primary>Send 2 invites →</Btn></div></>}
    >
      <div style={{ marginBottom: 8, display: 'flex', justifyContent: 'space-between' }}>
        <Eyebrow>Agents to invite</Eyebrow>
        <div style={{ fontSize: 11, color: C.inkSubtle, fontFamily: "'IBM Plex Mono'" }}>2 of 9 remaining seats</div>
      </div>
      <InviteRow email="matias@cordillera.tours" role="Agent"/>
      <InviteRow email="renata@cordillera.tours" role="Agent"/>
      <InviteRow email="" role="Agent"/>

      <button style={{ background: 'transparent', border: `1px dashed ${C.border}`, borderRadius: 3, padding: '10px', width: '100%', color: C.inkMuted, fontSize: 12, marginTop: 4, cursor: 'pointer' }}>+ Add another agent</button>

      <div style={{ marginTop: 24, padding: '14px 16px', background: '#FBF3DC', border: `1px solid ${C.accent}`, borderRadius: 4, fontSize: 12, color: C.ink, lineHeight: 1.55 }}>
        <strong style={{ fontWeight: 600 }}>Agents see everything your organisation owns.</strong> You can restrict per-client access once you're in the dashboard. <a href="#" style={{ color: C.accent }}>Learn about roles →</a>
      </div>
    </WizardShell>
  );

  const AgencyStep4 = () => (
    <WizardShell
      kind="Onboarding · Agency Pro"
      step={3} total={4}
      title="Ready to go, Elena."
      subtitle="Your dashboard is empty for a reason — everything in Atlas Weather starts from a client record. Let's add your first one."
    >
      <div style={{
        background: S, border: `1.5px dashed ${C.borderStrong}`, borderRadius: 6,
        padding: '28px 28px', textAlign: 'center',
      }}>
        <div style={{ width: 48, height: 48, borderRadius: 4, background: '#FBF3DC', border: `1px solid ${C.accent}`, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: 14 }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={C.accent} strokeWidth="1.6"><circle cx="12" cy="8" r="3.5"/><path d="M4 21c0-5 4-7 8-7s8 2 8 7"/></svg>
        </div>
        <div style={{ fontFamily: "'IBM Plex Serif'", fontSize: 22, fontWeight: 500, letterSpacing: '-0.01em' }}>Add your first client</div>
        <div style={{ fontSize: 12.5, color: C.inkMuted, lineHeight: 1.55, marginTop: 8, maxWidth: 380, margin: '8px auto 18px' }}>
          A client is a record your team plans on behalf of — they don't need to sign in. Create one, set their ideal weather, then build trips for them.
        </div>
        <Btn primary>+ New client</Btn>
      </div>

      <div style={{ marginTop: 20, display: 'flex', justifyContent: 'space-between', fontSize: 11.5, color: C.inkMuted }}>
        <a href="#" style={{ color: C.inkMuted, textDecoration: 'none' }}>Import clients from CSV (coming soon)</a>
        <a href="#" style={{ color: C.accent, textDecoration: 'none' }}>Skip — go to dashboard →</a>
      </div>
    </WizardShell>
  );

  // ═══════════════════ 6. Email templates ════════════════════════════
  // Rendered inside a "mail-client" chrome for context.
  const MailClient = ({ subject, from, preheader, children }) => (
    <div style={{
      width: 780, height: 760, background: '#F2F2F2', borderRadius: 8, overflow: 'hidden',
      border: `1px solid ${C.border}`, fontFamily: "system-ui",
      display: 'flex', flexDirection: 'column',
    }}>
      <div style={{ height: 40, background: '#ECECEC', borderBottom: '1px solid #DADADA', display: 'flex', alignItems: 'center', padding: '0 14px', gap: 8 }}>
        <div style={{ display: 'flex', gap: 6 }}>
          {['#FF5F57','#FEBC2E','#28C840'].map(c => <div key={c} style={{ width: 11, height: 11, borderRadius: 6, background: c }}/>)}
        </div>
        <div style={{ marginLeft: 16, fontSize: 12, color: '#5E5E5E' }}>Mail · Inbox</div>
      </div>
      <div style={{ padding: '18px 24px 12px', background: '#FFF', borderBottom: '1px solid #E5E5E5' }}>
        <div style={{ fontSize: 18, fontWeight: 600, color: '#111', letterSpacing: '-0.01em' }}>{subject}</div>
        <div style={{ fontSize: 12, color: '#6E6E6E', marginTop: 6, display: 'flex', gap: 12 }}>
          <span><strong style={{ color: '#111' }}>{from}</strong> &lt;no-reply@atlasweather.app&gt;</span>
          <span>to me</span>
          <span>· today, 2:41 PM</span>
        </div>
        <div style={{ fontSize: 12, color: '#888', marginTop: 4, fontStyle: 'italic' }}>{preheader}</div>
      </div>
      <div style={{ flex: 1, overflow: 'auto', background: '#F2F2F2', padding: '20px 0' }}>
        {children}
      </div>
    </div>
  );

  // Table-based HTML email body, rendered inline. Plex → Georgia/Arial fallback inside.
  const emailStyles = {
    body: { fontFamily: "Georgia, 'Times New Roman', serif", color: '#0F1B2D' },
    sans: { fontFamily: "Helvetica, Arial, sans-serif" },
  };

  const MagicLinkEmail = () => (
    <MailClient subject="Your Atlas Weather sign-in link" from="Atlas Weather" preheader="Click to sign in — expires in 15 minutes. Not you? Ignore this email.">
      <table width="600" cellPadding="0" cellSpacing="0" style={{ margin: '0 auto', background: '#FFF', border: '1px solid #E6E0D4', borderRadius: 6, overflow: 'hidden' }}>
        <tbody>
          <tr><td style={{ padding: '22px 32px', borderBottom: '1px solid #E6E0D4', background: '#FCFBF8', ...emailStyles.sans }}>
            <table width="100%"><tbody><tr>
              <td style={{ verticalAlign: 'middle' }}>
                <span style={{ fontFamily: "Georgia, serif", fontSize: 17, fontWeight: 500, color: '#0F1B2D' }}>Atlas Weather</span>
                <span style={{ fontSize: 10, fontFamily: "'Courier New', monospace", color: '#6B7280', letterSpacing: '0.12em', marginLeft: 8 }}>WHERETOGOFORGREATWEATHER</span>
              </td>
              <td align="right" style={{ fontSize: 10, fontFamily: "'Courier New', monospace", color: '#6B7280', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Sign-in link</td>
            </tr></tbody></table>
          </td></tr>

          <tr><td style={{ padding: '36px 36px 12px', ...emailStyles.body }}>
            <h1 style={{ margin: 0, fontSize: 28, fontWeight: 500, letterSpacing: '-0.015em', color: '#0F1B2D' }}>Sign in to Atlas Weather</h1>
            <p style={{ marginTop: 12, fontSize: 15, lineHeight: 1.55, color: '#4A5568' }}>
              Click the button below to finish signing in. This link is good for <strong style={{ color: '#0F1B2D' }}>one sign-in</strong> and expires in <strong style={{ color: '#0F1B2D' }}>15 minutes</strong>.
            </p>
          </td></tr>

          <tr><td align="center" style={{ padding: '18px 36px 30px' }}>
            <table cellPadding="0" cellSpacing="0"><tbody><tr>
              <td style={{ background: '#0F1B2D', borderRadius: 3, padding: '14px 28px' }}>
                <a href="#" style={{ color: '#FFF', textDecoration: 'none', fontSize: 15, fontWeight: 500, ...emailStyles.sans }}>Sign in to Atlas Weather →</a>
              </td>
            </tr></tbody></table>
            <p style={{ marginTop: 14, fontSize: 11, color: '#6B7280', fontFamily: "'Courier New', monospace" }}>
              Or paste this URL into your browser:<br/>
              <span style={{ wordBreak: 'break-all', color: '#0B3D66' }}>https://wheretogoforgreatweather.com/auth/verify?t=8f4c2e7a9b1d3e5f7a8c9d0e1f2b3c4</span>
            </p>
          </td></tr>

          <tr><td style={{ padding: '0 36px' }}>
            <table width="100%" style={{ background: '#FCFBF8', border: '1px solid #E6E0D4', borderRadius: 4 }}><tbody>
              <tr><td style={{ padding: '14px 18px 8px', fontSize: 10, fontFamily: "'Courier New', monospace", color: '#6B7280', letterSpacing: '0.14em', textTransform: 'uppercase', fontWeight: 600 }}>
                Request details · verify this was you
              </td></tr>
              <tr><td style={{ padding: '4px 18px 14px', ...emailStyles.sans, fontSize: 13, color: '#0F1B2D', lineHeight: 1.7 }}>
                <table width="100%" cellPadding="0" cellSpacing="0"><tbody>
                  <tr>
                    <td width="110" style={{ color: '#6B7280', fontSize: 11, fontFamily: "'Courier New', monospace", letterSpacing: '0.08em', textTransform: 'uppercase' }}>Location</td>
                    <td>San Francisco, CA · United States</td>
                  </tr>
                  <tr>
                    <td style={{ color: '#6B7280', fontSize: 11, fontFamily: "'Courier New', monospace", letterSpacing: '0.08em', textTransform: 'uppercase' }}>IP address</td>
                    <td style={{ fontFamily: "'Courier New', monospace" }}>73.189.44.22</td>
                  </tr>
                  <tr>
                    <td style={{ color: '#6B7280', fontSize: 11, fontFamily: "'Courier New', monospace", letterSpacing: '0.08em', textTransform: 'uppercase' }}>Device</td>
                    <td>Chrome 132 on macOS (Sonoma)</td>
                  </tr>
                  <tr>
                    <td style={{ color: '#6B7280', fontSize: 11, fontFamily: "'Courier New', monospace", letterSpacing: '0.08em', textTransform: 'uppercase' }}>Requested</td>
                    <td>April 24, 2026 · 2:41 PM PDT</td>
                  </tr>
                </tbody></table>
              </td></tr>
            </tbody></table>
          </td></tr>

          <tr><td style={{ padding: '22px 36px 8px', fontSize: 13, color: '#4A5568', lineHeight: 1.55, ...emailStyles.sans }}>
            <strong style={{ color: '#0F1B2D' }}>Didn't request this?</strong> Someone may have typed your email by mistake — you can safely ignore this email. No account changes have been made. If you're concerned, <a href="#" style={{ color: '#0B3D66' }}>reach out to us</a>.
          </td></tr>

          <tr><td style={{ padding: '26px 36px', borderTop: '1px solid #E6E0D4', marginTop: 20, background: '#FCFBF8', ...emailStyles.sans, fontSize: 11, color: '#6B7280', lineHeight: 1.6 }}>
            Atlas Weather · wheretogoforgreatweather.com · 2261 Market Street #4242, San Francisco, CA 94114<br/>
            <a href="#" style={{ color: '#6B7280', textDecoration: 'none' }}>Help centre</a> · <a href="#" style={{ color: '#6B7280', textDecoration: 'none' }}>Privacy</a> · <a href="#" style={{ color: '#6B7280', textDecoration: 'none' }}>Status</a>
          </td></tr>
        </tbody>
      </table>
    </MailClient>
  );

  const WelcomeEmail = () => (
    <MailClient subject="Welcome to Atlas Weather" from="Elena at Atlas Weather" preheader="You're in. Here's how to find your next great-weather destination.">
      <table width="600" cellPadding="0" cellSpacing="0" style={{ margin: '0 auto', background: '#FFF', border: '1px solid #E6E0D4', borderRadius: 6, overflow: 'hidden' }}>
        <tbody>
          <tr><td style={{ padding: '22px 32px', borderBottom: '1px solid #E6E0D4', background: '#FCFBF8' }}>
            <span style={{ fontFamily: "Georgia, serif", fontSize: 17, fontWeight: 500, color: '#0F1B2D' }}>Atlas Weather</span>
          </td></tr>

          <tr><td style={{ padding: '36px 36px 0', ...emailStyles.body }}>
            <h1 style={{ margin: 0, fontSize: 32, fontWeight: 500, letterSpacing: '-0.015em', color: '#0F1B2D', lineHeight: 1.15 }}>Welcome to Atlas Weather, Maya.</h1>
            <p style={{ marginTop: 14, fontSize: 15, lineHeight: 1.6, color: '#4A5568' }}>
              You've joined <strong style={{ color: '#0F1B2D' }}>Atlas Weather Free</strong>. No cards, no trials — just a practical tool for finding destinations with the weather you actually want.
            </p>
            <p style={{ fontSize: 15, lineHeight: 1.6, color: '#4A5568' }}>
              Here's what usually helps new travellers get the most out of the first week.
            </p>
          </td></tr>

          <tr><td style={{ padding: '20px 36px 6px' }}>
            <table width="100%" cellPadding="0" cellSpacing="0"><tbody>
              <tr>
                <td width="32" valign="top" style={{ paddingTop: 4, fontFamily: "Georgia, serif", fontSize: 18, fontWeight: 500, color: '#B88A2E' }}>01</td>
                <td style={{ paddingBottom: 16, ...emailStyles.body }}>
                  <div style={{ fontSize: 16, fontWeight: 500, color: '#0F1B2D', marginBottom: 4 }}>Open the map</div>
                  <div style={{ fontSize: 13.5, color: '#4A5568', lineHeight: 1.55 }}>Pick a travel month; every country gets a score against your preferences.</div>
                </td>
              </tr>
              <tr>
                <td valign="top" style={{ paddingTop: 4, fontFamily: "Georgia, serif", fontSize: 18, fontWeight: 500, color: '#B88A2E' }}>02</td>
                <td style={{ paddingBottom: 16, ...emailStyles.body }}>
                  <div style={{ fontSize: 16, fontWeight: 500, color: '#0F1B2D', marginBottom: 4 }}>Zoom in on a country</div>
                  <div style={{ fontSize: 13.5, color: '#4A5568', lineHeight: 1.55 }}>See per-region scoring, 12-month climate charts, and government safety advisories.</div>
                </td>
              </tr>
              <tr>
                <td valign="top" style={{ paddingTop: 4, fontFamily: "Georgia, serif", fontSize: 18, fontWeight: 500, color: '#B88A2E' }}>03</td>
                <td style={{ paddingBottom: 16, ...emailStyles.body }}>
                  <div style={{ fontSize: 16, fontWeight: 500, color: '#0F1B2D', marginBottom: 4 }}>Save a trip</div>
                  <div style={{ fontSize: 13.5, color: '#4A5568', lineHeight: 1.55 }}>Pin dates and destinations, then come back any time — or share a link with a travel companion.</div>
                </td>
              </tr>
            </tbody></table>
          </td></tr>

          <tr><td align="center" style={{ padding: '14px 36px 32px' }}>
            <table cellPadding="0" cellSpacing="0"><tbody><tr>
              <td style={{ background: '#0F1B2D', borderRadius: 3, padding: '14px 28px' }}>
                <a href="#" style={{ color: '#FFF', textDecoration: 'none', fontSize: 15, fontWeight: 500, ...emailStyles.sans }}>Open the map →</a>
              </td>
            </tr></tbody></table>
          </td></tr>

          <tr><td style={{ padding: '22px 36px 26px', borderTop: '1px solid #E6E0D4', ...emailStyles.sans, fontSize: 13.5, color: '#4A5568', lineHeight: 1.6 }}>
            Replies to this email reach a real person on our team — not a ticketing bot. If something is confusing, broken, or missing, just hit reply.<br/><br/>
            <span style={{ fontFamily: "Georgia, serif", fontSize: 15, color: '#0F1B2D', fontStyle: 'italic' }}>— Elena</span><br/>
            <span style={{ fontSize: 11.5, color: '#6B7280' }}>Product · Atlas Weather</span>
          </td></tr>

          <tr><td style={{ padding: '22px 36px', background: '#FCFBF8', ...emailStyles.sans, fontSize: 11, color: '#6B7280', lineHeight: 1.6, borderTop: '1px solid #E6E0D4' }}>
            You're getting this because you just created an Atlas Weather account. <a href="#" style={{ color: '#6B7280' }}>Unsubscribe</a> from product updates (we'll still send security emails).<br/>
            Atlas Weather · wheretogoforgreatweather.com · 2261 Market Street #4242, San Francisco, CA 94114
          </td></tr>
        </tbody>
      </table>
    </MailClient>
  );

  // ═══════════════════ CANVAS COMPOSITION ════════════════════════════
  const { DesignCanvas, DCSection, DCArtboard } = window;
  return (
    <DesignCanvas>
      <DCSection id="sec-auth" title="Authentication" subtitle="Magic-link only · optional Google OAuth · no passwords">
        <DCArtboard id="login"     label="/login"             width={1280} height={800}><Login/></DCArtboard>
        <DCArtboard id="sent"      label="/login/sent"        width={1280} height={800}><LoginSent/></DCArtboard>
        <DCArtboard id="landing"   label="Magic-link landing" width={1280} height={800}><MagicLanding/></DCArtboard>
      </DCSection>

      <DCSection id="sec-consumer" title="Consumer onboarding" subtitle="One flow · Premium card only shows after Paddle checkout">
        <DCArtboard id="c-step1" label="Step 1 · Units (Premium variant shown)" width={1280} height={800}><ConsumerStep1/></DCArtboard>
        <DCArtboard id="c-step2" label="Step 2 · Default preferences"            width={1280} height={800}><ConsumerStep2/></DCArtboard>
        <DCArtboard id="c-step3" label="Step 3 · Plan your first trip"           width={1280} height={800}><ConsumerStep3/></DCArtboard>
      </DCSection>

      <DCSection id="sec-agency" title="Agency-owner onboarding" subtitle="Post-Paddle · name org → house style → invite → add client">
        <DCArtboard id="a-step1" label="Step 1 · Name organisation"      width={1280} height={800}><AgencyStep1/></DCArtboard>
        <DCArtboard id="a-step2" label="Step 2 · House style"            width={1280} height={800}><AgencyStep2/></DCArtboard>
        <DCArtboard id="a-step3" label="Step 3 · Invite agents"          width={1280} height={800}><AgencyStep3/></DCArtboard>
        <DCArtboard id="a-step4" label="Step 4 · Dashboard + first client CTA" width={1280} height={800}><AgencyStep4/></DCArtboard>
      </DCSection>

      <DCSection id="sec-emails" title="Email templates" subtitle="Table-based HTML · renders in Gmail, Apple Mail, Outlook">
        <DCArtboard id="em-magic"   label="Magic-link email"  width={780} height={760}><MagicLinkEmail/></DCArtboard>
        <DCArtboard id="em-welcome" label="Welcome email"     width={780} height={760}><WelcomeEmail/></DCArtboard>
      </DCSection>
    </DesignCanvas>
  );
}

window.AuthOnboarding = AuthOnboarding;
