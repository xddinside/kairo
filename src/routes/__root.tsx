import { HeadContent, Outlet, Scripts, createRootRoute, useRouterState } from "@tanstack/react-router";
import { ClerkProvider } from "@clerk/tanstack-react-start";
import { lazy, Suspense } from "react";

import appCss from "../styles.css?url";

const WorkspaceShell = lazy(() =>
  import("../components/workspace-shell").then(({ WorkspaceShell }) => ({
    default: WorkspaceShell,
  })),
);

export const Route = createRootRoute({
  head: () => ({
    meta: [
      {
        charSet: "utf-8",
      },
      {
        name: "viewport",
        content: "width=device-width, initial-scale=1",
      },
      {
        title: "Kairo",
      },
      {
        name: "description",
        content: "A student workspace shaped around what matters now.",
      },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
      {
        rel: "icon",
        href: "/favicon.ico",
        sizes: "32x32",
      },
      {
        rel: "icon",
        href: "/favicon.svg",
        type: "image/svg+xml",
        sizes: "any",
      },
      {
        rel: "icon",
        href: "/favicon-32x32.png",
        type: "image/png",
        sizes: "32x32",
      },
      {
        rel: "apple-touch-icon",
        href: "/apple-touch-icon.png",
        sizes: "180x180",
      },
    ],
  }),
  component: RootRoute,
  shellComponent: RootDocument,
});

const workspacePath = /^\/(canvas(?:\/|$)|courses(?:\/|$)|tasks(?:\/|$)|timetable(?:\/|$)|notes(?:\/|$)|focus(?:\/|$))/;

function RootRoute() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const content = <Outlet />;

  return workspacePath.test(pathname) ? (
    <Suspense fallback={content}>
      <WorkspaceShell>{content}</WorkspaceShell>
    </Suspense>
  ) : content;
}

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="antialiased">
      <head>
        <HeadContent />
      </head>
      <body>
        <ClerkProvider publishableKey={import.meta.env.VITE_CLERK_PUBLISHABLE_KEY}>
          {children}
        </ClerkProvider>
        <Scripts />
      </body>
    </html>
  );
}
