/**
 * Magic-link sign-in email. Rendered via `@react-email/render` into
 * table-based HTML and handed to FastAPI's email service — the Next.js app
 * never sends mail itself. The FastAPI worker calls a small render script
 * (`pnpm email:render`) as a build step and ships the produced HTML.
 *
 * Visual reference: `web/design/Auth & Onboarding.html` (MagicLinkEmail).
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

export type MagicLinkEmailProps = {
  /** The fully-signed URL the recipient should click to finish sign-in. */
  verifyUrl: string;
  /** Optional diagnostic block so recipients can confirm the request was theirs. */
  request?: {
    location?: string;
    ip?: string;
    userAgent?: string;
    requestedAt?: string;
  };
};

const PREVIEW = "Click to sign in — expires in 15 minutes. Not you? Ignore this email.";

export default function MagicLinkEmail({
  verifyUrl = "https://wheretogoforgreatweather.com/auth/verify?t=example",
  request,
}: MagicLinkEmailProps) {
  return (
    <Html lang="en">
      <Head />
      <Preview>{PREVIEW}</Preview>
      <Body style={body}>
        <Container style={container}>
          <Section style={masthead}>
            <table width="100%" cellPadding={0} cellSpacing={0} role="presentation">
              <tbody>
                <tr>
                  <td style={brand}>
                    <span style={brandName}>Atlas Weather</span>
                    <span style={brandWordmark}>WHERETOGOFORGREATWEATHER</span>
                  </td>
                  <td align="right" style={eyebrow}>
                    Sign-in link
                  </td>
                </tr>
              </tbody>
            </table>
          </Section>

          <Section style={headingSection}>
            <Text style={h1}>Sign in to Atlas Weather</Text>
            <Text style={lede}>
              Click the button below to finish signing in. This link is good for{" "}
              <strong style={emphasis}>one sign-in</strong> and expires in{" "}
              <strong style={emphasis}>15 minutes</strong>.
            </Text>
          </Section>

          <Section style={ctaWrap}>
            <Button href={verifyUrl} style={cta}>
              Sign in to Atlas Weather →
            </Button>
            <Text style={fallback}>
              Or paste this URL into your browser:
              <br />
              <Link href={verifyUrl} style={fallbackLink}>
                {verifyUrl}
              </Link>
            </Text>
          </Section>

          {request ? (
            <Section style={requestBoxWrap}>
              <div style={requestBox}>
                <Text style={requestEyebrow}>Request details · verify this was you</Text>
                <table width="100%" cellPadding={0} cellSpacing={0} role="presentation">
                  <tbody>
                    {request.location ? (
                      <tr>
                        <td style={requestKey}>Location</td>
                        <td style={requestValue}>{request.location}</td>
                      </tr>
                    ) : null}
                    {request.ip ? (
                      <tr>
                        <td style={requestKey}>IP address</td>
                        <td style={requestValueMono}>{request.ip}</td>
                      </tr>
                    ) : null}
                    {request.userAgent ? (
                      <tr>
                        <td style={requestKey}>Device</td>
                        <td style={requestValue}>{request.userAgent}</td>
                      </tr>
                    ) : null}
                    {request.requestedAt ? (
                      <tr>
                        <td style={requestKey}>Requested</td>
                        <td style={requestValue}>{request.requestedAt}</td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </Section>
          ) : null}

          <Section style={guidance}>
            <Text style={guidanceText}>
              <strong style={emphasis}>Didn&apos;t request this?</strong> Someone may have typed
              your email by mistake — you can safely ignore this email. No account changes have
              been made. If you&apos;re concerned,{" "}
              <Link href="https://wheretogoforgreatweather.com/contact" style={inlineLink}>
                reach out to us
              </Link>
              .
            </Text>
          </Section>

          <Hr style={hr} />

          <Section style={footer}>
            <Text style={footerText}>
              Atlas Weather · wheretogoforgreatweather.com · 2261 Market Street #4242, San
              Francisco, CA 94114
              <br />
              <Link href="https://wheretogoforgreatweather.com/help" style={footerLink}>
                Help centre
              </Link>{" "}
              ·{" "}
              <Link href="https://wheretogoforgreatweather.com/privacy" style={footerLink}>
                Privacy
              </Link>{" "}
              ·{" "}
              <Link href="https://wheretogoforgreatweather.com/status" style={footerLink}>
                Status
              </Link>
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

MagicLinkEmail.PreviewProps = {
  verifyUrl:
    "https://wheretogoforgreatweather.com/auth/verify?t=8f4c2e7a9b1d3e5f7a8c9d0e1f2b3c4",
  request: {
    location: "San Francisco, CA · United States",
    ip: "73.189.44.22",
    userAgent: "Chrome 132 on macOS (Sonoma)",
    requestedAt: "April 24, 2026 · 2:41 PM PDT",
  },
} satisfies MagicLinkEmailProps;

// ─── Inline styles (table-safe) ──────────────────────────────────────

const mono = "'Courier New', Courier, monospace";
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

const brand: React.CSSProperties = { verticalAlign: "middle" };
const brandName: React.CSSProperties = {
  fontFamily: serif,
  fontSize: 17,
  fontWeight: 500,
  color: "#0F1B2D",
};
const brandWordmark: React.CSSProperties = {
  marginLeft: 8,
  fontFamily: mono,
  fontSize: 10,
  letterSpacing: "0.12em",
  color: "#6B7280",
};
const eyebrow: React.CSSProperties = {
  fontFamily: mono,
  fontSize: 10,
  letterSpacing: "0.1em",
  textTransform: "uppercase",
  color: "#6B7280",
};

const headingSection: React.CSSProperties = { padding: "36px 36px 0" };
const h1: React.CSSProperties = {
  margin: 0,
  fontFamily: serif,
  fontSize: 28,
  fontWeight: 500,
  letterSpacing: "-0.015em",
  color: "#0F1B2D",
};
const lede: React.CSSProperties = {
  marginTop: 12,
  fontFamily: serif,
  fontSize: 15,
  lineHeight: 1.55,
  color: "#4A5568",
};
const emphasis: React.CSSProperties = { color: "#0F1B2D" };

const ctaWrap: React.CSSProperties = { padding: "18px 36px 30px", textAlign: "center" };
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
const fallback: React.CSSProperties = {
  marginTop: 14,
  fontFamily: mono,
  fontSize: 11,
  color: "#6B7280",
  lineHeight: 1.5,
};
const fallbackLink: React.CSSProperties = {
  color: "#0B3D66",
  wordBreak: "break-all",
};

const requestBoxWrap: React.CSSProperties = { padding: "0 36px" };
const requestBox: React.CSSProperties = {
  background: "#FCFBF8",
  border: "1px solid #E6E0D4",
  borderRadius: 4,
  padding: "14px 18px",
};
const requestEyebrow: React.CSSProperties = {
  margin: 0,
  fontFamily: mono,
  fontSize: 10,
  fontWeight: 600,
  letterSpacing: "0.14em",
  textTransform: "uppercase",
  color: "#6B7280",
};
const requestKey: React.CSSProperties = {
  width: 110,
  fontFamily: mono,
  fontSize: 11,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  color: "#6B7280",
  paddingTop: 6,
};
const requestValue: React.CSSProperties = {
  fontFamily: sans,
  fontSize: 13,
  color: "#0F1B2D",
  paddingTop: 6,
};
const requestValueMono: React.CSSProperties = {
  ...requestValue,
  fontFamily: mono,
};

const guidance: React.CSSProperties = { padding: "22px 36px 8px" };
const guidanceText: React.CSSProperties = {
  margin: 0,
  fontFamily: sans,
  fontSize: 13,
  lineHeight: 1.55,
  color: "#4A5568",
};
const inlineLink: React.CSSProperties = { color: "#0B3D66" };

const hr: React.CSSProperties = {
  borderColor: "#E6E0D4",
  margin: "14px 36px 0",
};

const footer: React.CSSProperties = {
  padding: "18px 36px 24px",
  background: "#FCFBF8",
};
const footerText: React.CSSProperties = {
  margin: 0,
  fontFamily: sans,
  fontSize: 11,
  lineHeight: 1.6,
  color: "#6B7280",
};
const footerLink: React.CSSProperties = { color: "#6B7280", textDecoration: "none" };
