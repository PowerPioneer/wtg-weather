import { ImageResponse } from "next/og";

import { getSharedTrip } from "@/lib/trip-server";

export const runtime = "nodejs";
export const contentType = "image/png";
export const size = { width: 1200, height: 630 };
export const alt = "Atlas Weather — shared trip";

/**
 * OG card for a shared trip.
 *
 * It lives on the *share* route rather than on `/trip/[id]`, where it used to.
 * The share URL is the one that gets pasted into a chat app and unfurled; the
 * owner's page is session-gated and `noindex`, so a card for it would either
 * fail to render for the unfurler or leak a private trip to one. It reads the
 * same token-scoped payload the page does, so it can show nothing the page
 * does not.
 *
 * Everything here is the trip's own data. The previous version read
 * `findTripData` — the fixture — and printed "by {agency}" from a field only
 * the fixture had.
 */
export default async function OG({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const trip = await getSharedTrip(token);

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

  const where = [trip.regionName, trip.countryName].filter(Boolean).join(", ");
  const context = [where, trip.monthName].filter(Boolean).join(" · ");

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
              color: "#8A5A2B",
              fontWeight: 700,
              borderRadius: 4,
            }}
          >
            Shared trip
          </div>
          {context && <span>{context}</span>}
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
          {trip.destinations.length > 0 && (
            <span>{trip.destinations.length} regions ranked</span>
          )}
          {trip.score !== null && (
            <>
              {trip.destinations.length > 0 && <span>·</span>}
              <span>Match {trip.score}</span>
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
