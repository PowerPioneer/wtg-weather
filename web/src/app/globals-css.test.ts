// @vitest-environment node
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * The display serif's metric-matched fallbacks in `globals.css`.
 *
 * They exist to stop the hero heading re-wrapping when IBM Plex Serif swaps
 * in (see the comment above them), and they only work while their numbers
 * match the font files actually shipped. An @fontsource upgrade that changes
 * Plex's metrics would leave stale overrides behind and silently bring the
 * layout shift back, so this recomputes them the way next/font does and
 * compares.
 *
 * The fallbacks' own average widths are constants rather than files because
 * the CI runner has neither font installed. Times New Roman's is next/font's
 * own `DEFAULT_SERIF_FONT`; Georgia's was measured with the same
 * letter-frequency string from Windows' georgia.ttf.
 */

type Glyph = { advanceWidth: number };
type Font = {
  unitsPerEm: number;
  ascent: number;
  descent: number;
  lineGap: number;
  glyphsForString: (s: string) => Glyph[];
};

const require_ = createRequire(import.meta.url);
const fontkitModule = require_(
  "next/dist/compiled/@next/font/dist/fontkit",
) as { default: ((b: Buffer) => Font) & { default?: (b: Buffer) => Font } };
const openFont = fontkitModule.default.default ?? fontkitModule.default;

const AVG_CHARS = "aaabcdeeeefghiijklmnnoopqrrssttuvwxyz      ";
const FALLBACKS = {
  Georgia: { avgWidth: 928.3953488372093, unitsPerEm: 2048 },
  Times: { avgWidth: 854.3953488372093, unitsPerEm: 2048 },
} as const;

const css = readFileSync(join(process.cwd(), "src", "app", "globals.css"), "utf8");

function pct(v: number): string {
  return `${Math.abs(v * 100).toFixed(2)}%`;
}

function expected(weight: string, fallback: keyof typeof FALLBACKS) {
  const file = join(
    process.cwd(),
    "node_modules",
    "@fontsource",
    "ibm-plex-serif",
    "files",
    `ibm-plex-serif-latin-${weight}-normal.woff2`,
  );
  const plex = openFont(readFileSync(file));
  const widths = plex.glyphsForString(AVG_CHARS).map((g) => g.advanceWidth);
  const plexAvg = widths.reduce((a, b) => a + b, 0) / widths.length;
  const fb = FALLBACKS[fallback];
  const sizeAdjust = plexAvg / plex.unitsPerEm / (fb.avgWidth / fb.unitsPerEm);
  return {
    "size-adjust": pct(sizeAdjust),
    "ascent-override": pct(plex.ascent / (plex.unitsPerEm * sizeAdjust)),
    "descent-override": pct(plex.descent / (plex.unitsPerEm * sizeAdjust)),
  };
}

function declared(weight: string, fallback: keyof typeof FALLBACKS) {
  const faces = css.match(/@font-face\s*{[^}]*}/g) ?? [];
  const face = faces.find(
    (f) =>
      f.includes(`"IBM Plex Serif Fallback ${fallback}"`) &&
      f.includes(`font-weight: ${weight};`),
  );
  if (!face) return undefined;
  const read = (prop: string) =>
    face.match(new RegExp(`${prop}:\\s*([0-9.]+%)`))?.[1];
  return {
    "size-adjust": read("size-adjust"),
    "ascent-override": read("ascent-override"),
    "descent-override": read("descent-override"),
  };
}

describe("display serif fallback faces", () => {
  for (const fallback of ["Georgia", "Times"] as const) {
    for (const weight of ["400", "500", "600"]) {
      it(`${fallback} ${weight} matches IBM Plex Serif's shipped metrics`, () => {
        expect(declared(weight, fallback)).toEqual(expected(weight, fallback));
      });
    }
  }

  it("sit in the display stack directly after IBM Plex Serif", () => {
    expect(css).toMatch(
      /--font-display:\s*'IBM Plex Serif',\s*'IBM Plex Serif Fallback Georgia',\s*'IBM Plex Serif Fallback Times',/,
    );
  });
});
