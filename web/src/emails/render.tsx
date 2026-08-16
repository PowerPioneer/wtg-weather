/**
 * Server-only renderer for the react-email templates.
 *
 * The web app never sends email — FastAPI owns that. This module exists so a
 * tiny Node helper (called from CI or pre-build) can materialise each
 * template as a string of table-based HTML and hand it to the Python service.
 *
 * Usage (from a standalone script or `pnpm tsx`):
 *
 *     import { renderMagicLinkEmail } from "@/emails/render";
 *     const html = await renderMagicLinkEmail({ verifyUrl });
 *
 * Keep this file free of Next-specific APIs so it works outside the dev server.
 */

import "server-only";

import { render } from "@react-email/render";

import AlertEmail from "./alert";
import MagicLinkEmail, { type MagicLinkEmailProps } from "./magic-link";
import WelcomeEmail, { type WelcomeEmailProps } from "./welcome";

export type RenderedEmail = { html: string; text: string };

async function renderBoth(
  node: React.ReactElement,
): Promise<RenderedEmail> {
  const [html, text] = await Promise.all([
    render(node, { pretty: false }),
    render(node, { plainText: true }),
  ]);
  return { html, text };
}

export function renderMagicLinkEmail(props: MagicLinkEmailProps): Promise<RenderedEmail> {
  return renderBoth(<MagicLinkEmail {...props} />);
}

export function renderWelcomeEmail(props: WelcomeEmailProps): Promise<RenderedEmail> {
  return renderBoth(<WelcomeEmail {...props} />);
}

/* ────────────────────────────────────────────────────────────────────────────
 * Alert email — rendered as an artifact, not per-recipient
 *
 * Unlike the two above, nothing calls this at request time. `pnpm email:render`
 * renders it once with `{{placeholder}}` sentinels for every per-recipient
 * value, and `api/src/wtg_api/services/alert_email.py` substitutes them at send
 * time. See `alert.tsx` for why, and `templates.sync.test.tsx` for the drift
 * guard that keeps the committed artifact honest.
 * ──────────────────────────────────────────────────────────────────────────── */

export type RenderedTemplate = RenderedEmail & { subject: string };

/**
 * The placeholder each per-recipient value renders as. Kept here rather than
 * inlined so the Python side has one list to mirror — `alert_email.py` fails
 * loudly on a placeholder it was not given a value for, which only works if
 * both sides agree on the spelling.
 */
export const ALERT_PLACEHOLDERS = {
  place: "{{place}}",
  month: "{{month}}",
  score: "{{score}}",
  previousScore: "{{previous_score}}",
  placeUrl: "{{place_url}}",
  manageUrl: "{{manage_url}}",
  unsubscribeUrl: "{{unsubscribe_url}}",
} as const;

/**
 * Realistic values for the committed preview artifacts.
 *
 * These are not test data in the usual sense — they are the *contract* between
 * the two languages. `pnpm email:render` renders the templates a second time
 * with these values substituted by React, and `api/tests/test_alert_email.py`
 * asserts that Python's placeholder substitution produces the identical bytes.
 * If the two ever disagree — an escaping rule, a stray placeholder — the API
 * suite says so, rather than a recipient finding out.
 *
 * They double as the client preview: open the `.preview.html` files in a
 * browser or paste them into a mail client.
 */
export const ALERT_PREVIEW_VALUES = {
  place: "Peru",
  month: "April",
  score: "90",
  previousScore: "60",
  placeUrl: "https://wheretogoforgreatweather.com/peru/april",
  manageUrl: "https://wheretogoforgreatweather.com/account?s=alerts",
  unsubscribeUrl:
    "https://wheretogoforgreatweather.com/api/alerts/unsubscribe?token=Im5vdC1hLXJlYWwtdG9rZW4i.aBcDeF.9x0Q_sample-signature",
} as const;

/** The preview artifacts, keyed by the same names as {@link renderAlertEmails}. */
export async function renderAlertPreviews(): Promise<Record<string, RenderedEmail>> {
  const [matched, stopped] = await Promise.all([
    renderBoth(<AlertEmail {...ALERT_PREVIEW_VALUES} matched />),
    renderBoth(<AlertEmail {...ALERT_PREVIEW_VALUES} matched={false} />),
  ]);
  return { "alert-matched": matched, "alert-stopped": stopped };
}

/**
 * Both alert artifacts, keyed by the name the Python side loads them under.
 *
 * `matched` is baked in rather than substituted: it changes the subject, the
 * headline, the body copy and the score chip's colour, and a pre-rendered
 * template cannot branch. Two files is the honest way to say that.
 */
export async function renderAlertEmails(): Promise<Record<string, RenderedTemplate>> {
  const [matched, stopped] = await Promise.all([
    renderBoth(<AlertEmail {...ALERT_PLACEHOLDERS} matched />),
    renderBoth(<AlertEmail {...ALERT_PLACEHOLDERS} matched={false} />),
  ]);
  return {
    "alert-matched": {
      ...matched,
      subject: `${ALERT_PLACEHOLDERS.place} in ${ALERT_PLACEHOLDERS.month} now matches your preferences`,
    },
    "alert-stopped": {
      ...stopped,
      subject: `${ALERT_PLACEHOLDERS.place} in ${ALERT_PLACEHOLDERS.month} no longer matches your preferences`,
    },
  };
}
