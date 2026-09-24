import Form from "next/form";

import { COUNTRIES } from "@/lib/countries";
import { cn } from "@/lib/cn";

export const COUNTRY_DATALIST_ID = "wtg-country-names";

/**
 * Suggestions for every search box on the page, rendered once by
 * `PageHeader` so the inputs can share one id.
 *
 * A native `<datalist>` is the typeahead: it needs no client JS, which the
 * header must not depend on (`web/CLAUDE.md`). It lists the registry rather
 * than the routable set because the header is static and synchronous; a name
 * with no climate page just gets an honest "no page" from `/search`.
 */
export function CountryDatalist() {
  return (
    <datalist id={COUNTRY_DATALIST_ID}>
      {COUNTRIES.map((country) => (
        <option key={country.iso2} value={country.name} />
      ))}
    </datalist>
  );
}

/**
 * A GET form to `/search`. `next/form` makes it a client-side navigation
 * when JS is on and leaves a plain form submission when it is not.
 */
export function CountrySearchForm({
  defaultValue,
  autoFocus,
  className,
}: {
  defaultValue?: string;
  autoFocus?: boolean;
  className?: string;
}) {
  return (
    <Form action="/search" role="search" className={cn("flex", className)}>
      <input
        type="search"
        name="q"
        list={COUNTRY_DATALIST_ID}
        defaultValue={defaultValue}
        autoFocus={autoFocus}
        autoComplete="off"
        placeholder="Search countries"
        aria-label="Search countries"
        className="h-9 w-full min-w-0 rounded-md border border-border bg-surface px-3 text-[13px] text-text placeholder:text-text-subtle outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-focus-ring)]"
      />
    </Form>
  );
}
