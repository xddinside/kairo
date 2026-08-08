import { CheckCircle, Pause, Play, Timer } from "@phosphor-icons/react";

import {
  formatClock,
  useFocus,
  type BreakState,
  type FocusSession,
} from "./focus-store";

function PillBody({
  session,
  breakState,
  remainingMs,
  onToggle,
  onGoToFocus,
}: {
  session: FocusSession | null;
  breakState: BreakState;
  remainingMs: number | null;
  onToggle: () => void;
  onGoToFocus: () => void;
}) {
  if (breakState) {
    const breakRemaining = Math.max(0, breakState.endsAt - Date.now());
    return (
      <span
        role="button"
        tabIndex={0}
        aria-label="Break in progress, open Focus"
        onClick={onGoToFocus}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            onGoToFocus();
          }
        }}
        className="flex min-w-0 flex-1 items-center gap-2 text-sm font-medium text-kumo-default"
      >
        <span aria-hidden className="size-1.5 shrink-0 rounded-full bg-kumo-success" />
        <span className="truncate">Break</span>
        <span className="text-kumo-subtle tabular-nums">
          {formatClock(breakRemaining)}
        </span>
      </span>
    );
  }

  if (!session) return null;

  const paused = session.status === "paused";
  const time = remainingMs ?? 0;

  return (
    <>
      <span
        role="button"
        tabIndex={0}
        aria-label={paused ? "Focus paused, open Focus" : "Open Focus"}
        onClick={onGoToFocus}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            onGoToFocus();
          }
        }}
        className="flex min-w-0 flex-1 items-center gap-2 text-sm font-medium text-kumo-default"
      >
        <span
          aria-hidden
          className={`size-1.5 shrink-0 rounded-full ${
            paused ? "bg-kumo-warning" : "bg-kumo-brand"
          }`}
        />
        <span className="truncate">{paused ? "Paused" : "Focusing"}</span>
        <span className="text-kumo-subtle tabular-nums">{formatClock(time)}</span>
      </span>
      <button
        type="button"
        aria-label={paused ? "Resume focus" : "Pause focus"}
        onClick={onToggle}
        className="flex size-9 shrink-0 items-center justify-center rounded-md text-kumo-subtle transition-transform duration-150 ease-out hover:bg-kumo-base hover:text-kumo-default active:scale-[0.96]"
      >
        {paused ? (
          <Play aria-hidden size={15} weight="bold" className="translate-x-px" />
        ) : (
          <Pause aria-hidden size={15} weight="bold" />
        )}
      </button>
    </>
  );
}

export function RailPill({ onGoToFocus }: { onGoToFocus: () => void }) {
  const { session, breakState, remainingMs, togglePause, justCompleted } =
    useFocus();
  const active = Boolean(session || breakState || justCompleted);
  if (!active) return null;

  return (
    <div className="w-full rounded-lg bg-kumo-base px-3 py-2.5 shadow-xs ring ring-kumo-line group-data-[state=collapsed]/sidebar:hidden">
      {justCompleted && !session && !breakState ? (
        <button
          type="button"
          onClick={onGoToFocus}
          className="flex w-full items-center gap-2 text-sm font-medium text-kumo-default transition-transform duration-150 ease-out active:scale-[0.97]"
        >
          <CheckCircle
            aria-hidden
            size={15}
            weight="bold"
            className="text-kumo-success"
          />
          <span className="truncate">Pomodoro complete</span>
        </button>
      ) : (
        <div className="flex items-center gap-2">
          <PillBody
            session={session}
            breakState={breakState}
            remainingMs={remainingMs}
            onToggle={togglePause}
            onGoToFocus={onGoToFocus}
          />
        </div>
      )}
    </div>
  );
}

export function MobilePill({ onGoToFocus }: { onGoToFocus: () => void }) {
  const { session, breakState, remainingMs, togglePause, justCompleted } =
    useFocus();
  const active = Boolean(session || breakState || justCompleted);
  if (!active) return null;

  return (
    <div className="fixed inset-x-4 bottom-4 z-40 md:hidden">
      <div className="flex items-center gap-2 rounded-full bg-kumo-base px-4 py-2.5 shadow-md ring ring-kumo-line">
        <Timer
          aria-hidden
          size={16}
          weight="bold"
          className="shrink-0 text-kumo-brand"
        />
        {justCompleted && !session && !breakState ? (
          <button
            type="button"
            onClick={onGoToFocus}
            className="flex min-w-0 flex-1 items-center gap-2 text-sm font-medium text-kumo-default transition-transform duration-150 ease-out active:scale-[0.97]"
          >
            <CheckCircle
              aria-hidden
              size={15}
              weight="bold"
              className="shrink-0 text-kumo-success"
            />
            <span className="truncate">Pomodoro complete</span>
          </button>
        ) : (
          <PillBody
            session={session}
            breakState={breakState}
            remainingMs={remainingMs}
            onToggle={togglePause}
            onGoToFocus={onGoToFocus}
          />
        )}
      </div>
    </div>
  );
}
