import { useKumoToastManager } from "@cloudflare/kumo/components/toast";
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export const STORAGE_KEY = "kairo-focus-proto-v1";

export type FocusSurface = "focus" | "canvas";

export type SessionKind = "task" | "free";

export type FocusSession = {
  id: string;
  kind: SessionKind;
  title: string;
  course: string | null;
  note: string | null;
  fileId: string | null;
  windowMs: number;
  status: "running" | "paused";
  origin: FocusSurface;
  startedAt: number;
  accumulatedPausedMs: number;
  pausedAt: number | null;
};

export type HistoryRecord = {
  id: string;
  kind: SessionKind;
  title: string;
  course: string | null;
  windowMs: number;
  outcome: "completed" | "cancelled";
  startedAt: number;
  endedAt: number;
};

export type CompletedSession = {
  id: string;
  kind: SessionKind;
  title: string;
  course: string | null;
  windowMs: number;
  endedAt: number;
  canMarkDone: boolean;
};

export type FocusPrefs = {
  workMin: number;
  shortMin: number;
  longMin: number;
  breaksEnabled: boolean;
};

export const DEFAULT_PREFS: FocusPrefs = {
  workMin: 25,
  shortMin: 5,
  longMin: 15,
  breaksEnabled: true,
};

export const SESSIONS_PER_LONG_BREAK = 4;

export type BreakState = {
  kind: "short" | "long";
  endsAt: number;
} | null;

type PersistedState = {
  prefs: FocusPrefs;
  session: FocusSession | null;
  breakState: BreakState;
  history: HistoryRecord[];
  completedCount: number;
  sessionsSinceLongBreak: number;
};

type FocusStoreValue = {
  now: number;
  prefs: FocusPrefs;
  session: FocusSession | null;
  breakState: BreakState;
  history: HistoryRecord[];
  completedCount: number;
  justCompleted: CompletedSession | null;
  taskDone: boolean;
  todayTotalMs: number;
  todayCount: number;
  remainingMs: number | null;
  elapsedMs: number;
  pendingStart: FocusSession | null;
  openFileId: string | null;
  setOpenFile: (fileId: string | null) => void;
  updatePrefs: (patch: Partial<FocusPrefs>) => void;
  startSession: (
    input: Omit<
      FocusSession,
      "id" | "status" | "accumulatedPausedMs" | "pausedAt"
    >,
  ) => void;
  confirmStart: () => void;
  dismissStart: () => void;
  togglePause: () => void;
  endEarly: () => void;
  skipBreak: () => void;
  dismissCompleted: () => void;
  markDone: () => void;
  undoDone: () => void;
  resetAll: () => void;
};

const FocusContext = createContext<FocusStoreValue | null>(null);

function newId() {
  return Math.random().toString(36).slice(2, 10);
}

function startOfDay(now: number) {
  const date = new Date(now);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

function emptyPersisted(): PersistedState {
  return {
    prefs: DEFAULT_PREFS,
    session: null,
    breakState: null,
    history: [],
    completedCount: 0,
    sessionsSinceLongBreak: 0,
  };
}

function loadPersisted(): PersistedState {
  if (typeof window === "undefined") return emptyPersisted();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyPersisted();
    const parsed = JSON.parse(raw) as PersistedState;
    return {
      prefs: { ...DEFAULT_PREFS, ...parsed.prefs },
      session: parsed.session ?? null,
      breakState: parsed.breakState ?? null,
      history: parsed.history ?? [],
      completedCount: parsed.completedCount ?? 0,
      sessionsSinceLongBreak: parsed.sessionsSinceLongBreak ?? 0,
    };
  } catch {
    return emptyPersisted();
  }
}

export function remainingMsFor(session: FocusSession, now: number): number {
  const base = session.status === "running" ? now : (session.pausedAt ?? now);
  const spent = base - session.startedAt - session.accumulatedPausedMs;
  return Math.max(0, session.windowMs - spent);
}

export function elapsedMsFor(session: FocusSession, now: number): number {
  const base = session.status === "running" ? now : (session.pausedAt ?? now);
  return Math.max(0, base - session.startedAt - session.accumulatedPausedMs);
}

export function formatClock(ms: number) {
  const totalSeconds = Math.ceil(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const mm = String(minutes).padStart(2, "0");
  const ss = String(seconds).padStart(2, "0");
  return hours > 0 ? `${hours}:${mm}:${ss}` : `${minutes}:${ss}`;
}

export function formatDuration(ms: number) {
  const totalMinutes = Math.round(ms / 60000);
  if (totalMinutes < 60) return `${totalMinutes}m`;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
}

export function formatClockRange(startedAt: number, endedAt: number) {
  const start = new Date(startedAt);
  const end = new Date(endedAt);
  const hhmm = (date: Date) =>
    date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  return `${hhmm(start)}–${hhmm(end)}`;
}

export function FocusProvider({ children }: { children: ReactNode }) {
  const toast = useKumoToastManager();
  const initial = useState(loadPersisted)[0];
  const [now, setNow] = useState(() => Date.now());
  const [prefs, setPrefs] = useState<FocusPrefs>(initial.prefs);
  const [session, setSession] = useState<FocusSession | null>(initial.session);
  const [breakState, setBreakState] = useState<BreakState>(initial.breakState);
  const [history, setHistory] = useState<HistoryRecord[]>(initial.history);
  const [completedCount, setCompletedCount] = useState(initial.completedCount);
  const [sessionsSinceLongBreak, setSessionsSinceLongBreak] = useState(
    initial.sessionsSinceLongBreak,
  );
  const [justCompleted, setJustCompleted] = useState<CompletedSession | null>(
    null,
  );
  const [taskDone, setTaskDone] = useState(false);
  const [pendingStart, setPendingStart] = useState<FocusSession | null>(null);
  const [openFileId, setOpenFileId] = useState<string | null>(null);

  useEffect(() => {
    const tick = () => setNow(Date.now());
    tick();
    const interval = window.setInterval(tick, 1000);
    const onVisible = () => {
      if (document.visibilityState === "visible") tick();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  useEffect(() => {
    if (
      !session ||
      session.status !== "running" ||
      remainingMsFor(session, now) > 0
    ) {
      return;
    }
    const endedAt = Date.now();
    setHistory((records) => [
      {
        id: session.id,
        kind: session.kind,
        title: session.title,
        course: session.course,
        windowMs: session.windowMs,
        outcome: "completed",
        startedAt: session.startedAt,
        endedAt,
      },
      ...records,
    ]);
    setCompletedCount((count) => count + 1);
    const next = sessionsSinceLongBreak + 1;
    setSessionsSinceLongBreak(next);
    if (prefs.breaksEnabled) {
      const kind = next % SESSIONS_PER_LONG_BREAK === 0 ? "long" : "short";
      const minutes = kind === "long" ? prefs.longMin : prefs.shortMin;
      setBreakState({ kind, endsAt: endedAt + minutes * 60000 });
    }
    setJustCompleted({
      id: session.id,
      kind: session.kind,
      title: session.title,
      course: session.course,
      windowMs: session.windowMs,
      endedAt,
      canMarkDone: session.kind === "task",
    });
    setTaskDone(false);
    setSession(null);
    toast.add({
      title: "Pomodoro complete",
      description: session.title,
      variant: "success",
      timeout: 5000,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, now, sessionsSinceLongBreak, prefs]);

  useEffect(() => {
    if (breakState && now >= breakState.endsAt) {
      setBreakState(null);
    }
  }, [breakState, now]);

  const value = useMemo<FocusStoreValue>(() => {
    const remainingMs = session ? remainingMsFor(session, now) : null;
    const elapsedMs = session ? elapsedMsFor(session, now) : 0;

    const startSession: FocusStoreValue["startSession"] = (input) => {
      const candidate: FocusSession = {
        ...input,
        id: newId(),
        status: "running",
        accumulatedPausedMs: 0,
        pausedAt: null,
      };
      if (session) {
        setPendingStart(candidate);
        return;
      }
      setBreakState(null);
      setJustCompleted(null);
      setTaskDone(false);
      if (input.fileId) setOpenFileId(input.fileId);
      setSession(candidate);
      toast.add({
        title: "Focus session started",
        description: `${candidate.title} · ${formatDuration(candidate.windowMs)}`,
        timeout: 3000,
      });
    };

    return {
      now,
      prefs,
      session,
      breakState,
      history,
      completedCount,
      justCompleted,
      taskDone,
      todayTotalMs: history
        .filter(
          (record) =>
            record.outcome === "completed" &&
            record.startedAt >= startOfDay(now),
        )
        .reduce((total, record) => total + record.windowMs, 0),
      todayCount: history.filter(
        (record) =>
          record.outcome === "completed" &&
          record.startedAt >= startOfDay(now),
      ).length,
      remainingMs,
      elapsedMs,
      pendingStart,
      openFileId,
      setOpenFile: setOpenFileId,
      updatePrefs: (patch) => setPrefs((current) => ({ ...current, ...patch })),
      startSession,
      confirmStart: () => {
        if (!pendingStart) return;
        const candidate = pendingStart;
        if (session) {
          const endedAt = Date.now();
          setHistory((records) => [
            {
              id: session.id,
              kind: session.kind,
              title: session.title,
              course: session.course,
              windowMs: session.windowMs,
              outcome: "cancelled",
              startedAt: session.startedAt,
              endedAt,
            },
            ...records,
          ]);
        }
        setPendingStart(null);
        setBreakState(null);
        setJustCompleted(null);
        setTaskDone(false);
        if (candidate.fileId) setOpenFileId(candidate.fileId);
        setSession(candidate);
        toast.add({
          title: "Focus session started",
          description: `${candidate.title} · ${formatDuration(candidate.windowMs)}`,
          timeout: 3000,
        });
      },
      dismissStart: () => setPendingStart(null),
      togglePause: () =>
        setSession((current) => {
          if (!current) return current;
          if (current.status === "running") {
            return { ...current, status: "paused", pausedAt: Date.now() };
          }
          if (current.pausedAt === null) return current;
          return {
            ...current,
            status: "running",
            accumulatedPausedMs:
              current.accumulatedPausedMs + (Date.now() - current.pausedAt),
            pausedAt: null,
          };
        }),
      endEarly: () => {
        if (!session) return;
        const endedAt = Date.now();
        setHistory((records) => [
          {
            id: session.id,
            kind: session.kind,
            title: session.title,
            course: session.course,
            windowMs: session.windowMs,
            outcome: "cancelled",
            startedAt: session.startedAt,
            endedAt,
          },
          ...records,
        ]);
        toast.add({
          title: "Session ended",
          description: `${session.title} was cancelled early`,
          variant: "warning",
          timeout: 4000,
        });
        setSession(null);
      },
      skipBreak: () => {
        setBreakState(null);
        toast.add({
          title: "Break skipped",
          timeout: 2500,
        });
      },
      dismissCompleted: () => setJustCompleted(null),
      markDone: () => setTaskDone(true),
      undoDone: () => setTaskDone(false),
      resetAll: () => {
        setSession(null);
        setBreakState(null);
        setJustCompleted(null);
        setTaskDone(false);
        setPendingStart(null);
        setHistory([]);
        setCompletedCount(0);
        setSessionsSinceLongBreak(0);
        setPrefs(DEFAULT_PREFS);
      },
    };
  }, [
    now,
    prefs,
    session,
    breakState,
    history,
    completedCount,
    justCompleted,
    taskDone,
    pendingStart,
    openFileId,
  ]);

  useEffect(() => {
    const persisted: PersistedState = {      prefs,
      session,
      breakState,
      history,
      completedCount,
      sessionsSinceLongBreak,
    };
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(persisted));
    } catch {
      // prototype: persistence is best-effort
    }
  }, [prefs, session, breakState, history, completedCount, sessionsSinceLongBreak]);

  return <FocusContext.Provider value={value}>{children}</FocusContext.Provider>;
}export function useFocus(): FocusStoreValue {
  const context = useContext(FocusContext);
  if (!context) {
    throw new Error("useFocus must be used within FocusProvider");
  }
  return context;
}
