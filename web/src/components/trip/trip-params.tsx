import Link from "next/link";

import type { TripPref } from "@/lib/types";

type IconKind = "temp" | "rain" | "sun" | "wind" | "shield";

function PrefIcon({ kind }: { kind: IconKind }) {
  const common = {
    width: 16,
    height: 16,
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
  }
}

function ParamRow({
  pref,
  premium,
  locked,
}: {
  pref: TripPref;
  premium?: boolean;
  locked?: boolean;
}) {
  return (
    <div
      className={
        "grid grid-cols-[24px_1fr_auto] items-center gap-3.5 border-b border-dotted border-border py-3 last:border-b-0 " +
        (locked ? "opacity-60" : "")
      }
    >
      <div className="flex items-center text-text">
        {pref.icon && <PrefIcon kind={pref.icon as IconKind} />}
      </div>
      <div>
        <div className="flex items-center gap-2 text-[13px] font-medium text-text">
          {pref.label}
          {premium && (
            <span className="rounded-sm border border-accent bg-[#FBF3DC] px-1.5 py-px font-mono text-[9px] font-semibold uppercase tracking-[0.14em] text-accent">
              Pro
            </span>
          )}
        </div>
        <div className="mt-0.5 font-mono text-[11px] text-text-subtle">{pref.range}</div>
      </div>
      <div
        className={
          "font-mono text-[11px] " + (locked ? "text-text-subtle" : "text-score-perfect")
        }
      >
        {locked ? "— locked" : "✓ matched"}
      </div>
    </div>
  );
}

/**
 * Trip preferences panel. Free prefs always visible; premium prefs render
 * locked (grey, "— locked") for public viewers and matched for the owner.
 */
export function TripParams({
  free,
  premium,
  mode,
  owner,
}: {
  free: readonly TripPref[];
  premium: readonly TripPref[];
  mode: "owner" | "public";
  owner: { agency?: string } | null;
}) {
  const isOwner = mode === "owner";

  return (
    <div className="rounded-md border border-border bg-surface px-5 py-4">
      <div className="mb-1 flex items-baseline justify-between">
        <span className="font-mono text-[10.5px] font-semibold uppercase tracking-[0.16em] text-text-muted">
          Trip parameters
        </span>
        {isOwner && (
          <a href="#edit-prefs" className="text-[11px] text-accent hover:underline">
            Edit →
          </a>
        )}
      </div>
      <div className="mb-2.5 font-mono text-[11px] text-text-subtle">
        {isOwner
          ? `${free.length + premium.length} criteria active · all matched`
          : `${free.length} free criteria · ${premium.length} Premium criteria`}
      </div>

      {free.map((p) => (
        <ParamRow key={p.key} pref={p} />
      ))}

      <div className="mt-3 border-t border-border pt-3">
        <div className="mb-2 flex items-baseline justify-between">
          <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-accent">
            Premium parameters
          </span>
          {!isOwner && (
            <Link href="/pricing" className="text-[11px] text-accent hover:underline">
              Unlock →
            </Link>
          )}
        </div>
      </div>

      {premium.map((p) => (
        <ParamRow key={p.key} pref={p} premium locked={!isOwner} />
      ))}

      {!isOwner && (
        <div className="mt-3.5 rounded-sm border border-dashed border-accent bg-[#FBF3DC] px-3.5 py-3 text-[12px] leading-[1.5] text-text">
          Premium criteria are visible to the owner
          {owner?.agency && (
            <>
              {" ("}
              {owner.agency}
              {")"}
            </>
          )}
          .{" "}
          <Link href="/pricing" className="font-semibold text-accent hover:underline">
            Get Premium
          </Link>{" "}
          to filter destinations on these too.
        </div>
      )}
    </div>
  );
}
