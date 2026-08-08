import { Sidebar } from "@cloudflare/kumo/components/sidebar";
import { useRouterState } from "@tanstack/react-router";
import { useEffect, useState, type CSSProperties, type ReactNode } from "react";

import type { CanvasSummary } from "../server/canvas/domain";
import { CanvasNavigation, type NextClass } from "./canvas/canvas-navigation";
import { loadNextClass, loadRecentCanvases } from "./canvas/canvas-navigation-data";

/** Provides the persistent Canvas navigation and full-width frame for workspace routes. */
export function WorkspaceShell({ children }: { readonly children: ReactNode }) {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const currentCanvasId = pathname.match(/^\/canvas\/([^/]+)$/)?.[1];
  const [recent, setRecent] = useState<ReadonlyArray<CanvasSummary>>([]);
  const [nextClass, setNextClass] = useState<NextClass>();

  useEffect(() => {
    let active = true;
    void loadRecentCanvases()
      .then((canvases) => {
        if (active) setRecent(canvases);
      })
      .catch(() => undefined);
    void loadNextClass().then((value) => {
      if (active) setNextClass(value);
    });
    return () => {
      active = false;
    };
  }, []);

  return (
    <Sidebar.Provider
      collapsible="icon"
      style={
        {
          "--sidebar-active-bg": "var(--color-kumo-base)",
          "--sidebar-bg": "var(--color-kumo-canvas)",
        } as CSSProperties
      }
    >
      <CanvasNavigation
        currentCanvasId={currentCanvasId}
        recent={recent}
        nextClass={nextClass}
      >
        {children}
      </CanvasNavigation>
    </Sidebar.Provider>
  );
}
