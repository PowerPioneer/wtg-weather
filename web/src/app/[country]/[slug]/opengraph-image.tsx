import { ImageResponse } from "next/og";

import { getCountry } from "@/lib/api-client";
import { MONTH_NAMES, isMonthSlug, monthIndex } from "@/lib/months";
import { findRegion, regionBestMonthIndices } from "@/lib/regions";
import { MONTH_SLUGS } from "@/lib/months";
import { estimateMonthScore } from "@/lib/country-derive";

export const runtime = "nodejs";
export const contentType = "image/png";
export const size = { width: 1200, height: 630 };
export const alt = "Atlas Weather — month or region climate";

export default async function OG({
  params,
}: {
  params: Promise<{ country: string; slug: string }>;
}) {
  const { country, slug } = await params;
  const data = await getCountry(country);
  if (!data) return notFoundImage("Country not found");

  if (isMonthSlug(slug)) {
    const idx = monthIndex(slug);
    const monthName = MONTH_NAMES[slug];
    const score = estimateMonthScore(data, idx);
    const temp = data.climate.t[idx];
    const rain = data.climate.r[idx];
    return render({
      chip: "Month",
      eyebrow: `${data.name} · ${monthName}`,
      headline: `${data.name}`,
      tagline: `how ${monthName} reads`,
      stats: [
        { label: "Match", value: `${score}/100` },
        { label: "Temperature", value: `${temp.toFixed(0)}°C` },
        { label: "Rainfall", value: `${rain.toFixed(0)} mm` },
      ],
    });
  }

  const region = findRegion(data, slug);
  if (region) {
    const best = regionBestMonthIndices(data, region, 3)
      .map((i) => MONTH_NAMES[MONTH_SLUGS[i]])
      .join(" · ");
    const low = Math.min(...region.tl);
    const high = Math.max(...region.tl);
    return render({
      chip: "Region",
      eyebrow: `${data.name} · ${region.name}`,
      headline: region.name,
      tagline: "when to go",
      stats: [
        { label: "Match", value: `${region.score}/100` },
        { label: "Range", value: `${low.toFixed(0)}–${high.toFixed(0)}°C` },
        { label: "Best months", value: best || "—" },
      ],
    });
  }

  return notFoundImage("Not found");
}

function render({
  chip: chipText,
  eyebrow: eyebrowText,
  headline: headlineText,
  tagline: taglineText,
  stats,
}: {
  chip: string;
  eyebrow: string;
  headline: string;
  tagline: string;
  stats: { label: string; value: string }[];
}) {
  return new ImageResponse(
    (
      <div style={frame}>
        <div style={eyebrow}>
          <span style={chip}>{chipText}</span>
          <span>{eyebrowText}</span>
        </div>
        <div style={headline}>{headlineText}</div>
        <div style={tagline}>{taglineText}</div>
        <div style={{ flex: 1 }} />
        <div style={statsRow}>
          {stats.map((s) => (
            <Stat key={s.label} label={s.label} value={s.value} />
          ))}
        </div>
        <Footer />
      </div>
    ),
    size,
  );
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

function Footer() {
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
  color: "#B8763E",
  fontWeight: 700,
  borderRadius: 4,
};

const headline = {
  marginTop: 40,
  fontSize: 96,
  fontFamily: "serif",
  lineHeight: 1.02,
  letterSpacing: "-0.02em",
  display: "flex",
};

const tagline = {
  marginTop: 12,
  fontSize: 36,
  fontStyle: "italic" as const,
  color: "#8A4A1E",
  display: "flex",
};

const statsRow = {
  display: "flex",
  gap: 64,
};
