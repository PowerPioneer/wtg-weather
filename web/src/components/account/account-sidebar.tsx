import Link from "next/link";

import { cn } from "@/lib/cn";
import type { SessionUser } from "@/lib/types";

export type SidebarItem = {
  id: string;
  label: string;
  count?: number;
  short?: string;
};

/**
 * Left-rail nav. Uses URL search params (`?s=trips`) so a) every section is
 * linkable / shareable, b) the page ships with zero client JS for navigation,
 * c) back/forward behave correctly. The `basePath` parameter keeps this
 * component reusable for both `/account` and `/account/clients/:id`.
 */
export function AccountSidebar({
  session,
  sections,
  activeId,
  basePath,
  planLabel,
}: {
  session: SessionUser;
  sections: readonly SidebarItem[];
  activeId: string;
  basePath: string;
  planLabel: string;
}) {
  const isFree = session.plan === "free";
  return (
    <nav className="border-r border-border bg-[#FCFBF8] p-3.5 md:px-3.5 md:py-6">
      <div className="mb-2.5 border-b border-border px-2 pb-3.5">
        <div className="font-mono text-[10.5px] font-semibold uppercase tracking-[0.14em] text-text-subtle">
          Signed in
        </div>
        <div className="mt-1 font-display text-[17px] font-medium tracking-[-0.005em] text-text">
          {session.name}
        </div>
        <div className="mt-0.5 break-all font-mono text-[11px] text-text-muted">
          {session.email}
        </div>
        <div
          className={cn(
            "mt-2 inline-block rounded-sm px-1.5 py-0.5 font-mono text-[9.5px] font-semibold uppercase tracking-[0.1em]",
            isFree ? "bg-surface-2 text-text-muted" : "bg-[#FBF3DC] text-accent",
          )}
        >
          {planLabel}
        </div>
      </div>

      {sections.map((s) => {
        const active = s.id === activeId;
        const href = s.id === "overview" ? basePath : `${basePath}?s=${s.id}`;
        return (
          <Link
            key={s.id}
            href={href}
            className={cn(
              "mb-0.5 flex items-center gap-2.5 rounded-sm border border-transparent px-2.5 py-2 text-[13px] font-medium",
              active
                ? "border-border bg-surface text-text"
                : "text-text-muted hover:text-text",
            )}
          >
            <span
              className={cn(
                "h-[18px] w-1 rounded-sm",
                active ? "bg-accent" : "bg-transparent",
              )}
              aria-hidden="true"
            />
            <span className="flex-1">{s.label}</span>
            {typeof s.count === "number" && (
              <span className="font-mono text-[10.5px] text-text-subtle">{s.count}</span>
            )}
          </Link>
        );
      })}

      <div className="mt-6 px-2">
        <div className="mb-2 font-mono text-[10.5px] font-semibold uppercase tracking-[0.14em] text-text-subtle">
          Quick
        </div>
        <Link href="/" className="block py-1 text-[12.5px] text-text hover:underline">
          ↗ Open the map
        </Link>
        <Link href="/help" className="block py-1 text-[12.5px] text-text-muted hover:underline">
          Help center
        </Link>
        <Link href="/signout" className="block py-1 text-[12.5px] text-text-muted hover:underline">
          Sign out
        </Link>
      </div>
    </nav>
  );
}
