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
import { SITE_URL } from "@/lib/env";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Where to Go for Great Weather",
    template: "%s · Atlas Weather",
  },
  description:
    "A travel-climate map. Ten years of ERA5 data and five-government safety advisories for every country, for every month.",
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
        <NuqsAdapter>{children}</NuqsAdapter>
      </body>
    </html>
  );
}
