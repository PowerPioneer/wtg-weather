import type { CountryData } from "@/lib/types";

type StatKey = "temp" | "rain" | "sun";

/**
 * Three stat cards on the month page: temperature range, rainfall, sunshine.
 * Each shows the month's value alongside the year-wide range so readers have
 * immediate context — "47 mm" means nothing without the annual 8–168 range.
 */
export function MonthStats({
  country,
  monthIdx,
}: {
  country: CountryData;
  monthIdx: number;
}) {
  const c = country.climate;
  const tempLow = c.tMin[monthIdx];
  const tempHigh = c.tMax[monthIdx];

  const stats: { key: StatKey; title: string; value: string; detail: string }[] = [
    {
      key: "temp",
      title: "Temperature",
      value: `${tempLow.toFixed(0)} – ${tempHigh.toFixed(0)} °C`,
      detail: `Year range ${Math.min(...c.tMin).toFixed(0)} – ${Math.max(...c.tMax).toFixed(0)} °C`,
    },
    {
      key: "rain",
      title: "Rainfall",
      value: `${Math.round(c.r[monthIdx])} mm`,
      detail: `Year range ${Math.round(Math.min(...c.r))} – ${Math.round(Math.max(...c.r))} mm`,
    },
    {
      key: "sun",
      title: "Sunshine",
      value: `${c.s[monthIdx].toFixed(1)} hr / day`,
      detail: `Year range ${Math.min(...c.s).toFixed(1)} – ${Math.max(...c.s).toFixed(1)} hr / day`,
    },
  ];

  return (
    <section className="border-b border-border bg-background">
      <div className="mx-auto w-full max-w-[1280px] px-6 py-12 md:px-12">
        <div className="mb-6">
          <div className="text-[10.5px] font-semibold uppercase tracking-[0.16em] text-text-muted">
            What the weather usually does
          </div>
          <h2 className="mt-1 font-display text-[28px] font-medium leading-[1.2] text-text">
            {country.name} · typical month
          </h2>
        </div>
        <ul className="grid gap-4 md:grid-cols-3">
          {stats.map((s) => (
            <li
              key={s.key}
              className="flex flex-col gap-2 rounded-md border border-border bg-surface p-5"
            >
              <div className="text-[10.5px] font-semibold uppercase tracking-[0.16em] text-text-muted">
                {s.title}
              </div>
              <div className="font-display text-[34px] font-medium leading-none text-text">
                {s.value}
              </div>
              <div className="font-mono text-[11.5px] text-text-muted">{s.detail}</div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
