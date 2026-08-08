import { describe, expect, it } from "vitest";

import {
  expandOccurrences,
  occursOn,
  resolveLocalInstant,
  validateTimetableEntry,
  weekday,
} from "../../src/server/timetable/domain";

const weekly = {
  kind: "weekly" as const,
  startDate: "2026-03-01",
  endDate: "2026-03-31",
  daysOfWeek: [1, 3],
  startTime: "09:00",
  endTime: "10:00",
  exceptions: ["2026-03-09"],
};

describe("Timetable recurrence", () => {
  it("expands selected weekdays and applies explicit exceptions", () => {
    const occurrences = expandOccurrences(weekly, "2026-03-02", "2026-03-11", "UTC");
    expect(occurrences.map(({ date }) => date)).toEqual(["2026-03-02", "2026-03-04", "2026-03-11"]);
    expect(occursOn(weekly, "2026-03-09")).toBe(false);
    expect(weekday("2026-03-02")).toBe(1);
  });

  it("keeps local wall-clock times stable across a DST offset change", () => {
    const occurrences = expandOccurrences(
      { ...weekly, daysOfWeek: [0], exceptions: [], startDate: "2026-03-01", endDate: "2026-03-15" },
      "2026-03-01",
      "2026-03-15",
      "America/New_York",
    );
    expect(occurrences.map(({ startTime }) => startTime)).toEqual(["09:00", "09:00", "09:00"]);
    expect(occurrences[0]?.startInstant).toContain("14:00:00.000Z");
    expect(occurrences[1]?.startInstant).toContain("13:00:00.000Z");
  });

  it("rejects local times inside a DST gap", () => {
    expect(resolveLocalInstant("2026-03-08", "02:30", "America/New_York")).toBeUndefined();
    expect(validateTimetableEntry({
      kind: "one_off",
      startDate: "2026-03-08",
      endDate: "2026-03-08",
      daysOfWeek: [],
      startTime: "02:30",
      endTime: "03:30",
    }, "America/New_York")).toContainEqual(expect.objectContaining({ field: "startTime" }));
  });

  it("resolves an ambiguous repeated hour to the earlier instant", () => {
    expect(resolveLocalInstant("2026-11-01", "01:30", "America/New_York")?.toISOString()).toBe("2026-11-01T05:30:00.000Z");
  });

  it("rejects malformed recurrence and time ranges", () => {
    expect(validateTimetableEntry({ kind: "weekly", startDate: "2026-04-02", endDate: "2026-04-01", daysOfWeek: [], startTime: "10:00", endTime: "09:00" }, "UTC").map(({ field }) => field)).toEqual(expect.arrayContaining(["endDate", "endTime", "daysOfWeek"]));
  });
});
