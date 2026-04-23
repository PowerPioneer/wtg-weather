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
