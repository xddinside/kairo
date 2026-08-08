import { Button } from "@cloudflare/kumo/components/button";
import { Dialog } from "@cloudflare/kumo/components/dialog";
import { DropdownMenu } from "@cloudflare/kumo/components/dropdown";
import { Input } from "@cloudflare/kumo/components/input";
import { Sidebar } from "@cloudflare/kumo/components/sidebar";
import {
  Archive,
  DotsThree,
  FrameCorners,
  List,
  MagnifyingGlass,
  PencilSimple,
  Plus,
  SidebarSimple,
  Trash,
  X,
} from "@phosphor-icons/react";
import { Link, useRouter, useRouterState } from "@tanstack/react-router";
import {
  startTransition,
  useEffect,
  useState,
  type MouseEvent,
  type ReactNode,
} from "react";

import type { CanvasSummary } from "../../server/canvas/domain";
import {
  archiveCanvas,
  deleteCanvas,
  renameCanvas as renameCanvasRequest,
  restoreCanvas,
  searchCanvases,
} from "../../server/canvas/functions";
import { workRoutes } from "../workspace-routes";

const menuButtonClass =
  "min-h-11 rounded-lg text-lg font-normal text-kumo-default group-data-[state=collapsed]/sidebar:size-8.5 group-data-[state=collapsed]/sidebar:min-h-8.5";

const activeClass =
  "bg-kumo-base text-kumo-strong shadow-xs ring ring-kumo-line";

const mobileRowClass =
  "flex min-h-11 flex-1 items-center gap-2.5 rounded-lg px-3 text-lg font-normal text-kumo-default hover:bg-kumo-tint focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-kumo-focus";

/** Left click without a modifier key, which the router should handle in place. */
const isRoutedClick = (event: MouseEvent<HTMLElement>): boolean =>
  event.button === 0 &&
  !event.metaKey &&
  !event.ctrlKey &&
  !event.shiftKey &&
  !event.altKey;

export type NextClass = {
  readonly title: string;
  readonly startTime: string;
};

type CanvasNavigationProps = {
  readonly currentCanvasId?: string;
  readonly recent: ReadonlyArray<CanvasSummary>;
  readonly nextClass?: NextClass;
  readonly children: ReactNode;
};

type MutateOperation = "archive" | "restore" | "delete" | "rename";

type Mutate = (
  canvas: CanvasSummary,
  operation: MutateOperation,
) => Promise<void>;

/** Canvas navigation shared by desktop and mobile shells. */
export function CanvasNavigation({
  currentCanvasId,
  recent,
  nextClass,
  children,
}: CanvasNavigationProps) {
  const router = useRouter();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const canvasHome = pathname === "/canvas";
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ReadonlyArray<CanvasSummary>>(recent);
  const [renameTarget, setRenameTarget] = useState<CanvasSummary>();
  const [renameValue, setRenameValue] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (!query.trim()) setResults(recent);
  }, [query, recent]);

  const navigate = (to: string) => (event: MouseEvent<HTMLElement>) => {
    if (!isRoutedClick(event)) return;
    event.preventDefault();
    setMenuOpen(false);
    void router.navigate({ to });
  };

  const search = async (value: string) => {
    setQuery(value);
    if (!value.trim()) {
      setResults(recent);
      return;
    }
    setResults(
      await searchCanvases({ data: { query: value, state: "all", limit: 20 } }),
    );
  };

  const mutate: Mutate = async (canvas, operation) => {
    if (operation === "rename") {
      setRenameTarget(canvas);
      setRenameValue(canvas.title ?? "Untitled canvas");
      return;
    }
    const input = {
      canvasId: canvas.id,
      expectedVersion: canvas.version,
      clientRequestId: crypto.randomUUID(),
    };
    const result =
      operation === "archive"
        ? await archiveCanvas({ data: input })
        : operation === "restore"
          ? await restoreCanvas({ data: input })
          : await deleteCanvas({ data: input });
    if (result._tag !== "applied") return;
    if (operation === "delete" && currentCanvasId === canvas.id) {
      await router.navigate({ to: "/canvas" });
    }
    startTransition(() => void router.invalidate());
  };

  const rename = async () => {
    if (!renameTarget || !renameValue.trim()) return;
    const result = await renameCanvasRequest({
      data: {
        canvasId: renameTarget.id,
        expectedVersion: renameTarget.version,
        clientRequestId: crypto.randomUUID(),
        title: renameValue.trim(),
      },
    });
    if (result._tag !== "applied") return;
    setRenameTarget(undefined);
    startTransition(() => void router.invalidate());
  };

  const items = results.slice(0, 8);

  const searchField = (size: "sm" | "base") => (
    <div className="relative w-full">
      <MagnifyingGlass
        aria-hidden="true"
        size={16}
        className="pointer-events-none absolute top-1/2 start-3 z-10 -translate-y-1/2 text-kumo-subtle"
      />
      <Input
        size={size}
        value={query}
        onChange={(event) => void search(event.target.value)}
        placeholder="Search canvases"
        aria-label="Search canvases"
        className="w-full ps-9 text-base"
      />
    </div>
  );

  return (
    <>
      <Sidebar className="sticky top-0 hidden h-svh bg-kumo-canvas md:flex">
        <Sidebar.Header className="h-16 border-b border-kumo-line px-3 group-not-data-[state=collapsed]/sidebar:px-4">
          <Link
            to="/canvas"
            aria-label="Kairo canvas"
            className="flex min-h-10 min-w-0 items-center rounded-md px-1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-kumo-focus group-data-[state=collapsed]/sidebar:hidden"
          >
            <img
              src="/brand/kairo-primary.svg"
              alt="Kairo"
              className="h-6 w-auto shrink-0"
            />
          </Link>
          <Sidebar.Trigger
            title="Toggle sidebar"
            className="ms-auto size-9 rounded-lg text-kumo-subtle hover:bg-kumo-tint hover:text-kumo-default group-data-[state=collapsed]/sidebar:mx-auto"
          >
            <SidebarSimple aria-hidden="true" size={18} weight="regular" />
          </Sidebar.Trigger>
        </Sidebar.Header>

        <Sidebar.Content className="py-2">
          <nav aria-label="Main navigation">
            <Sidebar.Group className="pb-1">
              <Sidebar.Menu>
                <Sidebar.MenuButton
                  href="/canvas"
                  onClick={navigate("/canvas")}
                  active={canvasHome}
                  aria-current={canvasHome ? "page" : undefined}
                  tooltip="New canvas"
                  icon={
                    <Plus
                      aria-hidden="true"
                      size={18}
                      weight="regular"
                      className={`shrink-0 ${canvasHome ? "text-kumo-brand" : "text-kumo-subtle"}`}
                    />
                  }
                  className={`min-h-11 rounded-lg text-lg font-medium ${
                    canvasHome ? activeClass : "text-kumo-default"
                  } group-data-[state=collapsed]/sidebar:size-8.5 group-data-[state=collapsed]/sidebar:min-h-8.5`}
                >
                  New canvas
                </Sidebar.MenuButton>
              </Sidebar.Menu>
            </Sidebar.Group>

            {recent.length > 0 ? (
              <Sidebar.Group className="pt-2 pb-3">
                <Sidebar.GroupLabel className="text-base">Recent canvases</Sidebar.GroupLabel>
                <div className="px-2 pb-2 group-data-[state=collapsed]/sidebar:hidden">
                  {searchField("sm")}
                </div>
                {items.length === 0 ? (
                <EmptyCanvases className="group-data-[state=collapsed]/sidebar:hidden" />
              ) : (
                <Sidebar.Menu>
                  {items.map((canvas) => {
                    const title = canvas.title ?? "Untitled canvas";
                    const current = currentCanvasId === canvas.id;
                    return (
                      <Sidebar.MenuItem
                        key={canvas.id}
                        className="group/item relative flex items-center"
                      >
                        <Sidebar.MenuButton
                          href={`/canvas/${canvas.id}`}
                          onClick={navigate(`/canvas/${canvas.id}`)}
                          active={current}
                          aria-current={current ? "page" : undefined}
                          tooltip={title}
                          icon={
                            <FrameCorners
                              aria-hidden="true"
                              size={18}
                              weight="regular"
                              className={`shrink-0 ${current ? "text-kumo-brand" : "text-kumo-subtle"}`}
                            />
                          }
                          className={`min-w-0 flex-1 pe-10 ${menuButtonClass} ${current ? activeClass : ""}`}
                        >
                          <span className="min-w-0 flex-1 truncate">{title}</span>
                        </Sidebar.MenuButton>
                        <CanvasActions
                          canvas={canvas}
                          title={title}
                          onMutate={mutate}
                          className="absolute end-1 group-data-[state=collapsed]/sidebar:hidden md:opacity-0 md:group-hover/item:opacity-100 md:group-focus-within/item:opacity-100"
                        />
                      </Sidebar.MenuItem>
                    );
                  })}
                </Sidebar.Menu>
                )}
              </Sidebar.Group>
            ) : null}

              <Sidebar.Group className="pt-2">
              <Sidebar.GroupLabel className="text-base">Your work</Sidebar.GroupLabel>
              <Sidebar.Menu>
                {workRoutes.map(({ to, label, icon: Icon }) => {
                  const current = pathname === to || pathname.startsWith(`${to}/`);
                  return (
                    <Sidebar.MenuButton
                      key={to}
                      href={to}
                      onClick={navigate(to)}
                      active={current}
                      aria-current={current ? "page" : undefined}
                      tooltip={label}
                      icon={
                        <Icon
                          aria-hidden="true"
                          size={18}
                          weight="regular"
                          className={`shrink-0 ${current ? "text-kumo-brand" : "text-kumo-subtle"}`}
                        />
                      }
                      className={`${menuButtonClass} ${current ? activeClass : ""}`}
                    >
                      {label}
                    </Sidebar.MenuButton>
                  );
                })}
              </Sidebar.Menu>
            </Sidebar.Group>
          </nav>
        </Sidebar.Content>

        <Sidebar.Footer className="h-auto items-stretch border-t border-kumo-line px-3 py-3">
          <NextClassCard nextClass={nextClass} />
        </Sidebar.Footer>
      </Sidebar>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex min-h-14 items-center gap-3 border-b border-kumo-line bg-kumo-canvas px-4 md:hidden">
          <Link
            to="/canvas"
            aria-label="Kairo canvas"
            className="flex min-h-11 items-center focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-kumo-focus"
          >
            <img src="/brand/kairo-primary.svg" alt="Kairo" className="h-6 w-auto" />
          </Link>
          <Dialog.Root open={menuOpen} onOpenChange={setMenuOpen}>
          <Dialog.Trigger
            render={(props) => (
              <Button
                {...props}
                title="Open navigation menu"
                variant="secondary"
                className="ms-auto min-h-11 transition-transform duration-150 ease-out active:scale-[0.96]"
                icon={<List aria-hidden="true" size={18} />}
              >
                Menu
              </Button>
            )}
          />
          <Dialog className="inset-y-2 end-2 start-auto m-0 flex h-[calc(100svh-1rem)] w-[min(22rem,calc(100vw-1rem))] translate-x-0 translate-y-0 flex-col rounded-xl p-4">
            <div className="flex items-center justify-between gap-4">
              <Dialog.Title className="text-lg font-semibold">
                Navigation
              </Dialog.Title>
              <Dialog.Close
                aria-label="Close navigation menu"
                render={(props) => (
                  <Button
                    {...props}
                    title="Close navigation menu"
                    variant="secondary"
                    shape="square"
                    className="min-h-11 min-w-11"
                    icon={<X aria-hidden="true" size={18} />}
                  />
                )}
              />
            </div>

            <nav
              aria-label="Mobile navigation"
              className="mt-5 flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto"
            >
              <Link
                to="/canvas"
                onClick={() => setMenuOpen(false)}
                aria-current={canvasHome ? "page" : undefined}
                className={`flex min-h-11 items-center gap-2.5 rounded-lg px-3 text-lg font-medium ${
                  canvasHome ? activeClass : "text-kumo-default hover:bg-kumo-tint"
                }`}
              >
                <Plus
                  aria-hidden="true"
                  size={18}
                  className={canvasHome ? "text-kumo-brand" : "text-kumo-subtle"}
                />
                New canvas
              </Link>

              {recent.length > 0 ? (
                <div className="grid gap-2">
                  <MobileGroupLabel>Recent canvases</MobileGroupLabel>
                  {searchField("base")}
                  {items.length === 0 ? (
                  <EmptyCanvases />
                ) : (
                  <ul className="grid gap-1">
                    {items.map((canvas) => {
                      const title = canvas.title ?? "Untitled canvas";
                      const current = currentCanvasId === canvas.id;
                      return (
                        <li key={canvas.id} className="flex items-center gap-1">
                          <Link
                            to="/canvas/$canvasId"
                            params={{ canvasId: canvas.id }}
                            onClick={() => setMenuOpen(false)}
                            aria-current={current ? "page" : undefined}
                            className={`${mobileRowClass} min-w-0 ${current ? activeClass : ""}`}
                          >
                            <FrameCorners
                              aria-hidden="true"
                              size={18}
                              className={
                                current ? "shrink-0 text-kumo-brand" : "shrink-0 text-kumo-subtle"
                              }
                            />
                            <span className="min-w-0 flex-1 truncate">{title}</span>
                          </Link>
                          <CanvasActions
                            canvas={canvas}
                            title={title}
                            onMutate={mutate}
                            onSelect={() => setMenuOpen(false)}
                          />
                        </li>
                      );
                    })}
                  </ul>
                  )}
                </div>
              ) : null}

              <div className="grid gap-2">
                <MobileGroupLabel>Your work</MobileGroupLabel>
                <ul className="grid gap-1">
                  {workRoutes.map(({ to, label, icon: Icon }) => (
                    <li key={to}>
                      <Link
                        to={to}
                        onClick={() => setMenuOpen(false)}
                        activeProps={{
                          "aria-current": "page",
                          className: activeClass,
                        }}
                        className={mobileRowClass}
                      >
                        <Icon
                          aria-hidden="true"
                          size={18}
                          className="shrink-0 text-kumo-subtle"
                        />
                        {label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="mt-auto pt-2">
                <NextClassCard nextClass={nextClass} />
              </div>
            </nav>
          </Dialog>
        </Dialog.Root>
        </header>

        {children}
      </div>

      <Dialog.Root
        open={Boolean(renameTarget)}
        onOpenChange={(open) => {
          if (!open) setRenameTarget(undefined);
        }}
      >
        <Dialog className="p-5 sm:max-w-md">
          <Dialog.Title className="text-lg font-semibold">
            Rename canvas
          </Dialog.Title>
          <Input
            className="mt-5"
            value={renameValue}
            onChange={(event) => setRenameValue(event.target.value)}
            label="Canvas name"
            autoFocus
          />
          <div className="mt-5 flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setRenameTarget(undefined)}>
              Cancel
            </Button>
            <Button
              disabled={!renameValue.trim()}
              onClick={() => void rename()}
              className="transition-transform duration-150 ease-out active:not-disabled:scale-[0.96]"
            >
              Save
            </Button>
          </div>
        </Dialog>
      </Dialog.Root>

    </>
  );
}

function MobileGroupLabel({ children }: { readonly children: ReactNode }) {
  return (
    <p className="px-3 text-base font-medium text-kumo-subtle">{children}</p>
  );
}

function EmptyCanvases({ className = "" }: { readonly className?: string }) {
  return (
    <p className={`px-3 py-4 text-lg text-kumo-subtle ${className}`}>
      No canvases found
    </p>
  );
}

function CanvasActions({
  canvas,
  title,
  onMutate,
  onSelect,
  className = "",
}: {
  readonly canvas: CanvasSummary;
  readonly title: string;
  readonly onMutate: Mutate;
  readonly onSelect?: () => void;
  readonly className?: string;
}) {
  const run = (operation: MutateOperation) => () => {
    onSelect?.();
    void onMutate(canvas, operation);
  };
  return (
    <DropdownMenu>
      <DropdownMenu.Trigger
        aria-label={`Actions for ${title}`}
        className={`flex size-11 shrink-0 items-center justify-center rounded-md text-kumo-subtle transition-transform duration-150 ease-out hover:bg-kumo-tint hover:text-kumo-default focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-kumo-focus active:scale-[0.96] md:size-8 ${className}`}
      >
        <DotsThree aria-hidden="true" size={14} weight="regular" />
      </DropdownMenu.Trigger>
      <DropdownMenu.Content>
        <DropdownMenu.Item
          icon={<PencilSimple aria-hidden="true" className="mr-2 size-4" />}
          onClick={run("rename")}
        >
          Rename
        </DropdownMenu.Item>
        <DropdownMenu.Item
          icon={<Archive aria-hidden="true" className="mr-2 size-4" />}
          onClick={run(canvas.state === "archived" ? "restore" : "archive")}
        >
          {canvas.state === "archived" ? "Restore" : "Archive"}
        </DropdownMenu.Item>
        <DropdownMenu.Separator />
        <DropdownMenu.Item
          variant="danger"
          icon={<Trash aria-hidden="true" className="mr-2 size-4" />}
          onClick={run("delete")}
        >
          Delete
        </DropdownMenu.Item>
      </DropdownMenu.Content>
    </DropdownMenu>
  );
}

function NextClassCard({ nextClass }: { readonly nextClass?: NextClass }) {
  // Resolved after mount so the User's clock never disagrees with the server's.
  const [now, setNow] = useState<string>();
  useEffect(() => {
    const tick = () =>
      setNow(
        new Date().toLocaleTimeString(undefined, {
          hour: "numeric",
          minute: "2-digit",
        }),
      );
    tick();
    const timer = setInterval(tick, 60_000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="w-full rounded-lg bg-kumo-base px-3 py-3 shadow-xs ring ring-kumo-line group-data-[state=collapsed]/sidebar:hidden">
      <div className="flex items-center justify-between gap-3 text-base">
        <span className="font-medium text-kumo-default">Today</span>
        <span className="text-kumo-subtle tabular-nums">{now ?? ""}</span>
      </div>
      <div className="mt-1.5 flex items-center gap-2 text-base font-medium text-kumo-default">
        {nextClass ? (
          <>
            <span
              aria-hidden="true"
              className="size-1.5 shrink-0 rounded-full bg-kumo-success"
            />
            <span className="min-w-0 truncate">
              {nextClass.title} at {nextClass.startTime}
            </span>
          </>
        ) : (
          <span className="text-kumo-subtle">Nothing left today</span>
        )}
      </div>
    </div>
  );
}
