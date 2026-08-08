import { Context, Effect, Layer, Option, Redacted, Schema } from "effect";

import { ServerConfig } from "../config";

const completionContent = Schema.Struct({
  choices: Schema.Array(Schema.Struct({
    message: Schema.Struct({ content: Schema.String }),
  })).pipe(Schema.check(Schema.isMinLength(1))),
});

/** Typed failure from the model provider boundary. */
export class ModelGatewayError extends Schema.TaggedError<ModelGatewayError>()(
  "Kairo.ModelGatewayError",
  {
    category: Schema.Literals(["configuration", "transport", "rejected", "invalid_response"] as const),
    retryable: Schema.Boolean,
    status: Schema.optionalKey(Schema.Int),
  },
) {}

/** Provider-independent model completion boundary. */
export interface ModelGatewayShape {
  readonly complete: (system: string, context: string) => Effect.Effect<string, ModelGatewayError>;
}

/** Model gateway service tag. */
export class ModelGateway extends Context.Service<ModelGateway, ModelGatewayShape>()("kairo/server/ModelGateway") {}

const endpoint = "https://opencode.ai/zen/go/v1/chat/completions";

/** Live OpenCode Go gateway using DeepSeek V4 Flash. */
export const openCodeGoGatewayLayer = Layer.effect(ModelGateway, Effect.gen(function* () {
  const config = yield* ServerConfig;
  if (Option.isNone(config.openCodeGoApiKey)) {
    return yield* new ModelGatewayError({ category: "configuration", retryable: false });
  }
  const apiKey = config.openCodeGoApiKey.value;

  const complete = Effect.fn("ModelGateway.complete")((system: string, context: string) => Effect.gen(function* () {
    const response = yield* Effect.tryPromise({
      try: (signal) => fetch(endpoint, {
        method: "POST",
        signal,
        headers: {
          authorization: `Bearer ${Redacted.value(apiKey)}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model: "deepseek-v4-flash",
          temperature: 0.2,
          max_tokens: 2_000,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: system },
            { role: "user", content: context },
          ],
        }),
      }),
      catch: () => new ModelGatewayError({ category: "transport", retryable: true }),
    });
    if (!response.ok) {
      return yield* new ModelGatewayError({
        category: "rejected",
        retryable: response.status === 408 || response.status === 429 || response.status >= 500,
        status: response.status,
      });
    }
    const body = yield* Effect.tryPromise({
      try: () => response.json(),
      catch: () => new ModelGatewayError({ category: "invalid_response", retryable: false }),
    });
    const decoded = yield* Schema.decodeUnknownEffect(completionContent)(body).pipe(
      Effect.mapError(() => new ModelGatewayError({ category: "invalid_response", retryable: false })),
    );
    const first = decoded.choices[0];
    if (!first) return yield* new ModelGatewayError({ category: "invalid_response", retryable: false });
    return first.message.content;
  }));

  return ModelGateway.of({ complete });
}));
