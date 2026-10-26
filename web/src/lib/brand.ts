/**
 * The product's public name and the operator's postal address.
 *
 * "Atlas" was the code name of the design direction (`web/design/HANDOFF.md`)
 * and leaked into page titles, Open Graph cards, structured data and email as
 * if it were the brand — "Atlas Weather" in every search result, next to a
 * domain that says something else. The product is Where to Go for Great
 * Weather; anything a visitor, a search engine or a mailbox sees uses this.
 *
 * The address is the operator's, as published on the legal pages. Commercial
 * email must carry a real postal address; the templates used to carry a
 * placeholder from the design files (a San Francisco street that has nothing
 * to do with this business).
 */
export const SITE_NAME = "Where to Go for Great Weather";

export const POSTAL_ADDRESS = "Van Diemenstraat 138, 2518 VG Den Haag, Netherlands";

/** A full page title for surfaces the layout's title template does not reach (Open Graph, Twitter). */
export function brandedTitle(title: string): string {
  return `${title} · ${SITE_NAME}`;
}
