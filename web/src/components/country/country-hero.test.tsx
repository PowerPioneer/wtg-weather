import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { findCountryData } from "@/lib/mock-data";
import type { PlacePhoto } from "@/lib/place-photos";

const photos = vi.hoisted(() => ({ byIso: {} as Record<string, PlacePhoto> }));

vi.mock("@/lib/place-photos", async (original) => ({
  ...(await original<typeof import("@/lib/place-photos")>()),
  placePhoto: (iso2: string) => photos.byIso[iso2] ?? null,
}));
vi.mock("@/components/favourite/favourite-button", () => ({ FavouriteButton: () => null }));

import { CountryHero } from "./country-hero";

const PERU = findCountryData("peru")!;

const MACHU_PICCHU: PlacePhoto = {
  file: "File:Machu Picchu.jpg",
  place: "Machu Picchu, Cusco",
  alt: "Inca terraces of Machu Picchu below the peak of Huayna Picchu",
  author: "A. Photographer",
  license: "CC BY-SA 4.0",
  licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0",
  sourceUrl: "https://commons.wikimedia.org/wiki/File:Machu_Picchu.jpg",
  thumbUrl: "https://upload.wikimedia.org/x.jpg",
  width: 4000,
  height: 2667,
};

describe("CountryHero", () => {
  it("shows the place photo with its credit", () => {
    photos.byIso = { PE: MACHU_PICCHU };
    render(<CountryHero country={PERU} />);
    expect(screen.getByAltText(MACHU_PICCHU.alt)).toBeInTheDocument();
    expect(screen.getByText("Machu Picchu, Cusco")).toBeInTheDocument();
    // CC BY-SA: author, licence and source, each a working link.
    expect(screen.getByRole("link", { name: "A. Photographer" })).toHaveAttribute(
      "href",
      MACHU_PICCHU.sourceUrl,
    );
    expect(screen.getByRole("link", { name: "CC BY-SA 4.0" })).toHaveAttribute(
      "href",
      MACHU_PICCHU.licenseUrl,
    );
  });

  it("names a public-domain photo's status without a licence link", () => {
    photos.byIso = { PE: { ...MACHU_PICCHU, license: "Public domain", licenseUrl: undefined } };
    render(<CountryHero country={PERU} />);
    expect(screen.queryByRole("link", { name: "Public domain" })).toBeNull();
    expect(screen.getByText(/Public domain/)).toBeInTheDocument();
  });

  it("keeps the gradient panel for a country with no photo", () => {
    photos.byIso = {};
    const { container } = render(<CountryHero country={PERU} />);
    expect(container.querySelector("img")).toBeNull();
    expect(screen.getByText(/PE · South America/)).toBeInTheDocument();
  });
});
