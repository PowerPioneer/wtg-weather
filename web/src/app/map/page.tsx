import type { Metadata } from "next";
import { Suspense } from "react";

import { PageHeader } from "@/components/layout";
import { routableCountries } from "@/lib/country-routes";
import { getEntitlement, getSessionServer } from "@/lib/session";

import { MapExperience } from "./map-experience";

export const metadata: Metadata = {
  title: "Map · Where to Go for Great Weather",
  description:
    "Explore ten years of climate data and five-government safety advisories on an interactive world map.",
};

// Map bundle is heavy (~250KB gzipped). Keep the RSC light and let
// `MapExperience` — the Client Component — pull in MapLibre lazily.
export default async function MapPage() {
  const session = await getSessionServer();
  const entitlement = getEntitlement(session);
  // Which country pages exist. Resolved on the server because the gate reads a
  // server-only env var — passing the answer down keeps the panel's CTA honest
  // without the client having to guess at the data path's state.
  const publishedCountrySlugs = routableCountries().map((c) => c.slug);

  return (
    <>
      <PageHeader activePath="/map" />
      <main className="relative flex-1 overflow-hidden">
        <Suspense fallback={<MapLoading />}>
          <MapExperience
            isPremium={entitlement.premium}
            publishedCountrySlugs={publishedCountrySlugs}
          />
        </Suspense>
      </main>
    </>
  );
}

function MapLoading() {
  return (
    <div
      aria-hidden="true"
      className="flex h-[calc(100vh-var(--size-header,56px))] items-center justify-center bg-surface-sunken"
    >
      <div className="flex flex-col items-center gap-3 text-text-muted">
        <div className="h-1 w-24 overflow-hidden rounded-full bg-border">
          <div className="h-full w-1/3 animate-pulse bg-primary" />
        </div>
        <span className="font-mono text-[10.5px] uppercase tracking-[0.14em]">Loading map</span>
      </div>
    </div>
  );
}
