import { describe, expect, it } from "vitest";

import {
  MONTH_KEYS,
  formatMonthRun,
  itemById,
  lastChecked,
  rowsForMonth,
  yearShape,
} from "./activities";
import { PERU_ACTIVITIES } from "./mock-activities";
import type { ActivityBlock, ActivityStatus } from "./types";

describe("formatMonthRun", () => {
  it("names a single month", () => {
    expect(formatMonthRun([2])).toBe("February");
  });

  it("collapses a contiguous run to a range", () => {
    expect(formatMonthRun([5, 6, 7, 8, 9])).toBe("May–September");
  });

  it("wraps a run across the year boundary", () => {
    // A southern dry season written as "January, February, March, November,
    // December" is the same fact and reads as four separate ones.
    expect(formatMonthRun([11, 12, 1, 2, 3])).toBe("November–March");
  });

  it("keeps genuinely separate runs separate", () => {
    expect(formatMonthRun([2, 6, 7])).toBe("February, June–July");
  });

  it("says 'all year' rather than listing twelve months", () => {
    expect(formatMonthRun([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12])).toBe("all year");
  });

  it("is empty for no months", () => {
    expect(formatMonthRun([])).toBe("");
  });

  it("abbreviates on request", () => {
    expect(formatMonthRun([5, 6, 7], false)).toBe("May–Jul");
  });
});

describe("yearShape", () => {
  it("groups an activity's months by status, worst first", () => {
    const shape = yearShape(PERU_ACTIVITIES, "inca-trail");
    expect(shape[0].status).toBe("closed");
    expect(shape[0].months).toEqual([2]);
    const best = shape.find((s) => s.status === "best");
    expect(best?.months).toEqual([5, 6, 7, 8, 9]);
  });

  it("omits the months a dated event is not on", () => {
    // Inti Raymi is held on 24 June. It is absent from the other eleven
    // months rather than listed as closed in them.
    const shape = yearShape(PERU_ACTIVITIES, "inti-raymi");
    expect(shape).toEqual([{ status: "best", months: [6] }]);
  });

  it("is empty for an id the block does not carry", () => {
    expect(yearShape(PERU_ACTIVITIES, "nope")).toEqual([]);
  });
});

describe("rowsForMonth", () => {
  it("puts the closure first", () => {
    const rows = rowsForMonth(PERU_ACTIVITIES, 1); // February
    expect(rows[0].id).toBe("inca-trail");
    expect(rows[0].status).toBe("closed");
  });

  it("narrows to a region's activities", () => {
    const rows = rowsForMonth(PERU_ACTIVITIES, 1, ["colca-condors"]);
    expect(rows.map((r) => r.id)).toEqual(["colca-condors"]);
  });

  it("returns nothing for a region with no curated activities", () => {
    expect(rowsForMonth(PERU_ACTIVITIES, 1, [])).toEqual([]);
  });
});

describe("the shipped Peru block", () => {
  it("keeps Machu Picchu open every month", () => {
    // The claim the previous version of this site got backwards, pinned on
    // both sides of the pipeline boundary.
    for (const key of MONTH_KEYS) {
      const row = PERU_ACTIVITIES.months[key].rows.find((r) => r.id === "machu-picchu");
      expect(row?.status, `${key}`).not.toBe("closed");
    }
  });

  it("closes the Inca Trail in February and only in February", () => {
    const closedMonths = MONTH_KEYS.filter((key) =>
      PERU_ACTIVITIES.months[key].rows.some(
        (r) => r.id === "inca-trail" && r.status === "closed",
      ),
    );
    expect(closedMonths).toEqual(["Feb"]);
  });

  it("gives every activity at least one source", () => {
    for (const item of PERU_ACTIVITIES.items) {
      expect(item.sources.length, item.id).toBeGreaterThan(0);
      for (const source of item.sources) {
        expect(source.url).toMatch(/^https:\/\//);
        expect(source.checked).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      }
    }
  });

  it("has an item for every id any month row names", () => {
    for (const key of MONTH_KEYS) {
      for (const row of PERU_ACTIVITIES.months[key].rows) {
        expect(itemById(PERU_ACTIVITIES, row.id), `${key}/${row.id}`).toBeDefined();
      }
    }
  });

  it("never claims a status in the lede that the rows do not show", () => {
    // The same invariant the pipeline tests pin, checked against what actually
    // shipped in the payload rather than against the generator.
    const claims: [ActivityStatus, string][] = [
      ["closed", "closes"],
      ["limited", "weather-dependent"],
    ];
    for (const key of MONTH_KEYS) {
      const { lede, rows } = PERU_ACTIVITIES.months[key];
      for (const [status, word] of claims) {
        if (!rows.some((r) => r.status === status)) {
          expect(lede, `${key}`).not.toContain(word);
        }
      }
    }
  });
});

describe("lastChecked", () => {
  it("returns the newest source date", () => {
    const block: ActivityBlock = {
      reviewed: "2020-01-01",
      lede: "",
      months: {},
      items: [
        {
          id: "a", name: "A", kind: "site", regions: [], yearRound: true,
          datedEvent: false, onMonths: [],
          sources: [
            { url: "https://a.test", checked: "2026-01-05" },
            { url: "https://b.test", checked: "2026-07-02" },
          ],
        },
      ],
    };
    expect(lastChecked(block)).toBe("2026-07-02");
  });

  it("falls back to the review date when nothing carries a source date", () => {
    const block: ActivityBlock = {
      reviewed: "2026-08-28", lede: "", months: {}, items: [],
    };
    expect(lastChecked(block)).toBe("2026-08-28");
  });
});
