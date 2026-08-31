import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { FONT_SIZE_TOKENS } from "./tv";

/**
 * The tailwind-merge config in `tv.ts` has to name every `--text-*` token by
 * hand, and a token added to the theme without being added there is silently
 * mistaken for a colour — the failure that made every primary Button
 * invisible. Read the stylesheet and pin the two lists together.
 */
describe("FONT_SIZE_TOKENS", () => {
  it("matches the --text-* scale declared in globals.css", () => {
    // From `cwd` rather than `import.meta.url`, which is an http: URL under
    // jsdom — the same approach the other source-reading tests here take.
    const css = readFileSync(
      join(process.cwd(), "src", "app", "globals.css"),
      "utf8",
    );

    // `--text-body: 16px` is a size; `--text-body--line-height` is a modifier
    // of one, and carries no class of its own.
    const declared = new Set<string>();
    for (const [, name] of css.matchAll(/--text-([a-z0-9-]+)\s*:/g)) {
      if (!name.includes("--")) declared.add(name);
    }

    expect([...declared].sort()).toEqual([...FONT_SIZE_TOKENS].sort());
  });
});
