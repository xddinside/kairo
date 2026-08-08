import { describe, expect, it } from "vitest";
import { Effect } from "effect";

import { DatabaseUnavailable, retryTransient } from "../../src/server/database/service";

describe("Effect database retry policy", () => {
  it("retries transient database errors and not domain failures", async () => {
    let attempts = 0;
    const transient = Effect.suspend(() => {
      attempts += 1;
      return attempts < 3
        ? Effect.fail(new DatabaseUnavailable({ message: "serialization", requestId: `r-${attempts}`, retryable: true }))
        : Effect.succeed("committed");
    });
    expect(await Effect.runPromise(retryTransient(transient))).toBe("committed");
    expect(attempts).toBe(3);

    let domainAttempts = 0;
    const domain = Effect.suspend(() => {
      domainAttempts += 1;
      return Effect.fail(new DatabaseUnavailable({ message: "ownership", requestId: "domain", retryable: false }));
    });
    await expect(Effect.runPromise(retryTransient(domain))).rejects.toMatchObject({ retryable: false });
    expect(domainAttempts).toBe(1);
  });
});
