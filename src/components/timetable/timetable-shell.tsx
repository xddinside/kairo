import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";

import { workspaceRoutes as routes } from "../workspace-routes";

/** Quiet Rail shell used by production Timetable routes. */
export function TimetableShell({ children }: { readonly children: ReactNode }) {
  return (
    <div className="min-h-screen bg-kumo-canvas text-kumo-default">
      <div className="mx-auto flex min-h-screen max-w-[1440px]">
        <aside className="sticky top-0 hidden h-svh w-64 shrink-0 flex-col border-r border-kumo-line px-3 py-4 md:flex">
          <Link to="/canvas" className="flex h-12 items-center px-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-kumo-focus">
            <img src="/brand/kairo-primary.svg" alt="Kairo" className="h-7 w-auto" />
          </Link>
          <nav aria-label="Workspace routes" className="mt-5 grid gap-1">
            <p className="px-3 pb-1 text-xs font-medium text-kumo-subtle">Your work</p>
            {routes.map(({ to, label, icon: Icon }) => (
              <Link
                key={to}
                to={to}
                activeProps={{ "aria-current": "page", className: "bg-kumo-base text-kumo-strong shadow-xs ring ring-kumo-line" }}
                inactiveProps={{ className: "text-kumo-default hover:bg-kumo-tint" }}
                className="flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-kumo-focus"
              >
                <Icon aria-hidden="true" size={18} weight="regular" className="shrink-0 text-current" />
                {label}
              </Link>
            ))}
          </nav>
        </aside>
        <div className="min-w-0 flex-1">
          <header className="sticky top-0 z-30 flex min-h-14 items-center border-b border-kumo-line bg-kumo-canvas/95 px-4 backdrop-blur md:hidden">
            <Link to="/canvas" className="shrink-0"><img src="/brand/kairo-primary.svg" alt="Kairo" className="h-6 w-auto" /></Link>
            <nav aria-label="Mobile workspace routes" className="ms-auto flex items-center gap-1 overflow-x-auto ps-4">
              {routes.slice(1).map(({ to, label }) => (
                <Link key={to} to={to} activeProps={{ "aria-current": "page", className: "bg-kumo-base text-kumo-strong ring ring-kumo-line" }} className="flex min-h-11 shrink-0 items-center rounded-lg px-3 text-sm font-medium text-kumo-subtle focus-visible:outline-2 focus-visible:outline-kumo-focus">{label}</Link>
              ))}
            </nav>
          </header>
          {children}
        </div>
      </div>
    </div>
  );
}
