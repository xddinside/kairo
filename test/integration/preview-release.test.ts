import { describe, expect, it } from "vitest";
import { Effect } from "effect";

import { validatePreviewIsolation } from "../../src/server/preview-isolation";
import { releaseRecordFields, validateReleaseRecord } from "../../src/server/release";

const isolatedPreview = {
  previewId: "pr-42",
  origin: "https://kairo-git-pr-42.example.test",
  databaseUrl: "postgresql://preview@db.example.test/kairo-preview-pr-42",
  storageEndpoint: "https://s3.filebase.io",
  storageBucket: "kairo-preview-pr-42",
  productionOrigin: "https://kairo.example.com",
  productionDatabaseUrl: "postgresql://runtime@db.example.com/kairo-production",
  productionStorageBucket: "kairo-production",
};

describe("preview and release contracts", () => {
  it("accepts isolated preview resources", async () => {
    const result = await Effect.runPromise(validatePreviewIsolation(isolatedPreview));
    expect(result.previewId).toBe("pr-42");
  });

  it("fails closed when a preview points at production", async () => {
    const result = await Effect.runPromiseExit(
      validatePreviewIsolation({
        ...isolatedPreview,
        databaseUrl: isolatedPreview.productionDatabaseUrl,
        storageBucket: isolatedPreview.productionStorageBucket,
      }),
    );

    expect(result._tag).toBe("Failure");
  });

  it("rejects the same database resource when credentials and query strings differ", async () => {
    const result = await Effect.runPromiseExit(
      validatePreviewIsolation({
        ...isolatedPreview,
        databaseUrl: "postgresql://preview:other@ep-pr-42.neon.tech/kairo-preview-pr-42?application_name=preview",
        productionDatabaseUrl: "postgresql://runtime:other@ep-pr-42.neon.tech:5432/kairo-preview-pr-42?sslmode=require",
      }),
    );

    expect(result._tag).toBe("Failure");
    expect(String(result)).not.toContain("other");
    expect(String(result)).not.toContain("application_name");
  });

  it("rejects a preview id that appears only in database credentials or query", async () => {
    const result = await Effect.runPromiseExit(
      validatePreviewIsolation({
        ...isolatedPreview,
        databaseUrl: "postgresql://pr-42@ep-preview.neon.tech/kairo?application_name=pr-42",
        productionDatabaseUrl: "postgresql://runtime@ep-production.neon.tech/kairo-production",
      }),
    );

    expect(result._tag).toBe("Failure");
    expect(String(result)).not.toContain("pr-42");
  });

  it("requires the immutable commit release id and every operations field", async () => {
    const record = Object.fromEntries(
      releaseRecordFields.map((field) => [field, field === "commit" || field === "release_id" ? "a".repeat(40) : "pending"]),
    );
    const result = await Effect.runPromise(validateReleaseRecord(record));

    expect(result.release_id).toBe("a".repeat(40));
    expect(Object.keys(result)).toEqual(expect.arrayContaining([...releaseRecordFields]));
  });

  it("rejects a mutable or abbreviated release id", async () => {
    const result = await Effect.runPromiseExit(
      validateReleaseRecord({
        ...Object.fromEntries(releaseRecordFields.map((field) => [field, "pending"])),
        release_id: "main",
        commit: "short",
      }),
    );

    expect(result._tag).toBe("Failure");
  });
});
