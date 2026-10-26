/**
 * The hero photo manifest — a curated dataset whose licence terms the site
 * has to keep, so it is checked the way the activities dataset is.
 */

import { existsSync, readdirSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { GENERATED_COUNTRIES } from "./countries.generated";
import { ALLOWED_LICENCES, allPlacePhotos, placePhoto, placePhotoPath } from "./place-photos";

const PUBLIC = path.join(process.cwd(), "public");
const entries = Object.entries(allPlacePhotos());

describe("place photos", () => {
  it("covers a real country per entry", () => {
    const known = new Set(GENERATED_COUNTRIES.map((c) => c.iso2));
    for (const [iso2] of entries) expect(known.has(iso2), iso2).toBe(true);
  });

  it("uses only licences whose terms the hero's credit line meets", () => {
    for (const [iso2, photo] of entries) {
      expect(
        ALLOWED_LICENCES.some((pattern) => pattern.test(photo.license)),
        `${iso2}: ${photo.license}`,
      ).toBe(true);
    }
  });

  it("credits an author and links the Commons file page", () => {
    for (const [iso2, photo] of entries) {
      expect(photo.author.trim(), iso2).not.toBe("");
      expect(photo.author, iso2).not.toMatch(/<[a-z]/i);
      expect(photo.file, iso2).toMatch(/^File:/);
      expect(photo.sourceUrl, iso2).toMatch(/^https:\/\/commons\.wikimedia\.org\/wiki\/File:/);
    }
  });

  it("describes each photo for a screen reader and names its place", () => {
    for (const [iso2, photo] of entries) {
      expect(photo.alt.trim().length, iso2).toBeGreaterThan(10);
      expect(photo.alt.length, iso2).toBeLessThanOrEqual(140);
      expect(photo.alt, iso2).not.toMatch(/^(image|photo|picture) of/i);
      expect(photo.place.trim(), iso2).not.toBe("");
    }
  });

  it("has the sized file on disk for every entry, and no orphan files", () => {
    for (const [iso2] of entries) {
      expect(existsSync(path.join(PUBLIC, placePhotoPath(iso2))), iso2).toBe(true);
    }
    const dir = path.join(PUBLIC, "places");
    const files = existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith(".jpg")) : [];
    for (const file of files) {
      expect(placePhoto(file.replace(/\.jpg$/, "")), file).not.toBeNull();
    }
  });
});
