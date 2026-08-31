import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Design reference material — not production code, Tailwind v3 JSX from Claude Design.
    "design/**",
  ]),
  {
    // `tv()` runs tailwind-merge, which cannot tell this theme's font-size
    // tokens (`text-body-sm`, `text-h3`, …) from a colour and silently drops
    // whichever it decides lost — which is how every primary Button came to
    // render its label in its own background colour. `lib/tv.ts` is the same
    // `tv` with the scale registered; nothing else may reach past it.
    files: ["src/**/*.{ts,tsx}"],
    ignores: ["src/lib/tv.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "tailwind-variants",
              message:
                "Import tv from '@/lib/tv' — the bare one drops colours that collide with a font-size token.",
            },
          ],
        },
      ],
    },
  },
]);

export default eslintConfig;
