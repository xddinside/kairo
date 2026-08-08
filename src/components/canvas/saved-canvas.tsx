import { Button } from "@cloudflare/kumo/components/button";
import { Input } from "@cloudflare/kumo/components/input";
import { LayerCard } from "@cloudflare/kumo/components/layer-card";
import { Text } from "@cloudflare/kumo/components/text";
import { CaretLeft, CaretRight, PencilSimple } from "@phosphor-icons/react";
import { useRouter } from "@tanstack/react-router";
import { startTransition, useState, type FormEvent } from "react";

import type { CanvasDetail } from "../../server/canvas/domain";
import {
  appendCanvasActivity,
  renameCanvas,
} from "../../server/canvas/functions";

const formatStamp = (value: string): string =>
  new Date(value).toLocaleString(undefined, {
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "numeric",
    minute: "2-digit",
  });

/** Saved Canvas activity and immutable Generated view history surface. */
export function SavedCanvas({ detail }: { readonly detail: CanvasDetail }) {
  const router = useRouter();
  const [selectedIndex, setSelectedIndex] = useState(
    Math.max(0, detail.history.length - 1),
  );
  const [prompt, setPrompt] = useState("");
  const [title, setTitle] = useState(detail.canvas.title ?? "Untitled canvas");
  const [renaming, setRenaming] = useState(false);
  const [pending, setPending] = useState(false);
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
          expectedVersion: detail.canvas.version,
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
      setPrompt("");
      startTransition(() => void router.invalidate());
    } finally {
      setPending(false);
    }
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
                  {selected.rationale ? (
                    <p className="text-sm leading-6 text-kumo-subtle">
                      {selected.rationale}
                    </p>
                  ) : (
                    <p className="text-sm leading-6 text-kumo-subtle">
                      This view has no rationale recorded.
                    </p>
                  )}
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
          </form>
        </div>
      </div>
    </main>
  );
}
