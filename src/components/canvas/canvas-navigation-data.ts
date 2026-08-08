import { recentCanvases } from "../../server/canvas/functions";
import { listTimetable } from "../../server/timetable/functions";
import type { NextClass } from "./canvas-navigation";

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

const findNextClass = (
  entries: Awaited<ReturnType<typeof listTimetable>>["items"],
): NextClass | undefined => {
  const now = Date.now();
  const next = entries
    .flatMap((entry) =>
      entry.occurrences.map((occurrence) => ({
        title: entry.title,
        startTime: occurrence.startTime,
        startsAt: Date.parse(occurrence.startInstant),
      })),
    )
    .filter((occurrence) => occurrence.startsAt >= now)
    .sort((left, right) => left.startsAt - right.startsAt)[0];

  return next
    ? { title: next.title, startTime: formatTime(next.startTime) }
    : undefined;
};

/** Loads the recent Canvases shown in workspace navigation. */
export function loadRecentCanvases() {
  return recentCanvases({ data: { limit: 20 } });
}

/** Loads the next class shown in the workspace navigation footer. */
export async function loadNextClass() {
  const today = localDate(new Date());
  const timetable = await listTimetable({
    data: { from: today, to: today, q: "", courseId: null, pageSize: 25 },
  }).catch(() => undefined);

  return timetable ? findNextClass(timetable.items) : undefined;
}

/** Loads all data shown in the persistent workspace navigation. */
export async function loadCanvasNavigationData() {
  const [recent, nextClass] = await Promise.all([
    loadRecentCanvases(),
    loadNextClass(),
  ]);
  return {
    recent,
    nextClass,
  };
}
