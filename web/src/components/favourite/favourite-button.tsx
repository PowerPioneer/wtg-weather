"use client";

/**
 * Star a country or a region.
 *
 * Progressive enhancement, deliberately: the country and region pages are
 * statically generated and one HTML document serves every visitor, so whether
 * *you* have starred Peru cannot be in the markup. With JS off the button is
 * absent and the page is otherwise untouched, which is the SSR rule in
 * `web/CLAUDE.md`.
 *
 * An anonymous visitor gets a sign-in link rather than a button that does
 * nothing. A star that silently fails is worse than no star: the user believes
 * the place is saved and finds an empty account later.
 */

import Link from "next/link";

import { useFavourite, type FavouriteTarget } from "@/hooks/use-favourite";
import { cn } from "@/lib/cn";

export type FavouriteButtonProps = FavouriteTarget & {
  /** What is being starred — "Peru", "Cusco" — for the accessible label. */
  name: string;
  className?: string;
};

export function FavouriteButton({
  countryIso2,
  regionCode,
  name,
  className,
}: FavouriteButtonProps) {
  const { favourited, anonymous, pending, error, toggle } = useFavourite({
    countryIso2,
    regionCode,
  });

  const shell = cn(
    "inline-flex h-9 items-center gap-2 rounded-sm border border-border bg-surface px-3 text-[12.5px] font-medium text-text transition-colors hover:bg-surface-2 disabled:opacity-60",
    className,
  );

  if (anonymous) {
    // A link, not a disabled button: the visitor gets somewhere. There is no
    // `?next=` because the round trip goes through an email, and the token in
    // that email is minted by the API — nothing carries a return path across
    // the hop today.
    return (
      <Link href="/login" className={shell} data-testid="favourite-signin">
        <Star filled={false} />
        Sign in to save
      </Link>
    );
  }

  return (
    <div className="inline-flex flex-col items-start gap-1">
      <button
        type="button"
        onClick={toggle}
        // Until the list resolves we do not know the state, and a hollow star
        // would be a claim. Disabled-and-neutral says "not yet".
        disabled={favourited === null || pending}
        aria-pressed={favourited ?? false}
        aria-label={
          favourited ? `Remove ${name} from favourites` : `Save ${name} to favourites`
        }
        data-testid="favourite-toggle"
        className={shell}
      >
        <Star filled={favourited === true} />
        {favourited ? "Saved" : "Save"}
      </button>
      {error && (
        <span role="status" className="font-mono text-[11px] text-destructive">
          {error}
        </span>
      )}
    </div>
  );
}

function Star({ filled }: { filled: boolean }) {
  return (
    <svg
      width={14}
      height={14}
      viewBox="0 0 24 24"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinejoin="round"
      aria-hidden="true"
      className={filled ? "text-accent" : "text-text-muted"}
    >
      <path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z" />
    </svg>
  );
}
