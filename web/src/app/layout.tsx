import type { Metadata } from "next";
import { NuqsAdapter } from "nuqs/adapters/next/app";

import "@fontsource-variable/ibm-plex-sans";
import "@fontsource/ibm-plex-serif/400.css";
import "@fontsource/ibm-plex-serif/500.css";
import "@fontsource/ibm-plex-serif/600.css";
import "@fontsource/ibm-plex-mono/400.css";
import "@fontsource/ibm-plex-mono/500.css";

import "./globals.css";
import { GlitchTipClient } from "@/components/analytics/glitchtip-client";
import { PlausibleScript } from "@/components/analytics/plausible-script";
import { PostHogProvider } from "@/components/analytics/posthog-provider";
import { SITE_URL } from "@/lib/env";
import { getSessionServer } from "@/lib/session";

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

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await getSessionServer();

  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        <GlitchTipClient />
        {session ? (
          <PostHogProvider
            user={{
              id: session.id,
              plan: session.plan,
              role: session.role,
              orgId: session.org?.id,
            }}
          />
        ) : (
          <PlausibleScript />
        )}
        <NuqsAdapter>{children}</NuqsAdapter>
      </body>
    </html>
  );
}
