import { DropdownMenu } from "@cloudflare/kumo/components/dropdown";
import { Button } from "@cloudflare/kumo/components/button";
import { Dialog } from "@cloudflare/kumo/components/dialog";
import { Input } from "@cloudflare/kumo/components/input";
import { Sidebar } from "@cloudflare/kumo/components/sidebar";
import { Archive, DotsThree, FrameCorners, PencilSimple, Plus, Trash } from "@phosphor-icons/react";
import { Link, useRouter } from "@tanstack/react-router";
import { startTransition, useState } from "react";

import type { CanvasSummary } from "../../server/canvas/domain";
import { archiveCanvas, deleteCanvas, renameCanvas as renameCanvasRequest, restoreCanvas, searchCanvases } from "../../server/canvas/functions";

type CanvasNavigationProps = {
  readonly currentCanvasId?: string;
  readonly recent: ReadonlyArray<CanvasSummary>;
};

/** Canvas navigation shared by desktop and mobile shells. */
export function CanvasNavigation({ currentCanvasId, recent }: CanvasNavigationProps) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ReadonlyArray<CanvasSummary>>(recent);
  const [renameTarget, setRenameTarget] = useState<CanvasSummary>();
  const [renameValue, setRenameValue] = useState("");

  const search = async (value: string) => {
    setQuery(value);
    if (!value.trim()) {
      setResults(recent);
      return;
    }
    setResults(await searchCanvases({ data: { query: value, state: "all", limit: 20 } }));
  };

  const mutate = async (canvas: CanvasSummary, operation: "archive" | "restore" | "delete" | "rename") => {
    const input = { canvasId: canvas.id, expectedVersion: canvas.version, clientRequestId: crypto.randomUUID() };
    let result;
    if (operation === "rename") {
      setRenameTarget(canvas);
      setRenameValue(canvas.title ?? "Untitled canvas");
      return;
    } else result = operation === "archive"
      ? await archiveCanvas({ data: input })
      : operation === "restore"
        ? await restoreCanvas({ data: input })
        : await deleteCanvas({ data: input });
    if (result._tag === "applied") {
      if (operation === "delete" && currentCanvasId === canvas.id) await router.navigate({ to: "/canvas" });
      startTransition(() => void router.invalidate());
    }
  };

  const rename = async () => {
    if (!renameTarget || !renameValue.trim()) return;
    const result = await renameCanvasRequest({ data: {
      canvasId: renameTarget.id,
      expectedVersion: renameTarget.version,
      clientRequestId: crypto.randomUUID(),
      title: renameValue.trim(),
    } });
    if (result._tag === "applied") {
      setRenameTarget(undefined);
      startTransition(() => void router.invalidate());
    }
  };

  const items = results.slice(0, 8);
  return (
    <>
      <Sidebar className="sticky top-0 hidden h-svh md:flex">
        <Sidebar.Header className="h-16 px-4">
          <img src="/brand/kairo-primary.svg" alt="Kairo" className="h-6 w-auto" />
          <Sidebar.Trigger className="ms-auto size-9" />
        </Sidebar.Header>
        <Sidebar.Content>
          <Sidebar.Group>
            <Sidebar.Menu>
              <Sidebar.MenuButton
                href="/canvas"
                active={!currentCanvasId}
                icon={<Plus aria-hidden="true" size={18} />}
                className="min-h-10 w-full text-base font-medium"
              >
                New canvas
              </Sidebar.MenuButton>
            </Sidebar.Menu>
          </Sidebar.Group>
          <Sidebar.Group>
            <Sidebar.GroupLabel>Recent canvases</Sidebar.GroupLabel>
            <div className="px-2 pb-2">
              <Input
                size="sm"
                value={query}
                onChange={(event) => void search(event.target.value)}
                placeholder="Search canvases"
                aria-label="Search canvases"
              />
            </div>
            <CanvasList currentCanvasId={currentCanvasId} items={items} onMutate={mutate} />
          </Sidebar.Group>
        </Sidebar.Content>
      </Sidebar>

      <header className="sticky top-0 z-30 flex min-h-14 items-center gap-3 border-b border-kumo-line bg-kumo-canvas px-4 md:hidden">
        <Link to="/canvas" aria-label="New canvas" className="flex min-h-11 items-center gap-2 rounded-lg px-2 text-sm font-medium">
          <FrameCorners aria-hidden="true" size={18} className="text-kumo-brand" />
          Canvas
        </Link>
        <details className="group ms-auto">
          <summary className="flex min-h-11 cursor-pointer list-none items-center rounded-lg px-3 text-sm font-medium hover:bg-kumo-tint">Canvases</summary>
          <div className="absolute inset-x-3 top-13 rounded-xl bg-kumo-base px-3 py-3 shadow-lg ring ring-kumo-line">
            <Input
              size="base"
              value={query}
              onChange={(event) => void search(event.target.value)}
              placeholder="Search canvases"
              aria-label="Search canvases"
            />
            <div className="mt-2 max-h-[50svh] overflow-y-auto">
              <CanvasList currentCanvasId={currentCanvasId} items={items} onMutate={mutate} />
            </div>
          </div>
        </details>
      </header>

      <Dialog.Root open={Boolean(renameTarget)} onOpenChange={(open) => { if (!open) setRenameTarget(undefined); }}>
        <Dialog className="p-5 sm:max-w-md">
          <Dialog.Title className="text-lg font-semibold">Rename canvas</Dialog.Title>
          <Input className="mt-5" value={renameValue} onChange={(event) => setRenameValue(event.target.value)} label="Canvas name" autoFocus />
          <div className="mt-5 flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setRenameTarget(undefined)}>Cancel</Button>
            <Button disabled={!renameValue.trim()} onClick={() => void rename()} className="transition-transform active:not-disabled:scale-[0.96]">Save</Button>
          </div>
        </Dialog>
      </Dialog.Root>
    </>
  );
}

function CanvasList({ currentCanvasId, items, onMutate }: {
  readonly currentCanvasId?: string;
  readonly items: ReadonlyArray<CanvasSummary>;
  readonly onMutate: (canvas: CanvasSummary, operation: "archive" | "restore" | "delete" | "rename") => Promise<void>;
}) {
  if (items.length === 0) return <p className="px-3 py-4 text-sm text-kumo-subtle">No canvases found</p>;
  return (
    <Sidebar.Menu>
      {items.map((canvas) => (
        <Sidebar.MenuItem key={canvas.id} className="group/item flex items-center">
          <Sidebar.MenuButton
            href={`/canvas/${canvas.id}`}
            active={currentCanvasId === canvas.id}
            icon={<FrameCorners aria-hidden="true" size={18} className="text-kumo-subtle" />}
            className="min-h-10 min-w-0 flex-1 text-base font-normal"
          >
            <span className="truncate">{canvas.title ?? "Untitled canvas"}</span>
          </Sidebar.MenuButton>
          <DropdownMenu>
            <DropdownMenu.Trigger
              aria-label={`Actions for ${canvas.title ?? "Untitled canvas"}`}
              className="me-1 flex size-9 shrink-0 items-center justify-center rounded-lg text-kumo-subtle hover:bg-kumo-tint focus-visible:outline-2 focus-visible:outline-kumo-focus"
            >
              <DotsThree aria-hidden="true" size={18} weight="bold" />
            </DropdownMenu.Trigger>
            <DropdownMenu.Content>
              <DropdownMenu.Item icon={<PencilSimple aria-hidden="true" />} onClick={() => void onMutate(canvas, "rename")}>
                Rename
              </DropdownMenu.Item>
              <DropdownMenu.Item icon={<Archive aria-hidden="true" />} onClick={() => void onMutate(canvas, canvas.state === "archived" ? "restore" : "archive")}>
                {canvas.state === "archived" ? "Restore" : "Archive"}
              </DropdownMenu.Item>
              <DropdownMenu.Separator />
              <DropdownMenu.Item variant="danger" icon={<Trash aria-hidden="true" />} onClick={() => void onMutate(canvas, "delete")}>
                Delete
              </DropdownMenu.Item>
            </DropdownMenu.Content>
          </DropdownMenu>
        </Sidebar.MenuItem>
      ))}
    </Sidebar.Menu>
  );
}
