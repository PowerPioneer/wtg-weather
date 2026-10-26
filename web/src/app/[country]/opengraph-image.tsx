import { readFile } from "node:fs/promises";
import path from "node:path";

import { ImageResponse } from "next/og";

import { OgBrandMark } from "@/components/og/brand-mark";
import { getCountry } from "@/lib/api-client";
import { placePhoto, placePhotoPath } from "@/lib/place-photos";

export const runtime = "nodejs";
export const contentType = "image/png";
export const size = { width: 1200, height: 630 };
export const alt = "Where to Go for Great Weather — country climate guide";

export default async function OG({
  params,
}: {
  params: Promise<{ country: string }>;
}) {
  const { country } = await params;
  const data = await getCountry(country);
  if (!data) return notFoundImage("Country not found");

  const best = data.bestMonths
    .slice(0, 3)
    .map((b) => b.month)
    .join(" · ");
  const tempMean = data.climate.t.reduce((s, v) => s + v, 0) / data.climate.t.length;

  const photo = await photoDataUrl(data.iso2);

  return new ImageResponse(
    (
      <div style={{ display: "flex", width: "100%", height: "100%", background: "#F7F6F2" }}>
        <div style={photo ? { ...frame, width: 720, padding: "56px 56px 48px 64px" } : frame}>
          <div style={eyebrow}>
            <span style={chip}>Country</span>
            <span>{[data.region, data.tz].filter(Boolean).join(" · ")}</span>
          </div>
          <div style={photo ? { ...headline, fontSize: 84 } : headline}>{data.name}</div>
          <div style={tagline}>weather, regions, safety</div>
          <div style={{ flex: 1 }} />
          <div style={photo ? { ...stats, gap: 40 } : stats}>
            <Stat label="Best months" value={best || "—"} />
            <Stat label="Mean temp" value={`${tempMean.toFixed(1)}°C`} />
            <Stat label="Regions" value={`${data.regions.length}`} />
          </div>
          <Footer compact={Boolean(photo)} />
        </div>
        {photo ? (
          // eslint-disable-next-line @next/next/no-img-element -- Satori renders plain <img>; next/image does not exist here
          <img src={photo} alt="" width={480} height={630} style={{ width: 480, height: 630, objectFit: "cover" }} />
        ) : null}
      </div>
    ),
    size,
  );
}

/**
 * The country's hero photo as a data URL, or `null`.
 *
 * Read off disk rather than fetched: this renders at build time, before the
 * server that would serve `/places/*` exists. The credit is on the page the
 * preview links to, which is where CC BY asks for it; a 1200×630 card has no
 * room for a legible one.
 */
async function photoDataUrl(iso2: string): Promise<string | null> {
  if (!placePhoto(iso2)) return null;
  try {
    const bytes = await readFile(path.join(process.cwd(), "public", placePhotoPath(iso2)));
    return `data:image/jpeg;base64,${bytes.toString("base64")}`;
  } catch {
    return null;
  }
}

function notFoundImage(message: string) {
  return new ImageResponse(
    (
      <div
        style={{
          ...frame,
          alignItems: "center",
          justifyContent: "center",
          fontSize: 52,
        }}
      >
        {message}
      </div>
    ),
    size,
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <span
        style={{
          fontSize: 16,
          letterSpacing: "0.16em",
          textTransform: "uppercase",
          color: "#4A5568",
        }}
      >
        {label}
      </span>
      <span style={{ fontSize: 32, color: "#0F1B2D", fontFamily: "serif" }}>
        {value}
      </span>
    </div>
  );
}

function Footer({ compact = false }: { compact?: boolean }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        paddingTop: 24,
        marginTop: 32,
        borderTop: "1px solid #D9D5C8",
        fontSize: 20,
        color: "#4A5568",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <div
          style={{
            width: 36,
            height: 36,
            background: "#0F1B2D",
            borderRadius: 6,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <OgBrandMark />
        </div>
        <span style={{ color: "#0F1B2D", fontWeight: 600 }}>Where to Go for Great Weather</span>
      </div>
      {compact ? null : <span>ERA5 climate · government safety advisories</span>}
    </div>
  );
}

const frame = {
  display: "flex",
  flexDirection: "column" as const,
  width: "100%",
  height: "100%",
  background: "#F7F6F2",
  padding: "60px 72px",
  color: "#0F1B2D",
  fontFamily: "sans-serif",
};

const eyebrow = {
  display: "flex",
  alignItems: "center",
  gap: 16,
  fontSize: 20,
  letterSpacing: "0.1em",
  textTransform: "uppercase" as const,
  color: "#4A5568",
};

const chip = {
  padding: "6px 12px",
  background: "#FBF3DC",
  border: "1px solid #B8763E",
  color: "#8A5A2B",
  fontWeight: 700,
  borderRadius: 4,
};

const headline = {
  marginTop: 40,
  fontSize: 104,
  fontFamily: "serif",
  lineHeight: 1.02,
  letterSpacing: "-0.02em",
  display: "flex",
};

const tagline = {
  marginTop: 12,
  fontSize: 38,
  fontStyle: "italic" as const,
  color: "#8A4A1E",
  display: "flex",
};

const stats = {
  display: "flex",
  gap: 72,
};
