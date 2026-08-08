import { Config, Context, Effect, Layer, Option, Redacted, Schema } from "effect";

export const serverEnvironmentValues = ["local", "test", "ci", "preview", "production"] as const;
export type ServerEnvironment = (typeof serverEnvironmentValues)[number];

export interface ServerConfigShape {
  readonly environment: ServerEnvironment;
  readonly origin: URL;
  readonly clerkPublishableKey: Option.Option<string>;
  readonly clerkSecretKey: Option.Option<Redacted.Redacted<string>>;
  readonly databaseUrl: Option.Option<Redacted.Redacted<URL>>;
  readonly directDatabaseUrl: Option.Option<Redacted.Redacted<URL>>;
  readonly databaseRuntimeRole: Option.Option<string>;
  readonly databaseMigrationRole: Option.Option<string>;
  readonly fileStorageEndpoint: Option.Option<URL>;
  readonly fileStorageBucket: Option.Option<string>;
  readonly fileStorageAccessKeyId: Option.Option<Redacted.Redacted<string>>;
  readonly fileStorageSecretAccessKey: Option.Option<Redacted.Redacted<string>>;
  readonly fileStorageSigningSecret: Option.Option<Redacted.Redacted<string>>;
  readonly cronSecret: Option.Option<Redacted.Redacted<string>>;
}

export class ServerConfig extends Context.Service<ServerConfig, ServerConfigShape>()(
  "kairo/server/ServerConfig",
) {}

export class InvalidServerConfig extends Schema.TaggedError<InvalidServerConfig>()(
  "Kairo.InvalidServerConfig",
  {
    environment: Schema.String,
    fields: Schema.Array(Schema.String),
    message: Schema.String,
  },
) {}

const environment = Config.string("KAIRO_ENV").pipe(Config.withDefault("local"));
const origin = Config.url("KAIRO_ORIGIN").pipe(Config.withDefault(new URL("http://localhost:4173")));
const optionalPublishableKey = Config.option(Config.nonEmptyString("VITE_CLERK_PUBLISHABLE_KEY"));
const optionalSecret = (name: string) => Config.option(Config.redacted(name));
const optionalUrl = (name: string) => Config.option(Config.url(name).pipe(Config.map(Redacted.make)));
const optionalStorageEndpoint = Config.option(Config.url("FILE_STORAGE_ENDPOINT"));
const optionalBucket = Config.option(Config.nonEmptyString("FILE_STORAGE_BUCKET"));
const optionalRole = (name: string) => Config.option(Config.nonEmptyString(name));

const readServerConfig = Effect.gen(function* () {
  return {
    environment: yield* environment,
    origin: yield* origin,
    clerkPublishableKey: yield* optionalPublishableKey,
    clerkSecretKey: yield* optionalSecret("CLERK_SECRET_KEY"),
    databaseUrl: yield* optionalUrl("DATABASE_URL"),
    directDatabaseUrl: yield* optionalUrl("DIRECT_DATABASE_URL"),
    databaseRuntimeRole: yield* optionalRole("DATABASE_RUNTIME_ROLE"),
    databaseMigrationRole: yield* optionalRole("DATABASE_MIGRATION_ROLE"),
    fileStorageEndpoint: yield* optionalStorageEndpoint,
    fileStorageBucket: yield* optionalBucket,
    fileStorageAccessKeyId: yield* optionalSecret("FILE_STORAGE_ACCESS_KEY_ID"),
    fileStorageSecretAccessKey: yield* optionalSecret("FILE_STORAGE_SECRET_ACCESS_KEY"),
    fileStorageSigningSecret: yield* optionalSecret("FILE_STORAGE_SIGNING_SECRET"),
    cronSecret: yield* optionalSecret("CRON_SECRET"),
  };
});

const isServerEnvironment = (value: string): value is ServerEnvironment =>
  serverEnvironmentValues.some((candidate) => candidate === value);

const isWebOrigin = (value: URL): boolean =>
  (value.protocol === "http:" || value.protocol === "https:") &&
  value.username === "" &&
  value.password === "" &&
  value.pathname === "/" &&
  value.search === "" &&
  value.hash === "";

const isPostgresUrl = (value: URL): boolean => value.protocol === "postgres:" || value.protocol === "postgresql:";

const hasValue = <A>(value: Option.Option<A>): boolean => Option.isSome(value);

const isLiveClerkSecret = (value: Option.Option<Redacted.Redacted<string>>): boolean =>
  Option.isSome(value) && Redacted.value(value.value).startsWith("sk_live_");

const isLiveClerkPublishableKey = (value: Option.Option<string>): boolean =>
  Option.isSome(value) && value.value.startsWith("pk_live_");

const validateServerConfig = Effect.fn("ServerConfig.validate")(function* (
  config: Omit<ServerConfigShape, "environment"> & { readonly environment: string },
) {
  const fields: Array<string> = [];

  if (!isServerEnvironment(config.environment)) fields.push("KAIRO_ENV");
  if (!isWebOrigin(config.origin)) fields.push("KAIRO_ORIGIN");

  if (config.environment === "production") {
    if (!isLiveClerkPublishableKey(config.clerkPublishableKey)) fields.push("VITE_CLERK_PUBLISHABLE_KEY");
    if (!isLiveClerkSecret(config.clerkSecretKey)) fields.push("CLERK_SECRET_KEY");
    if (!hasValue(config.databaseUrl)) fields.push("DATABASE_URL");
    if (!hasValue(config.directDatabaseUrl)) fields.push("DIRECT_DATABASE_URL");
    if (!hasValue(config.databaseRuntimeRole)) fields.push("DATABASE_RUNTIME_ROLE");
    if (!hasValue(config.databaseMigrationRole)) fields.push("DATABASE_MIGRATION_ROLE");
    if (Option.isSome(config.databaseRuntimeRole) && Option.isSome(config.databaseMigrationRole) && config.databaseRuntimeRole.value === config.databaseMigrationRole.value) fields.push("DATABASE_RUNTIME_ROLE");
    if (Option.isSome(config.databaseUrl) && !isPostgresUrl(Redacted.value(config.databaseUrl.value))) {
      fields.push("DATABASE_URL");
    }
    if (Option.isSome(config.directDatabaseUrl) && !isPostgresUrl(Redacted.value(config.directDatabaseUrl.value))) {
      fields.push("DIRECT_DATABASE_URL");
    }
    if (config.origin.protocol !== "https:") fields.push("KAIRO_ORIGIN");
    if (!hasValue(config.fileStorageEndpoint)) fields.push("FILE_STORAGE_ENDPOINT");
    if (Option.isSome(config.fileStorageEndpoint) && config.fileStorageEndpoint.value.protocol !== "https:") {
      fields.push("FILE_STORAGE_ENDPOINT");
    }
    if (!hasValue(config.fileStorageBucket)) fields.push("FILE_STORAGE_BUCKET");
    if (!hasValue(config.fileStorageAccessKeyId)) fields.push("FILE_STORAGE_ACCESS_KEY_ID");
    if (!hasValue(config.fileStorageSecretAccessKey)) fields.push("FILE_STORAGE_SECRET_ACCESS_KEY");
    if (!hasValue(config.fileStorageSigningSecret)) fields.push("FILE_STORAGE_SIGNING_SECRET");
  }

  if (fields.length > 0) {
    return yield* new InvalidServerConfig({
      environment: config.environment,
      fields: [...new Set(fields)],
      message: `Invalid server configuration for ${config.environment}: ${[...new Set(fields)].join(", ")}`,
    });
  }

  if (!isServerEnvironment(config.environment)) {
    return yield* new InvalidServerConfig({
      environment: config.environment,
      fields: ["KAIRO_ENV"],
      message: "Invalid KAIRO_ENV",
    });
  }

  return { ...config, environment: config.environment };
});

export const loadServerConfig = Effect.fn("ServerConfig.load")(function* () {
  const config = yield* readServerConfig;
  return yield* validateServerConfig(config);
});

export const layer = Layer.effect(ServerConfig, loadServerConfig());
