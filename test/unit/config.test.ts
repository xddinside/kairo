import { describe, expect, it } from "vitest";
import { ConfigProvider, Effect, Option, Redacted } from "effect";

import { InvalidServerConfig, loadServerConfig } from "../../src/server/config";

const load = (input: Record<string, unknown>) =>
  Effect.runPromiseExit(
    loadServerConfig().pipe(Effect.provide(ConfigProvider.layer(ConfigProvider.fromUnknown(input)))),
  );

const run = (input: Record<string, unknown>) =>
  Effect.runPromise(loadServerConfig().pipe(Effect.provide(ConfigProvider.layer(ConfigProvider.fromUnknown(input)))));

describe("server configuration", () => {
  it("provides safe local defaults without production credentials", async () => {
    const result = await load({ KAIRO_ENV: "test" });

    expect(result._tag).toBe("Success");
    if (result._tag === "Success") {
      expect(result.value.environment).toBe("test");
      expect(result.value.origin.href).toBe("http://localhost:4173/");
      expect(Option.isNone(result.value.databaseUrl)).toBe(true);
      expect(String(Redacted.make("not-used"))).toBe("<redacted>");
    }
  });

  it("fails production configuration with named missing fields", async () => {
    const result = await load({ KAIRO_ENV: "production", KAIRO_ORIGIN: "https://kairo.example" });

    expect(result._tag).toBe("Failure");
    expect(String(result)).not.toContain("sk_live_");

    try {
      await run({ KAIRO_ENV: "production", KAIRO_ORIGIN: "https://kairo.example" });
      expect.fail("production config should fail");
    } catch (error) {
      expect(error).toBeInstanceOf(InvalidServerConfig);
      if (error instanceof InvalidServerConfig) {
        expect(error.fields).toContain("CLERK_SECRET_KEY");
        expect(error.fields).toContain("DATABASE_URL");
        expect(error.fields).toContain("OPENCODE_GO_API_KEY");
      }
    }
  });

  it("rejects a non-live Clerk key in production", async () => {
    const result = await load({
      KAIRO_ENV: "production",
      KAIRO_ORIGIN: "https://kairo.example",
      CLERK_SECRET_KEY: "sk_test_not-for-production",
      DATABASE_URL: "postgresql://db.example/preview",
      DIRECT_DATABASE_URL: "postgresql://db.example/preview-direct",
      FILE_STORAGE_ENDPOINT: "https://s3.example",
      FILE_STORAGE_BUCKET: "kairo-preview",
      FILE_STORAGE_ACCESS_KEY_ID: "access",
      FILE_STORAGE_SECRET_ACCESS_KEY: "secret",
      FILE_STORAGE_SIGNING_SECRET: "signing",
    });

    expect(result._tag).toBe("Failure");
    if (result._tag === "Failure") {
      expect(result.cause).toBeDefined();
    }
  });
});
