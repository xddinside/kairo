import { Effect, Layer } from "effect";

import { layer as serverConfigLayer, ServerConfig, type ServerConfigShape } from "./config";

/** The shared foundation layer. Later server slices add their adapters beside this layer. */
export const foundationLayer = serverConfigLayer;

export const testFoundationLayer = (config: ServerConfigShape): Layer.Layer<ServerConfig> =>
  Layer.succeed(ServerConfig, config);

export const readFoundationConfig = ServerConfig.use((config) => Effect.succeed(config));
