import { Sidebar } from "@cloudflare/kumo/components/sidebar";
import { FrameCorners, SidebarSimple } from "@phosphor-icons/react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import type { ReactNode } from "react";

import { workspaceRoutes } from "./workspace-routes";

type AppSidebarProps = {
  active?: "canvas" | "account";
  recentCanvases?: Array<{ name: string }>;
  footer?: ReactNode;
};

export function AppSidebar({
  active = "canvas",
  recentCanvases = [],
  footer,
}: AppSidebarProps) {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (state) => state.location.pathname });

  return (
    <Sidebar className="sticky top-0 hidden h-svh md:flex">
      <Sidebar.Header className="h-16 px-3 group-not-data-[state=collapsed]/sidebar:px-5">
        <img
          src="/brand/kairo-primary.svg"
          alt="Kairo"
          className="h-6 w-auto shrink-0 group-data-[state=collapsed]/sidebar:hidden"
        />
        <Sidebar.Trigger className="ms-auto size-9 group-data-[state=collapsed]/sidebar:mx-auto">
          <SidebarSimple aria-hidden="true" size={18} weight="regular" />
        </Sidebar.Trigger>
      </Sidebar.Header>

      <Sidebar.Content>
        <nav aria-label="Main navigation">
          {recentCanvases.length > 0 ? (
            <Sidebar.Group className="mb-1">
              <Sidebar.GroupLabel>Recent canvases</Sidebar.GroupLabel>
              <Sidebar.Menu>
                {recentCanvases.map((canvas) => (
                  <Sidebar.MenuButton
                    key={canvas.name}
                    disabled
                    icon={
                      <FrameCorners
                        aria-hidden="true"
                        size={18}
                        weight="regular"
                        className="shrink-0 text-kumo-subtle"
                      />
                    }
                    className="min-h-10 cursor-default text-lg font-normal text-kumo-default disabled:opacity-100 hover:bg-transparent"
                  >
                    <span className="min-w-0 flex-1 truncate">
                      {canvas.name}
                    </span>
                  </Sidebar.MenuButton>
                ))}
              </Sidebar.Menu>
            </Sidebar.Group>
          ) : null}

          <Sidebar.Group>
            <Sidebar.GroupLabel>Your work</Sidebar.GroupLabel>
            <Sidebar.Menu>
              {workspaceRoutes.map((item) => {
                const Icon = item.icon;
                const current = active === "canvas" && (item.to === "/canvas" ? pathname === item.to : pathname.startsWith(item.to));

                return (
                  <Sidebar.MenuButton
                    key={item.to}
                    href={item.to}
                    onClick={(event) => {
                      event.preventDefault();
                      void navigate({ to: item.to });
                    }}
                    active={current}
                    aria-current={current ? "page" : undefined}
                    tooltip={item.label}
                    icon={
                      <Icon
                        aria-hidden="true"
                        size={18}
                        weight="regular"
                        className={`shrink-0 ${current ? "text-kumo-brand" : "text-kumo-subtle"}`}
                      />
                    }
                    className={`min-h-10 text-lg font-medium group-data-[state=collapsed]/sidebar:size-8.5 group-data-[state=collapsed]/sidebar:min-h-8.5 ${current ? "bg-kumo-base text-kumo-strong shadow-xs ring ring-kumo-line" : "text-kumo-default"}`}
                  >
                    {item.label}
                  </Sidebar.MenuButton>
                );
              })}
            </Sidebar.Menu>
          </Sidebar.Group>
        </nav>
      </Sidebar.Content>

      <Sidebar.Footer className="h-auto items-stretch px-3 py-3">
        {footer ?? (
          <div className="w-full rounded-lg bg-kumo-base px-3 py-2.5 shadow-xs ring ring-kumo-line group-data-[state=collapsed]/sidebar:hidden">
            <div className="flex items-center justify-between gap-2 text-sm">
              <span className="font-medium text-kumo-default">Today</span>
              <span className="text-kumo-subtle tabular-nums">8:00 AM</span>
            </div>
            <div className="mt-2 flex items-center gap-2 text-base font-medium text-kumo-default">
              <span
                aria-hidden="true"
                className="size-1.5 shrink-0 rounded-full bg-kumo-success"
              />
              <span>AINN at 9:00 AM</span>
            </div>
          </div>
        )}
      </Sidebar.Footer>
    </Sidebar>
  );
}
