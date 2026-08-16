/**
 * Weather-alert email. Sent by `api/src/wtg_api/jobs/alerts_weekly.py` when a
 * saved alert changes state — it started matching the user's preferences, or it
 * stopped.
 *
 * Visual reference: `web/design/Auth & Onboarding.html` (transactional shell)
 * and `web/design/Upgrades & Empty States.html` (score chip).
 *
 * ## How this reaches a recipient
 *
 * The Next.js app never sends mail — FastAPI does, and the API container has no
 * Node in it. So this template is rendered **once, at build time**, into
 * `api/src/wtg_api/templates/emails/` with `{{placeholder}}` sentinels where the
 * per-recipient values go, and `services/alert_email.py` substitutes them. Run
 * `pnpm email:render` after editing this file; `templates.sync.test.tsx` fails
 * the suite if the committed artifact drifts from this source.
 *
 * Every value the API substitutes is a placeholder *string* here, which is why
 * the props are typed `string` rather than `number` — the render pass never sees
 * a real score.
 *
 * ## Why two artifacts rather than one with a conditional
 *
 * `matched` decides copy, colour and subject line. A pre-rendered template
 * cannot branch at send time, so the render script emits `alert-matched` and
 * `alert-stopped` as separate files and the sender picks one. Anything that
 * varies per recipient has to be a placeholder, not a branch.
 */

import {
  Body,
  Container,
  Head,
  Hr,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from "@react-email/components";

export type AlertEmailProps = {
  /** True for "now matches", false for "stopped matching". Fixed per artifact. */
  matched: boolean;
  /** Human label for the alert's place, e.g. "Peru" or "Cusco, Peru". */
  place: string;
  /** Month name, e.g. "April". */
  month: string;
  /** 0–100 match score, already formatted. */
  score: string;
  /** The previous run's score, already formatted. */
  previousScore: string;
  /** Country/month page for the alert's place. */
  placeUrl: string;
  /** `/account?s=alerts`. */
  manageUrl: string;
  /** Signed, session-less unsubscribe URL. Also goes in `List-Unsubscribe`. */
  unsubscribeUrl: string;
};

export default function AlertEmail({
  matched = true,
  place = "{{place}}",
  month = "{{month}}",
  score = "{{score}}",
  previousScore = "{{previous_score}}",
  placeUrl = "{{place_url}}",
  manageUrl = "{{manage_url}}",
  unsubscribeUrl = "{{unsubscribe_url}}",
}: AlertEmailProps) {
  const preview = matched
    ? `${place} in ${month} now matches what you asked for.`
    : `${place} in ${month} has dropped below your preferences.`;

  return (
    <Html lang="en">
      <Head />
      <Preview>{preview}</Preview>
      <Body style={body}>
        <Container style={container}>
          {/* Single-column masthead, unlike `magic-link.tsx`'s two-column one.
              A table row's cells are concatenated without separators by the
              plain-text pass, which turned the header into one unreadable word;
              the eyebrow moved below, where it reads correctly in both parts. */}
          <Section style={masthead}>
            <Text style={brandName}>Atlas Weather</Text>
          </Section>

          <Section style={headingSection}>
            <Text style={eyebrow}>Weather alert</Text>
            <Text style={h1}>
              {matched
                ? `${place} in ${month} now matches.`
                : `${place} in ${month} no longer matches.`}
            </Text>
            <Text style={lede}>
              {matched
                ? "You asked to hear when this one came good against your saved preferences. This week's recomputed climate scores put it over the line."
                : "This week's recomputed climate scores put it back under the line you set. Nothing is wrong with the alert — it stays active and we'll write again if it recovers."}
            </Text>
          </Section>

          <Section style={scoreWrap}>
            <div style={matched ? scoreBoxMatched : scoreBoxStopped}>
              <Text style={scoreKey}>Match score</Text>
              <Text style={matched ? scoreValueMatched : scoreValueStopped}>
                {score}
                <span style={scoreOutOf}>/100</span>
              </Text>
              <Text style={scoreValueMuted}>Previous run: {previousScore}/100</Text>
            </div>
          </Section>

          <Section style={ctaWrap}>
            <Link href={placeUrl} style={cta}>
              See {month} in {place} →
            </Link>
            <Text style={fallback}>
              Scores come from ten years of ERA5 reanalysis, recomputed against the
              preferences saved on this alert. Nothing about today&apos;s weather.
            </Text>
          </Section>

          <Hr style={hr} />

          <Section style={footer}>
            <Text style={footerText}>
              You are receiving this because you set a weather alert on Atlas Weather.{" "}
              <Link href={manageUrl} style={footerLinkStrong}>
                Manage your alerts
              </Link>{" "}
              or{" "}
              <Link href={unsubscribeUrl} style={footerLinkStrong}>
                unsubscribe from alert email
              </Link>
              .
            </Text>
            <Text style={footerText}>
              Atlas Weather · wheretogoforgreatweather.com · 2261 Market Street #4242, San
              Francisco, CA 94114
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

AlertEmail.PreviewProps = {
  matched: true,
  place: "Peru",
  month: "April",
  score: "90",
  previousScore: "60",
  placeUrl: "https://wheretogoforgreatweather.com/peru/april",
  manageUrl: "https://wheretogoforgreatweather.com/account?s=alerts",
  unsubscribeUrl:
    "https://wheretogoforgreatweather.com/api/alerts/unsubscribe?token=example",
} satisfies AlertEmailProps;

// ─── Inline styles (table-safe) ──────────────────────────────────────
// Palette values are the Atlas tokens from `web/design/tokens.md`. They are
// literal here rather than imported because an email is rendered outside the
// Tailwind pipeline — there is no stylesheet to reference.

const mono = "'Courier New', Courier, monospace";
const serif = "Georgia, 'Times New Roman', serif";
const sans = "Helvetica, Arial, sans-serif";

const INK = "#0F1B2D";
const MUTED = "#6B7280";
const BODY_TEXT = "#4A5568";
const RULE = "#E6E0D4";
const PAPER = "#FCFBF8";
const PERFECT = "#0B6E5F";
const AVOID = "#7A2E2E";

const body: React.CSSProperties = {
  margin: 0,
  padding: "20px 0",
  background: "#ECEAE3",
  fontFamily: sans,
  color: INK,
};

const container: React.CSSProperties = {
  width: 600,
  margin: "0 auto",
  background: "#FFFFFF",
  border: `1px solid ${RULE}`,
  borderRadius: 6,
  overflow: "hidden",
};

const masthead: React.CSSProperties = {
  padding: "22px 32px",
  borderBottom: `1px solid ${RULE}`,
  background: PAPER,
};

const brandName: React.CSSProperties = {
  margin: 0,
  fontFamily: serif,
  fontSize: 17,
  fontWeight: 500,
  color: INK,
};
const eyebrow: React.CSSProperties = {
  margin: 0,
  fontFamily: mono,
  fontSize: 10,
  letterSpacing: "0.1em",
  textTransform: "uppercase",
  color: MUTED,
};

const headingSection: React.CSSProperties = { padding: "30px 36px 0" };
const h1: React.CSSProperties = {
  margin: 0,
  fontFamily: serif,
  fontSize: 26,
  fontWeight: 500,
  letterSpacing: "-0.015em",
  color: INK,
};
const lede: React.CSSProperties = {
  marginTop: 12,
  fontFamily: serif,
  fontSize: 15,
  lineHeight: 1.55,
  color: BODY_TEXT,
};

const scoreWrap: React.CSSProperties = { padding: "20px 36px 0" };
const scoreBoxBase: React.CSSProperties = {
  border: `1px solid ${RULE}`,
  borderRadius: 4,
  padding: "14px 18px",
};
const scoreBoxMatched: React.CSSProperties = {
  ...scoreBoxBase,
  background: "#DDEBE7",
  borderColor: "#BFD9D2",
};
const scoreBoxStopped: React.CSSProperties = {
  ...scoreBoxBase,
  background: "#EFD8D8",
  borderColor: "#DDBDBD",
};
const scoreKey: React.CSSProperties = {
  margin: 0,
  fontFamily: mono,
  fontSize: 10,
  letterSpacing: "0.12em",
  textTransform: "uppercase",
  color: MUTED,
};
const scoreValueBase: React.CSSProperties = {
  margin: "2px 0 0",
  fontFamily: serif,
  fontSize: 26,
  fontWeight: 500,
  lineHeight: 1.1,
};
const scoreValueMatched: React.CSSProperties = { ...scoreValueBase, color: PERFECT };
const scoreValueStopped: React.CSSProperties = { ...scoreValueBase, color: AVOID };
const scoreValueMuted: React.CSSProperties = {
  margin: "6px 0 0",
  fontFamily: mono,
  fontSize: 11,
  color: MUTED,
};
const scoreOutOf: React.CSSProperties = {
  fontFamily: mono,
  fontSize: 11,
  color: MUTED,
  marginLeft: 2,
};

const ctaWrap: React.CSSProperties = { padding: "22px 36px 28px" };
const cta: React.CSSProperties = {
  background: INK,
  color: "#FFFFFF",
  fontFamily: sans,
  fontSize: 15,
  fontWeight: 500,
  textDecoration: "none",
  padding: "14px 28px",
  borderRadius: 3,
  display: "inline-block",
};
const fallback: React.CSSProperties = {
  marginTop: 16,
  fontFamily: sans,
  fontSize: 12,
  lineHeight: 1.55,
  color: MUTED,
};

const hr: React.CSSProperties = {
  borderColor: RULE,
  margin: "0 36px",
};

const footer: React.CSSProperties = {
  padding: "18px 36px 24px",
  background: PAPER,
};
const footerText: React.CSSProperties = {
  margin: "0 0 6px",
  fontFamily: sans,
  fontSize: 11,
  lineHeight: 1.6,
  color: MUTED,
};
const footerLinkStrong: React.CSSProperties = { color: "#0B3D66", textDecoration: "underline" };
