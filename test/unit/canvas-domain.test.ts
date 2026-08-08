import { Schema } from "effect";
import { describe, expect, it } from "vitest";

import { AppendGeneratedView, CanvasActivityContent, CreateCanvas } from "../../src/server/canvas/domain";

const id = "123e4567-e89b-42d3-a456-426614174000";

describe("Canvas domain schemas", () => {
  it("accepts the four strict activity variants", () => {
    const decode = Schema.decodeUnknownSync(CanvasActivityContent);
    expect(decode({ kind: "request", text: "Plan my week", sourceViewId: null, fileIds: [] }).kind).toBe("request");
    expect(decode({ kind: "attachment", fileId: id }).kind).toBe("attachment");
    expect(decode({ kind: "clarification_answer", questionId: "scope", text: "This week" }).kind).toBe("clarification_answer");
    expect(decode({ kind: "accepted_action", action: "task.create", input: { title: "Read" } }).kind).toBe("accepted_action");
  });

  it("rejects empty first activity content and unknown fields", () => {
    const decode = Schema.decodeUnknownSync(CreateCanvas, { onExcessProperty: "error" });
    expect(() => decode({ clientRequestId: "request-1", activity: { kind: "request", text: " ", sourceViewId: null, fileIds: [] } })).toThrow();
    expect(() => decode({ clientRequestId: "request-1", activity: { kind: "attachment", fileId: id, ownerId: "forged" } })).toThrow();
  });

  it("validates the immutable Generated view boundary while allowing JSON specs", () => {
    const decode = Schema.decodeUnknownSync(AppendGeneratedView);
    expect(decode({
      canvasId: id,
      expectedVersion: 1,
      clientRequestId: "view-1",
      requestActivityId: id,
      catalogVersion: "1",
      schemaVersion: "1",
      modelVersion: "model",
      promptVersion: "1",
      spec: { root: { type: "Stack", children: [] } },
      rationale: null,
      evidence: [{ type: "task", id }],
    }).spec).toEqual({ root: { type: "Stack", children: [] } });
  });
});
