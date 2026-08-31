import { createTV } from "tailwind-variants";

/**
 * Every font-size token in the `--text-*` namespace of `app/globals.css`.
 *
 * `tv()` runs tailwind-merge, and tailwind-merge has to decide whether a
 * `text-<x>` class is a font size or a text colour. It only knows the stock
 * Tailwind scale, so it read `text-body-sm` as a *colour* and dropped the
 * colour that came before it — a primary Button rendered navy label on navy
 * fill, invisible. Registering the scale here puts each class in the right
 * group, so a size and a colour stop competing.
 *
 * This list must match `globals.css`; `tv.test.ts` pins the two together.
 */
export const FONT_SIZE_TOKENS = [
  "display-xl",
  "display-lg",
  "h1",
  "h2",
  "h3",
  "h4",
  "body",
  "body-sm",
  "caption",
  "label",
  "code",
  "figure",
] as const;

/**
 * The `tv` every component must use. The bare `tv` from `tailwind-variants`
 * carries the default tailwind-merge config and will eat colours again.
 */
export const tv = createTV({
  twMergeConfig: {
    extend: { theme: { text: [...FONT_SIZE_TOKENS] } },
  },
});

export type { VariantProps } from "tailwind-variants";
