import { Button } from "@cloudflare/kumo/components/button";
import { Input } from "@cloudflare/kumo/components/input";
import { LayerCard } from "@cloudflare/kumo/components/layer-card";
import { Text } from "@cloudflare/kumo/components/text";
import { CaretLeft, CaretRight, PencilSimple } from "@phosphor-icons/react";
import { useRouter } from "@tanstack/react-router";
import { startTransition, useRef, useState, type FormEvent } from "react";

import type { Task } from "../../server/academic/domain";
import type { CanvasDetail } from "../../server/canvas/domain";
import {
  appendCanvasActivity,
  renameCanvas,
} from "../../server/canvas/functions";
import { generateCanvasView } from "../../server/generation/functions";
import { GeneratedView } from "./generated-view";

const formatStamp = (value: string): string =>
  new Date(value).toLocaleString(undefined, {
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "numeric",
    minute: "2-digit",
  });

type ClarificationState = { readonly questionId: string; readonly question: string; readonly requestActivityId: string; readonly expectedVersion: number };

const initialClarification = (canvasId: string): ClarificationState | undefined => {
  if (typeof window === "undefined") return undefined;
  const key = `kairo:clarification:${canvasId}`;
  const stored = sessionStorage.getItem(key);
  sessionStorage.removeItem(key);
  if (!stored) return undefined;
  try {
    const value: unknown = JSON.parse(stored);
    if (!value || typeof value !== "object") return undefined;
    if (!("questionId" in value) || !("question" in value) || !("requestActivityId" in value) || !("expectedVersion" in value)) return undefined;
    if (typeof value.questionId !== "string" || typeof value.question !== "string" || typeof value.requestActivityId !== "string" || typeof value.expectedVersion !== "number") return undefined;
    return { questionId: value.questionId, question: value.question, requestActivityId: value.requestActivityId, expectedVersion: value.expectedVersion };
  } catch { return undefined; }
};

const initialRecovery = (canvasId: string): { readonly requestActivityId: string; readonly expectedVersion: number } | undefined => {
  if (typeof window === "undefined") return undefined;
  const key = `kairo:recovery:${canvasId}`;
  const stored = sessionStorage.getItem(key);
  sessionStorage.removeItem(key);
  if (!stored) return undefined;
  try {
    const value: unknown = JSON.parse(stored);
    if (!value || typeof value !== "object" || !("requestActivityId" in value) || !("expectedVersion" in value)) return undefined;
    if (typeof value.requestActivityId !== "string" || typeof value.expectedVersion !== "number") return undefined;
    return { requestActivityId: value.requestActivityId, expectedVersion: value.expectedVersion };
  } catch { return undefined; }
};

/** Saved Canvas activity and immutable Generated view history surface. */
export function SavedCanvas({ detail, tasks }: { readonly detail: CanvasDetail; readonly tasks: ReadonlyArray<Task> }) {
  const router = useRouter();
  const [selectedIndex, setSelectedIndex] = useState(
    Math.max(0, detail.history.length - 1),
  );
  const [prompt, setPrompt] = useState("");
  const [title, setTitle] = useState(detail.canvas.title ?? "Untitled canvas");
  const [renaming, setRenaming] = useState(false);
  const [pending, setPending] = useState(false);
  const recoveredGeneration = initialRecovery(detail.canvas.id);
  const [recovery, setRecovery] = useState(Boolean(recoveredGeneration));
  const [clarification, setClarification] = useState<ClarificationState | undefined>(() => initialClarification(detail.canvas.id));
  const [lastGeneration, setLastGeneration] = useState<{ readonly requestActivityId: string; readonly expectedVersion: number } | undefined>(recoveredGeneration);
  const generationToken = useRef(0);
  const canvasVersion = useRef(detail.canvas.version);
  if (detail.canvas.version > canvasVersion.current) canvasVersion.current = detail.canvas.version;
  const selected = detail.history[selectedIndex];
  const archived = detail.canvas.state === "archived";

  const rename = async (event: FormEvent) => {
    event.preventDefault();
    if (!title.trim()) return;
    const result = await renameCanvas({
      data: {
        canvasId: detail.canvas.id,
        expectedVersion: detail.canvas.version,
        clientRequestId: crypto.randomUUID(),
        title,
      },
    });
    if (result._tag !== "applied") return;
    setRenaming(false);
    startTransition(() => void router.invalidate());
  };

  const append = async (event: FormEvent) => {
    event.preventDefault();
    if (!prompt.trim() || pending || archived) return;
    setPending(true);
    try {
      const result = await appendCanvasActivity({
        data: {
          canvasId: detail.canvas.id,
          expectedVersion: canvasVersion.current,
          clientRequestId: crypto.randomUUID(),
          activity: {
            kind: "request",
            text: prompt.trim(),
            sourceViewId: selected?.id ?? null,
            fileIds: [],
          },
        },
      });
      if (result._tag !== "activity_appended") return;
      canvasVersion.current = result.canvas.version;
      setPrompt("");
      setLastGeneration({ requestActivityId: result.activity.id, expectedVersion: result.canvas.version });
      const token = ++generationToken.current;
      const generated = await generateCanvasView({ data: {
        canvasId: detail.canvas.id,
        requestActivityId: result.activity.id,
        expectedVersion: result.canvas.version,
        clientRequestId: crypto.randomUUID(),
      } });
      if (token !== generationToken.current) return;
      if (generated._tag === "clarification_required") {
        setClarification({ ...generated, requestActivityId: result.activity.id, expectedVersion: result.canvas.version });
        setRecovery(false);
      } else if (generated._tag === "view_ready") {
        setClarification(undefined);
        setRecovery(false);
        startTransition(() => void router.invalidate());
      } else {
        setRecovery(true);
      }
    } finally {
      setPending(false);
    }
  };

  const answerClarification = async (answer: string) => {
    if (!clarification || !answer.trim() || pending) return;
    setPending(true);
    try {
      const appended = await appendCanvasActivity({ data: {
        canvasId: detail.canvas.id,
        expectedVersion: canvasVersion.current,
        clientRequestId: crypto.randomUUID(),
        activity: { kind: "clarification_answer", questionId: clarification.questionId, text: answer.trim() },
      } });
      if (appended._tag !== "activity_appended") { setRecovery(true); return; }
      canvasVersion.current = appended.canvas.version;
      setLastGeneration({ requestActivityId: clarification.requestActivityId, expectedVersion: appended.canvas.version });
      const generated = await generateCanvasView({ data: {
        canvasId: detail.canvas.id,
        requestActivityId: clarification.requestActivityId,
        expectedVersion: appended.canvas.version,
        clientRequestId: crypto.randomUUID(),
      } });
      if (generated._tag === "view_ready") {
        setClarification(undefined);
        setRecovery(false);
        startTransition(() => void router.invalidate());
      } else if (generated._tag === "clarification_required") {
        setClarification({ ...generated, requestActivityId: clarification.requestActivityId, expectedVersion: appended.canvas.version });
      } else setRecovery(true);
    } finally { setPending(false); }
  };

  const cancelGeneration = () => {
    generationToken.current += 1;
    setPending(false);
    setRecovery(false);
  };

  const recordAction = async (action: string, input: unknown) => {
    const result = await appendCanvasActivity({ data: {
      canvasId: detail.canvas.id,
      expectedVersion: canvasVersion.current,
      clientRequestId: crypto.randomUUID(),
      activity: { kind: "accepted_action", action, input },
    } });
    if (result._tag === "activity_appended") canvasVersion.current = result.canvas.version;
  };

  const retryGeneration = async () => {
    if (!lastGeneration || pending) return;
    setPending(true);
    setRecovery(false);
    try {
      const generated = await generateCanvasView({ data: {
        canvasId: detail.canvas.id,
        requestActivityId: lastGeneration.requestActivityId,
        expectedVersion: lastGeneration.expectedVersion,
        clientRequestId: crypto.randomUUID(),
      } });
      if (generated._tag === "view_ready") startTransition(() => void router.invalidate());
      else if (generated._tag === "clarification_required") setClarification({ ...generated, ...lastGeneration });
      else setRecovery(true);
    } finally { setPending(false); }
  };

  return (
    <main className="bg-kumo-canvas">
      <div className="mx-auto flex min-h-[calc(100svh-3.5rem)] w-full max-w-2xl flex-col gap-8 px-6 pt-12 pb-44 md:min-h-screen">
        <header className="flex items-start justify-between gap-4">
          {renaming ? (
            <form onSubmit={rename} className="flex w-full items-center gap-2">
              <Input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                aria-label="Canvas name"
                autoFocus
              />
              <Button
                type="submit"
                className="shrink-0 transition-transform duration-150 ease-out active:not-disabled:scale-[0.96]"
              >
                Save
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={() => setRenaming(false)}
                className="shrink-0"
              >
                Cancel
              </Button>
            </form>
          ) : (
            <>
              <div className="grid min-w-0 gap-1.5">
                <Text as="h1" variant="heading2">
                  {detail.canvas.title ?? "Untitled canvas"}
                </Text>
                <Text variant="secondary" size="base">
                  {archived
                    ? "Archived"
                    : selected
                      ? `Generated ${formatStamp(selected.createdAt)}`
                      : "No view generated yet"}
                </Text>
              </div>
              <Button
                variant="ghost"
                shape="square"
                aria-label="Rename canvas"
                icon={<PencilSimple aria-hidden="true" size={16} />}
                onClick={() => setRenaming(true)}
                className="shrink-0 transition-transform duration-150 ease-out active:not-disabled:scale-[0.96]"
              />
            </>
          )}
        </header>

        <div className="grid gap-6">
          <section aria-label="Generated view">
            {selected ? (
              <LayerCard>
                <LayerCard.Secondary className="flex-wrap justify-between gap-x-4 gap-y-1 px-5 py-3">
                  <span className="flex items-center gap-2 text-sm font-medium text-kumo-default tabular-nums">
                    <span
                      aria-hidden="true"
                      className="size-1.5 rounded-full bg-kumo-success"
                    />
                    View {selected.historySequence}
                  </span>
                  <time
                    className="text-sm font-normal text-kumo-subtle"
                    dateTime={selected.createdAt}
                  >
                    {formatStamp(selected.createdAt)}
                  </time>
                </LayerCard.Secondary>
                <LayerCard.Primary className="gap-4 px-5 py-4">
                  <GeneratedView spec={selected.spec} tasks={tasks} onAction={recordAction} />
                  {selected.rationale ? <p className="border-t border-kumo-line pt-4 text-sm leading-6 text-kumo-subtle">{selected.rationale}</p> : null}
                </LayerCard.Primary>
              </LayerCard>
            ) : (
              <LayerCard className="px-5 py-4">
                <div className="grid gap-1.5 py-8 text-center">
                  <Text as="h2" variant="heading3">
                    Ready for a view
                  </Text>
                  <Text variant="secondary" size="base">
                    Ask Kairo to shape this canvas.
                  </Text>
                </div>
              </LayerCard>
            )}
          </section>

          {clarification ? (
            <LayerCard className="px-5 py-5">
              <form className="grid gap-4" onSubmit={(event) => { event.preventDefault(); void answerClarification(prompt); }}>
                <Text as="h2" variant="heading3">{clarification.question}</Text>
                <div className="flex gap-2"><Input value={prompt} onChange={(event) => setPrompt(event.target.value)} aria-label="Clarification answer" /><Button type="submit" disabled={pending || !prompt.trim()}>Continue</Button></div>
              </form>
            </LayerCard>
          ) : null}

          {recovery ? (
            <LayerCard className="px-5 py-5"><div className="grid gap-4"><Text as="h2" variant="heading3">Kairo couldn’t update this view</Text><div className="flex gap-2"><Button onClick={() => void retryGeneration()}>Try again</Button>{selected ? <Button variant="secondary" onClick={() => setRecovery(false)}>Use last view</Button> : null}</div></div></LayerCard>
          ) : null}

          {detail.history.length > 1 ? (
            <nav
              aria-label="Generated view history"
              className="flex items-center justify-center gap-3"
            >
              <Button
                variant="secondary"
                shape="square"
                aria-label="Previous view"
                icon={<CaretLeft aria-hidden="true" size={16} />}
                disabled={selectedIndex === 0}
                onClick={() => setSelectedIndex((value) => value - 1)}
                className="transition-transform duration-150 ease-out active:not-disabled:scale-[0.96]"
              />
              <span className="min-w-16 text-center text-sm text-kumo-subtle tabular-nums">
                {selectedIndex + 1} of {detail.history.length}
              </span>
              <Button
                variant="secondary"
                shape="square"
                aria-label="Next view"
                icon={<CaretRight aria-hidden="true" size={16} />}
                disabled={selectedIndex === detail.history.length - 1}
                onClick={() => setSelectedIndex((value) => value + 1)}
                className="transition-transform duration-150 ease-out active:not-disabled:scale-[0.96]"
              />
            </nav>
          ) : null}
        </div>
      </div>

      <div className="fixed inset-x-0 bottom-4 z-40 md:left-(--sidebar-width) md:group-data-[state=collapsed]/sidebar-wrapper:left-(--sidebar-width-icon)">
        <div className="mx-auto w-full max-w-2xl px-6">
          <form
            onSubmit={append}
            aria-label="Ask Kairo"
            className="flex w-full items-center gap-2 rounded-full bg-kumo-base py-1.5 ps-5 pe-2 shadow-lg ring ring-kumo-line transition-shadow focus-within:ring-2 focus-within:ring-kumo-focus/50"
          >
            <input
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              disabled={archived}
              placeholder={
                archived
                  ? "Restore this canvas to continue"
                  : "Ask Kairo to shape your day…"
              }
              aria-label="Ask Kairo"
              className="h-9 min-w-0 flex-1 border-0 bg-transparent px-0 font-sans text-lg leading-6 text-kumo-default placeholder:text-kumo-placeholder outline-none focus:outline-none focus:ring-0 disabled:text-kumo-subtle"
            />
            <Button
              variant="primary"
              size="base"
              type="submit"
              disabled={pending || !prompt.trim() || archived}
              className="shrink-0 rounded-full text-lg transition-transform duration-150 ease-out active:not-disabled:scale-[0.96]"
            >
              {pending ? "Sending" : "Generate"}
            </Button>
            {pending ? <Button variant="ghost" size="base" type="button" onClick={cancelGeneration}>Cancel</Button> : null}
          </form>
        </div>
      </div>
    </main>
  );
}
