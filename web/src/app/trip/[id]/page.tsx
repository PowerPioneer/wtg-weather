import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { PageFooter, PageHeader } from "@/components/layout";
import {
  TripActionRail,
  TripDestinations,
  TripFooter,
  TripHero,
  TripMap,
  TripParams,
} from "@/components/trip";
import { findTripData } from "@/lib/mock-data";
import { canonical } from "@/lib/seo";
import { getSessionServer } from "@/lib/session";
import type { TripData } from "@/lib/types";

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ view?: string }>;
};

async function loadTrip(id: string): Promise<TripData | null> {
  // Phase 5.5 replaces this with `serverFetch('/v1/trips/:id')` once the API
  // is live. Today the fixtures return the one mock trip.
  return findTripData(id);
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const trip = await loadTrip(id);
  if (!trip) return { title: "Trip not found" };
  const title = `${trip.title} · Atlas Weather`;
  return {
    title,
    description: `Climate-matched trip to ${trip.country} for ${trip.months.join(" & ")} ${trip.year}. ${trip.destinations.length} regions ranked by weather fit.`,
    alternates: { canonical: canonical(`/trip/${trip.id}`) },
    openGraph: {
      title,
      description: `Overall fit ${trip.score} · ${trip.destinations.length} matching destinations`,
      type: "article",
    },
    robots: { index: false },
  };
}

export default async function TripPage({ params, searchParams }: PageProps) {
  const [{ id }, { view }] = await Promise.all([params, searchParams]);
  const trip = await loadTrip(id);
  if (!trip) notFound();

  const session = await getSessionServer();
  // Viewer is the owner when the session id matches AND they haven't forced
  // `?view=public` (useful for the owner previewing the shared link).
  const isOwner = view !== "public" && session?.id === trip.ownerUserId;
  const mode: "owner" | "public" = isOwner ? "owner" : "public";
  const agencyOwner = trip.owner.kind === "agency" ? trip.owner : null;

  return (
    <>
      <PageHeader />
      <main className="flex-1">
        <TripHero trip={trip} mode={mode} />

        <div className="mx-auto grid w-full max-w-[1280px] gap-6 px-6 pb-14 pt-4 md:grid-cols-[1.55fr_1fr] md:px-12">
          <TripMap tripId={trip.id} />
          <div className="flex flex-col gap-4">
            {isOwner && <TripActionRail shareUrl={trip.shareUrl} />}
            <TripParams
              free={trip.prefs.free}
              premium={trip.prefs.premium}
              mode={mode}
              owner={agencyOwner}
            />
          </div>
        </div>

        <TripDestinations countrySlug={trip.countrySlug} destinations={trip.destinations} />

        {!isOwner && (
          <div className="mx-auto w-full max-w-[1280px] px-6 pb-16 md:px-12">
            <div className="flex flex-col items-start justify-between gap-6 rounded-lg bg-primary p-10 text-primary-foreground md:flex-row md:items-center">
              <div className="max-w-[560px]">
                <div className="font-mono text-[10.5px] font-semibold uppercase tracking-[0.16em] text-[#E0C98A]">
                  Plan your own trip
                </div>
                <div className="mt-2 font-display text-[26px] font-normal leading-[1.15] tracking-[-0.012em] md:text-[30px]">
                  Like this layout? Build your own from a country, a month, and the weather you want. Free.
                </div>
              </div>
              <div className="flex flex-shrink-0 gap-2.5">
                <Link
                  href="/map"
                  className="rounded-md bg-[#E0C98A] px-5 py-3 text-[14px] font-semibold text-primary hover:brightness-95"
                >
                  Open the map
                </Link>
                <Link
                  href="/signup"
                  className="rounded-md border border-white/30 px-5 py-3 text-[14px] font-medium hover:bg-white/10"
                >
                  Create account
                </Link>
              </div>
            </div>
          </div>
        )}

        <TripFooter trip={trip} />
      </main>
      <PageFooter />
    </>
  );
}
