import type { Metadata } from "next";
import { NuqsAdapter } from "nuqs/adapters/next/app";

import "@fontsource-variable/ibm-plex-sans";
import "@fontsource/ibm-plex-serif/400.css";
import "@fontsource/ibm-plex-serif/500.css";
import "@fontsource/ibm-plex-serif/600.css";
import "@fontsource/ibm-plex-mono/400.css";
import "@fontsource/ibm-plex-mono/500.css";

import "./globals.css";
import { AnalyticsSwitch } from "@/components/analytics/analytics-switch";
import { GlitchTipClient } from "@/components/analytics/glitchtip-client";
import { UnitProvider } from "@/components/units";
import { SITE_URL } from "@/lib/env";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Where to Go for Great Weather",
    template: "%s · Atlas Weather",
  },
  description:
    "A travel-climate map. Ten years of ERA5 data and six-government safety advisories for every country, for every month.",
  applicationName: "Where to Go for Great Weather",
  openGraph: {
    type: "website",
    siteName: "Atlas Weather",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
  },
};

/**
 * Deliberately reads nothing per-request. A dynamic API here — `cookies()`,
 * `headers()` — opts every route in the app out of static generation, which is
 * how the country pages came to be server-rendered on demand despite declaring
 * `revalidate`. The analytics split that used to need the session now resolves
 * in the browser; see `AnalyticsSwitch`.
 *
 * `UnitProvider` is here for the same reason and resolves the same way: it
 * renders metric (what the server rendered) until it has read the visitor's
 * cookie in the browser. Wrapping `{children}` rather than being wrapped by it
 * keeps every page below a Server Component.
 */
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        <GlitchTipClient />
        <AnalyticsSwitch />
        <NuqsAdapter>
          <UnitProvider>{children}</UnitProvider>
        </NuqsAdapter>
      </body>
    </html>
  );
}
