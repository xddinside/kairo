import {
  Books,
  CalendarDots,
  FrameCorners,
  ListChecks,
  NoteBlank,
} from "@phosphor-icons/react";

/** Canvas plus the saved work collections, in the order every shell shows them. */
export const workspaceRoutes = [
  { to: "/canvas", label: "Canvas", icon: FrameCorners },
  { to: "/courses", label: "Courses", icon: Books },
  { to: "/tasks", label: "Tasks", icon: ListChecks },
  { to: "/timetable", label: "Timetable", icon: CalendarDots },
  { to: "/notes", label: "Notes", icon: NoteBlank },
] as const;

/** Saved work collections, without the Canvas entry that owns its own shell. */
export const workRoutes = workspaceRoutes.filter(
  (route) => route.to !== "/canvas",
);
