import { Badge } from "@cloudflare/kumo/components/badge";
import { Button } from "@cloudflare/kumo/components/button";
import { LayerCard } from "@cloudflare/kumo/components/layer-card";
import { Popover } from "@cloudflare/kumo/components/popover";
import { Text } from "@cloudflare/kumo/components/text";
import { useEffect, useState } from "react";

import { ArrowLeft, ArrowSquareOut, Check, CheckCircle, FileText, FrameCorners, Note, Pause, Play, Timer, X } from "@phosphor-icons/react";
import { CircularTimer } from "./circular-timer";
import { DurationPopover } from "./duration-popover";
import {
  formatClock,
  formatClockRange,
  formatDuration,
  useFocus,
  type BreakState,
  type CompletedSession,
  type FocusSession,
  type HistoryRecord,
} from "./focus-store";
import { renderMarkdown, sampleFiles, type SampleFile } from "./sample-files";

function todayLabel(timestamp: number) {
  const date = new Date(timestamp);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const day = new Date(timestamp);
  day.setHours(0, 0, 0, 0);
  if (day.getTime() === today.getTime()) return "Today";
  if (day.getTime() === yesterday.getTime()) return "Yesterday";
  return date.toLocaleDateString([], {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

function groupByDay(records: HistoryRecord[]) {
  const groups: Array<{ key: string; records: HistoryRecord[] }> = [];
  for (const record of records) {
    const key = todayLabel(record.startedAt);
    const group = groups.find((candidate) => candidate.key === key);
    if (group) group.records.push(record);
    else groups.push({ key, records: [record] });
  }
  return groups;
}
function StatusAnnouncer() {
  const { session, breakState, justCompleted } = useFocus();
  const [announced, setAnnounced] = useState("");
  const message = session
    ? session.status === "running"
      ? `Focus session running: ${session.title}`
      : "Focus session paused"
    : breakState
      ? "Break in progress"
      : justCompleted
        ? "Pomodoro complete"
        : "";
  useEffect(() => {
    if (message && message !== announced) setAnnounced(message);
  }, [message, announced]);
  return (
    <p aria-live="polite" className="sr-only">
      {announced}
    </p>
  );
}

const demoTasks = [
  {
    title: "Review backpropagation examples",
    course: "AI & Neural Networks",
    note: "Backpropagation mistakes",
    fileId: "ainn-backprop",
  },
  {
    title: "Finish TOC Tutorial 3",
    course: "Theory of Computation",
    note: "Pumping lemma checklist",
    fileId: "toc-pumping",
  },
  {
    title: "Finish the Software Engineering planning flow",
    course: "Software Engineering",
    note: null,
    fileId: null,
  },
] as const;

function ContextChips({
  session,
  onOpenTask,
  onOpenNote,
  onToggleFile,
}: {
  session: FocusSession;
  onOpenTask: () => void;
  onOpenNote: () => void;
  onToggleFile: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-center gap-1.5">
      {session.course ? (
        <Badge variant="secondary">{session.course}</Badge>
      ) : null}
      {session.kind === "task" ? (
        <button
          type="button"
          onClick={onOpenTask}
          className="flex min-h-8 items-center gap-1 rounded-md px-2 text-sm font-medium text-kumo-default transition-transform duration-150 ease-out hover:bg-kumo-tint hover:text-kumo-strong active:scale-[0.96]"
        >
          <CheckCircle
            aria-hidden
            size={14}
            weight="bold"
            className="text-kumo-success"
          />
          Task
        </button>
      ) : null}
      {session.note ? (
        <button
          type="button"
          onClick={onOpenNote}
          className="flex min-h-8 items-center gap-1 rounded-md px-2 text-sm font-medium text-kumo-default transition-transform duration-150 ease-out hover:bg-kumo-tint hover:text-kumo-strong active:scale-[0.96]"
        >
          <Note aria-hidden size={14} weight="bold" />
          Note
        </button>
      ) : null}
      <button
        type="button"
        onClick={onToggleFile}
        className="flex min-h-8 items-center gap-1 rounded-md px-2 text-sm font-medium text-kumo-default transition-transform duration-150 ease-out hover:bg-kumo-tint hover:text-kumo-strong active:scale-[0.96]"
      >
        <FileText aria-hidden size={14} weight="bold" />
        File
      </button>
    </div>
  );
}

function SessionCard({
  session,
  onOpenTask,
  onOpenNote,
  onToggleFile,
}: {
  session: FocusSession;
  onOpenTask: () => void;
  onOpenNote: () => void;
  onToggleFile: () => void;
}) {
  const { remainingMs, elapsedMs, togglePause, endEarly } = useFocus();
  const paused = session.status === "paused";
  const remaining = remainingMs ?? 0;

  return (
    <LayerCard className="px-5 py-6">
      <div className="grid justify-items-center gap-5">
        <CircularTimer
          remainingMs={remaining}
          totalMs={session.windowMs}
          label={paused ? "Paused" : "Focus session"}
        />
        <div className="grid justify-items-center gap-1">
          <div className="text-center">
            <Text as="h2" variant="heading3">
              {session.title}
            </Text>
          </div>
          <p className="text-sm text-kumo-subtle">
            Planned {formatDuration(session.windowMs)} ·{" "}
            {formatDuration(elapsedMs)} worked
          </p>
        </div>
        <ContextChips
          session={session}
          onOpenTask={onOpenTask}
          onOpenNote={onOpenNote}
          onToggleFile={onToggleFile}
        />
        <div className="flex flex-wrap items-center justify-center gap-2">
          <Button
            variant="primary"
            className="min-w-32 justify-center text-sm transition-transform duration-150 ease-out active:scale-[0.96]"
            onClick={togglePause}
          >
            {paused ? (
              <Play
                aria-hidden
                size={14}
                weight="bold"
                className="translate-x-px"
              />
            ) : (
              <Pause aria-hidden size={14} weight="bold" />
            )}
            {paused ? "Resume" : "Pause"}
          </Button>
          <Button
            variant="ghost"
            className="min-w-32 justify-center text-sm transition-transform duration-150 ease-out active:scale-[0.96]"
            onClick={endEarly}
          >
            {paused ? "Complete" : "Complete early"}
          </Button>
        </div>
      </div>
    </LayerCard>
  );
}

function BreakCard({ breakState }: { breakState: NonNullable<BreakState> }) {
  const { now, skipBreak } = useFocus();
  const remaining = Math.max(0, breakState.endsAt - now);
  const total =
    (breakState.endsAt - remaining) * 0 + Math.max(remaining, 60000);
  return (
    <LayerCard className="px-5 py-6">
      <div className="grid justify-items-center gap-5">
        <CircularTimer
          remainingMs={remaining}
          totalMs={total}
          label={breakState.kind === "long" ? "Long break" : "Short break"}
          tone="success"
        />
        <Text as="h2" variant="heading3">
          {breakState.kind === "long" ? "Long break" : "Short break"}
        </Text>
        <Button
          variant="ghost"
          className="min-w-32 justify-center text-sm transition-transform duration-150 ease-out active:scale-[0.96]"
          onClick={skipBreak}
        >
          Skip break
        </Button>
      </div>
    </LayerCard>
  );
}

function CompletedCard({
  completed,
  onStartAnother,
}: {
  completed: CompletedSession;
  onStartAnother: () => void;
}) {
  const {
    breakState,
    now,
    skipBreak,
    dismissCompleted,
    taskDone,
    markDone,
    undoDone,
  } = useFocus();
  const breakRemaining = breakState ? Math.max(0, breakState.endsAt - now) : 0;

  return (
    <LayerCard className="px-5 py-6">
      <div className="grid justify-items-center gap-4">
        <span className="grid size-16 place-items-center rounded-full bg-kumo-success/15">
          <Check aria-hidden size={30} weight="bold" className="text-kumo-success" />
        </span>
        <div className="grid justify-items-center gap-1">
          <Text as="h2" variant="heading3">
            Pomodoro complete
          </Text>
          <p className="text-center text-sm text-kumo-subtle">
            {completed.title}
            {completed.course ? ` · ${completed.course}` : ""}
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-2">
          <Button
            variant="primary"
            className="min-w-32 justify-center text-sm transition-transform duration-150 ease-out active:scale-[0.96]"
            onClick={onStartAnother}
          >
            <Timer aria-hidden size={14} weight="bold" />
            Start another
          </Button>
          {completed.canMarkDone ? (
            taskDone ? (
              <Button
                variant="ghost"
                className="min-w-32 justify-center text-sm transition-transform duration-150 ease-out active:scale-[0.96]"
                onClick={undoDone}
              >
                <X aria-hidden size={14} weight="bold" />
                Undo done
              </Button>
            ) : (
              <Button
                variant="ghost"
                className="min-w-32 justify-center text-sm transition-transform duration-150 ease-out active:scale-[0.96]"
                onClick={markDone}
              >
                <Check aria-hidden size={14} weight="bold" />
                Mark task done
              </Button>
            )
          ) : null}
          <button
            type="button"
            aria-label="Dismiss"
            onClick={dismissCompleted}
            className="flex size-11 items-center justify-center rounded-lg text-kumo-subtle transition-transform duration-150 ease-out hover:bg-kumo-tint hover:text-kumo-default active:scale-[0.96]"
          >
            <X aria-hidden size={16} />
          </button>
        </div>
        {breakState ? (
          <div className="flex items-center gap-2 rounded-full bg-kumo-tint px-4 py-2 text-sm">
            <span aria-hidden className="size-1.5 rounded-full bg-kumo-success" />
            <span className="text-kumo-default">
              Break in progress ·{" "}
              <span className="tabular-nums">{formatClock(breakRemaining)}</span>
            </span>
            <button
              type="button"
              onClick={skipBreak}
              className="text-sm font-medium text-kumo-default transition-transform duration-150 ease-out hover:text-kumo-strong active:scale-[0.96]"
            >
              Skip
            </button>
          </div>
        ) : null}
      </div>
    </LayerCard>
  );
}

function FreeFocusCard({
  onFocusTask,
}: {
  onFocusTask: (task: (typeof demoTasks)[number]) => void;
}) {
  const { prefs, startSession } = useFocus();
  return (
    <LayerCard className="px-5 py-6">
      <div className="grid justify-items-center gap-5">
        <span className="grid size-16 place-items-center rounded-full bg-kumo-brand/15">
          <Timer aria-hidden size={30} weight="bold" className="text-kumo-brand" />
        </span>
        <div className="grid justify-items-center gap-1">
          <Text as="h2" variant="heading3">
            No session running
          </Text>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-2">
          <Button
            variant="primary"
            className="min-w-40 justify-center text-sm transition-transform duration-150 ease-out active:scale-[0.96]"
            onClick={() =>
              startSession({
                kind: "free",
                title: "Focus session",
                course: null,
                note: null,
                fileId: null,
                windowMs: prefs.workMin * 60000,
                origin: "focus",
                startedAt: Date.now(),
              })
            }
          >
            <Play
              aria-hidden
              size={14}
              weight="bold"
              className="translate-x-px"
            />
            Start a session
          </Button>
          <Popover>
            <Popover.Trigger
              render={(props) => (
                <Button
                  {...props}
                  variant="ghost"
                  className="min-w-40 justify-center text-sm transition-transform duration-150 ease-out active:scale-[0.96]"
                >
                  <CheckCircle aria-hidden size={14} weight="bold" />
                  Focus on a task
                </Button>
              )}
            />
            <Popover.Content align="center" side="top" className="w-80">
              <Popover.Title>Choose a task</Popover.Title>
              <ul className="grid gap-1 px-2 pt-1 pb-2">
                {demoTasks.map((task) => (
                  <li key={task.title}>
                    <button
                      type="button"
                      onClick={() => onFocusTask(task)}
                      className="grid w-full gap-0.5 rounded-lg px-3 py-2.5 text-left transition-colors duration-150 ease-out hover:bg-kumo-tint focus-visible:outline-2 focus-visible:outline-kumo-focus"
                    >
                      <span className="text-sm font-medium text-kumo-default">
                        {task.title}
                      </span>
                      <span className="text-xs text-kumo-subtle">{task.course}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </Popover.Content>
          </Popover>
        </div>
      </div>
    </LayerCard>
  );
}

function FilePanel({
  onClose,
  onFullscreen,
}: {
  onClose: () => void;
  onFullscreen: () => void;
}) {
  const { openFileId, setOpenFile } = useFocus();
  const openFile = sampleFiles.find((file) => file.id === openFileId) ?? null;

  return (
    <LayerCard className="flex min-h-0 flex-col overflow-hidden">
      <div className="flex items-center justify-between gap-3 border-b border-kumo-line px-5 py-3.5">
        {openFile ? (
          <>
            <div className="flex min-w-0 items-center gap-2.5">
              <FileText
                aria-hidden
                size={16}
                weight="bold"
                className="shrink-0 text-kumo-subtle"
              />
              <div className="grid min-w-0 gap-0">
                <span className="truncate text-sm font-medium text-kumo-default">
                  {openFile.name}
                </span>
                <span className="text-xs text-kumo-subtle">
                  {openFile.course} · {openFile.size}
                </span>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <button
                type="button"
                aria-label="Open file fullscreen"
                onClick={onFullscreen}
                className="flex size-11 items-center justify-center rounded-lg text-kumo-subtle transition-transform duration-150 ease-out hover:bg-kumo-tint hover:text-kumo-default active:scale-[0.96]"
              >
                <FrameCorners aria-hidden size={16} />
              </button>
              <button
                type="button"
                aria-label="Close file"
                onClick={onClose}
                className="flex size-11 items-center justify-center rounded-lg text-kumo-subtle transition-transform duration-150 ease-out hover:bg-kumo-tint hover:text-kumo-default active:scale-[0.96]"
              >
                <X aria-hidden size={16} />
              </button>
            </div>
          </>
        ) : (
          <>
            <span className="text-sm font-medium text-kumo-default">Open a file</span>
            <button
              type="button"
              aria-label="Close file panel"
              onClick={onClose}
              className="flex size-11 items-center justify-center rounded-lg text-kumo-subtle transition-transform duration-150 ease-out hover:bg-kumo-tint hover:text-kumo-default active:scale-[0.96]"
            >
              <X aria-hidden size={16} />
            </button>
          </>
        )}
      </div>
      {openFile ? (
        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
          <article className="mx-auto max-w-2xl">
            {renderMarkdown(openFile.body)}
          </article>
        </div>
      ) : (
        <div className="grid gap-1 p-2">
          {sampleFiles.map((file) => (
            <button
              key={file.id}
              type="button"
              onClick={() => setOpenFile(file.id)}
              className="grid gap-0.5 rounded-lg px-3 py-3 text-left transition-colors duration-150 ease-out hover:bg-kumo-tint focus-visible:outline-2 focus-visible:outline-kumo-focus"
            >
              <span className="flex items-center gap-2 text-sm font-medium text-kumo-default">
                <FileText
                  aria-hidden
                  size={15}
                  weight="bold"
                  className="shrink-0 text-kumo-subtle"
                />
                <span className="truncate">{file.name}</span>
              </span>
              <span className="ps-[1.35rem] text-xs text-kumo-subtle">
                {file.course} · {file.size}
              </span>
            </button>
          ))}
        </div>
      )}
    </LayerCard>
  );
}

function FloatingTimerPill({ onExit }: { onExit: () => void }) {
  const { session, remainingMs, breakState, now, togglePause } = useFocus();
  const showBreak = breakState && !session;
  const remaining = session
    ? (remainingMs ?? 0)
    : showBreak
      ? Math.max(0, breakState!.endsAt - now)
      : 0;
  const label = session ? (session.status === "paused" ? "Paused" : "Focus") : "Break";

  return (
    <div className="fixed top-4 right-4 z-50 flex items-center gap-2 rounded-full bg-kumo-base px-4 py-2 shadow-md ring ring-kumo-line">
      <span
        aria-hidden
        className={`size-1.5 rounded-full ${
          showBreak
            ? "bg-kumo-success"
            : session?.status === "paused"
              ? "bg-kumo-warning"
              : "bg-kumo-brand"
        }`}
      />
      <span className="text-sm font-medium text-kumo-default">{label}</span>
      <span className="text-sm text-kumo-subtle tabular-nums">
        {formatClock(remaining)}
      </span>
      {session ? (
        <button
          type="button"
          aria-label={session.status === "paused" ? "Resume focus" : "Pause focus"}
          onClick={togglePause}
          className="flex size-9 items-center justify-center rounded-full text-kumo-default transition-transform duration-150 ease-out hover:bg-kumo-tint active:scale-[0.96]"
        >
          {session.status === "paused" ? (
            <Play aria-hidden size={14} weight="bold" className="translate-x-px" />
          ) : (
            <Pause aria-hidden size={14} weight="bold" />
          )}
        </button>
      ) : null}
      <button
        type="button"
        aria-label="Exit fullscreen"
        onClick={onExit}
        className="flex size-9 items-center justify-center rounded-full text-kumo-subtle transition-transform duration-150 ease-out hover:bg-kumo-tint hover:text-kumo-default active:scale-[0.96]"
      >
        <ArrowSquareOut aria-hidden size={14} weight="bold" />
      </button>
    </div>
  );
}

function FullscreenFile({ file, onExit }: { file: SampleFile; onExit: () => void }) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onExit();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onExit]);

  return (
    <div className="fixed inset-0 z-40 bg-kumo-canvas">
      <div className="h-full overflow-y-auto">
        <div className="mx-auto max-w-3xl px-6 py-12 pb-24">
          <article className="grid gap-4">
            <div>
              <h1 className="text-3xl font-semibold tracking-tight text-kumo-strong">
                {file.name}
              </h1>
              <p className="mt-1 text-sm text-kumo-subtle">
                {file.course} · {file.size}
              </p>
            </div>
            <div className="mt-2">{renderMarkdown(file.body)}</div>
          </article>
        </div>
      </div>
      <FloatingTimerPill onExit={onExit} />
    </div>
  );
}

function SessionDetail({
  record,
  onBack,
  onStartAgain,
}: {
  record: HistoryRecord;
  onBack: () => void;
  onStartAgain: () => void;
}) {
  return (
    <LayerCard className="px-5 py-5">
      <div className="grid gap-4">
        <button
          type="button"
          onClick={onBack}
          className="flex min-h-8 w-fit items-center gap-1 text-sm font-medium text-kumo-default transition-transform duration-150 ease-out hover:text-kumo-strong active:scale-[0.96]"
        >
          <ArrowLeft aria-hidden size={14} weight="bold" /> History
        </button>
        <div className="grid gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <Text as="h2" variant="heading3">
              {record.title}
            </Text>
            <Badge
              variant={record.outcome === "completed" ? "success" : "secondary"}
            >
              {record.outcome === "completed" ? "Completed" : "Cancelled"}
            </Badge>
          </div>
          <p className="text-sm text-kumo-subtle">
            {record.course ? `${record.course} · ` : ""}
            Planned {formatDuration(record.windowMs)} ·{" "}
            {formatClockRange(record.startedAt, record.endedAt)}
          </p>
        </div>
        <Button
          variant="ghost"
          className="w-fit justify-center text-sm transition-transform duration-150 ease-out active:scale-[0.96]"
          onClick={onStartAgain}
        >
          <Timer aria-hidden size={14} weight="bold" /> Start again
        </Button>
      </div>
    </LayerCard>
  );
}

function HistorySection() {
  const { history, todayTotalMs, todayCount, startSession } = useFocus();
  const [selected, setSelected] = useState<HistoryRecord | null>(null);

  if (history.length === 0) return null;

  if (selected) {
    return (
      <SessionDetail
        record={selected}
        onBack={() => setSelected(null)}
        onStartAgain={() => {
          startSession({
            kind: selected.kind,
            title: selected.title,
            course: selected.course,
            note: null,
            fileId: null,
            windowMs: selected.windowMs,
            origin: "focus",
            startedAt: Date.now(),
          });
          setSelected(null);
        }}
      />
    );
  }

  const groups = groupByDay(history);

  return (
    <section className="grid gap-3" aria-labelledby="focus-history">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <Text as="h2" variant="heading3" id="focus-history">
          History
        </Text>
        {todayCount > 0 ? (
          <span className="text-sm text-kumo-subtle">
            Today · {todayCount} {todayCount === 1 ? "session" : "sessions"} ·{" "}
            {formatDuration(todayTotalMs)}
          </span>
        ) : null}
      </div>
      <LayerCard>
        <div className="divide-y divide-kumo-line">
          {groups.map((group) => (
            <div key={group.key}>
              <h3 className="px-5 pt-4 pb-1 text-xs font-medium tracking-wide text-kumo-subtle uppercase">
                {group.key}
              </h3>
              <ul>
                {group.records.map((record) => (
                  <li key={record.id}>
                    <button
                      type="button"
                      onClick={() => setSelected(record)}
                      className="grid w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 px-5 py-3.5 text-left transition-colors duration-150 ease-out hover:bg-kumo-tint focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-kumo-focus"
                    >
                      <span
                        className={`flex size-6 shrink-0 items-center justify-center rounded-full ${
                          record.outcome === "completed"
                            ? "bg-kumo-success text-white"
                            : "bg-kumo-base text-kumo-subtle ring ring-kumo-line"
                        }`}
                      >
                        {record.outcome === "completed" ? (
                          <Check aria-hidden size={13} weight="bold" />
                        ) : (
                          <X aria-hidden size={12} weight="bold" />
                        )}
                      </span>
                      <span className="grid min-w-0 gap-0">
                        <span className="truncate text-sm font-medium text-kumo-default">
                          {record.title}
                        </span>
                        <span className="text-xs text-kumo-subtle">
                          {record.course ? `${record.course} · ` : ""}
                          {formatClockRange(record.startedAt, record.endedAt)}
                        </span>
                      </span>
                      <span className="text-xs text-kumo-subtle tabular-nums">
                        {formatDuration(record.windowMs)}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </LayerCard>
    </section>
  );
}

export function FocusPage({
  onOpenTaskSurface,
  onOpenNoteSurface,
}: {
  onOpenTaskSurface: () => void;
  onOpenNoteSurface: () => void;
}) {
  const {
    session,
    breakState,
    justCompleted,
    startSession,
    openFileId,
    setOpenFile,
    prefs,
  } = useFocus();
  const [fileFullscreen, setFileFullscreen] = useState(false);

  const openFile = sampleFiles.find((file) => file.id === openFileId) ?? null;
  const showSplit =
    !fileFullscreen && (Boolean(session) || Boolean(openFileId));

  const startTaskSession = (task: (typeof demoTasks)[number]) => {
    startSession({
      kind: "task",
      title: task.title,
      course: task.course,
      note: task.note,
      fileId: task.fileId,
      windowMs: prefs.workMin * 60000,
      origin: "focus",
      startedAt: Date.now(),
    });
  };

  return (
    <main className="bg-kumo-canvas">
      <StatusAnnouncer />
      <div className="mx-auto w-full max-w-6xl px-4 py-8 pb-24 sm:px-6 md:py-10">
        <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <Text as="h1" variant="heading2">
            Focus
          </Text>
          <DurationPopover />
        </header>

        <div
          className={
            showSplit
              ? "grid items-start gap-4 lg:grid-cols-[minmax(20rem,24rem)_minmax(0,1fr)]"
              : "grid items-start gap-4"
          }
        >
          <div className="grid gap-4">
            {session ? (
              <SessionCard
                session={session}
                onOpenTask={onOpenTaskSurface}
                onOpenNote={onOpenNoteSurface}
                onToggleFile={() => setOpenFile(openFileId ? null : session.fileId ?? sampleFiles[0].id)}
              />
            ) : breakState && !justCompleted ? (
              <BreakCard breakState={breakState} />
            ) : justCompleted ? (
              <CompletedCard
                completed={justCompleted}
                onStartAnother={() =>
                  startSession({
                    kind: justCompleted.kind,
                    title: justCompleted.title,
                    course: justCompleted.course,
                    note: null,
                    fileId: null,
                    windowMs: justCompleted.windowMs,
                    origin: "focus",
                    startedAt: Date.now(),
                  })
                }
              />
            ) : (
              <FreeFocusCard onFocusTask={startTaskSession} />
            )}
          </div>

          {showSplit ? (
            <FilePanel
              onClose={() => setOpenFile(null)}
              onFullscreen={() => {
                if (openFile) setFileFullscreen(true);
              }}
            />
          ) : null}
        </div>

        <div className="mt-8">
          <HistorySection />
        </div>
      </div>

      {fileFullscreen && openFile ? (
        <FullscreenFile file={openFile} onExit={() => setFileFullscreen(false)} />
      ) : null}
    </main>
  );
}
