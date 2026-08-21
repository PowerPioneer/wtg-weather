import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

/**
 * Contrast guard for `Chip`.
 *
 * This is deliberately NOT a render test. `Chip` is a design-system primitive
 * that no page imports yet, so an axe run over the app cannot reach it — and
 * jsdom does not resolve Tailwind classes to computed colours anyway. Instead
 * we read the variant classes straight out of the component and the token
 * values straight out of `globals.css`, so the assertion breaks if *either*
 * side drifts.
 *
 * Background: on 2026-08-16 three of the six variants were found rendering a
 * fill colour as text on that colour's own tint, at 4.01 / 3.49 / 3.77 : 1.
 * See `web/design/tokens.md` § 2.2.
 */

const read = (rel: string) =>
  readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8");

const CHIP_SOURCE = read("./chip.tsx");
const GLOBALS = read("../../app/globals.css");

/** Every `--color-*` declared in the `@theme` block. */
function tokens(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const m of GLOBALS.matchAll(/--color-([a-z0-9-]+):\s*(#[0-9A-Fa-f]{6})/g)) {
    out[m[1]] = m[2].toUpperCase();
  }
  return out;
}

/** `variant: { good: "bg-x text-y", … }` → the class string per variant. */
function variantClasses(): Record<string, string> {
  const block = CHIP_SOURCE.match(/variant:\s*\{([\s\S]*?)\n {4}\}/);
  if (!block) throw new Error("could not locate the `variant` block in chip.tsx");
  const out: Record<string, string> = {};
  for (const m of block[1].matchAll(/^\s*([a-z]+):\s*"([^"]+)"/gm)) {
    out[m[1]] = m[2];
  }
  return out;
}

const srgb = (c: number) => {
  const s = c / 255;
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
};
const channels = (hex: string) =>
  [0, 2, 4].map((i) => parseInt(hex.slice(1 + i, 3 + i), 16));
const luminance = (hex: string) => {
  const [r, g, b] = channels(hex).map(srgb);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (fg: string, bg: string) => {
  const a = luminance(fg);
  const b = luminance(bg);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
};
/** sRGB alpha compositing, matching what the browser does for `bg-token/15`. */
const composite = (fg: string, bg: string, alpha: number) => {
  const f = channels(fg);
  const b = channels(bg);
  const mix = f.map((v, i) => Math.round(v * alpha + b[i] * (1 - alpha)));
  return `#${mix.map((v) => v.toString(16).padStart(2, "0")).join("").toUpperCase()}`;
};

/**
 * A chip can sit on either page surface. `background` is the darker of the
 * two, so it is the worst case for any variant using a translucent fill.
 */
const PARENT_SURFACES = ["background", "surface"] as const;

describe("Chip — WCAG AA contrast", () => {
  const T = tokens();
  const VARIANTS = variantClasses();

  it("declares the six variants the design spec lists", () => {
    expect(Object.keys(VARIANTS).sort()).toEqual(
      ["avoid", "caution", "good", "neutral", "premium", "warm"].sort(),
    );
  });

  it.each(Object.entries(VARIANTS))(
    "%s: text on fill clears 4.5:1",
    (name, classes) => {
      const fg = classes.match(/(?:^|\s)text-([a-z0-9-]+)/)?.[1];
      // `bg-advisory-caution/15` — capture the token and its optional alpha.
      const bgMatch = classes.match(/(?:^|\s)bg-([a-z0-9-]+?)(?:\/(\d+))?(?:\s|$)/);
      expect(fg, `${name}: no text- class`).toBeTruthy();
      expect(bgMatch, `${name}: no bg- class`).toBeTruthy();

      const fgHex = T[fg!];
      const bgHex = T[bgMatch![1]];
      expect(fgHex, `${name}: unknown token text-${fg}`).toBeTruthy();
      expect(bgHex, `${name}: unknown token bg-${bgMatch![1]}`).toBeTruthy();

      const alpha = bgMatch![2] ? Number(bgMatch![2]) / 100 : 1;

      for (const surface of PARENT_SURFACES) {
        const effectiveBg =
          alpha === 1 ? bgHex : composite(bgHex, T[surface], alpha);
        const ratio = contrast(fgHex, effectiveBg);
        expect(
          ratio,
          `${name} on ${surface}: ${fgHex} on ${effectiveBg} = ${ratio.toFixed(2)}:1`,
        ).toBeGreaterThanOrEqual(4.5);
      }
    },
  );

  it("uses an ink variant wherever the fill itself would fail as text", () => {
    // Regression pin for the specific bug: these three must not go back to
    // referencing the fill token directly.
    expect(VARIANTS.good).toContain("text-score-good-text");
    expect(VARIANTS.warm).toContain("text-score-acceptable-text");
    expect(VARIANTS.caution).toContain("text-advisory-caution-text");
    // …and `avoid` must NOT gain one it does not need.
    expect(VARIANTS.avoid).toContain("text-score-avoid");
  });
});
