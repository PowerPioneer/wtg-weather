/**
 * Resolve an admin-1 polygon id to its region page and redirect.
 *
 * A click on the map knows two things about the polygon under the cursor: its
 * `adm1_code` (the feature's `id`) and its name. It does *not* know the URL
 * slug, because the pipeline de-duplicates those — two admin-1 units in one
 * country whose names slug identically differ by a suffix carrying the code,
 * and the tiles never saw it. Slugging the name in the browser would therefore
 * send one of any colliding pair to the other one's page, silently.
 *
 * The alternative — passing the code to the region page as a search param —
 * would opt that page out of the full-route cache for every visitor, to fix a
 * case that affects a handful of regions. A redirect costs one hop on the way
 * in and leaves `/[country]/[region]` exactly as it was.
 *
 * Nothing here 404s: an unresolvable code lands on the country page, which is
 * where the click would have gone before this route existed.
 */

import { redirect } from "next/navigation";
import type { NextRequest } from "next/server";

import { getCountry } from "@/lib/api-client";
import { findRegionByCode, regionHref } from "@/lib/regions";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ country: string; code: string }> },
): Promise<never> {
  const { country, code } = await params;
  const data = await getCountry(country);
  if (!data) redirect("/map");

  const region =
    findRegionByCode(data, decodeURIComponent(code)) ??
    // A bundle published before regions carried their code. The caller sends
    // the feature's name for exactly this window; matching on it is right for
    // everything except two regions that share a name outright, which is the
    // one case no client-side information can settle.
    findRegionByName(data, request.nextUrl.searchParams.get("name"));

  redirect(region ? `/${data.slug}/${regionHref(region)}` : `/${data.slug}`);
}

function findRegionByName(
  country: Awaited<ReturnType<typeof getCountry>>,
  name: string | null,
) {
  if (!country || !name) return null;
  const wanted = name.trim().toLowerCase();
  return country.regions.find((r) => r.name.trim().toLowerCase() === wanted) ?? null;
}
