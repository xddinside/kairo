import { Sidebar } from "@cloudflare/kumo/components/sidebar";
import { Outlet, createFileRoute } from "@tanstack/react-router";
import type { CSSProperties } from "react";

import { AppSidebar } from "../components/app-sidebar";

export const Route = createFileRoute("/canvas")({ component: CanvasShell });

function CanvasShell() {
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
      <AppSidebar />
      <div className="min-w-0 flex-1">
        <Outlet />
      </div>
    </Sidebar.Provider>
  );
}
