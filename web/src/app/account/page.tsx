import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import {
  AccountSidebar,
  AgencyBilling,
  AgencyBranding,
  AgencyClients,
  AgencyOverview,
  AgencyTeam,
  ConsumerAlerts,
  ConsumerBilling,
  ConsumerFavourites,
  ConsumerOverview,
  ConsumerSettings,
  ConsumerTrips,
  type SidebarItem,
} from "@/components/account";
import { PageFooter, PageHeader } from "@/components/layout";
import {
  agencySections,
  resolveAgencySection,
  type AgencySectionId,
} from "@/lib/account-sections";
import { getConsumerAccount } from "@/lib/account-server";
import { getAgencyAccount } from "@/lib/agency-server";
import { getBillingSummary, type BillingSummary } from "@/lib/billing-server";
import { getSessionServer, isAgencyWorkspace, planLabel } from "@/lib/session";
import type {
  AgencyAccount,
  ConsumerAccount,
  SessionUser,
} from "@/lib/types";

export const metadata: Metadata = {
  title: "Account · Atlas Weather",
  description: "Manage your trips, favourites, alerts, and billing.",
  robots: { index: false },
};

type PageProps = {
  searchParams: Promise<{ s?: string }>;
};

const CONSUMER_SECTIONS = [
  "overview",
  "trips",
  "favourites",
  "alerts",
  "settings",
  "billing",
] as const;

type ConsumerSectionId = (typeof CONSUMER_SECTIONS)[number];

/** The account page is per-user; nothing about it can be cached or prerendered. */
export const dynamic = "force-dynamic";

export default async function AccountPage({ searchParams }: PageProps) {
  const session = await getSessionServer();
  if (!session) redirect("/login");

  const { s } = await searchParams;

  // Membership decides the shell, not the plan (WS-C item 5). An agency that
  // has finished the wizard but not yet paid is on the free plan and still an
  // agency — and its dashboard is where the upgrade path lives, so gating the
  // dashboard on the plan would hide the way to buy the plan. A premium
  // consumer's single-seat organization is a wallet, not a workspace, and
  // `isAgencyWorkspace` is what tells the two apart.
  if (isAgencyWorkspace(session)) {
    return <AgencyAccountPage session={session} activeParam={s} />;
  }

  // Null means the API rejected the session between the `/api/me` read above
  // and this one — expired mid-render, or revoked. Sign in again rather than
  // rendering an empty account to someone who has three trips.
  // Issued together: the billing read is a second round trip to the API and
  // there is no reason for it to queue behind the trips list.
  const [account, billing] = await Promise.all([
    getConsumerAccount(),
    getBillingSummary(),
  ]);
  if (!account) redirect("/login");

  return (
    <ConsumerAccountPage
      session={session}
      account={account}
      billing={billing}
      activeParam={s}
    />
  );
}

function ConsumerAccountPage({
  session,
  account,
  billing,
  activeParam,
}: {
  session: SessionUser;
  account: ConsumerAccount;
  billing: BillingSummary | null;
  activeParam: string | undefined;
}) {
  const activeId: ConsumerSectionId = CONSUMER_SECTIONS.includes(
    activeParam as ConsumerSectionId,
  )
    ? (activeParam as ConsumerSectionId)
    : "overview";

  const sections: readonly SidebarItem[] = [
    { id: "overview", label: "Overview" },
    { id: "trips", label: "Trips", count: account.trips.length },
    {
      id: "favourites",
      label: "Favourites",
      count: account.favourites.length,
    },
    { id: "alerts", label: "Alerts", count: account.alerts.length },
    { id: "settings", label: "Settings" },
    { id: "billing", label: "Billing" },
  ];

  return (
    <AccountShell
      session={session}
      sections={sections}
      activeId={activeId}
      basePath="/account"
    >
      {renderConsumerSection(activeId, session, account, billing)}
    </AccountShell>
  );
}

function renderConsumerSection(
  id: ConsumerSectionId,
  session: SessionUser,
  account: ConsumerAccount,
  billing: BillingSummary | null,
) {
  switch (id) {
    case "overview":
      return <ConsumerOverview session={session} account={account} billing={billing} />;
    case "trips":
      return <ConsumerTrips session={session} account={account} />;
    case "favourites":
      return <ConsumerFavourites session={session} account={account} />;
    case "alerts":
      return <ConsumerAlerts session={session} account={account} />;
    case "settings":
      return <ConsumerSettings session={session} account={account} />;
    case "billing":
      return (
        <ConsumerBilling session={session} account={account} billing={billing} />
      );
  }
}

async function AgencyAccountPage({
  session,
  activeParam,
}: {
  session: SessionUser;
  activeParam: string | undefined;
}) {
  const org = session.org;
  if (!org) notFound();
  const [account, billing] = await Promise.all([
    // The caller's id so the team table can mark their own row — the API does
    // not stamp it, because "which of these is you" is a question only the
    // caller's own session answers.
    getAgencyAccount(org.id, session.id),
    getBillingSummary(),
  ]);
  // Null means the API refused the read between the `/api/me` above and this
  // one. Sign in again rather than rendering an empty organisation to somebody
  // who has a team.
  if (!account) redirect("/login");

  const activeId = resolveAgencySection(activeParam, session.role);
  const sections: readonly SidebarItem[] = agencySections(session.role, {
    clients: account.clients.length,
    team: account.team.length,
  });

  return (
    <AccountShell
      session={session}
      sections={sections}
      activeId={activeId}
      basePath="/account"
    >
      {renderAgencySection(activeId, session, account, billing)}
    </AccountShell>
  );
}

function renderAgencySection(
  id: AgencySectionId,
  session: SessionUser,
  account: AgencyAccount,
  billing: BillingSummary | null,
) {
  switch (id) {
    case "overview":
      return <AgencyOverview session={session} account={account} />;
    case "clients":
      return <AgencyClients session={session} account={account} />;
    case "team":
      return <AgencyTeam session={session} account={account} />;
    case "branding":
      return <AgencyBranding />;
    case "billing":
      // Reachable only for owner/admin — `resolveAgencySection` sends an agent
      // to the overview instead. The API refuses them regardless.
      return (
        <AgencyBilling session={session} account={account} billing={billing} />
      );
  }
}

function AccountShell({
  session,
  sections,
  activeId,
  basePath,
  children,
}: {
  session: SessionUser;
  sections: readonly SidebarItem[];
  activeId: string;
  basePath: string;
  children: React.ReactNode;
}) {
  return (
    <>
      <PageHeader />
      <main className="flex-1 bg-surface">
        <div className="mx-auto grid w-full max-w-[1280px] gap-0 border-x border-border bg-surface md:grid-cols-[240px_1fr]">
          <AccountSidebar
            session={session}
            sections={sections}
            activeId={activeId}
            basePath={basePath}
            planLabel={planLabel(session.plan)}
          />
          <section className="px-6 py-8 md:px-10 md:py-10">{children}</section>
        </div>
      </main>
      <PageFooter />
    </>
  );
}
