import { Sidebar } from "@cloudflare/kumo/components/sidebar";
import { Toasty } from "@cloudflare/kumo/components/toast";
import {
  createFileRoute,
  useNavigate,
  useSearch,
} from "@tanstack/react-router";
import { useEffect, type CSSProperties } from "react";
import { z } from "zod";

import { AppSidebar } from "../../components/app-sidebar";
import { CanvasSurface } from "../../components/proto/focus/canvas-surface";
import { ConflictDialog } from "../../components/proto/focus/conflict-dialog";
import { FocusPage } from "../../components/proto/focus/focus-page";
import { FocusProvider, useFocus } from "../../components/proto/focus/focus-store";
import { MobilePill, RailPill } from "../../components/proto/focus/rail-pill";

export const Route = createFileRoute("/proto/focus")({
  validateSearch: z.object({
    surface: z.enum(["focus", "canvas"]).default("focus"),
    reset: z
      .preprocess(
        (value) => value === "1" || value === true,
        z.boolean(),
      )
      .optional(),
  }),
  head: () => ({
    meta: [{ title: "Focus prototype · Kairo" }],
  }),
  component: FocusPrototypeRoute,
});

function FocusPrototypeRoute() {
  return (
    <Toasty>
      <FocusProvider>
        <FocusApp />
      </FocusProvider>
    </Toasty>
  );
}

function FocusApp() {
  const { surface, reset } = useSearch({ from: "/proto/focus" });
  const navigate = useNavigate();
  const { resetAll } = useFocus();

  useEffect(() => {
    if (reset) {
      resetAll();
      navigate({
        to: "/proto/focus",
        search: { surface: "focus", reset: undefined },
        replace: true,
      });
    }
  }, [reset, navigate, resetAll]);

  const goTo = (nextSurface: "focus" | "canvas") => {
    if (nextSurface === surface) return;
    navigate({ to: "/proto/focus", search: { surface: nextSurface } });
  };

  return (
    <>
      <PhaseSwitcher />
      <Sidebar.Provider
        collapsible="icon"
        defaultOpen
        style={
          {
            "--sidebar-active-bg": "var(--color-kumo-base)",
            "--sidebar-bg": "var(--color-kumo-canvas)",
          } as CSSProperties
        }
      >
        <AppSidebar />
        <div className="min-w-0 flex-1">
          {surface === "focus" ? (
            <FocusPage
              onOpenTaskSurface={() => goTo("canvas")}
              onOpenNoteSurface={() => goTo("canvas")}
            />
          ) : (
            <CanvasSurface onOpenFocus={() => goTo("focus")} />
          )}
        </div>
      </Sidebar.Provider>
      <aside className="pointer-events-none fixed bottom-4 left-4 z-40 hidden w-60 md:block md:left-[calc(var(--sidebar-width)+1rem)] md:group-data-[state=collapsed]/sidebar-wrapper:left-[calc(var(--sidebar-width-icon)+1rem)]">
        <div className="pointer-events-auto">
          <RailPill onGoToFocus={() => goTo("focus")} />
        </div>
      </aside>
      <MobilePill onGoToFocus={() => goTo("focus")} />
      <ConflictGate onGoTo={(next) => goTo(next)} />
    </>
  );
}

function ConflictGate({ onGoTo }: { onGoTo: (surface: "focus" | "canvas") => void }) {
  const { session, pendingStart, confirmStart, dismissStart } = useFocus();
  if (!pendingStart) return null;
  return (
    <ConflictDialog
      open={Boolean(pendingStart)}
      runningTitle={session?.title ?? "a focus session"}
      runningOrigin={session?.origin ?? "focus"}
      onViewSession={() => {
        dismissStart();
        if (session) onGoTo(session.origin);
      }}
      onEndAndStart={confirmStart}
      onDismiss={dismissStart}
    />
  );
}

function PhaseSwitcher() {
  const { surface } = useSearch({ from: "/proto/focus" });
  const phases = [
    { id: "focus", label: "Focus" },
    { id: "canvas", label: "Canvas" },
  ] as const;

  const segmentClass = (active: boolean) =>
    `rounded-full px-2.5 py-1 text-sm font-medium ${
      active ? "bg-kumo-fill text-kumo-strong" : "text-kumo-default hover:bg-kumo-tint"
    }`;

  return (
    <div className="pointer-events-none fixed top-4 right-4 z-50 flex justify-end">
      <nav
        aria-label="Focus prototype surfaces"
        className="pointer-events-auto flex items-center gap-1 rounded-full bg-kumo-base p-1 shadow-md ring ring-kumo-line"
      >
        <span className="pr-1 pl-2 text-xs text-kumo-subtle">Surface</span>
        {phases.map((phase) => (
          <a
            key={phase.id}
            href={`/proto/focus?surface=${phase.id}`}
            className={segmentClass(phase.id === surface)}
            aria-current={phase.id === surface ? "page" : undefined}
          >
            {phase.label}
          </a>
        ))}
        <span aria-hidden className="mx-0.5 h-4 w-px bg-kumo-line" />
        <a
          href="/proto/focus?reset=1"
          className={segmentClass(false)}
        >
          Reset
        </a>
        <span aria-hidden className="mx-0.5 h-4 w-px bg-kumo-line" />
        <a href="/proto" className={segmentClass(false)}>
          Index
        </a>
      </nav>
    </div>
  );
}
