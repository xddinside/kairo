import { Effect, Schema } from "effect";

const PreviewIsolationInputSchema = Schema.Struct({
  previewId: Schema.NonEmptyString,
  origin: Schema.NonEmptyString,
  databaseUrl: Schema.NonEmptyString,
  storageEndpoint: Schema.NonEmptyString,
  storageBucket: Schema.NonEmptyString,
  productionOrigin: Schema.NonEmptyString,
  productionDatabaseUrl: Schema.NonEmptyString,
  productionStorageBucket: Schema.NonEmptyString,
});

export type PreviewIsolationInput = Schema.Schema.Type<typeof PreviewIsolationInputSchema>;

export class PreviewIsolationError extends Schema.TaggedError<PreviewIsolationError>()(
  "Kairo.PreviewIsolationError",
  {
    fields: Schema.Array(Schema.String),
    message: Schema.String,
  },
) {}

const normalize = (value: string): string => value.toLowerCase().replace(/[^a-z0-9]/g, "");

interface PostgresResourceIdentity {
  readonly hostname: string;
  readonly port: number;
  readonly databasePath: string;
  readonly key: string;
}

const parseUrl = (value: string): URL | undefined => {
  try {
    return new URL(value);
  } catch {
    return undefined;
  }
};

const postgresResourceIdentity = (value: URL): PostgresResourceIdentity | undefined => {
  if (value.protocol !== "postgres:" && value.protocol !== "postgresql:") return undefined;

  let databasePath: string;
  try {
    databasePath = (decodeURIComponent(value.pathname).replace(/\/+$/, "") || "/").toLowerCase();
  } catch {
    return undefined;
  }

  const hostname = value.hostname.toLowerCase().replace(/\.$/, "");
  const port = value.port === "" ? 5432 : Number(value.port);

  if (hostname === "" || !Number.isInteger(port) || port < 1 || port > 65_535) return undefined;

  return {
    hostname,
    port,
    databasePath,
    key: `${hostname}:${port}${databasePath}`,
  };
};

export const validatePreviewIsolation = Effect.fn("PreviewIsolation.validate")(function* (input: unknown) {
  const config = yield* Schema.decodeUnknownEffect(PreviewIsolationInputSchema)(input).pipe(
    Effect.mapError(() =>
      new PreviewIsolationError({
        fields: ["preview configuration"],
        message: "Preview configuration is missing or malformed",
      }),
    ),
  );
  const fields: Array<string> = [];
  const origin = parseUrl(config.origin);
  const databaseUrl = parseUrl(config.databaseUrl);
  const storageEndpoint = parseUrl(config.storageEndpoint);
  const productionOrigin = parseUrl(config.productionOrigin);
  const productionDatabaseUrl = parseUrl(config.productionDatabaseUrl);
  const databaseIdentity = databaseUrl === undefined ? undefined : postgresResourceIdentity(databaseUrl);
  const productionDatabaseIdentity =
    productionDatabaseUrl === undefined ? undefined : postgresResourceIdentity(productionDatabaseUrl);

  if (origin === undefined || (origin.protocol !== "http:" && origin.protocol !== "https:")) fields.push("origin");
  if (databaseIdentity === undefined) fields.push("databaseUrl");
  if (storageEndpoint === undefined || storageEndpoint.protocol !== "https:") fields.push("storageEndpoint");
  if (productionOrigin === undefined) fields.push("productionOrigin");
  if (productionDatabaseIdentity === undefined) fields.push("productionDatabaseUrl");

  const normalizedId = normalize(config.previewId);
  const databaseTarget =
    databaseIdentity === undefined ? "" : normalize(`${databaseIdentity.hostname}${databaseIdentity.databasePath}`);
  const bucketTarget = normalize(config.storageBucket);
  if (!databaseTarget.includes(normalizedId)) fields.push("databaseUrl.previewId");
  if (!bucketTarget.includes(normalizedId)) fields.push("storageBucket.previewId");

  const targets = [config.origin, config.storageEndpoint, config.storageBucket];
  if (targets.some((target) => /production|prod/i.test(target))) fields.push("production resource reference");
  if (config.origin === config.productionOrigin) fields.push("origin");
  if (
    databaseIdentity !== undefined &&
    productionDatabaseIdentity !== undefined &&
    databaseIdentity.key === productionDatabaseIdentity.key
  ) {
    fields.push("databaseUrl.resource");
  }
  if (config.storageBucket === config.productionStorageBucket) fields.push("storageBucket");

  if (fields.length > 0) {
    const uniqueFields = [...new Set(fields)];
    return yield* new PreviewIsolationError({
      fields: uniqueFields,
      message: `Preview isolation failed for: ${uniqueFields.join(", ")}`,
    });
  }

  return config;
});
