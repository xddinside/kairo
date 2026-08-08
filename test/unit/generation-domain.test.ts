import { describe, expect, it } from "vitest";

import { decodeModelResult } from "../../src/server/generation/domain";

const taskId = "123e4567-e89b-42d3-a456-426614174000";

describe("Generated view boundary", () => {
  it("accepts approved catalog blocks with authorized Task references", async () => {
    const result = await decodeModelResult({
      kind: "view",
      spec: {
        title: "Today",
        blocks: [
          { type: "Summary", heading: "Start here", body: "Finish the nearest work first." },
          { type: "TaskList", heading: "Open Tasks", taskIds: [taskId] },
          { type: "TaskCreator", heading: "Add a Task" },
        ],
      },
      rationale: "Ordered by due date.",
    }, new Set([taskId]));

    expect(result.kind).toBe("view");
  });

  it("rejects unknown components, executable fields, and foreign Task references", async () => {
    await expect(decodeModelResult({ kind: "view", spec: { title: "Unsafe", blocks: [{ type: "Html", html: "<script />" }] } }, new Set())).rejects.toThrow();
    await expect(decodeModelResult({ kind: "view", spec: { title: "Unsafe", blocks: [{ type: "Summary", heading: "A", body: "B", onClick: "run()" }] } }, new Set())).rejects.toThrow();
    await expect(decodeModelResult({ kind: "view", spec: { title: "Unsafe", blocks: [{ type: "TaskList", heading: "Tasks", taskIds: [taskId] }] } }, new Set())).rejects.toThrow(/outside the authorized context/);
  });

  it("accepts one bounded Clarification", async () => {
    await expect(decodeModelResult({ kind: "clarification", questionId: "time", question: "When should the plan start?" }, new Set())).resolves.toMatchObject({ kind: "clarification" });
  });
});
