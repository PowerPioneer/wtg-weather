import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import {
  AccountSidebar,
  AgencyActivity,
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
  findAgencyAccount,
  findConsumerAccount,
} from "@/lib/mock-data";
import { getEntitlement, getSessionServer } from "@/lib/session";
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

const AGENCY_SECTIONS = [
  "overview",
  "clients",
  "team",
  "activity",
  "branding",
  "billing",
] as const;

type ConsumerSectionId = (typeof CONSUMER_SECTIONS)[number];
type AgencySectionId = (typeof AGENCY_SECTIONS)[number];

const PLAN_LABEL: Record<SessionUser["plan"], string> = {
  free: "Free",
  premium: "Premium",
  agency_starter: "Agency · Starter",
  agency_pro: "Agency · Pro",
  agency_enterprise: "Agency · Enterprise",
};

export default async function AccountPage({ searchParams }: PageProps) {
  const session = await getSessionServer();
  if (!session) redirect("/signin");

  const entitlement = getEntitlement(session);
  const { s } = await searchParams;

  if (entitlement.agency) {
    return <AgencyAccountPage session={session} activeParam={s} />;
  }
  return <ConsumerAccountPage session={session} activeParam={s} />;
}

function ConsumerAccountPage({
  session,
  activeParam,
}: {
  session: SessionUser;
  activeParam: string | undefined;
}) {
  const account = findConsumerAccount(session.id);
  if (!account) notFound();

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
      {renderConsumerSection(activeId, session, account)}
    </AccountShell>
  );
}

function renderConsumerSection(
  id: ConsumerSectionId,
  session: SessionUser,
  account: ConsumerAccount,
) {
  switch (id) {
    case "overview":
      return <ConsumerOverview session={session} account={account} />;
    case "trips":
      return <ConsumerTrips session={session} account={account} />;
    case "favourites":
      return <ConsumerFavourites session={session} account={account} />;
    case "alerts":
      return <ConsumerAlerts session={session} account={account} />;
    case "settings":
      return <ConsumerSettings session={session} account={account} />;
    case "billing":
      return <ConsumerBilling session={session} account={account} />;
  }
}

function AgencyAccountPage({
  session,
  activeParam,
}: {
  session: SessionUser;
  activeParam: string | undefined;
}) {
  const org = session.org;
  if (!org) notFound();
  const account = findAgencyAccount(org.id);
  if (!account) notFound();

  const activeId: AgencySectionId = AGENCY_SECTIONS.includes(
    activeParam as AgencySectionId,
  )
    ? (activeParam as AgencySectionId)
    : "overview";

  const sections: readonly SidebarItem[] = [
    { id: "overview", label: "Overview" },
    { id: "clients", label: "Clients", count: account.clients.length },
    { id: "team", label: "Team", count: account.team.length },
    { id: "activity", label: "Activity" },
    { id: "branding", label: "Branding", short: "Soon" },
    { id: "billing", label: "Billing" },
  ];

  return (
    <AccountShell
      session={session}
      sections={sections}
      activeId={activeId}
      basePath="/account"
    >
      {renderAgencySection(activeId, session, account)}
    </AccountShell>
  );
}

function renderAgencySection(
  id: AgencySectionId,
  session: SessionUser,
  account: AgencyAccount,
) {
  switch (id) {
    case "overview":
      return <AgencyOverview session={session} account={account} />;
    case "clients":
      return <AgencyClients session={session} account={account} />;
    case "team":
      return <AgencyTeam session={session} account={account} />;
    case "activity":
      return <AgencyActivity session={session} account={account} />;
    case "branding":
      return <AgencyBranding />;
    case "billing":
      return <AgencyBilling session={session} account={account} />;
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
            planLabel={PLAN_LABEL[session.plan]}
          />
          <section className="px-6 py-8 md:px-10 md:py-10">{children}</section>
        </div>
      </main>
      <PageFooter />
    </>
  );
}
