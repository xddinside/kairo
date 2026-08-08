import { Sidebar } from "@cloudflare/kumo/components/sidebar";
import { Outlet, createFileRoute, useRouterState } from "@tanstack/react-router";
import type { CSSProperties } from "react";

import { CanvasNavigation } from "../components/canvas/canvas-navigation";
import { requireAuthenticatedRoute } from "../server/auth/functions";
import { recentCanvases } from "../server/canvas/functions";

export const Route = createFileRoute("/canvas")({
  beforeLoad: requireAuthenticatedRoute,
  loader: () => recentCanvases({ data: { limit: 20 } }),
  component: CanvasShell,
});

function CanvasShell() {
  const recent = Route.useLoaderData();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const canvasId = pathname.match(/^\/canvas\/([^/]+)$/)?.[1];
  return (
    <Sidebar.Provider
      animationDuration={0}
      collapsible="icon"
      style={
        {
          "--sidebar-active-bg": "var(--color-kumo-base)",
          "--sidebar-bg": "var(--color-kumo-canvas)",
        } as CSSProperties
      }
    >
      <CanvasNavigation currentCanvasId={canvasId} recent={recent} />
      <div className="min-w-0 flex-1 md:contents">
        <Outlet />
      </div>
    </Sidebar.Provider>
  );
}
