import { describe, expect, it } from "vitest";
import { ConfigProvider, Effect, Layer } from "effect";

import { ServerConfig } from "../../src/server/config";
import { foundationLayer } from "../../src/server/runtime";
import { Database, databaseLayer, FileStorage, fileStorageLayer } from "../../src/server/services";

describe("production foundation layers", () => {
  it("loads server configuration through a replaceable Effect layer", async () => {
    const result = await Effect.runPromise(
      ServerConfig.use((config) => Effect.succeed(config.environment)).pipe(
        Effect.provide(
          Layer.provide(
            foundationLayer,
            ConfigProvider.layer(ConfigProvider.fromUnknown({ KAIRO_ENV: "ci" })),
          ),
        ),
      ),
    );

    expect(result).toBe("ci");
  });

  it("keeps database and storage adapters behind typed service tags", async () => {
    const result = await Effect.runPromise(
      Effect.all({
        database: Database.use((service) => service.healthcheck()),
        storage: FileStorage.use((service) => service.healthcheck()),
      }).pipe(
        Effect.provide(
          Layer.merge(
            databaseLayer({ healthcheck: () => Effect.succeed("ready" as const) }),
            fileStorageLayer({ healthcheck: () => Effect.succeed("ready" as const) }),
          ),
        ),
      ),
    );

    expect(result).toEqual({ database: "ready", storage: "ready" });
  });
});
