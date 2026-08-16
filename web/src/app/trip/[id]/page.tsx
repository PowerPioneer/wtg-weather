import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { PageFooter, PageHeader } from "@/components/layout";
import {
  AssignClient,
  TripActionRail,
  TripDestinations,
  TripFooter,
  TripHero,
  TripParams,
} from "@/components/trip";
import { SITE_URL } from "@/lib/env";
import { getAgencyClients } from "@/lib/agency-server";
import { getSessionServer, isAgencyWorkspace } from "@/lib/session";
import { describeTrip, getOwnTrip } from "@/lib/trip-server";

type PageProps = {
  params: Promise<{ id: string }>;
};

/** Per-user and never cacheable: the trip belongs to whoever is asking. */
export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const trip = await getOwnTrip(id);
  if (!trip) return { title: "Trip not found", robots: { index: false } };
  return {
    title: `${trip.title} · Atlas Weather`,
    description: describeTrip(trip),
    // Never indexed. This is one user's private page, and the shared view has
    // its own route with its own (also unindexed) metadata.
    robots: { index: false, follow: false },
  };
}

/**
 * The owner's view of a saved trip.
 *
 * This used to call `findTripData(id)` — one hard-coded honeymoon in Peru — so
 * every real trip 404'd and the fixture one was readable by anybody. Now the
 * id resolves against `GET /api/trips/{id}`, which is owner-scoped: it answers
 * 404, not 403, for someone else's trip, and this page passes that straight
 * through. A trip you do not own is indistinguishable from one that is not
 * there, which is the point.
 *
 * The public read-only view lives at `/trip/share/[token]`, because sharing
 * grants a token rather than exposing an id.
 */
export default async function TripPage({ params }: PageProps) {
  const { id } = await params;

  const session = await getSessionServer();
  // Signed out is a different answer from "not yours": send them to sign in,
  // because after signing in this page may well be theirs.
  if (!session) redirect("/login");

  const trip = await getOwnTrip(id);
  if (!trip || !trip.id) notFound();

  // Agency members can file the trip against one of their clients. Fetched
  // only for them: a consumer has no organisation and no clients, so there is
  // nothing to ask the API for.
  const org = isAgencyWorkspace(session) ? session.org : null;
  const clients = org ? await getAgencyClients(org.id) : [];

  return (
    <>
      <PageHeader />
      <main className="flex-1">
        <TripHero trip={trip} mode="owner" />

        <div className="mx-auto grid w-full max-w-[1280px] gap-6 px-6 pb-14 pt-4 md:grid-cols-[1.55fr_1fr] md:px-12">
          <div className="flex flex-col gap-4">
            <TripParams
              preferences={trip.preferences}
              usesDefaults={trip.usesDefaultPreferences}
            />
            {trip.countrySlug && trip.monthSlug && (
              <Link
                href={`/${trip.countrySlug}/${trip.monthSlug}`}
                className="inline-flex h-10 items-center justify-center rounded-md border border-border bg-surface px-4 text-[13px] font-medium text-text hover:bg-surface-2"
              >
                Open {trip.countryName} in {trip.monthName} →
              </Link>
            )}
          </div>
          <div className="flex flex-col gap-4">
            <TripActionRail
              tripId={trip.id}
              title={trip.title}
              shareToken={trip.shareToken}
              siteUrl={SITE_URL}
            />
            {org && (
              <AssignClient
                tripId={trip.id}
                clientId={trip.clientId}
                clients={clients}
              />
            )}
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
