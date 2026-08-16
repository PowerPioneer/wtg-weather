/**
 * The bridge between `src/emails/*.tsx` and the Python service that actually
 * sends mail.
 *
 * FastAPI owns sending, and the API image is `python:3.12-slim` — there is no
 * Node in it and no way to run `@react-email/render` at send time. So the
 * templates are rendered **once** into `api/src/wtg_api/templates/emails/`, with
 * `{{placeholder}}` sentinels standing in for the per-recipient values, and
 * `wtg_api.services.alert_email` substitutes them.
 *
 * That leaves the usual generated-artifact hazard: someone edits `alert.tsx`,
 * never re-renders, and the deployed email quietly stays the old one. This file
 * closes that hole from both ends —
 *
 *   - `pnpm -C web test` **compares** the committed artifacts against a fresh
 *     render and fails on any drift;
 *   - `pnpm -C web email:render` (`vitest --mode render`) **writes** them.
 *
 * Vite's `--mode` is what switches the two, because it is the only knob that
 * works identically in PowerShell and in a POSIX shell — `VAR=1 pnpm test` is
 * a parse error in the former, and this repo is developed on Windows.
 */

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { renderAlertEmails, renderAlertPreviews, type RenderedTemplate } from "./render";

const HERE = dirname(fileURLToPath(import.meta.url));
const API = join(HERE, "..", "..", "..", "api");
/** Shipped in the API image; the sender substitutes the placeholders. */
const OUT_DIR = join(API, "src", "wtg_api", "templates", "emails");
/** Not shipped: the client preview, and the fixture `test_alert_email.py` pins. */
const PREVIEW_DIR = join(API, "tests", "fixtures", "emails");

// `import.meta.env` is Vite's, and typing it would mean pulling `vite/client`
// into a tsconfig that otherwise describes a Next app. One narrow cast is
// cheaper than that, and it is the only Vite-specific line in the file.
const MODE = (import.meta as unknown as { env?: { MODE?: string } }).env?.MODE;
const WRITING = MODE === "render";

function artifactFiles(name: string, t: RenderedTemplate): Array<[string, string]> {
  return [
    [`${name}.html`, t.html],
    [`${name}.txt`, t.text],
  ];
}

describe("alert email artifacts", () => {
  it(WRITING ? "writes the rendered templates" : "match the committed artifacts", async () => {
    const rendered = await renderAlertEmails();

    const manifest = JSON.stringify(
      Object.fromEntries(
        Object.entries(rendered).map(([name, t]) => [name, { subject: t.subject }]),
      ),
      null,
      2,
    );

    const previews = await renderAlertPreviews();

    const files: Array<[string, string, string]> = [
      ...Object.entries(rendered).flatMap(([name, t]) =>
        artifactFiles(name, t).map(([f, c]): [string, string, string] => [OUT_DIR, f, c]),
      ),
      [OUT_DIR, "manifest.json", `${manifest}\n`],
      ...Object.entries(previews).flatMap(([name, t]): Array<[string, string, string]> => [
        [PREVIEW_DIR, `${name}.preview.html`, t.html],
        [PREVIEW_DIR, `${name}.preview.txt`, t.text],
      ]),
    ];

    if (WRITING) {
      for (const dir of [OUT_DIR, PREVIEW_DIR]) mkdirSync(dir, { recursive: true });
      for (const [dir, name, content] of files) {
        writeFileSync(join(dir, name), content, "utf8");
      }
      expect(files.length).toBeGreaterThan(0);
      return;
    }

    for (const [dir, name, content] of files) {
      let committed: string;
      try {
        committed = readFileSync(join(dir, name), "utf8");
      } catch {
        throw new Error(
          `${name} has never been rendered. Run \`pnpm -C web email:render\` and commit the result.`,
        );
      }
      // `.gitattributes` pins these to LF; normalising anyway means a
      // misconfigured checkout reports the real problem (stale content) rather
      // than a diff nobody can see.
      expect(
        committed.replace(/\r\n/g, "\n"),
        `${name} is stale — re-run \`pnpm -C web email:render\` and commit the result`,
      ).toBe(content.replace(/\r\n/g, "\n"));
    }
  });

  it("leaves every placeholder intact through the render", async () => {
    const rendered = await renderAlertEmails();
    for (const [name, t] of Object.entries(rendered)) {
      for (const placeholder of ["{{place}}", "{{month}}", "{{unsubscribe_url}}"]) {
        expect(t.html, `${name}.html lost ${placeholder}`).toContain(placeholder);
        expect(t.text, `${name}.txt lost ${placeholder}`).toContain(placeholder);
      }
    }
  });
});
