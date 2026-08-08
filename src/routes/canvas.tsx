import { Sidebar } from "@cloudflare/kumo/components/sidebar";
import { Outlet, createFileRoute, useRouterState } from "@tanstack/react-router";
import type { CSSProperties } from "react";

import {
  CanvasNavigation,
  type NextClass,
} from "../components/canvas/canvas-navigation";
import { requireAuthenticatedRoute } from "../server/auth/functions";
import { recentCanvases } from "../server/canvas/functions";
import { listTimetable } from "../server/timetable/functions";

const localDate = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const formatTime = (time: string): string => {
  const [hours, minutes] = time.split(":").map(Number);
  if (hours === undefined || minutes === undefined) return time;
  const marker = hours < 12 ? "AM" : "PM";
  const hour = hours % 12 === 0 ? 12 : hours % 12;
  return `${hour}:${String(minutes).padStart(2, "0")} ${marker}`;
};

/** Next timetable occurrence that has not yet started today. */
const findNextClass = (
  entries: Awaited<ReturnType<typeof listTimetable>>["items"],
): NextClass | undefined => {
  const now = Date.now();
  const upcoming = entries
    .flatMap((entry) =>
      entry.occurrences.map((occurrence) => ({
        title: entry.title,
        startTime: occurrence.startTime,
        startsAt: Date.parse(occurrence.startInstant),
      })),
    )
    .filter((occurrence) => occurrence.startsAt >= now)
    .sort((left, right) => left.startsAt - right.startsAt);
  const next = upcoming[0];
  return next
    ? { title: next.title, startTime: formatTime(next.startTime) }
    : undefined;
};

export const Route = createFileRoute("/canvas")({
  beforeLoad: requireAuthenticatedRoute,
  loader: async () => {
    const today = localDate(new Date());
    const [recent, timetable] = await Promise.all([
      recentCanvases({ data: { limit: 20 } }),
      listTimetable({
        data: { from: today, to: today, q: "", courseId: null, pageSize: 25 },
      }).catch(() => undefined),
    ]);
    return {
      recent,
      nextClass: timetable ? findNextClass(timetable.items) : undefined,
    };
  },
  component: CanvasShell,
});

function CanvasShell() {
  const { recent, nextClass } = Route.useLoaderData();
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
      <CanvasNavigation
        currentCanvasId={canvasId}
        recent={recent}
        nextClass={nextClass}
      />
      <div className="min-w-0 flex-1 md:contents">
        <Outlet />
      </div>
    </Sidebar.Provider>
  );
}
