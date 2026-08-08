import { Effect, Schema } from "effect";

export const releaseRecordFields = [
  "release_id",
  "commit",
  "environment",
  "schema_migration",
  "catalog_version",
  "prompt_version",
  "model_id",
  "model_endpoint_checked_at",
  "runtime_node_version",
  "dependency_scan",
  "typecheck",
  "build",
  "unit_and_integration_tests",
  "browser_and_accessibility_tests",
  "performance_results",
  "database_backup_id",
  "database_restore_drill",
  "file_backup_manifest",
  "file_restore_drill",
  "security_headers_check",
  "sentry_release_and_alerts",
  "provider_terms_and_retention_checked_at",
  "rollback_target",
  "open_p1_items",
  "release_owner",
  "approved_at",
] as const;

const ReleaseRecordSchema = Schema.Struct({
  release_id: Schema.NonEmptyString,
  commit: Schema.NonEmptyString,
  environment: Schema.NonEmptyString,
  schema_migration: Schema.NonEmptyString,
  catalog_version: Schema.NonEmptyString,
  prompt_version: Schema.NonEmptyString,
  model_id: Schema.NonEmptyString,
  model_endpoint_checked_at: Schema.NonEmptyString,
  runtime_node_version: Schema.NonEmptyString,
  dependency_scan: Schema.NonEmptyString,
  typecheck: Schema.NonEmptyString,
  build: Schema.NonEmptyString,
  unit_and_integration_tests: Schema.NonEmptyString,
  browser_and_accessibility_tests: Schema.NonEmptyString,
  performance_results: Schema.NonEmptyString,
  database_backup_id: Schema.NonEmptyString,
  database_restore_drill: Schema.NonEmptyString,
  file_backup_manifest: Schema.NonEmptyString,
  file_restore_drill: Schema.NonEmptyString,
  security_headers_check: Schema.NonEmptyString,
  sentry_release_and_alerts: Schema.NonEmptyString,
  provider_terms_and_retention_checked_at: Schema.NonEmptyString,
  rollback_target: Schema.NonEmptyString,
  open_p1_items: Schema.NonEmptyString,
  release_owner: Schema.NonEmptyString,
  approved_at: Schema.NonEmptyString,
});

export type ReleaseRecord = Schema.Schema.Type<typeof ReleaseRecordSchema>;

export class InvalidReleaseRecord extends Schema.TaggedError<InvalidReleaseRecord>()(
  "Kairo.InvalidReleaseRecord",
  {
    fields: Schema.Array(Schema.String),
    message: Schema.String,
  },
) {}

export const validateReleaseRecord = Effect.fn("ReleaseRecord.validate")(function* (input: unknown) {
  const record = yield* Schema.decodeUnknownEffect(ReleaseRecordSchema)(input).pipe(
    Effect.mapError(() =>
      new InvalidReleaseRecord({
        fields: ["release record"],
        message: "Release record is missing a required field",
      }),
    ),
  );
  const fields: Array<string> = [];

  if (!/^[0-9a-f]{40}$/.test(record.commit)) fields.push("commit");
  if (record.release_id !== record.commit) fields.push("release_id");
  if (record.environment === "production" && record.approved_at === "pending") fields.push("approved_at");

  if (fields.length > 0) {
    const uniqueFields = [...new Set(fields)];
    return yield* new InvalidReleaseRecord({
      fields: uniqueFields,
      message: `Release record validation failed for: ${uniqueFields.join(", ")}`,
    });
  }

  return record;
});
