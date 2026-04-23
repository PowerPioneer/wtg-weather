import { ImageResponse } from "next/og";

import { findTripData } from "@/lib/mock-data";

export const runtime = "nodejs";
export const contentType = "image/png";
export const size = { width: 1200, height: 630 };
export const alt = "Atlas Weather — shared trip";

/**
 * Build-time OG image. Rendered with `next/og` at request time (cached per
 * URL by Vercel / Next's image pipeline). Keeps the design palette synced
 * with the page — if the hero card ever drifts, update both together.
 */
export default async function OG({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const trip = findTripData(id);
  if (!trip) {
    return new ImageResponse(
      (
        <div
          style={{
            display: "flex",
            width: "100%",
            height: "100%",
            background: "#F7F6F2",
            color: "#0F1B2D",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 48,
            fontFamily: "serif",
          }}
        >
          Trip not found
        </div>
      ),
      size,
    );
  }

  const agency = trip.owner.kind === "agency" ? trip.owner.agency : null;

  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          width: "100%",
          height: "100%",
          background: "#F7F6F2",
          padding: "60px 72px",
          color: "#0F1B2D",
          fontFamily: "sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 16,
            fontSize: 20,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            color: "#4A5568",
          }}
        >
          <div
            style={{
              padding: "6px 12px",
              background: "#FBF3DC",
              border: "1px solid #B8763E",
              color: "#B8763E",
              fontWeight: 700,
              borderRadius: 4,
            }}
          >
            Shared trip
          </div>
          <span>
            {trip.country} · {trip.months.join(" – ")} · {trip.year}
          </span>
        </div>

        <div
          style={{
            marginTop: 48,
            fontSize: 82,
            fontFamily: "serif",
            lineHeight: 1.05,
            letterSpacing: "-0.02em",
            display: "flex",
          }}
        >
          {trip.title}
        </div>

        <div
          style={{
            marginTop: 32,
            fontSize: 26,
            color: "#4A5568",
            display: "flex",
            gap: 20,
          }}
        >
          <span>{trip.destinations.length} destinations</span>
          <span>·</span>
          <span>Overall fit {trip.score}</span>
          {agency && (
            <>
              <span>·</span>
              <span>by {agency}</span>
            </>
          )}
        </div>

        <div style={{ flex: 1 }} />

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            paddingTop: 24,
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
                color: "#E0C98A",
                fontWeight: 700,
              }}
            >
              ☀
            </div>
            <span style={{ color: "#0F1B2D", fontWeight: 600 }}>Atlas Weather</span>
          </div>
          <span>ERA5 climate · 5-gov safety</span>
        </div>
      </div>
    ),
    size,
  );
}
