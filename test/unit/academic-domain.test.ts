import { describe, expect, it } from "vitest";

import { canTransitionStatus, isIsoDate, validateAcademicFields } from "../../src/server/academic/domain";

describe("academic domain rules", () => {
  it("validates exact dates and due-time coupling", () => {
    expect(isIsoDate("2026-02-29")).toBe(false);
    expect(isIsoDate("2028-02-29")).toBe(true);
    expect(validateAcademicFields({ title: "Essay", dueTime: "09:00" })).toContainEqual(expect.objectContaining({ field: "dueTime" }));
  });

  it("requires reopening between terminal statuses", () => {
    expect(canTransitionStatus("open", "completed")).toBe(true);
    expect(canTransitionStatus("completed", "open")).toBe(true);
    expect(canTransitionStatus("completed", "cancelled")).toBe(false);
  });
});
