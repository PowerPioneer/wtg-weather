/**
 * Talking to the stack the WS-A journey runs against.
 *
 * Most of this suite runs against `pnpm dev` with `WTG_USE_MOCK_DATA=1` and no
 * API at all — see `playwright.config.ts`. The journey spec cannot: it signs a
 * real user in, writes a real trip, and reads it back through `/account`, all
 * of which the Next *server* fetches from the API. `page.route` only sees the
 * browser's own requests, so faking those would test the fake.
 *
 * So that one spec is opt-in, and this module is the seam:
 *
 *   - {@link STACK_ENABLED} gates it (`WTG_E2E_STACK=1`)
 *   - {@link waitForMagicLinkToken} scrapes the sign-in token out of the API's
 *     stdout, which is where `EMAIL_PROVIDER=console` puts it
 *
 * Scraping stdout rather than seeding a session cookie is the point: the magic
 * link is the whole of the sign-in flow, both halves of it were written months
 * apart, and the join between them (`/login/verify`) had never once been
 * exercised end to end before this spec existed.
 */

import { exec as execCallback } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";

const exec = promisify(execCallback);

/** Opt-in. Off by default, because the default suite has no stack behind it. */
export const STACK_ENABLED = process.env.WTG_E2E_STACK === "1";

/** `docker compose` has to run from the compose file's directory. */
export const REPO_ROOT = path.resolve(__dirname, "..", "..", "..");

/**
 * `--since` bounds the read so a long-lived stack does not hand back a day of
 * logs on every poll; 15 minutes is the magic link's own TTL, so anything older
 * could not be signed in with anyway. Override for a stack that is not this
 * compose project — a remote box wants something like
 * `ssh v2 'docker compose -f /srv/wtg/docker-compose.yml logs --since 15m api'`.
 */
const DEFAULT_API_LOGS_COMMAND = "docker compose logs --no-color --since 15m api";

export function apiLogsCommand(): string {
  return process.env.WTG_E2E_API_LOGS ?? DEFAULT_API_LOGS_COMMAND;
}

async function readApiLogs(): Promise<string> {
  const { stdout, stderr } = await exec(apiLogsCommand(), {
    cwd: REPO_ROOT,
    // A busy stack's 15 minutes can be large, and a truncated read would look
    // exactly like "the email never arrived".
    maxBuffer: 64 * 1024 * 1024,
    windowsHide: true,
  });
  // uvicorn logs to the container's stderr and `print` to its stdout; docker
  // compose merges both onto its own stdout, but a wrapper command might not.
  return `${stdout}\n${stderr}`;
}

/**
 * The link `ConsoleEmail` prints. The token is an `itsdangerous`
 * `URLSafeTimedSerializer` payload: url-safe base64 segments joined by dots.
 */
const VERIFY_LINK = /\/login\/verify\?token=([A-Za-z0-9._~-]+)/;

/**
 * The most recent magic-link token issued to `email`, or null if none is in the
 * log yet.
 *
 * Anchored on the address so a stack with other traffic on it cannot hand back
 * somebody else's sign-in link. `ConsoleEmail` writes the whole message in one
 * `print`, so the token always follows its own `To:` line — the last such line
 * is the newest request.
 */
export function findMagicLinkToken(logs: string, email: string): string | null {
  const addressed = logs.lastIndexOf(`To: ${email}`);
  if (addressed === -1) return null;
  return VERIFY_LINK.exec(logs.slice(addressed))?.[1] ?? null;
}

/**
 * Poll the API's stdout until the magic link for `email` shows up.
 *
 * The failure message names both suspects, because they are the two ways this
 * realistically breaks: the stack is not sending to the console, or the command
 * we are reading logs with is pointed somewhere else.
 */
export async function waitForMagicLinkToken(
  email: string,
  timeoutMs = 30_000,
): Promise<string> {
  const deadline = Date.now() + timeoutMs;
  let lastError: unknown = null;

  for (;;) {
    try {
      const token = findMagicLinkToken(await readApiLogs(), email);
      if (token) return token;
      lastError = null;
    } catch (err) {
      lastError = err;
    }

    if (Date.now() >= deadline) {
      throw new Error(
        [
          `No magic link for ${email} in the API's logs after ${timeoutMs}ms.`,
          `Command: ${apiLogsCommand()} (cwd ${REPO_ROOT})`,
          lastError ? `Last error: ${String(lastError)}` : null,
          "Check that the API runs with EMAIL_PROVIDER=console — any other",
          "provider posts the link to SendGrid or Postmark and prints nothing.",
        ]
          .filter(Boolean)
          .join("\n"),
      );
    }

    await new Promise((resolve) => setTimeout(resolve, 500));
  }
}
