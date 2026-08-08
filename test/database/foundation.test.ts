import { describe, expect, it } from "vitest";

import { isIsolatedDatabaseTestUrl } from "../../src/server/database-contract";

describe("database test boundary", () => {
  it("only permits explicit test or preview database targets", () => {
    const value = process.env.KAIRO_DATABASE_TEST_URL ?? "";

    expect(isIsolatedDatabaseTestUrl(value)).toBe(true);
    expect(isIsolatedDatabaseTestUrl("postgresql://runtime@db.example/kairo-production")).toBe(false);
  });
});
