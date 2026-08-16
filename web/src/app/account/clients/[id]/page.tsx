import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { AccountSidebar, ClientNotes, type SidebarItem } from "@/components/account";
import { PageFooter, PageHeader } from "@/components/layout";
import { agencySections } from "@/lib/account-sections";
import { getAgencyAccount, getClientRecord } from "@/lib/agency-server";
import { cn } from "@/lib/cn";
import {
  displayName,
  getSessionServer,
  isAgencyWorkspace,
  planLabel,
} from "@/lib/session";
import type { ClientRecord, ClientTrip } from "@/lib/types";

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
};

const TABS = ["profile", "trips"] as const;
type TabId = (typeof TABS)[number];

const TAB_LABEL: Record<TabId, string> = {
  profile: "Profile",
  trips: "Trips",
};

/** Per-user and per-org; nothing about it can be cached or prerendered. */
export const dynamic = "force-dynamic";

/**
 * Metadata deliberately says nothing about *which* client.
 *
 * The title is the one part of the page a browser keeps outside the session —
 * in history, in tab titles, in a screenshot — and the record is somebody
 * else's personal data. `robots: noindex` is belt and braces on a route that
 * 404s without a session anyway.
 */
export const metadata: Metadata = {
  title: "Client · Atlas Weather",
  robots: { index: false },
};

export default async function ClientDetailPage({ params, searchParams }: PageProps) {
  const session = await getSessionServer();
  if (!session) redirect("/login");
  // Membership, not plan: an agent on a free-plan agency still works clients.
  if (!isAgencyWorkspace(session) || !session.org) notFound();

  const [{ id }, { tab }] = await Promise.all([params, searchParams]);

  // Scoped by the caller's org, not by the id in the URL. The fixture version
  // resolved the record from the URL alone, so any agency user could read any
  // client by guessing an id — see `lib/agency-server.ts`.
  const [client, agency] = await Promise.all([
    getClientRecord(session.org.id, id),
    getAgencyAccount(session.org.id, session.id),
  ]);
  if (!client) notFound();
  if (!agency) redirect("/login");

  const activeTab: TabId = TABS.includes(tab as TabId) ? (tab as TabId) : "profile";

  const sections: readonly SidebarItem[] = agencySections(session.role, {
    clients: agency.clients.length,
    team: agency.team.length,
  });

  return (
    <>
      <PageHeader />
      <main className="flex-1 bg-surface">
        <div className="border-b border-border bg-[#FCFBF8] px-6 py-2 font-mono text-[11px] text-text-subtle md:px-12">
          <div className="mx-auto flex max-w-[1280px] flex-wrap justify-between gap-2">
            <div>
              org <span className="font-semibold text-text">{session.org.name}</span> ·{" "}
              {planLabel(session.plan)}
            </div>
            <div>
              signed in as {displayName(session)} ({session.role ?? "member"}) ·{" "}
              {agency.seatsUsed}/{agency.seatCap} seats
            </div>
          </div>
        </div>

        <div className="mx-auto grid w-full max-w-[1280px] gap-0 border-x border-border bg-surface md:grid-cols-[240px_1fr]">
          <div>
            <AccountSidebar
              session={session}
              sections={sections}
              activeId="clients"
              basePath="/account"
              planLabel={planLabel(session.plan)}
            />
            <div className="mx-3 mt-4 rounded-sm border border-border bg-white p-2.5">
              <div className="mb-1 font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-text-subtle">
                Viewing client
              </div>
              <div className="font-display text-[13px] font-medium">{client.name}</div>
              <Link
                href="/account?s=clients"
                className="mt-1 inline-block text-[11px] text-accent hover:underline"
              >
                ← All clients
              </Link>
            </div>
          </div>

          <section>
            <ClientHeader client={client} activeTab={activeTab} />
            <div className="px-6 py-8 md:px-10 md:py-10">
              {activeTab === "profile" ? (
                <ProfileTab client={client} orgId={session.org.id} />
              ) : (
                <TripsTab client={client} />
              )}
            </div>
          </section>
        </div>
      </main>
      <PageFooter />
    </>
  );
}

function ClientHeader({
  client,
  activeTab,
}: {
  client: ClientRecord;
  activeTab: TabId;
}) {
  const initial = client.name.trim()[0]?.toUpperCase() ?? "?";
  return (
    <div className="border-b border-border bg-surface px-6 py-6 md:px-10">
      <nav aria-label="Breadcrumb" className="mb-4">
        <ol className="flex list-none flex-wrap items-center gap-1.5 p-0 font-mono text-[11px] text-text-muted">
          <li>
            <Link href="/account" className="hover:text-text">
              Account
            </Link>
          </li>
          <li aria-hidden="true" className="text-border-strong">
            ›
          </li>
          <li>
            <Link href="/account?s=clients" className="hover:text-text">
              Clients
            </Link>
          </li>
          <li aria-hidden="true" className="text-border-strong">
            ›
          </li>
          <li className="text-text">{client.name}</li>
        </ol>
      </nav>

      <div className="flex flex-wrap items-start gap-6">
        <div
          aria-hidden="true"
          className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-sm border border-accent bg-[#FBF3DC] font-display text-[22px] font-medium tracking-[-0.02em] text-accent"
        >
          {initial}
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="m-0 font-display text-[28px] font-normal tracking-[-0.012em] text-text md:text-[30px]">
            {client.name}
          </h1>

          <div className="mt-2.5 flex flex-wrap gap-4 text-[12.5px] text-text-muted">
            {/* Only the contact details the record carries. The fixture printed
                a phone number and a city for a client whose row has neither
                column — nothing collected them, so nothing can render them. */}
            {client.email ? (
              <a
                href={`mailto:${client.email}`}
                className="font-mono text-[11.5px] text-text hover:underline"
              >
                {client.email}
              </a>
            ) : (
              <span className="font-mono text-[11.5px] text-text-subtle">
                No email on file
              </span>
            )}
          </div>

          <p className="mt-3.5 inline-flex max-w-[640px] items-start gap-2.5 rounded-sm border border-accent bg-[#FBF3DC] px-3 py-2 text-[11.5px] text-text">
            <span>
              <strong className="font-semibold">Managed record.</strong>{" "}
              {client.name} does not have a login — this profile exists so your
              team can plan on their behalf. Email them a shared trip link when
              you&apos;re ready.
            </span>
          </p>
        </div>
      </div>

      <nav aria-label="Client sections" className="-mb-px mt-6 flex gap-1">
        {TABS.map((id) => {
          const active = id === activeTab;
          const href =
            id === "profile"
              ? `/account/clients/${client.id}`
              : `/account/clients/${client.id}?tab=${id}`;
          const sub =
            id === "profile"
              ? `${client.notes.length} note${client.notes.length === 1 ? "" : "s"}`
              : `${client.trips.length} assigned`;
          return (
            <Link
              key={id}
              href={href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex items-baseline gap-2 border-b-2 px-4 py-2.5 text-[13px] no-underline",
                active
                  ? "border-accent text-text"
                  : "border-transparent text-text-muted hover:text-text",
              )}
            >
              <span className="font-medium">{TAB_LABEL[id]}</span>
              <span className="font-mono text-[10.5px] text-text-subtle">{sub}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

function ProfileTab({ client, orgId }: { client: ClientRecord; orgId: string }) {
  return (
    <div className="grid gap-7 md:grid-cols-[1fr_1.1fr]">
      <div>
        <Eyebrow>Record</Eyebrow>
        <dl className="mt-2 overflow-hidden rounded-md border border-border bg-surface">
          <Row label="Name" value={client.name} />
          <Row label="Email" value={client.email ?? "—"} mono />
          <Row
            label="Created"
            value={
              client.createdAt
                ? new Date(client.createdAt).toLocaleDateString("en-GB", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })
                : "—"
            }
            mono
          />
          <Row label="Assigned trips" value={String(client.trips.length)} mono />
        </dl>

        {client.profileNotes && (
          <div className="mt-7">
            <Eyebrow>Profile note</Eyebrow>
            <p className="mt-2 whitespace-pre-wrap rounded-md border border-border bg-surface px-4 py-3 text-[12.5px] leading-[1.6] text-text">
              {client.profileNotes}
            </p>
          </div>
        )}
      </div>

      <div>
        <div className="mb-2.5">
          <Eyebrow>Notes · shared across the team</Eyebrow>
        </div>
        <ClientNotes orgId={orgId} clientId={client.id} initial={client.notes} />
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div
      className="grid items-center gap-3 border-b border-border px-4 py-3 last:border-b-0"
      style={{ gridTemplateColumns: "140px 1fr" }}
    >
      <dt className="font-mono text-[10.5px] uppercase tracking-[0.12em] text-text-subtle">
        {label}
      </dt>
      <dd
        className={cn(
          "m-0 text-[12.5px] text-text",
          mono && "font-mono text-[11.5px]",
        )}
      >
        {value}
      </dd>
    </div>
  );
}

function TripsTab({ client }: { client: ClientRecord }) {
  if (client.trips.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-border-strong bg-[#FCFBF8] px-8 py-12 text-center">
        <div className="font-display text-[22px] font-medium tracking-[-0.005em] text-text">
          No trips assigned yet
        </div>
        <p className="mx-auto mt-2 max-w-[460px] text-[13px] leading-[1.55] text-text-muted">
          Build a trip from the map or a country page, then assign it to{" "}
          {client.name} from the trip itself.
        </p>
        <Link
          href="/map"
          className="mt-5 inline-block rounded-sm bg-primary px-3.5 py-2 text-[12.5px] font-medium text-primary-foreground hover:bg-primary/90"
        >
          Open the map
        </Link>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] border-collapse overflow-hidden rounded-md border border-border bg-surface text-left">
        <caption className="sr-only">Trips assigned to {client.name}</caption>
        <thead>
          <tr className="border-b border-border bg-[#FCFBF8] font-mono text-[10.5px] uppercase tracking-[0.1em] text-text-subtle">
            <th scope="col" className="px-4 py-2.5 font-medium">
              Trip
            </th>
            <th scope="col" className="px-4 py-2.5 font-medium">
              Country
            </th>
            <th scope="col" className="px-4 py-2.5 font-medium">
              Month
            </th>
            <th scope="col" className="px-4 py-2.5 font-medium">
              Agent
            </th>
            <th scope="col" className="px-4 py-2.5 font-medium">
              Shared
            </th>
          </tr>
        </thead>
        <tbody>
          {client.trips.map((t) => (
            <TripRow key={t.id} trip={t} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TripRow({ trip }: { trip: ClientTrip }) {
  return (
    <tr className="border-b border-border text-[12.5px] last:border-b-0">
      <td className="px-4 py-3">
        {/* The link is the owner's route; a colleague following it meets a 404
            from the API, which is the correct answer — a trip belongs to the
            agent who wrote it. */}
        <Link
          href={`/trip/${trip.id}`}
          className="font-display text-[15px] font-medium tracking-[-0.002em] text-text hover:underline"
        >
          {trip.title}
        </Link>
      </td>
      <td className="px-4 py-3 text-text">
        {trip.countrySlug && trip.countryName ? (
          <Link href={`/${trip.countrySlug}`} className="hover:underline">
            {trip.countryName}
          </Link>
        ) : (
          "—"
        )}
      </td>
      <td className="px-4 py-3 font-mono text-text">{trip.monthName ?? "—"}</td>
      <td className="px-4 py-3 text-text-muted">{trip.agent}</td>
      <td className="px-4 py-3 font-mono text-[10.5px] uppercase tracking-[0.1em]">
        {trip.shared ? (
          <span className="text-score-perfect">● shared</span>
        ) : (
          <span className="text-text-subtle">not shared</span>
        )}
      </td>
    </tr>
  );
}

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <div className="font-mono text-[10.5px] font-semibold uppercase tracking-[0.14em] text-text-subtle">
      {children}
    </div>
  );
}
