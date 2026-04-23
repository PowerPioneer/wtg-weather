import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { AccountSidebar, type SidebarItem } from "@/components/account";
import { ScoreBadge } from "@/components/match/score-badge";
import { PageFooter, PageHeader } from "@/components/layout";
import { cn } from "@/lib/cn";
import { findAgencyAccount, findClientRecord } from "@/lib/mock-data";
import { getEntitlement, getSessionServer } from "@/lib/session";
import type {
  ClientActivityRow,
  ClientNote,
  ClientRecord,
  SessionUser,
} from "@/lib/types";

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
};

const TABS = ["profile", "trips", "activity", "files"] as const;
type TabId = (typeof TABS)[number];

const TAB_LABEL: Record<TabId, string> = {
  profile: "Profile",
  trips: "Trips",
  activity: "Activity",
  files: "Files",
};

const PLAN_LABEL: Record<SessionUser["plan"], string> = {
  free: "Free",
  premium: "Premium",
  agency_starter: "Agency · Starter",
  agency_pro: "Agency · Pro",
  agency_enterprise: "Agency · Enterprise",
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const client = findClientRecord(id);
  return {
    title: client ? `${client.shortName} · Client · Atlas Weather` : "Client not found",
    robots: { index: false },
  };
}

export default async function ClientDetailPage({ params, searchParams }: PageProps) {
  const session = await getSessionServer();
  if (!session) redirect("/signin");
  const entitlement = getEntitlement(session);
  if (!entitlement.agency || !session.org) notFound();

  const [{ id }, { tab }] = await Promise.all([params, searchParams]);
  const client = findClientRecord(id);
  if (!client) notFound();

  const agency = findAgencyAccount(session.org.id);
  const activeTab: TabId = TABS.includes(tab as TabId) ? (tab as TabId) : "profile";

  const sections: readonly SidebarItem[] = [
    { id: "overview", label: "Overview" },
    { id: "clients", label: "Clients", count: agency?.clients.length ?? 0 },
    { id: "team", label: "Team", count: agency?.team.length },
    { id: "activity", label: "Activity" },
    { id: "branding", label: "Branding", short: "Soon" },
    { id: "billing", label: "Billing" },
  ];

  return (
    <>
      <PageHeader />
      <main className="flex-1 bg-surface">
        <div className="border-b border-border bg-[#FCFBF8] px-6 py-2 font-mono text-[11px] text-text-subtle md:px-12">
          <div className="mx-auto flex max-w-[1280px] justify-between">
            <div>
              /account/clients/{client.id} · org{" "}
              <span className="font-semibold text-text">{session.org.name}</span> ·{" "}
              {PLAN_LABEL[session.plan]}
            </div>
            <div>
              signed in as {session.name} ({session.role.replace("agency_", "")}) ·{" "}
              {session.org.seatsUsed}/{session.org.seatCap} seats
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
              planLabel={PLAN_LABEL[session.plan]}
            />
            <div className="mx-3 mt-4 rounded-sm border border-border bg-white p-2.5">
              <div className="mb-1 font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-text-subtle">
                Viewing client
              </div>
              <div className="font-display text-[13px] font-medium">{client.shortName}</div>
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
              {activeTab === "profile" && <ProfileTab client={client} />}
              {activeTab === "trips" && <TripsTab client={client} />}
              {activeTab === "activity" && <ActivityTab client={client} />}
              {activeTab === "files" && <FilesTab />}
            </div>
          </section>
        </div>
      </main>
      <PageFooter />
    </>
  );
}

function ClientHeader({ client, activeTab }: { client: ClientRecord; activeTab: TabId }) {
  const initial = client.shortName[0] ?? "?";
  return (
    <div className="border-b border-border bg-surface px-6 py-6 md:px-10">
      <div className="mb-4 flex items-center gap-1.5 font-mono text-[11px] text-text-muted">
        <Link href="/account" className="hover:text-text">
          Account
        </Link>
        <span className="text-border-strong">›</span>
        <Link href="/account?s=clients" className="hover:text-text">
          Clients
        </Link>
        <span className="text-border-strong">›</span>
        <span className="text-text">{client.shortName}</span>
        <span className="ml-1 text-text-subtle">· {client.id}</span>
      </div>

      <div className="flex flex-wrap items-start gap-6">
        <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-sm border border-accent bg-[#FBF3DC] font-display text-[22px] font-medium tracking-[-0.02em] text-accent">
          {initial}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="m-0 font-display text-[28px] font-normal tracking-[-0.012em] text-text md:text-[30px]">
              {client.name}
            </h1>
            <Chip>{client.kind}</Chip>
            {client.tags.map((t) => (
              <Chip key={t} bg="#ECEAE3" tone="muted">
                {t}
              </Chip>
            ))}
          </div>

          <div className="mt-2.5 flex flex-wrap gap-4 text-[12.5px] text-text-muted">
            <span className="inline-flex items-center gap-1.5">
              <MailIcon />
              <a
                href={`mailto:${client.email}`}
                className="font-mono text-[11.5px] text-text hover:underline"
              >
                {client.email}
              </a>
            </span>
            <span className="inline-flex items-center gap-1.5">
              <PhoneIcon />
              <span className="font-mono text-[11.5px] text-text">{client.phone}</span>
            </span>
            <span className="inline-flex items-center gap-1.5">
              <PinIcon />
              {client.city}
            </span>
          </div>

          <div className="mt-3.5 inline-flex max-w-[640px] items-start gap-2.5 rounded-sm border border-accent bg-[#FBF3DC] px-3 py-2 text-[11.5px] text-text">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--color-accent)" strokeWidth="1.7" className="mt-0.5 flex-shrink-0">
              <circle cx="12" cy="12" r="9" />
              <path d="M12 8v5M12 16.5v.01" strokeLinecap="round" />
            </svg>
            <span>
              <strong className="font-semibold">Managed record.</strong>{" "}
              {client.shortName} does not have a login — this profile exists so your team can plan on their behalf. Email them a shared trip link or export a PDF when you&apos;re ready.
            </span>
          </div>
        </div>

        <div className="min-w-[200px] flex-shrink-0 text-right">
          <div className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-text-subtle">
            Primary agent
          </div>
          <div className="mt-1 font-display text-[17px] font-medium tracking-[-0.005em] text-text">
            {client.primaryAgent.name}
          </div>
          <div className="font-mono text-[10.5px] uppercase tracking-[0.08em] text-text-muted">
            {client.primaryAgent.role.toUpperCase()}
          </div>
          <div className="mt-3 font-mono text-[11.5px] text-text-muted">
            Active since {client.since}
          </div>
          <div className="mt-1 font-mono text-[11.5px] text-accent">
            Next touch · {client.nextTouch}
          </div>
          <div className="mt-3 flex justify-end gap-1.5">
            <button
              type="button"
              className="inline-flex items-center gap-1.5 rounded-sm border border-border bg-white px-3 py-1.5 text-[12px] font-medium text-text hover:bg-surface-2"
            >
              + New trip
            </button>
          </div>
        </div>
      </div>

      <nav className="-mb-px mt-6 flex gap-1">
        {TABS.map((id) => {
          const active = id === activeTab;
          const href = id === "profile"
            ? `/account/clients/${client.id}`
            : `/account/clients/${client.id}?tab=${id}`;
          const sub =
            id === "profile"
              ? "Preferences · restrictions · notes"
              : id === "trips"
                ? `${client.trips.length} assigned`
                : id === "activity"
                  ? "Agent actions"
                  : "Coming soon";
          return (
            <Link
              key={id}
              href={href}
              className={cn(
                "flex items-baseline gap-2 border-b-2 px-4 py-2.5 text-[13px] no-underline",
                active
                  ? "border-accent text-text"
                  : "border-transparent text-text-muted hover:text-text",
              )}
            >
              <span className="font-medium">{TAB_LABEL[id]}</span>
              <span className="font-mono text-[10.5px] text-text-subtle">{sub}</span>
              {id === "files" && (
                <Chip bg="#FBF3DC" tone="accent">
                  SOON
                </Chip>
              )}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

function ProfileTab({ client }: { client: ClientRecord }) {
  return (
    <div className="grid gap-7 md:grid-cols-[1.2fr_1fr]">
      <div>
        <Eyebrow>Default preferences · used to score trips</Eyebrow>
        <div className="mt-2 overflow-hidden rounded-md border border-border bg-surface">
          {client.prefs.ranges.map((p, i) => (
            <div
              key={p.key}
              className={cn(
                "grid items-center gap-3 px-4 py-3",
                i < client.prefs.ranges.length - 1 && "border-b border-border",
                p.pro && "opacity-90",
              )}
              style={{ gridTemplateColumns: "32px 1fr auto" }}
            >
              <div className="flex h-[26px] w-[26px] items-center justify-center rounded-sm border border-border bg-[#FCFBF8] text-text-muted">
                <PrefIcon kind={p.icon ?? null} />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[12.5px] font-medium text-text">{p.label}</span>
                {p.pro && (
                  <Chip bg="#FBF3DC" tone="accent">
                    PREMIUM
                  </Chip>
                )}
              </div>
              <div
                className={cn(
                  "font-mono text-[11.5px]",
                  p.pro ? "text-text-muted" : "text-text",
                )}
              >
                {p.value}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-7">
          <Eyebrow>Travel restrictions &amp; context</Eyebrow>
          <div className="mt-2 rounded-md border border-border bg-surface px-4">
            {client.prefs.restrictions.map((r, i) => (
              <div
                key={r.label}
                className={cn(
                  "grid items-center py-2.5",
                  i < client.prefs.restrictions.length - 1 && "border-b border-dotted border-border",
                )}
                style={{ gridTemplateColumns: "120px 1fr" }}
              >
                <div className="font-mono text-[10.5px] uppercase tracking-[0.12em] text-text-subtle">
                  {r.label}
                </div>
                <div className="text-[12.5px] text-text">{r.value}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div>
        <div className="mb-2.5 flex items-baseline justify-between">
          <Eyebrow>Notes · shared across the team</Eyebrow>
          <button
            type="button"
            className="inline-flex items-center gap-1.5 rounded-sm border border-border bg-white px-3 py-1.5 text-[12px] font-medium text-text hover:bg-surface-2"
          >
            + Add note
          </button>
        </div>
        <div className="relative pl-5">
          <div className="absolute bottom-1 left-1.5 top-1 w-px bg-border" aria-hidden="true" />
          {client.notes.map((n, i) => (
            <NoteCard key={`${n.when}-${i}`} note={n} />
          ))}
        </div>
      </div>
    </div>
  );
}

function NoteCard({ note }: { note: ClientNote }) {
  const ringColor =
    note.kind === "client"
      ? "var(--color-score-perfect)"
      : note.kind === "internal"
        ? "var(--color-accent)"
        : "var(--color-text-subtle)";
  return (
    <div className="relative mb-4.5" style={{ marginBottom: 18 }}>
      <div
        className="absolute left-[-14px] top-[10px] h-2.5 w-2.5 rounded-full bg-white"
        style={{ border: `2px solid ${ringColor}` }}
      />
      <div className="rounded-md border border-border bg-surface px-4 py-3">
        <div className="mb-1.5 flex flex-wrap items-center gap-2.5">
          <span className="text-[12px] font-semibold text-text">{note.author}</span>
          <span className="font-mono text-[10.5px] text-text-subtle">{note.when}</span>
          <Chip bg={note.kind === "internal" ? "#FBF3DC" : "#FCFBF8"} tone={note.kind === "internal" ? "accent" : "muted"}>
            {note.kind}
          </Chip>
        </div>
        <div className="whitespace-pre-wrap text-[12.5px] leading-[1.6] text-text">
          {renderInlineBold(note.body)}
        </div>
      </div>
    </div>
  );
}

function renderInlineBold(body: string) {
  return body.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith("**") ? (
      <strong key={i} className="font-semibold">
        {part.slice(2, -2)}
      </strong>
    ) : (
      <span key={i}>{part}</span>
    ),
  );
}

function TripsTab({ client }: { client: ClientRecord }) {
  return (
    <div>
      <div className="mb-3.5 flex items-center justify-between">
        <Eyebrow>All trips assigned to {client.shortName}</Eyebrow>
        <Link
          href="/map"
          className="rounded-sm bg-primary px-3.5 py-2 text-[12.5px] font-medium text-primary-foreground hover:bg-primary/90"
        >
          + New trip for {client.shortName}
        </Link>
      </div>
      <div className="overflow-hidden rounded-md border border-border bg-surface">
        <div
          className="grid items-center gap-3 border-b border-border bg-[#FCFBF8] px-4 py-2.5 font-mono text-[10.5px] uppercase tracking-[0.1em] text-text-subtle"
          style={{ gridTemplateColumns: "1fr 110px 130px 120px 130px 60px 70px" }}
        >
          <div>Trip</div>
          <div>Country</div>
          <div>Month</div>
          <div>Agent</div>
          <div>Last updated</div>
          <div className="text-right">Score</div>
          <div className="text-right">Open</div>
        </div>
        {client.trips.map((t, i) => (
          <div
            key={t.id}
            className={cn(
              "grid items-center gap-3 px-4 py-3",
              i < client.trips.length - 1 && "border-b border-border",
            )}
            style={{ gridTemplateColumns: "1fr 110px 130px 120px 130px 60px 70px" }}
          >
            <div>
              <div className="font-display text-[15px] font-medium tracking-[-0.002em] text-text">
                {t.title}
              </div>
              <div className="mt-0.5 flex items-center gap-2 font-mono text-[10.5px] text-text-subtle">
                <span>{t.id}</span>
                <Chip
                  bg={t.status === "shared" ? "#E8F2E8" : "#FCFBF8"}
                  tone={t.status === "shared" ? "perfect" : "muted"}
                >
                  {t.status}
                </Chip>
              </div>
            </div>
            <div className="text-[12px] text-text">{t.country}</div>
            <div className="font-mono text-[12px] text-text">{t.months}</div>
            <div className="text-[12px] text-text-muted">{t.agent}</div>
            <div className="font-mono text-[11px] text-text-muted">{t.updated}</div>
            <div className="flex justify-end">
              <ScoreBadge score={t.score} size="sm" />
            </div>
            <div className="text-right">
              <Link href={`/trip/${t.id}`} className="text-[11px] text-accent hover:underline">
                Open →
              </Link>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-4 flex items-center gap-3 rounded-md border border-dashed border-border-strong bg-[#FCFBF8] px-4 py-3 text-[12px] text-text-muted">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <rect x="4" y="4" width="16" height="16" rx="2" />
          <path d="M9 9h6M9 13h6M9 17h4" />
        </svg>
        <span>
          <strong className="font-semibold text-text">Tip.</strong> New trips start from{" "}
          {client.shortName}&apos;s default preferences — edit them on the Profile tab to change the scoring baseline.
        </span>
      </div>
    </div>
  );
}

const ACTIVITY_KIND_COLOR: Record<ClientActivityRow["kind"], string> = {
  CREATE: "text-score-perfect",
  EDIT: "text-text-muted",
  SHARE: "text-accent",
  EXPORT: "text-score-good",
  VIEW: "text-text-subtle",
  NOTE: "text-[#6B4FAE]",
  TAG: "text-[#B88A2E]",
  SYSTEM: "text-text-subtle",
};

function ActivityTab({ client }: { client: ClientRecord }) {
  return (
    <div>
      <div className="mb-3.5 flex items-center justify-between">
        <Eyebrow>Agent actions on this client · newest first</Eyebrow>
      </div>
      <div className="overflow-hidden rounded-md border border-border bg-surface">
        <div
          className="grid items-center border-b border-border bg-[#FCFBF8] px-4 py-2.5 font-mono text-[10.5px] uppercase tracking-[0.1em] text-text-subtle"
          style={{ gridTemplateColumns: "100px 80px 150px 1fr" }}
        >
          <div>When</div>
          <div>Kind</div>
          <div>Who</div>
          <div>Action</div>
        </div>
        {client.activity.map((a, i) => (
          <div
            key={i}
            className={cn(
              "grid items-center px-4 py-2.5 text-[12px]",
              i < client.activity.length - 1 && "border-b border-border",
            )}
            style={{ gridTemplateColumns: "100px 80px 150px 1fr" }}
          >
            <div className="font-mono text-[11px] text-text-muted">{a.t}</div>
            <div>
              <span
                className={cn(
                  "inline-block rounded-sm border border-border bg-[#FCFBF8] px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-[0.1em]",
                  ACTIVITY_KIND_COLOR[a.kind],
                )}
              >
                {a.kind}
              </span>
            </div>
            <div className="font-medium text-text">{a.who}</div>
            <div className="text-text">
              {a.act}{" "}
              <span className="font-display text-[12.5px] italic text-text">{a.obj}</span>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-3.5 text-right font-mono text-[11px] text-text-subtle">
        Showing {client.activity.length} of {client.activity.length} events
      </div>
    </div>
  );
}

function FilesTab() {
  return (
    <div className="rounded-md border border-dashed border-border-strong bg-[#FCFBF8] px-10 py-16 text-center">
      <Chip bg="#FBF3DC" tone="accent">
        COMING SOON · V2
      </Chip>
      <div className="mt-3.5 font-display text-[26px] font-medium tracking-[-0.012em] text-text">
        Client files
      </div>
      <div className="mx-auto mt-2.5 max-w-[520px] text-[13px] leading-[1.6] text-text-muted">
        Passports, insurance certificates, booking confirmations — one place per client. We&apos;re working on it for the end of 2026.
      </div>
      <button
        type="button"
        className="mt-5 rounded-sm border border-border bg-white px-3.5 py-2 text-[12.5px] font-medium text-text hover:bg-surface-2"
      >
        Get notified when this ships
      </button>
    </div>
  );
}

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <div className="font-mono text-[10.5px] font-semibold uppercase tracking-[0.14em] text-text-subtle">
      {children}
    </div>
  );
}

function Chip({
  children,
  bg = "#FCFBF8",
  tone = "default",
}: {
  children: React.ReactNode;
  bg?: string;
  tone?: "default" | "muted" | "accent" | "perfect";
}) {
  const toneClass =
    tone === "accent"
      ? "border-accent text-accent"
      : tone === "perfect"
        ? "border-score-perfect text-score-perfect"
        : tone === "muted"
          ? "border-border text-text-muted"
          : "border-border text-text";
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-sm border px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-[0.1em]",
        toneClass,
      )}
      style={{ backgroundColor: bg }}
    >
      {children}
    </span>
  );
}

function MailIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
      <path d="M3 6h18v12H3z" />
      <path d="M3 6l9 7 9-7" />
    </svg>
  );
}

function PhoneIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
      <path d="M5 4h4l2 5-3 2a11 11 0 0 0 5 5l2-3 5 2v4a2 2 0 0 1-2 2A17 17 0 0 1 3 6a2 2 0 0 1 2-2z" />
    </svg>
  );
}

function PinIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
      <path d="M12 22s7-7 7-12a7 7 0 1 0-14 0c0 5 7 12 7 12z" />
      <circle cx="12" cy="10" r="2.5" />
    </svg>
  );
}

type IconKind = "temp" | "rain" | "sun" | "wind" | "shield" | null;

function PrefIcon({ kind }: { kind: IconKind }) {
  const common = {
    width: 14,
    height: 14,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.5,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
  switch (kind) {
    case "temp":
      return (
        <svg {...common}>
          <path d="M14 14V5a2 2 0 1 0-4 0v9a4 4 0 1 0 4 0z" />
          <circle cx="12" cy="17" r="1.5" fill="currentColor" stroke="none" />
        </svg>
      );
    case "rain":
      return (
        <svg {...common}>
          <path d="M7 16a5 5 0 1 1 9-4 4 4 0 0 1-1 8H8a3 3 0 0 1-1-4z" />
          <path d="M9 20l-1 2M13 20l-1 2M17 20l-1 2" />
        </svg>
      );
    case "sun":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="4" />
          <path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4L7 17M17 7l1.4-1.4" />
        </svg>
      );
    case "wind":
      return (
        <svg {...common}>
          <path d="M3 8h12a3 3 0 1 0-3-3M3 14h16a3 3 0 1 1-3 3M3 11h8" />
        </svg>
      );
    case "shield":
      return (
        <svg {...common}>
          <path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6l8-3z" />
        </svg>
      );
    default:
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="4" />
        </svg>
      );
  }
}
