/**
 * Country registry used by `generateStaticParams`. Keeping it a concrete list
 * (rather than deriving from mock data) means the page tree doesn't shrink
 * when mock data does. Expanded to ~195 countries in Phase 5.4 from the
 * pipeline's country table; for 5.3a we ship the three mock entries plus a
 * short neighbour set so the cross-linking on month pages resolves.
 */

export type CountryRef = {
  slug: string;
  name: string;
  iso2: string;
  region: string;
};

export const COUNTRIES: readonly CountryRef[] = [
  { slug: "peru", name: "Peru", iso2: "PE", region: "South America" },
  { slug: "japan", name: "Japan", iso2: "JP", region: "Asia" },
  { slug: "iceland", name: "Iceland", iso2: "IS", region: "Europe" },
  { slug: "ecuador", name: "Ecuador", iso2: "EC", region: "South America" },
  { slug: "bolivia", name: "Bolivia", iso2: "BO", region: "South America" },
  { slug: "colombia", name: "Colombia", iso2: "CO", region: "South America" },
  { slug: "chile", name: "Chile", iso2: "CL", region: "South America" },
  { slug: "brazil", name: "Brazil", iso2: "BR", region: "South America" },
  { slug: "argentina", name: "Argentina", iso2: "AR", region: "South America" },
];

export function findCountry(slug: string): CountryRef | undefined {
  return COUNTRIES.find((c) => c.slug === slug);
}
