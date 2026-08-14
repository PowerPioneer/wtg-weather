/**
 * The region-level carve-out notice.
 *
 * Until the subdivision gazetteer landed, a government saying "do not travel
 * to Ayacucho" could only reach the site as "somewhere in Peru is worse" — the
 * `regional-L4` sentinel names no polygon. Now that carve-outs resolve to
 * ISO-3166-2 codes, the region's own page can say it, and this is the only
 * surface that does.
 */

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { RegionRow } from "@/lib/types";

import { RegionAdvisoryNotice } from "./region-advisory-notice";

const REGION: RegionRow = {
  name: "Ayacucho",
  slug: "ayacucho",
  code: "PER-1234",
  score: 72,
  tl: [17, 17, 17, 17, 16, 16, 16, 17, 17, 18, 18, 17] as RegionRow["tl"],
};

describe("RegionAdvisoryNotice", () => {
  it("names the region, the level and the subdivision code", () => {
    render(
      <RegionAdvisoryNotice
        region={{
          ...REGION,
          advisory: { level: 4, label: "Do not travel", code: "PE-AYA" },
        }}
        countryName="Peru"
      />,
    );

    expect(
      screen.getByText(/Ayacucho carries a higher advisory than the rest of Peru/),
    ).toBeInTheDocument();
    // The badge also renders the label, so scope to the prose paragraph.
    expect(screen.getByText(/level 4, .Do not travel./)).toBeInTheDocument();
    expect(screen.getByText(/PE-AYA/)).toBeInTheDocument();
  });

  it("says the carve-out may cover only part of the region", () => {
    // Governments name areas in prose — "some areas within the regions of
    // Ayacucho, Cusco, Huancavelica" — and admin-1 is the finest boundary the
    // pipeline can attach that to. Claiming the whole region would overstate
    // what the source said.
    render(
      <RegionAdvisoryNotice
        region={{
          ...REGION,
          advisory: { level: 4, label: "Do not travel", code: "PE-AYA" },
        }}
        countryName="Peru"
      />,
    );

    expect(
      screen.getByText(/may apply to part of Ayacucho rather than all of it/),
    ).toBeInTheDocument();
  });

  it("renders nothing when the region carries no carve-out", () => {
    // The pipeline omits `advisory` when the region's level equals its
    // country's, because the country-wide panel on the same page says it.
    const { container } = render(
      <RegionAdvisoryNotice region={REGION} countryName="Peru" />,
    );

    expect(container).toBeEmptyDOMElement();
  });
});
