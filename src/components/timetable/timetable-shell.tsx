import type { ReactNode } from "react";

/** Quiet Rail shell used by production Timetable routes. */
export function TimetableShell({ children }: { readonly children: ReactNode }) {
  return children;
}
