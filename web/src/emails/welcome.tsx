/**
 * Welcome email. Sent once, right after the first successful sign-in.
 *
 * Visual reference: `web/design/Auth & Onboarding.html` (WelcomeEmail).
 * Rendered by FastAPI's email service — see the header of `magic-link.tsx`
 * for the ownership boundary.
 */

import {
  Body,
  Button,
  Container,
  Head,
  Hr,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from "@react-email/components";

export type WelcomeEmailProps = {
  /** Used in the greeting. Falls back to "there" if missing so we never send "Welcome, ,". */
  firstName?: string;
  /** Primary CTA destination — usually the map. */
  mapUrl?: string;
};

const PREVIEW = "You're in. Here's how to find your next great-weather destination.";

export default function WelcomeEmail({
  firstName = "there",
  mapUrl = "https://wheretogoforgreatweather.com/map",
}: WelcomeEmailProps) {
  return (
    <Html lang="en">
      <Head />
      <Preview>{PREVIEW}</Preview>
      <Body style={body}>
        <Container style={container}>
          <Section style={masthead}>
            <span style={brandName}>Atlas Weather</span>
          </Section>

          <Section style={headingSection}>
            <Text style={h1}>Welcome to Atlas Weather, {firstName}.</Text>
            <Text style={lede}>
              You&apos;ve joined <strong style={emphasis}>Atlas Weather Free</strong>. No cards,
              no trials — just a practical tool for finding destinations with the weather you
              actually want.
            </Text>
            <Text style={lede}>
              Here&apos;s what usually helps new travellers get the most out of the first week.
            </Text>
          </Section>

          <Section style={stepsWrap}>
            <Step n="01" title="Open the map">
              Pick a travel month; every country gets a score against your preferences.
            </Step>
            <Step n="02" title="Zoom in on a country">
              See per-region scoring, 12-month climate charts, and government safety advisories.
            </Step>
            <Step n="03" title="Save a trip">
              Pin dates and destinations, then come back any time — or share a link with a
              travel companion.
            </Step>
          </Section>

          <Section style={ctaWrap}>
            <Button href={mapUrl} style={cta}>
              Open the map →
            </Button>
          </Section>

          <Hr style={hr} />

          <Section style={signoff}>
            <Text style={signoffText}>
              Replies to this email reach a real person on our team — not a ticketing bot. If
              something is confusing, broken, or missing, just hit reply.
            </Text>
            <Text style={signName}>— Elena</Text>
            <Text style={signRole}>Product · Atlas Weather</Text>
          </Section>

          <Section style={footer}>
            <Text style={footerText}>
              You&apos;re getting this because you just created an Atlas Weather account.{" "}
              <Link href="https://wheretogoforgreatweather.com/account" style={footerLink}>
                Unsubscribe
              </Link>{" "}
              from product updates (we&apos;ll still send security emails).
              <br />
              Atlas Weather · wheretogoforgreatweather.com · 2261 Market Street #4242, San
              Francisco, CA 94114
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

WelcomeEmail.PreviewProps = {
  firstName: "Maya",
  mapUrl: "https://wheretogoforgreatweather.com/map",
} satisfies WelcomeEmailProps;

function Step({ n, title, children }: { n: string; title: string; children: React.ReactNode }) {
  return (
    <table
      width="100%"
      cellPadding={0}
      cellSpacing={0}
      role="presentation"
      style={{ marginBottom: 16 }}
    >
      <tbody>
        <tr>
          <td width={36} valign="top" style={stepNumber}>
            {n}
          </td>
          <td>
            <Text style={stepTitle}>{title}</Text>
            <Text style={stepBody}>{children}</Text>
          </td>
        </tr>
      </tbody>
    </table>
  );
}

// ─── Inline styles ───────────────────────────────────────────────────

const serif = "Georgia, 'Times New Roman', serif";
const sans = "Helvetica, Arial, sans-serif";

const body: React.CSSProperties = {
  margin: 0,
  padding: "20px 0",
  background: "#ECEAE3",
  fontFamily: sans,
  color: "#0F1B2D",
};

const container: React.CSSProperties = {
  width: 600,
  margin: "0 auto",
  background: "#FFFFFF",
  border: "1px solid #E6E0D4",
  borderRadius: 6,
  overflow: "hidden",
};

const masthead: React.CSSProperties = {
  padding: "22px 32px",
  borderBottom: "1px solid #E6E0D4",
  background: "#FCFBF8",
};
const brandName: React.CSSProperties = {
  fontFamily: serif,
  fontSize: 17,
  fontWeight: 500,
  color: "#0F1B2D",
};

const headingSection: React.CSSProperties = { padding: "36px 36px 0" };
const h1: React.CSSProperties = {
  margin: 0,
  fontFamily: serif,
  fontSize: 32,
  fontWeight: 500,
  letterSpacing: "-0.015em",
  lineHeight: 1.15,
  color: "#0F1B2D",
};
const lede: React.CSSProperties = {
  margin: "14px 0 0",
  fontFamily: serif,
  fontSize: 15,
  lineHeight: 1.6,
  color: "#4A5568",
};
const emphasis: React.CSSProperties = { color: "#0F1B2D" };

const stepsWrap: React.CSSProperties = { padding: "20px 36px 6px" };
const stepNumber: React.CSSProperties = {
  paddingTop: 4,
  fontFamily: serif,
  fontSize: 18,
  fontWeight: 500,
  color: "#B88A2E",
};
const stepTitle: React.CSSProperties = {
  margin: 0,
  fontFamily: serif,
  fontSize: 16,
  fontWeight: 500,
  color: "#0F1B2D",
};
const stepBody: React.CSSProperties = {
  margin: "4px 0 0",
  fontFamily: serif,
  fontSize: 13,
  lineHeight: 1.55,
  color: "#4A5568",
};

const ctaWrap: React.CSSProperties = { padding: "14px 36px 32px", textAlign: "center" };
const cta: React.CSSProperties = {
  background: "#0F1B2D",
  color: "#FFFFFF",
  fontFamily: sans,
  fontSize: 15,
  fontWeight: 500,
  textDecoration: "none",
  padding: "14px 28px",
  borderRadius: 3,
  display: "inline-block",
};

const hr: React.CSSProperties = { borderColor: "#E6E0D4", margin: 0 };

const signoff: React.CSSProperties = { padding: "22px 36px 4px" };
const signoffText: React.CSSProperties = {
  margin: 0,
  fontFamily: sans,
  fontSize: 13.5,
  lineHeight: 1.6,
  color: "#4A5568",
};
const signName: React.CSSProperties = {
  margin: "16px 0 0",
  fontFamily: serif,
  fontSize: 15,
  fontStyle: "italic",
  color: "#0F1B2D",
};
const signRole: React.CSSProperties = {
  margin: "2px 0 18px",
  fontFamily: sans,
  fontSize: 11.5,
  color: "#6B7280",
};

const footer: React.CSSProperties = {
  padding: "22px 36px",
  background: "#FCFBF8",
  borderTop: "1px solid #E6E0D4",
};
const footerText: React.CSSProperties = {
  margin: 0,
  fontFamily: sans,
  fontSize: 11,
  lineHeight: 1.6,
  color: "#6B7280",
};
const footerLink: React.CSSProperties = { color: "#6B7280" };
