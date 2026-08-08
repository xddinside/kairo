import { Context, Effect, Layer, Schema } from "effect";
import { Database as ProductionDatabase, type DatabaseService as ProductionDatabaseService } from "./database/service";

export { ProductionDatabase as Database };

export class DatabaseError extends Schema.TaggedError<DatabaseError>()("Kairo.DatabaseError", {
  message: Schema.String,
}) {}

export type DatabaseService = Pick<ProductionDatabaseService, "healthcheck">;

export const databaseLayer = (service: DatabaseService): Layer.Layer<ProductionDatabase> =>
  Layer.succeed(ProductionDatabase, service as ProductionDatabaseService);

export class FileStorageError extends Schema.TaggedError<FileStorageError>()("Kairo.FileStorageError", {
  message: Schema.String,
}) {}

export interface FileStorageService {
  readonly healthcheck: () => Effect.Effect<"ready", FileStorageError>;
}

export class FileStorage extends Context.Service<FileStorage, FileStorageService>()(
  "kairo/server/FileStorage",
) {}

export const fileStorageLayer = (service: FileStorageService): Layer.Layer<FileStorage> =>
  Layer.succeed(FileStorage, service);
