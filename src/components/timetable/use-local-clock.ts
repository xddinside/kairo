import { useEffect, useState } from "react";

import { localDate } from "./timetable-dates";

/** The browser's current calendar day and instant, sampled after hydration. */
export interface LocalClock {
  /** The browser-local calendar day as `YYYY-MM-DD`. */
  readonly today: string;
  /** The current instant as an ISO 8601 UTC string. */
  readonly instant: string;
}

/**
 * Read the browser clock without risking a hydration mismatch.
 *
 * The server has no access to the reader's clock, so the hook returns
 * `undefined` until the first client effect runs. Callers must treat
 * `undefined` as "no time-relative emphasis yet" rather than "no data".
 *
 * @returns The current local clock, or `undefined` before hydration completes.
 */
export function useLocalClock(): LocalClock | undefined {
  const [clock, setClock] = useState<LocalClock>();

  useEffect(() => {
    const sample = () => {
      const now = new Date();
      setClock({ today: localDate(now), instant: now.toISOString() });
    };
    sample();
    const timer = setInterval(sample, 60_000);
    return () => clearInterval(timer);
  }, []);

  return clock;
}
