import { Button } from "@cloudflare/kumo/components/button";
import { Input } from "@cloudflare/kumo/components/input";
import { LayerCard } from "@cloudflare/kumo/components/layer-card";
import { CaretLeft, CaretRight, PencilSimple } from "@phosphor-icons/react";
import { useRouter } from "@tanstack/react-router";
import { startTransition, useState, type FormEvent } from "react";

import type { CanvasDetail } from "../../server/canvas/domain";
import { appendCanvasActivity, renameCanvas } from "../../server/canvas/functions";

/** Saved Canvas activity and immutable Generated view history surface. */
export function SavedCanvas({ detail }: { readonly detail: CanvasDetail }) {
  const router = useRouter();
  const [selectedIndex, setSelectedIndex] = useState(Math.max(0, detail.history.length - 1));
  const [prompt, setPrompt] = useState("");
  const [title, setTitle] = useState(detail.canvas.title ?? "Untitled canvas");
  const [renaming, setRenaming] = useState(false);
  const [pending, setPending] = useState(false);
  const selected = detail.history[selectedIndex];

  const rename = async (event: FormEvent) => {
    event.preventDefault();
    if (!title.trim()) return;
    const result = await renameCanvas({ data: { canvasId: detail.canvas.id, expectedVersion: detail.canvas.version, clientRequestId: crypto.randomUUID(), title } });
    if (result._tag === "applied") {
      setRenaming(false);
      startTransition(() => void router.invalidate());
    }
  };

  const append = async (event: FormEvent) => {
    event.preventDefault();
    if (!prompt.trim() || pending || detail.canvas.state === "archived") return;
    setPending(true);
    try {
      const result = await appendCanvasActivity({ data: {
        canvasId: detail.canvas.id,
        expectedVersion: detail.canvas.version,
        clientRequestId: crypto.randomUUID(),
        activity: { kind: "request", text: prompt.trim(), sourceViewId: selected?.id ?? null, fileIds: [] },
      } });
      if (result._tag === "activity_appended") {
        setPrompt("");
        startTransition(() => void router.invalidate());
      }
    } finally {
      setPending(false);
    }
  };

  return (
    <main className="min-h-[calc(100svh-3.5rem)] bg-kumo-canvas md:min-h-screen">
      <div className="mx-auto flex min-h-[inherit] w-full max-w-3xl flex-col px-4 py-6 pb-32 sm:px-6 md:py-10">
        <header className="flex items-start justify-between gap-4 border-b border-kumo-line pb-4">
          {renaming ? (
            <form onSubmit={rename} className="flex w-full max-w-md items-center gap-2">
              <Input value={title} onChange={(event) => setTitle(event.target.value)} aria-label="Canvas name" autoFocus />
              <Button type="submit">Save</Button>
            </form>
          ) : (
            <div className="min-w-0">
              <h1 className="truncate text-xl font-semibold text-kumo-strong">{detail.canvas.title ?? "Untitled canvas"}</h1>
              {detail.canvas.state === "archived" ? <p className="mt-1 text-sm text-kumo-subtle">Archived</p> : null}
            </div>
          )}
          {!renaming ? <Button variant="ghost" shape="square" aria-label="Rename canvas" icon={<PencilSimple aria-hidden="true" size={17} />} onClick={() => setRenaming(true)} /> : null}
        </header>

        <section className="flex flex-1 flex-col justify-center py-8" aria-label="Generated view">
          {selected ? (
            <LayerCard className="px-5 py-5 sm:px-6">
              <div className="flex items-center justify-between gap-4">
                <h2 className="text-lg font-semibold">Saved view {selected.historySequence}</h2>
                <time className="text-sm text-kumo-subtle" dateTime={selected.createdAt}>{new Date(selected.createdAt).toLocaleDateString()}</time>
              </div>
              {selected.rationale ? <p className="mt-4 text-sm leading-6 text-kumo-subtle">{selected.rationale}</p> : null}
            </LayerCard>
          ) : (
            <div className="py-16 text-center">
              <h2 className="text-lg font-semibold">Ready for a view</h2>
            </div>
          )}
        </section>

        {detail.history.length > 1 ? (
          <nav aria-label="Generated view history" className="mb-5 flex items-center justify-center gap-3">
            <Button variant="secondary" shape="square" aria-label="Previous view" icon={<CaretLeft aria-hidden="true" size={17} />} disabled={selectedIndex === 0} onClick={() => setSelectedIndex((value) => value - 1)} />
            <span className="min-w-16 text-center text-sm tabular-nums text-kumo-subtle">{selectedIndex + 1} of {detail.history.length}</span>
            <Button variant="secondary" shape="square" aria-label="Next view" icon={<CaretRight aria-hidden="true" size={17} />} disabled={selectedIndex === detail.history.length - 1} onClick={() => setSelectedIndex((value) => value + 1)} />
          </nav>
        ) : null}

        <form onSubmit={append} className="fixed inset-x-3 bottom-3 z-20 mx-auto flex max-w-2xl items-center gap-2 rounded-full bg-kumo-base py-1.5 pe-2 ps-5 shadow-lg ring ring-kumo-line md:left-(--sidebar-width) md:group-data-[state=collapsed]/sidebar-wrapper:left-(--sidebar-width-icon)">
          <input value={prompt} onChange={(event) => setPrompt(event.target.value)} disabled={detail.canvas.state === "archived"} placeholder={detail.canvas.state === "archived" ? "Restore this canvas to continue" : "Ask Kairo"} aria-label="Ask Kairo" className="h-9 min-w-0 flex-1 border-0 bg-transparent p-0 text-base outline-none disabled:text-kumo-subtle" />
          <Button type="submit" disabled={pending || !prompt.trim() || detail.canvas.state === "archived"} className="rounded-full transition-transform active:not-disabled:scale-[0.96]">Send</Button>
        </form>
      </div>
    </main>
  );
}
