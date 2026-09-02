/**
 * Month naming. The slug is lowercase English (january, february, …) and
 * drives the `/[country]/[month]` URL — search engines prefer it over numeric
 * paths, and it lets us swap locales later without URL breakage.
 */

export const MONTH_SLUGS = [
  "january",
  "february",
  "march",
  "april",
  "may",
  "june",
  "july",
  "august",
  "september",
  "october",
  "november",
  "december",
] as const;

export type MonthSlug = (typeof MONTH_SLUGS)[number];

export const MONTH_NAMES: Record<MonthSlug, string> = {
  january: "January",
  february: "February",
  march: "March",
  april: "April",
  may: "May",
  june: "June",
  july: "July",
  august: "August",
  september: "September",
  october: "October",
  november: "November",
  december: "December",
};

export const MONTH_SHORT: Record<MonthSlug, string> = {
  january: "Jan",
  february: "Feb",
  march: "Mar",
  april: "Apr",
  may: "May",
  june: "Jun",
  july: "Jul",
  august: "Aug",
  september: "Sep",
  october: "Oct",
  november: "Nov",
  december: "Dec",
};

export function isMonthSlug(s: string): s is MonthSlug {
  return (MONTH_SLUGS as readonly string[]).includes(s);
}

export function monthIndex(slug: MonthSlug): number {
  return MONTH_SLUGS.indexOf(slug);
}

export function previousMonth(slug: MonthSlug): MonthSlug {
  const i = monthIndex(slug);
  return MONTH_SLUGS[(i + 11) % 12];
}

export function nextMonth(slug: MonthSlug): MonthSlug {
  const i = monthIndex(slug);
  return MONTH_SLUGS[(i + 1) % 12];
}

/**
 * Days per calendar month, non-leap. Used to turn the pipeline's mm/day
 * rainfall into the mm/month the rainfall chart labels its axis with.
 * A leap day moves a February total by ~3%, which is inside the noise of a
 * ten-year mean and well under the chart's one-millimetre resolution.
 */
export const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31] as const;

/**
 * mm/day → mm/month.
 *
 * The two shapes are a real trap: `CountryData.climate.r` is already
 * mm/month (the pipeline converts it in `api_data.py`), while a region's
 * `rl` is mm/day. Feeding `rl` straight to a `kind="rain"` chart draws a
 * Dutch province as 2mm of rain in April under an axis labelled "mm".
 */
export function rainDayToMonth(perDay: readonly number[]): number[] {
  return perDay.map((v, i) => v * DAYS_IN_MONTH[i]);
}
