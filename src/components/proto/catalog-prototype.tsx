import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import {
  ArrowRight,
  CalendarCheck,
  CalendarDots,
  Check,
  CheckCircle,
  Clock,
  FrameCorners,
  Lightning,
  ListChecks,
  Note,
  NoteBlank,
  Pause,
  Play,
  Sparkle,
  Target,
  Timer,
} from "@phosphor-icons/react";
import { Badge } from "@cloudflare/kumo/components/badge";
import { Button } from "@cloudflare/kumo/components/button";
import { LayerCard } from "@cloudflare/kumo/components/layer-card";
import { Text } from "@cloudflare/kumo/components/text";

import {
  contextSummary,
  linkedNotes,
  planItems,
  studyWindows,
  todayClasses,
} from "./canvas-data";

type WorkRoute =
  | "Canvas"
  | "Tasks"
  | "Timetable"
  | "Deadlines"
  | "Notes"
  | "Focus";

type CatalogScenario =
  | "plan"
  | "workload"
  | "focus"
  | "clarify"
  | "loading"
  | "recovery";

const catalogScenarios = [
  { key: "plan", label: "Plan" },
  { key: "workload", label: "Workload" },
  { key: "focus", label: "Focus" },
  { key: "clarify", label: "Clarify" },
  { key: "loading", label: "Generating" },
  { key: "recovery", label: "Recover" },
] as const satisfies ReadonlyArray<{ key: CatalogScenario; label: string }>;

const routeItems = [
  { key: "Canvas", icon: FrameCorners, description: "Shape the next move" },
  { key: "Tasks", icon: ListChecks, description: "Open academic work" },
  { key: "Timetable", icon: CalendarDots, description: "Classes and windows" },
  { key: "Deadlines", icon: CalendarCheck, description: "What is coming up" },
  { key: "Notes", icon: NoteBlank, description: "Remembered context" },
  { key: "Focus", icon: Timer, description: "Work in a session" },
] as const satisfies ReadonlyArray<{
  key: WorkRoute;
  icon: typeof FrameCorners;
  description: string;
}>;

const routeDescriptions: Record<WorkRoute, string> = {
  Canvas: "A generated view shaped by your intent and academic context.",
  Tasks: "Every open piece of academic work in one place.",
  Timetable: "Classes and study windows for the week.",
  Deadlines: "The dates that should shape your plan.",
  Notes: "Short context that keeps work specific.",
  Focus: "A clear place to start and finish a session.",
};

const scenarioHeadings: Record<CatalogScenario, { title: string; description: string }> = {
  plan: {
    title: "What matters now",
    description: "A generated plan ranked around your current context.",
  },
  workload: {
    title: "Balance this workload",
    description: "Deadlines, available time, and open work in one generated view.",
  },
  focus: {
    title: "Focus on the next step",
    description: "A working session with the notes that support it.",
  },
  clarify: {
    title: "One thing before I plan",
    description: "Kairo asks only for context that changes the result.",
  },
  loading: {
    title: "Shaping your view",
    description: "The last usable view stays available while a new one is prepared.",
  },
  recovery: {
    title: "Keep working",
    description: "A failed generation never removes the last usable plan.",
  },
};

const taskRows = [
  {
    title: "Finish TOC Tutorial 3",
    course: "Theory of Computation",
    detail: "Questions 4–5 left",
    status: "Overdue",
    badge: "error" as const,
  },
  {
    title: "Review backpropagation examples",
    course: "AI & Neural Networks",
    detail: "Quiz Wednesday · 45 min",
    status: "In progress",
    badge: "info" as const,
  },
  {
    title: "Finish the planning flow",
    course: "Software Engineering",
    detail: "Checkpoint Thursday · 90 min",
    status: "In progress",
    badge: "info" as const,
  },
  {
    title: "Complete the vulnerable-VM exercise",
    course: "Ethical Hacking",
    detail: "Report due Monday · 60 min",
    status: "Queued",
    badge: "secondary" as const,
  },
] as const;

const deadlines = [
  {
    title: "AINN Quiz 2",
    date: "Wednesday, 5 August · 9:00 AM",
    detail: "30% prepared · review examples and take a practice quiz",
    progress: "30%",
    badge: "warning" as const,
  },
  {
    title: "Software Engineering checkpoint",
    date: "Thursday, 6 August · 6:00 PM",
    detail: "Main planning flow is 55% complete",
    progress: "55%",
    badge: "info" as const,
  },
  {
    title: "Ethical Hacking Lab 4 report",
    date: "Monday, 10 August · 5:00 PM",
    detail: "Vulnerable-VM exercise and report are still open",
    progress: "20%",
    badge: "secondary" as const,
  },
] as const;

const pickerStyles = `
.proto-picker {
  position: fixed;
  bottom: 24px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 2147483647;
  display: flex;
  max-width: calc(100vw - 32px);
  align-items: center;
  gap: 2px;
  overflow-x: auto;
  padding: 4px;
  scrollbar-width: none;
  border-radius: 999px;
  background: rgba(10, 10, 10, 0.82);
  -webkit-backdrop-filter: blur(12px) saturate(1.4);
  backdrop-filter: blur(12px) saturate(1.4);
  box-shadow:
    0 0 0 1px rgba(255, 255, 255, 0.08) inset,
    0 8px 24px rgba(0, 0, 0, 0.24),
    0 2px 6px rgba(0, 0, 0, 0.12);
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  font-size: 13px;
  line-height: 1;
  -webkit-font-smoothing: antialiased;
  user-select: none;
  -webkit-user-select: none;
}

.proto-picker::-webkit-scrollbar { display: none; }

.proto-picker-highlight {
  position: absolute;
  top: 4px;
  left: 0;
  height: 28px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.12);
  will-change: transform;
}

.proto-picker[data-ready] .proto-picker-highlight {
  transition:
    transform 250ms cubic-bezier(0.23, 1, 0.32, 1),
    width 250ms cubic-bezier(0.23, 1, 0.32, 1);
}

@media (prefers-reduced-motion: reduce) {
  .proto-picker[data-ready] .proto-picker-highlight { transition: none; }
}

.proto-picker-item {
  position: relative;
  display: flex;
  align-items: center;
  height: 28px;
  padding: 0 12px;
  border: 0;
  border-radius: 999px;
  background: transparent;
  color: rgba(255, 255, 255, 0.55);
  font: inherit;
  white-space: nowrap;
  cursor: pointer;
  transition: color 150ms ease-out;
}

.proto-picker-item:hover { color: rgba(255, 255, 255, 0.85); }
.proto-picker-item:active { transform: scale(0.97); }
.proto-picker-item:focus-visible {
  outline: 2px solid rgba(255, 255, 255, 0.4);
  outline-offset: 2px;
}
.proto-picker-item[data-active] { color: #fff; }
.proto-picker-divider {
  width: 1px;
  height: 16px;
  margin: 0 4px;
  background: rgba(255, 255, 255, 0.12);
}
.proto-picker-replay { padding: 0 10px; font-size: 14px; }
.proto-picker[data-position="top"] { bottom: auto; top: 24px; }
.proto-picker-item[data-scenario-active] {
  background: rgba(255, 255, 255, 0.12);
  color: #fff;
}

.catalog-view-enter { animation: catalog-view-enter 180ms ease-out both; }
@keyframes catalog-view-enter {
  from { opacity: 0; transform: translateY(4px); }
  to { opacity: 1; transform: translateY(0); }
}
@media (prefers-reduced-motion: reduce) {
  .catalog-view-enter { animation: none; }
}
`;

type DemoState = {
  route: WorkRoute;
  focusRunning: boolean;
  completedTasks: Set<string>;
  notice: string;
  selectedNote: string;
  goTo: (route: WorkRoute) => void;
  startFocus: () => void;
  toggleTask: (title: string) => void;
  selectNote: (title: string) => void;
  announce: (message: string) => void;
};

function useDemoState(): DemoState {
  const [route, setRoute] = useState<WorkRoute>("Canvas");
  const [focusRunning, setFocusRunning] = useState(false);
  const [completedTasks, setCompletedTasks] = useState<Set<string>>(new Set());
  const [notice, setNotice] = useState("");
  const [selectedNote, setSelectedNote] = useState(linkedNotes[0].title);

  return {
    route,
    focusRunning,
    completedTasks,
    notice,
    selectedNote,
    goTo: (nextRoute) => {
      setRoute(nextRoute);
      setNotice("");
    },
    startFocus: () => {
      setFocusRunning((running) => !running);
      setNotice(focusRunning ? "Focus session paused" : "Focus session started");
    },
    toggleTask: (title) => {
      setCompletedTasks((current) => {
        const next = new Set(current);
        if (next.has(title)) next.delete(title);
        else next.add(title);
        return next;
      });
      setNotice(completedTasks.has(title) ? `${title} reopened` : `${title} marked done`);
    },
    selectNote: (title) => {
      setSelectedNote(title);
      setNotice(`${title} is open in context`);
    },
    announce: setNotice,
  };
}

function RouteIcon({ route, size = 18 }: { route: WorkRoute; size?: number }) {
  const item = routeItems.find((candidate) => candidate.key === route);
  if (!item) return null;
  const Icon = item.icon;
  return <Icon aria-hidden="true" size={size} weight="regular" />;
}

function RouteNavButton({
  route,
  active,
  onSelect,
  mode,
}: {
  route: (typeof routeItems)[number];
  active: boolean;
  onSelect: () => void;
  mode: "rail" | "icon" | "top";
}) {
  const base =
    "group flex min-w-0 items-center border-0 text-left transition-colors duration-150 ease-out focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-kumo-focus";
  const modeClass = {
    rail: "w-full gap-3 rounded-lg px-3 py-2.5",
    icon: "mx-auto size-9 justify-center rounded-lg",
    top: "gap-2 rounded-md px-3 py-2",
  }[mode];
  const activeClass = active
    ? "bg-kumo-base text-kumo-strong shadow-xs ring ring-kumo-line"
    : "text-kumo-subtle hover:bg-kumo-tint hover:text-kumo-default";

  return (
    <button
      type="button"
      aria-current={active ? "page" : undefined}
      aria-label={mode === "icon" ? route.key : undefined}
      className={`${base} ${modeClass} ${activeClass}`}
      onClick={onSelect}
    >
      <span className={active ? "text-kumo-brand" : "text-kumo-subtle"}>
        <RouteIcon route={route.key} />
      </span>
      {mode !== "icon" ? (
        <span className="min-w-0 flex-1 truncate text-sm font-medium">
          {route.key}
        </span>
      ) : null}
      {mode === "rail" && active ? (
        <span className="text-xs text-kumo-subtle">Now</span>
      ) : null}
    </button>
  );
}

function RouteHeading({
  route,
  scenario,
}: {
  route: WorkRoute;
  scenario: CatalogScenario;
}) {
  const heading = route === "Canvas" ? scenarioHeadings[scenario] : null;

  return (
    <div className="grid gap-1">
      <Text as="h1" variant="heading2">
        {heading?.title ?? route}
      </Text>
      <p className="max-w-2xl text-sm text-kumo-subtle">
        {heading?.description ?? routeDescriptions[route]}
      </p>
    </div>
  );
}

function CatalogDefinition() {
  const blocks = [
    ["Generated view", "secondary"],
    ["Work plan", "info"],
    ["Schedule snapshot", "secondary"],
    ["Deadline snapshot", "warning"],
    ["Context notes", "secondary"],
    ["Task checklist", "secondary"],
    ["Focus session", "success"],
    ["Plan rationale", "info"],
    ["Decision prompt", "warning"],
  ] as const;

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {blocks.map(([label, variant]) => (
        <Badge key={label} variant={variant} className="text-xs">
          {label}
        </Badge>
      ))}
    </div>
  );
}

function ActionButton({
  children,
  className = "",
  onClick,
  variant = "ghost",
}: {
  children: ReactNode;
  className?: string;
  onClick: () => void;
  variant?: "primary" | "ghost";
}) {
  return (
    <Button
      type="button"
      variant={variant}
      size="sm"
      className={`text-sm transition-transform duration-150 ease-out active:not-disabled:scale-[0.96] ${className}`}
      onClick={onClick}
    >
      {children}
    </Button>
  );
}

type CurrentFocusBlockProps = {
  item: (typeof planItems)[number];
  focusRunning: boolean;
  onToggleFocus: () => void;
  onOpenNote: (title: string) => void;
};

function CurrentFocusBlock({
  item,
  focusRunning,
  onToggleFocus,
  onOpenNote,
}: CurrentFocusBlockProps) {
  return (
    <LayerCard className="px-5 py-5">
      <div className="grid gap-4">
        <div className="flex items-center gap-2 text-sm font-medium text-kumo-default">
          <span
            aria-hidden="true"
            className={`size-1.5 rounded-full ${focusRunning ? "bg-kumo-brand" : "bg-kumo-success"}`}
          />
          {focusRunning ? "Focus running" : `Now · ${item.window}`}
        </div>
        <div className="grid gap-1.5">
          <Text as="h2" variant="heading2">
            {item.title}
          </Text>
          <p className="text-sm text-kumo-subtle">
            {item.course} · {item.duration} · {item.context}
          </p>
        </div>
        <p className="max-w-2xl text-sm leading-6 text-kumo-subtle">
          {item.reason}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <ActionButton className="min-w-28 justify-center" variant="primary" onClick={onToggleFocus}>
            <span aria-hidden="true" className="relative size-3.5 shrink-0">
              <Pause
                size={14}
                weight="bold"
                className={`absolute inset-0 transition-[opacity,filter,scale] duration-300 ease-[cubic-bezier(0.2,0,0,1)] motion-reduce:transition-none motion-reduce:blur-none ${focusRunning ? "scale-100 opacity-100 blur-0" : "scale-[0.25] opacity-0 blur-[4px]"}`}
              />
              <Play
                size={14}
                weight="bold"
                className={`absolute inset-0 translate-x-px transition-[opacity,filter,scale] duration-300 ease-[cubic-bezier(0.2,0,0,1)] motion-reduce:transition-none motion-reduce:blur-none ${focusRunning ? "scale-[0.25] opacity-0 blur-[4px]" : "scale-100 opacity-100 blur-0"}`}
              />
            </span>
            {focusRunning ? "Pause focus" : "Start focus"}
          </ActionButton>
          {item.note ? (
            <ActionButton onClick={() => onOpenNote(item.note!)}>
              <Note aria-hidden="true" size={14} weight="bold" /> Open note
            </ActionButton>
          ) : null}
        </div>
      </div>
    </LayerCard>
  );
}

type NextStepsBlockProps = {
  items: Array<(typeof planItems)[number]>;
  onOpenAll: () => void;
  onOpenItem: (title: string) => void;
};

function NextStepsBlock({ items, onOpenAll, onOpenItem }: NextStepsBlockProps) {
  return (
    <section className="grid gap-3" aria-labelledby="catalog-next-steps">
      <div className="flex items-end justify-between gap-3">
        <Text as="h2" variant="heading3" id="catalog-next-steps">
          Next steps
        </Text>
        <button
          type="button"
          className="flex min-h-8 items-center gap-1 text-sm font-medium text-kumo-default transition-transform duration-150 ease-out hover:text-kumo-strong active:scale-[0.96] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-kumo-focus"
          onClick={onOpenAll}
        >
          All tasks <ArrowRight aria-hidden="true" size={14} weight="bold" />
        </button>
      </div>
      <LayerCard>
        <ol className="divide-y divide-kumo-line">
          {items.map((item) => (
            <li key={item.title} className="grid gap-2 px-5 py-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-sm font-medium text-kumo-default">
                  <Clock aria-hidden="true" size={15} weight="bold" /> {item.window}
                </div>
                <div className="flex items-center gap-1.5">
                  <Badge variant={item.timing === "Next" ? "info" : "secondary"}>
                    {item.timing}
                  </Badge>
                  {item.overdue ? <Badge variant="error">Overdue</Badge> : null}
                </div>
              </div>
              <Text as="h3" bold size="lg">
                {item.title}
              </Text>
              <p className="text-sm text-kumo-subtle">
                {item.course} · {item.duration} · {item.context}
              </p>
              <p className="text-sm leading-6 text-kumo-subtle">{item.reason}</p>
              <button
                type="button"
                className="flex min-h-8 w-fit items-center gap-1 text-sm font-medium text-kumo-default transition-transform duration-150 ease-out hover:text-kumo-strong active:scale-[0.96] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-kumo-focus"
                onClick={() => onOpenItem(item.title)}
              >
                View work <ArrowRight aria-hidden="true" size={14} weight="bold" />
              </button>
            </li>
          ))}
        </ol>
      </LayerCard>
    </section>
  );
}

function WorkPlanBlock({ state }: { state: DemoState }) {
  const [currentFocus, ...nextSteps] = planItems;

  return (
    <div className="grid gap-6">
      <CurrentFocusBlock
        item={currentFocus}
        focusRunning={state.focusRunning}
        onToggleFocus={state.startFocus}
        onOpenNote={(title) => {
          state.goTo("Notes");
          state.selectNote(title);
        }}
      />
      <NextStepsBlock
        items={nextSteps}
        onOpenAll={() => state.goTo("Tasks")}
        onOpenItem={(title) => {
          state.goTo("Tasks");
          state.announce(`Opened ${title}`);
        }}
      />
    </div>
  );
}

function PlanRationaleBlock() {
  const evidence = [
    ...planItems[0].signals,
    contextSummary.next,
  ];

  return (
    <section className="grid gap-3" aria-labelledby="catalog-plan-rationale">
      <Text as="h2" variant="heading3" id="catalog-plan-rationale">
        Why this plan
      </Text>
      <LayerCard className="px-5 py-4">
        <ul className="grid gap-2 sm:grid-cols-2">
          {evidence.map((signal) => (
            <li key={signal} className="flex items-start gap-2 text-sm text-kumo-default">
              <span className="flex h-lh items-center text-kumo-success">
                <CheckCircle aria-hidden="true" size={15} weight="bold" />
              </span>
              <span>{signal}</span>
            </li>
          ))}
        </ul>
      </LayerCard>
    </section>
  );
}

function TaskChecklistBlock({
  completedTasks,
  onToggleTask,
}: {
  completedTasks: Set<string>;
  onToggleTask: (title: string) => void;
}) {
  return (
    <section className="grid gap-3" aria-labelledby="catalog-task-list">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Text as="h2" variant="heading3" id="catalog-task-list">
          Open tasks
        </Text>
        <Badge variant="secondary">{taskRows.length} shown</Badge>
      </div>
      <LayerCard>
        <ul className="divide-y divide-kumo-line">
          {taskRows.map((task) => {
            const complete = completedTasks.has(task.title);
            return (
              <li key={task.title} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
                <div className="flex min-w-0 items-start gap-3">
                  <button
                    type="button"
                    aria-label={complete ? `Reopen ${task.title}` : `Mark ${task.title} done`}
                    aria-pressed={complete}
                    className={`mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full border transition-transform duration-150 ease-out active:scale-[0.96] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-kumo-focus ${complete ? "border-kumo-success bg-kumo-success text-white" : "border-kumo-line hover:border-kumo-brand"}`}
                    onClick={() => onToggleTask(task.title)}
                  >
                    {complete ? <Check aria-hidden="true" size={13} weight="bold" /> : null}
                  </button>
                  <div className="grid min-w-0 gap-1">
                    <span className={`text-sm font-medium ${complete ? "text-kumo-subtle line-through" : "text-kumo-default"}`}>
                      {task.title}
                    </span>
                    <span className="text-xs text-kumo-subtle">
                      {task.course} · {task.detail}
                    </span>
                  </div>
                </div>
                <Badge variant={task.badge}>{complete ? "Done" : task.status}</Badge>
              </li>
            );
          })}
        </ul>
      </LayerCard>
    </section>
  );
}

function ScheduleSnapshotBlock({ onShapePlan }: { onShapePlan: () => void }) {
  return (
    <section className="grid gap-3" aria-labelledby="catalog-schedule-snapshot">
      <Text as="h2" variant="heading3" id="catalog-schedule-snapshot">
        Schedule snapshot
      </Text>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <LayerCard className="px-5 py-5">
          <div className="grid gap-4">
            <div className="flex items-center justify-between gap-3">
              <Text as="h3" bold size="lg">Monday timetable</Text>
              <Badge variant="info">{todayClasses.length} classes</Badge>
            </div>
            <ol className="grid gap-2">
              {todayClasses.map((entry, index) => (
                <li key={entry.time} className="flex items-center gap-3 rounded-lg bg-kumo-tint px-3 py-3">
                  <span className={`flex size-8 shrink-0 items-center justify-center rounded-full ${index === 0 ? "bg-kumo-brand text-white" : "bg-kumo-base text-kumo-subtle ring ring-kumo-line"}`}>
                    <CalendarDots aria-hidden="true" size={16} weight={index === 0 ? "bold" : "regular"} />
                  </span>
                  <span className="grid gap-0.5">
                    <span className="text-sm font-medium text-kumo-default">{entry.name}</span>
                    <span className="text-xs text-kumo-subtle">{entry.time}</span>
                  </span>
                </li>
              ))}
            </ol>
          </div>
        </LayerCard>
        <LayerCard className="px-5 py-5">
          <div className="grid gap-3">
            <Text as="h3" bold size="lg">Open study windows</Text>
            <ul className="grid gap-2">
              {studyWindows.map((window) => (
                <li key={window} className="flex items-center justify-between gap-3 text-sm">
                  <span className="flex items-center gap-2 text-kumo-default">
                    <Clock aria-hidden="true" size={15} weight="bold" /> {window}
                  </span>
                  <span className="text-xs text-kumo-subtle">Available</span>
                </li>
              ))}
            </ul>
            <ActionButton onClick={onShapePlan}>
              Shape a plan <ArrowRight aria-hidden="true" size={14} weight="bold" />
            </ActionButton>
          </div>
        </LayerCard>
      </div>
    </section>
  );
}

function DeadlineSnapshotBlock({ onReviewWork }: { onReviewWork: () => void }) {
  return (
    <section className="grid gap-3" aria-labelledby="catalog-deadline-snapshot">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Text as="h2" variant="heading3" id="catalog-deadline-snapshot">
          Deadline snapshot
        </Text>
        <Badge variant="warning">1 overdue task</Badge>
      </div>
      <div className="grid gap-3">
        {deadlines.map((deadline) => {
          const progress = Number.parseInt(deadline.progress, 10);
          return (
            <LayerCard key={deadline.title} className="px-5 py-4">
              <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_10rem] sm:items-center">
                <div className="grid gap-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={deadline.badge}>{deadline.progress} prepared</Badge>
                    <span className="text-xs text-kumo-subtle">{deadline.date}</span>
                  </div>
                  <Text as="h3" bold size="lg">{deadline.title}</Text>
                  <p className="text-sm text-kumo-subtle">{deadline.detail}</p>
                </div>
                <div className="grid gap-2">
                  <div
                    role="progressbar"
                    aria-label={`${deadline.title} preparation`}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={progress}
                    className="h-2 overflow-hidden rounded-full bg-kumo-tint"
                  >
                    <div className="h-full rounded-full bg-kumo-brand" style={{ width: deadline.progress }} />
                  </div>
                  <button
                    type="button"
                    className="justify-self-end text-sm font-medium text-kumo-default transition-transform duration-150 ease-out hover:text-kumo-strong active:scale-[0.96] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-kumo-focus"
                    onClick={onReviewWork}
                  >
                    Review work
                  </button>
                </div>
              </div>
            </LayerCard>
          );
        })}
      </div>
    </section>
  );
}

function ContextNotesBlock({
  selectedNote,
  onSelectNote,
}: {
  selectedNote: string;
  onSelectNote: (title: string) => void;
}) {
  return (
    <section className="grid gap-3" aria-labelledby="catalog-context-notes">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Text as="h2" variant="heading3" id="catalog-context-notes">
          Context notes
        </Text>
        <Badge variant="secondary">{linkedNotes.length} linked</Badge>
      </div>
      <LayerCard className="px-3 py-3">
        <ul className="grid gap-1">
          {linkedNotes.map((note) => {
            const selected = selectedNote === note.title;
            return (
              <li key={note.title}>
                <button
                  type="button"
                  aria-pressed={selected}
                  className={`grid w-full gap-1 rounded-lg px-3 py-3 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-kumo-focus ${selected ? "bg-kumo-tint ring ring-kumo-line" : "hover:bg-kumo-tint"}`}
                  onClick={() => onSelectNote(note.title)}
                >
                  <span className="flex items-center justify-between gap-3">
                    <span className="flex items-center gap-2 text-sm font-medium text-kumo-default">
                      <Note aria-hidden="true" size={16} weight={selected ? "fill" : "regular"} /> {note.title}
                    </span>
                    {selected ? <Badge variant="info">In context</Badge> : null}
                  </span>
                  <span className="text-sm leading-6 text-kumo-subtle">{note.preview}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </LayerCard>
    </section>
  );
}

function FocusSessionBlock({ state }: { state: DemoState }) {
  const item = planItems[0];
  return (
    <section className="grid gap-3" aria-labelledby="catalog-focus-session">
      <Text as="h2" variant="heading3" id="catalog-focus-session">
        Focus session
      </Text>
      <CurrentFocusBlock
        item={item}
        focusRunning={state.focusRunning}
        onToggleFocus={state.startFocus}
        onOpenNote={(title) => {
          state.goTo("Notes");
          state.selectNote(title);
        }}
      />
      <LayerCard className="px-5 py-4">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="grid gap-1">
            <Text as="h3" bold size="lg">This week</Text>
            <p className="text-sm text-kumo-subtle">Today: 0 of 3 focus blocks</p>
          </div>
          <div className="flex items-end gap-2">
            <span className="text-3xl font-semibold text-kumo-strong tabular-nums">9</span>
            <span className="pb-1 text-sm text-kumo-subtle">completed blocks</span>
          </div>
        </div>
      </LayerCard>
    </section>
  );
}

function DecisionPromptBlock({ onAnswer }: { onAnswer: (answer: string) => void }) {
  const answers = ["Before class", "After lunch", "This evening"];
  return (
    <LayerCard className="px-5 py-5">
      <div className="grid max-w-2xl gap-4">
        <Badge variant="info" className="w-fit">Needs context</Badge>
        <div className="grid gap-1.5">
          <Text as="h2" variant="heading2">When should I protect the study block?</Text>
          <p className="text-sm leading-6 text-kumo-subtle">Your calendar has room in three places. This choice changes the plan order.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {answers.map((answer, index) => (
            <ActionButton key={answer} variant={index === 0 ? "primary" : "ghost"} onClick={() => onAnswer(answer)}>
              {answer}
            </ActionButton>
          ))}
        </div>
      </div>
    </LayerCard>
  );
}

function GenerationStatusBlock({ onUseLastPlan }: { onUseLastPlan: () => void }) {
  return (
    <LayerCard className="px-5 py-5">
      <div role="status" className="grid max-w-2xl gap-5">
        <div className="flex items-center gap-2 text-sm font-medium text-kumo-default">
          <Sparkle aria-hidden="true" size={16} weight="bold" className="text-kumo-brand motion-safe:animate-pulse" />
          Shaping your view
        </div>
        <div className="grid gap-3" aria-hidden="true">
          <div className="h-4 w-2/3 rounded bg-kumo-tint motion-safe:animate-pulse" />
          <div className="h-3 w-full rounded bg-kumo-tint motion-safe:animate-pulse" />
          <div className="h-3 w-5/6 rounded bg-kumo-tint motion-safe:animate-pulse" />
        </div>
        <p className="text-sm leading-6 text-kumo-subtle">Checking deadlines, available windows, and linked course context.</p>
        <ActionButton onClick={onUseLastPlan}>Use last plan</ActionButton>
      </div>
    </LayerCard>
  );
}

function RecoveryBlock({
  onRetry,
  onUseLastPlan,
}: {
  onRetry: () => void;
  onUseLastPlan: () => void;
}) {
  return (
    <LayerCard className="px-5 py-5">
      <div className="grid max-w-2xl gap-4">
        <Badge variant="warning" className="w-fit">Generation paused</Badge>
        <div className="grid gap-1.5">
          <Text as="h2" variant="heading2">Kairo couldn’t update this view</Text>
          <p className="text-sm leading-6 text-kumo-subtle">Your last plan is still available. Retry the update or keep working from that plan.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <ActionButton variant="primary" onClick={onRetry}>
            <Lightning aria-hidden="true" size={14} weight="bold" /> Retry
          </ActionButton>
          <ActionButton onClick={onUseLastPlan}>Use last plan</ActionButton>
        </div>
      </div>
    </LayerCard>
  );
}

function GeneratedCanvas({
  state,
  scenario,
  onScenarioChange,
}: {
  state: DemoState;
  scenario: CatalogScenario;
  onScenarioChange: (scenario: CatalogScenario) => void;
}) {
  if (scenario === "workload") {
    return (
      <div className="grid gap-6">
        <DeadlineSnapshotBlock onReviewWork={() => state.goTo("Tasks")} />
        <ScheduleSnapshotBlock onShapePlan={() => onScenarioChange("plan")} />
        <TaskChecklistBlock completedTasks={state.completedTasks} onToggleTask={state.toggleTask} />
      </div>
    );
  }

  if (scenario === "focus") {
    return (
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <FocusSessionBlock state={state} />
        <ContextNotesBlock selectedNote={state.selectedNote} onSelectNote={state.selectNote} />
      </div>
    );
  }

  if (scenario === "clarify") {
    return (
      <DecisionPromptBlock
        onAnswer={(answer) => {
          state.announce(`${answer} selected`);
          onScenarioChange("plan");
        }}
      />
    );
  }

  if (scenario === "loading") {
    return (
      <GenerationStatusBlock
        onUseLastPlan={() => {
          state.announce("Last plan restored");
          onScenarioChange("plan");
        }}
      />
    );
  }

  if (scenario === "recovery") {
    return (
      <RecoveryBlock
        onRetry={() => {
          state.announce("Generation retried");
          onScenarioChange("loading");
        }}
        onUseLastPlan={() => {
          state.announce("Last plan restored");
          onScenarioChange("plan");
        }}
      />
    );
  }

  return (
    <div className="grid gap-6">
      <WorkPlanBlock state={state} />
      <PlanRationaleBlock />
    </div>
  );
}

function FeatureRouteContent({ state }: { state: DemoState }) {
  if (state.route === "Tasks") {
    return <TaskChecklistBlock completedTasks={state.completedTasks} onToggleTask={state.toggleTask} />;
  }

  if (state.route === "Timetable") {
    return <ScheduleSnapshotBlock onShapePlan={() => state.goTo("Canvas")} />;
  }

  if (state.route === "Deadlines") {
    return <DeadlineSnapshotBlock onReviewWork={() => state.goTo("Tasks")} />;
  }

  if (state.route === "Notes") {
    return <ContextNotesBlock selectedNote={state.selectedNote} onSelectNote={state.selectNote} />;
  }

  if (state.route === "Focus") {
    return <FocusSessionBlock state={state} />;
  }

  return null;
}

function Notice({ message }: { message: string }) {
  if (!message) return null;
  return (
    <div role="status" className="fixed right-5 bottom-24 z-40 flex items-center gap-2 rounded-lg bg-kumo-brand px-3 py-2 text-sm text-white shadow-lg">
      <CheckCircle aria-hidden="true" size={16} weight="bold" className="text-white/80" />
      {message}
    </div>
  );
}

type PrototypeLayoutProps = {
  state: DemoState;
  scenario: CatalogScenario;
  onScenarioChange: (scenario: CatalogScenario) => void;
};

function QuietRail({ state, scenario, onScenarioChange }: PrototypeLayoutProps) {
  return (
    <div className="min-h-screen bg-kumo-canvas text-kumo-default">
      <div className="mx-auto flex min-h-screen max-w-[1440px]">
        <aside className="hidden w-64 shrink-0 flex-col border-r border-kumo-line bg-kumo-canvas px-3 py-4 md:flex">
          <div className="flex h-12 items-center px-2">
            <img src="/brand/kairo-primary.svg" alt="Kairo" className="h-7 w-auto" />
          </div>
          <nav aria-label="Workspace routes" className="mt-5 grid gap-1">
            <p className="px-3 pb-1 text-xs font-medium text-kumo-subtle">Workspace</p>
            {routeItems.map((route) => (
              <RouteNavButton key={route.key} route={route} active={state.route === route.key} onSelect={() => state.goTo(route.key)} mode="rail" />
            ))}
          </nav>
          <div className="mt-auto rounded-lg bg-kumo-base px-3 py-3 shadow-xs ring ring-kumo-line">
            <div className="flex items-center justify-between gap-2 text-xs"><span className="font-medium text-kumo-default">Today</span><span className="text-kumo-subtle">8:00 AM</span></div>
            <p className="mt-2 flex items-center gap-2 text-sm font-medium text-kumo-default"><span className="size-1.5 rounded-full bg-kumo-success" /> AINN at 9:00 AM</p>
          </div>
        </aside>
        <main className="min-w-0 flex-1">
          <header className="border-b border-kumo-line bg-kumo-canvas px-6 py-5 lg:px-10">
            <div className="mx-auto flex max-w-5xl flex-wrap items-end justify-between gap-4">
              <RouteHeading route={state.route} scenario={scenario} />
              <p className="text-xs text-kumo-subtle">Monday 3 August 2026</p>
            </div>
          </header>
          <div className="mx-auto w-full max-w-5xl px-6 pt-7 pb-32 lg:px-10">
            {state.route === "Canvas" ? <GeneratedCanvas state={state} scenario={scenario} onScenarioChange={onScenarioChange} /> : <FeatureRouteContent state={state} />}
          </div>
        </main>
      </div>
      <Notice message={state.notice} />
    </div>
  );
}

function Workbench({ state, scenario, onScenarioChange }: PrototypeLayoutProps) {
  return (
    <div className="min-h-screen bg-kumo-canvas text-kumo-default">
      <div className="grid min-h-screen lg:grid-cols-[4.75rem_minmax(0,1fr)_18rem]">
        <aside className="flex border-b border-kumo-line bg-kumo-base px-2 py-3 lg:flex-col lg:border-r lg:border-b-0 lg:py-5">
          <div className="flex items-center justify-center pb-5"><img src="/brand/kairo-icon.svg" alt="Kairo" className="size-8" /></div>
          <nav aria-label="Workspace routes" className="flex flex-1 justify-center gap-1 lg:grid lg:content-start">
            {routeItems.map((route) => (
              <RouteNavButton key={route.key} route={route} active={state.route === route.key} onSelect={() => state.goTo(route.key)} mode="icon" />
            ))}
          </nav>
          <div className="hidden justify-center pt-5 lg:flex"><Lightning size={18} className="text-kumo-warning" /></div>
        </aside>
        <main className="min-w-0">
          <header className="flex flex-wrap items-end justify-between gap-4 border-b border-kumo-line px-6 py-5 lg:px-8">
            <RouteHeading route={state.route} scenario={scenario} />
            <div className="flex items-center gap-2 text-xs text-kumo-subtle"><span className="size-1.5 rounded-full bg-kumo-success" /> Context synced</div>
          </header>
          <div className="mx-auto max-w-5xl px-6 pt-7 pb-32 lg:px-8">
            {state.route === "Canvas" ? <GeneratedCanvas state={state} scenario={scenario} onScenarioChange={onScenarioChange} /> : <FeatureRouteContent state={state} />}
          </div>
        </main>
        <aside className="border-t border-kumo-line bg-kumo-base px-5 py-6 lg:border-t-0 lg:border-l">
          <div className="sticky top-6 grid gap-6">
            <div className="grid gap-1"><p className="text-xs font-medium text-kumo-subtle">Shared context</p><Text as="h2" variant="heading3">Why this view knows</Text></div>
            <div className="grid gap-3">
              <div className="grid gap-1"><span className="text-xs text-kumo-subtle">Student work</span><span className="text-sm font-medium text-kumo-default">{contextSummary.courses} · {contextSummary.openTasks}</span></div>
              <div className="grid gap-1"><span className="text-xs text-kumo-subtle">Attention signal</span><span className="text-sm font-medium text-kumo-warning">{contextSummary.overdue} · TOC Tutorial 3</span></div>
              <div className="grid gap-1"><span className="text-xs text-kumo-subtle">Next fixed event</span><span className="text-sm font-medium text-kumo-default">{contextSummary.next}</span></div>
            </div>
            <div className="grid gap-3 border-t border-kumo-line pt-5">
              <div className="flex items-center gap-2"><Sparkle aria-hidden="true" size={16} weight="bold" className="text-kumo-brand" /><span className="text-sm font-medium text-kumo-default">Generated catalog</span></div>
              <p className="text-sm leading-6 text-kumo-subtle">Nine bounded blocks cover academic context, real actions, rationale, and decisions. Loading and failure stay in the Canvas host.</p>
              <CatalogDefinition />
            </div>
          </div>
        </aside>
      </div>
      <Notice message={state.notice} />
    </div>
  );
}

function CommandDeck({ state, scenario, onScenarioChange }: PrototypeLayoutProps) {
  return (
    <div className="min-h-screen bg-kumo-canvas text-kumo-default">
      <header className="sticky top-0 z-10 border-b border-kumo-line bg-kumo-base">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-4 px-6 py-3 lg:px-8">
          <div className="flex items-center gap-2 pr-2"><img src="/brand/kairo-icon.svg" alt="Kairo" className="size-7" /><span className="text-sm font-semibold text-kumo-strong">Kairo</span></div>
          <nav aria-label="Workspace routes" className="flex min-w-0 flex-1 flex-wrap gap-1">
            {routeItems.map((route) => (
              <RouteNavButton key={route.key} route={route} active={state.route === route.key} onSelect={() => state.goTo(route.key)} mode="top" />
            ))}
          </nav>
          <div className="hidden items-center gap-2 text-xs text-kumo-subtle xl:flex"><span className="size-1.5 rounded-full bg-kumo-success" /> Monday · 8:00 AM</div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-6 pt-7 pb-32 lg:px-8">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <RouteHeading route={state.route} scenario={scenario} />
          <div className="flex items-center gap-2 rounded-full bg-kumo-base px-3 py-1.5 text-xs text-kumo-subtle ring ring-kumo-line"><Target size={14} /> 3 focus blocks today</div>
        </div>
        {state.route === "Canvas" ? <GeneratedCanvas state={state} scenario={scenario} onScenarioChange={onScenarioChange} /> : <FeatureRouteContent state={state} />}
      </main>
      <Notice message={state.notice} />
    </div>
  );
}

const variants = [
  { name: "Quiet Rail", axis: "Persistent labeled navigation", render: QuietRail },
  { name: "Workbench", axis: "Route rail with context inspector", render: Workbench },
  { name: "Command Deck", axis: "Top navigation with a wider board", render: CommandDeck },
] as const;

export function CatalogPrototype() {
  const [current, setCurrent] = useState(0);
  const [scenario, setScenario] = useState<CatalogScenario>("plan");
  const [replay, setReplay] = useState(0);
  const [ready, setReady] = useState(false);
  const state = useDemoState();
  const pickerRef = useRef<HTMLElement | null>(null);
  const highlightRef = useRef<HTMLSpanElement | null>(null);
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const moveHighlight = () => {
    const picker = pickerRef.current;
    const highlight = highlightRef.current;
    const item = itemRefs.current[current];
    if (!picker || !highlight || !item) return;
    highlight.style.width = `${item.offsetWidth}px`;
    highlight.style.transform = `translateX(${item.offsetLeft}px)`;
  };

  const setVariant = (index: number) => {
    if (index < 0 || index >= variants.length) return;
    setCurrent(index);
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.set("v", String(index + 1));
      window.history.replaceState(null, "", url);
    }
  };

  const setCatalogScenario = (nextScenario: CatalogScenario) => {
    state.goTo("Canvas");
    setScenario(nextScenario);
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.set("scenario", nextScenario);
      window.history.replaceState(null, "", url);
    }
  };

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const stored = Number.parseInt(params.get("v") ?? "1", 10);
    const storedScenario = params.get("scenario");
    if (stored >= 1 && stored <= variants.length) setCurrent(stored - 1);
    if (catalogScenarios.some((candidate) => candidate.key === storedScenario)) {
      setScenario(storedScenario as CatalogScenario);
    }
  }, []);

  useEffect(() => {
    moveHighlight();
    const first = window.requestAnimationFrame(() => {
      const second = window.requestAnimationFrame(() => setReady(true));
      return () => window.cancelAnimationFrame(second);
    });
    return () => window.cancelAnimationFrame(first);
  }, [current]);

  useEffect(() => {
    const onResize = () => moveHighlight();
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && (/^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName) || target.isContentEditable)) return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const number = Number.parseInt(event.key, 10);
      if (number >= 1 && number <= variants.length) setVariant(number - 1);
      else if (event.key === "ArrowRight") setVariant((current + 1) % variants.length);
      else if (event.key === "ArrowLeft") setVariant((current - 1 + variants.length) % variants.length);
      else if (event.key === "r" || event.key === "R") setReplay((value) => value + 1);
    };
    window.addEventListener("resize", onResize);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("resize", onResize);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [current]);

  const Variant = variants[current].render;

  return (
    <>
      <div key={`${current}-${replay}`} className="catalog-view-enter">
        <Variant state={state} scenario={scenario} onScenarioChange={setCatalogScenario} />
      </div>
      <nav ref={pickerRef} className="proto-picker" aria-label="Catalog prototype controls" data-ready={ready ? "" : undefined}>
        <span ref={highlightRef} className="proto-picker-highlight" aria-hidden="true" />
        {variants.map((variant, index) => (
          <button
            key={variant.name}
            ref={(element) => { itemRefs.current[index] = element; }}
            type="button"
            className="proto-picker-item"
            data-active={current === index ? "" : undefined}
            aria-current={current === index ? "true" : undefined}
            onClick={() => setVariant(index)}
            title={`${variant.name} · ${variant.axis}`}
          >
            {variant.name}
          </button>
        ))}
        <span className="proto-picker-divider" aria-hidden="true" />
        {catalogScenarios.map((candidate) => (
          <button
            key={candidate.key}
            type="button"
            className="proto-picker-item"
            data-scenario-active={scenario === candidate.key ? "" : undefined}
            aria-pressed={scenario === candidate.key}
            onClick={() => setCatalogScenario(candidate.key)}
          >
            {candidate.label}
          </button>
        ))}
        <span className="proto-picker-divider" aria-hidden="true" />
        <button type="button" className="proto-picker-item proto-picker-replay" aria-label="Replay animation (R)" onClick={() => setReplay((value) => value + 1)}>↻</button>
      </nav>
      <style dangerouslySetInnerHTML={{ __html: pickerStyles }} />
    </>
  );
}
