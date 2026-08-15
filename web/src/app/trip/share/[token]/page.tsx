import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { PageFooter, PageHeader } from "@/components/layout";
import { TripDestinations, TripFooter, TripHero, TripParams } from "@/components/trip";
import { describeTrip, getSharedTrip } from "@/lib/trip-server";

type PageProps = {
  params: Promise<{ token: string }>;
};

/**
 * The public, read-only view of a shared trip.
 *
 * A separate route from `/trip/[id]` on purpose. The old page decided owner vs.
 * public from `?view=public` on the *same* URL, which meant the only thing
 * standing between a stranger and a trip was a query parameter they controlled
 * — and it read the trip from a fixture that belonged to nobody in particular.
 *
 * Here the token in the path is the entire authorisation, it is a secret
 * distinct from the trip id, and the payload behind it (`TripPublicRead`)
 * carries no id and no client — so nothing on this page can be turned into an
 * owner-scoped request. Revoking makes the URL 404 immediately.
 */
export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { token } = await params;
  const trip = await getSharedTrip(token);
  if (!trip) return { title: "Trip not found", robots: { index: false } };
  return {
    title: `${trip.title} · Atlas Weather`,
    description: describeTrip(trip),
    openGraph: { title: trip.title, description: describeTrip(trip), type: "article" },
    // Not indexed: the owner shared a link with particular people, not with
    // search engines, and the URL is a secret.
    robots: { index: false, follow: false },
  };
}

export default async function SharedTripPage({ params }: PageProps) {
  const { token } = await params;
  const trip = await getSharedTrip(token);
  // A revoked link and a link that never existed get the same answer.
  if (!trip) notFound();

  return (
    <>
      <PageHeader />
      <main className="flex-1">
        <TripHero trip={trip} mode="public" />

        <div className="mx-auto grid w-full max-w-[1280px] gap-6 px-6 pb-14 pt-4 md:grid-cols-[1.55fr_1fr] md:px-12">
          <TripParams
            preferences={trip.preferences}
            usesDefaults={trip.usesDefaultPreferences}
          />
          {/* No owner rail. Nothing on this page mutates anything. */}
          <div className="rounded-md border border-dashed border-border-strong bg-[#FCFBF8] px-5 py-4">
            <div className="font-mono text-[10.5px] font-semibold uppercase tracking-[0.16em] text-text-muted">
              Read-only
            </div>
            <p className="mt-2 text-[13px] leading-[1.55] text-text-muted">
              You&apos;re viewing a trip someone shared with you. Build your own
              from a country, a month, and the weather you want.
            </p>
            <Link
              href="/map"
              className="mt-3 inline-flex h-9 items-center rounded-sm bg-primary px-3.5 text-[12.5px] font-medium text-primary-foreground hover:bg-primary-hover"
            >
              Open the map
            </Link>
          </div>
        </div>

        <TripDestinations
          destinations={trip.destinations}
          monthName={trip.monthName}
        />
        <TripFooter monthName={trip.monthName} />
      </main>
      <PageFooter />
    </>
  );
}
