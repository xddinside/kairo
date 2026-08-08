import { Badge } from "@cloudflare/kumo/components/badge";
import { Button } from "@cloudflare/kumo/components/button";
import { Dialog } from "@cloudflare/kumo/components/dialog";
import { Text } from "@cloudflare/kumo/components/text";
import {
  ArrowRight,
  CalendarCheck,
  CalendarDots,
  Check,
  FilePdf,
  FrameCorners,
  ListChecks,
  NoteBlank,
  Play,
  Timer,
  X,
} from "@phosphor-icons/react";
import { useEffect, useState, type ReactNode } from "react";

import { planItems } from "../canvas-data";

function CanvasPageVisual() {
  const now = planItems[0];
  const next = planItems[1];
  const later = planItems[2];

  return (
    <div className="grid h-full min-w-0 grid-cols-[minmax(0,1fr)] overflow-hidden content-start gap-2.5 rounded-xl bg-kumo-canvas p-4 ring ring-kumo-line">
      <div className="flex min-w-0 items-center justify-between gap-3 rounded-full bg-kumo-base py-1.5 pr-1.5 pl-4 shadow-xs ring ring-kumo-line">
        <span className="min-w-0 truncate text-sm text-kumo-subtle">
          Shape my day around my readings
        </span>
        <span className="shrink-0 rounded-full bg-kumo-brand px-3 py-1 text-sm font-medium !text-white">
          Generate
        </span>
      </div>

      <div className="grid gap-2 rounded-xl bg-kumo-base p-4 shadow-xs ring ring-kumo-line">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="success">Now</Badge>
          <span className="text-sm font-medium text-kumo-default tabular-nums">
            {now.window}
          </span>
        </div>
        <div className="grid gap-0.5">
          <p className="text-base leading-5 font-semibold text-kumo-strong">
            {now.title}
          </p>
          <p className="text-sm text-kumo-subtle">
            {now.course} · {now.duration}
          </p>
        </div>
        <p className="text-sm leading-5 text-pretty text-kumo-subtle">
          {now.reason}
        </p>
        <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-kumo-brand px-3 py-1 text-sm font-medium !text-white">
          <Play size={12} weight="bold" className="translate-x-px" />
          Start focus
        </span>
      </div>

      <div className="flex items-center gap-3 rounded-xl bg-kumo-base px-4 py-2.5 shadow-xs ring ring-kumo-line">
        <Badge variant="info">{next.timing}</Badge>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-kumo-default">
            {next.title}
          </p>
          <p className="truncate text-xs text-kumo-subtle">
            {next.course} · {next.window}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3 rounded-xl bg-kumo-base px-4 py-2.5 shadow-xs ring ring-kumo-line">
        <Badge>{later.timing}</Badge>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-kumo-default">
            {later.title}
          </p>
          <p className="truncate text-xs text-kumo-subtle">
            {later.course} · {later.window}
          </p>
        </div>
      </div>
    </div>
  );
}

const workSections = [
  { icon: ListChecks, label: "Tasks" },
  { icon: CalendarDots, label: "Timetable" },
  { icon: CalendarCheck, label: "Deadlines" },
  { icon: NoteBlank, label: "Notes" },
  { icon: Timer, label: "Focus" },
] as const;

const taskRows = [
  { title: "Review backpropagation examples", due: "Today 8:00 AM", done: false },
  { title: "Finish TOC Tutorial 3", due: "Overdue", done: false },
  { title: "Read Kant ch. 2", due: "Friday", done: true },
  { title: "Draft SE checkpoint notes", due: "Tomorrow", done: false },
  { title: "Send tutor email", due: "Mon", done: false },
] as const;

function WorkPageVisual() {
  return (
    <div className="grid h-full min-w-0 overflow-hidden gap-3 rounded-xl bg-kumo-canvas p-4 ring ring-kumo-line @sm:grid-cols-[7rem_minmax(0,1fr)]">
      <div className="grid content-start gap-0.5">
        <div className="flex items-center gap-2 rounded-lg bg-kumo-base px-2.5 py-1.5 shadow-xs ring ring-kumo-line">
          <FrameCorners size={14} weight="regular" className="text-kumo-brand" />
          <span className="text-sm font-medium text-kumo-default">Canvas</span>
        </div>
        {workSections.map((section) => {
          const Icon = section.icon;
          return (
            <div
              key={section.label}
              className="flex items-center gap-2 px-2.5 py-1.5 text-sm text-kumo-subtle"
            >
              <Icon size={14} weight="regular" />
              {section.label}
            </div>
          );
        })}
      </div>

      <div className="grid min-w-0 content-start gap-1 rounded-xl bg-kumo-base p-3 shadow-xs ring ring-kumo-line">
        <p className="px-1 text-sm font-semibold text-kumo-strong">Tasks</p>
        {taskRows.map((task) => (
          <div
            key={task.title}
            className="flex min-w-0 items-center gap-2.5 rounded-lg px-1.5 py-1.5"
          >
            <span
              aria-hidden
              className={`grid size-4 shrink-0 place-items-center rounded-full ring-1 ${
                task.done
                  ? "bg-kumo-success ring-kumo-success"
                  : "ring-kumo-line"
              }`}
            >
              {task.done ? (
                <Check size={10} weight="bold" className="!text-white" />
              ) : null}
            </span>
            <span
              className={`min-w-0 flex-1 truncate text-sm ${
                task.done
                  ? "text-kumo-subtle line-through"
                  : "text-kumo-default"
              }`}
            >
              {task.title}
            </span>
            <span
              className={`shrink-0 whitespace-nowrap text-xs tabular-nums ${
                task.due === "Overdue" ? "text-kumo-warning" : "text-kumo-subtle"
              }`}
            >
              {task.due}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function FocusPageVisual() {
  return (
    <div className="grid h-full min-w-0 overflow-hidden content-center gap-5 rounded-xl bg-kumo-canvas p-4 ring ring-kumo-line @sm:grid-cols-[auto_minmax(0,1fr)] @sm:items-center @sm:gap-6">
      <div className="grid place-items-center gap-1.5">
        <span className="grid size-24 place-items-center rounded-full bg-kumo-base shadow-xs ring-8 ring-kumo-brand/15">
          <Timer size={26} weight="regular" className="text-kumo-brand" />
        </span>
        <span className="text-xl font-semibold text-kumo-strong tabular-nums">
          25:00
        </span>
        <span className="text-xs text-kumo-subtle">Focus session</span>
      </div>

      <div className="grid content-start gap-2">
        <div className="flex items-center gap-2.5 rounded-lg bg-kumo-base px-3 py-2 shadow-xs ring ring-kumo-line">
          <span className="grid size-6 shrink-0 place-items-center rounded-md bg-kumo-fill text-kumo-danger">
            <FilePdf size={14} weight="regular" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-kumo-default">
              Physics reader.pdf
            </p>
            <p className="truncate text-xs text-kumo-subtle">
              12 pages · added Tuesday
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2.5 rounded-lg bg-kumo-base px-3 py-2 shadow-xs ring ring-kumo-line">
          <span className="grid size-6 shrink-0 place-items-center rounded-md bg-kumo-fill text-kumo-info">
            <NoteBlank size={14} weight="regular" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-kumo-default">
              Lecture notes
            </p>
            <p className="truncate text-xs text-kumo-subtle">
              Markdown · AI & Neural Networks
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2.5 rounded-lg bg-kumo-base px-3 py-2 shadow-xs ring ring-kumo-line">
          <span className="grid size-6 shrink-0 place-items-center rounded-md bg-kumo-fill text-kumo-warning">
            <FilePdf size={14} weight="regular" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-kumo-default">
              Tutorial 3.pdf
            </p>
            <p className="truncate text-xs text-kumo-subtle">
              4 pages · Theory of Computation
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

const pages: Array<{
  visual: ReactNode;
  heading: string;
  copy: string;
}> = [
  {
    visual: <CanvasPageVisual />,
    heading: "Tell Kairo what you're working on",
    copy: "One prompt shapes your day into a plan you can act on.",
  },
  {
    visual: <WorkPageVisual />,
    heading: "All of your work in one place",
    copy: "Tasks, timetable, deadlines, and notes, reshaped around what matters now.",
  },
  {
    visual: <FocusPageVisual />,
    heading: "Focus and your documents",
    copy: "Start a focus session, upload notes and PDFs, and let Kairo use them.",
  },
];

function stagger(delay: number) {
  return {
    animationDelay: `${delay}ms`,
  };
}

export function IntroModal({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [page, setPage] = useState(0);
  const current = pages[page];
  const isLast = page === pages.length - 1;

  useEffect(() => {
    if (!open) setPage(0);
  }, [open]);

  const advance = () => {
    if (isLast) {
      onOpenChange(false);
    } else {
      setPage(page + 1);
    }
  };

  const stepBack = () => {
    if (page > 0) setPage(page - 1);
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog
        size="xl"
        className="w-[calc(100vw-2rem)] max-h-[calc(100svh-2rem)] overflow-hidden p-0 @container sm:max-w-[58rem]"
      >
        <div className="flex items-center justify-between border-b border-kumo-line px-6 py-4">
          <span className="text-sm text-kumo-subtle">Introduction</span>
          <Dialog.Close
            render={(props) => (
              <Button
                {...props}
                variant="ghost"
                shape="square"
                size="sm"
                aria-label="Skip introduction"
                className="-mr-2 transition-transform duration-150 ease-out active:scale-[0.96]"
              >
                <X size={16} />
              </Button>
            )}
          />
        </div>

        <div className="grid min-h-0 gap-8 overflow-y-auto px-6 pt-6 pb-6 @2xl:grid-cols-[minmax(0,1.55fr)_minmax(17rem,1fr)] @2xl:items-center @2xl:gap-10">
          <div
            aria-hidden="true"
            key={page}
            className="lfc-rise flex h-[24rem] min-w-0 items-stretch"
            style={stagger(0)}
          >
            <div className="flex min-w-0 w-full">{current.visual}</div>
          </div>
          <div aria-live="polite" className="self-center">
            <div
              key={page}
              className="lfc-rise grid gap-3 text-balance"
            >
              <Text as="h2" variant="heading2">
                {current.heading}
              </Text>
              <div className="text-pretty">
                <Text variant="secondary" size="lg">
                  {current.copy}
                </Text>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4 px-6 pb-4 pt-2">
          <Button
            variant="ghost"
            className="text-sm transition-transform duration-150 ease-out active:scale-[0.96] disabled:opacity-40"
            onClick={stepBack}
            disabled={page === 0}
          >
            Back
          </Button>
          <nav aria-label="Introduction pages" className="flex items-center gap-2">
            {pages.map((item, index) => {
              const selected = index === page;
              return (
                <button
                  key={index}
                  type="button"
                  aria-label={`Go to page ${index + 1}: ${item.heading}`}
                  aria-current={selected ? "step" : undefined}
                  onClick={() => setPage(index)}
                  className={`text-xs tabular-nums focus:outline-none focus-visible:ring-2 focus-visible:ring-kumo-brand focus-visible:ring-offset-2 focus-visible:ring-offset-kumo-base ${
                    selected
                      ? "font-semibold text-kumo-strong"
                      : "text-kumo-subtle hover:text-kumo-default"
                  }`}
                >
                  {index + 1}
                </button>
              );
            })}
          </nav>
          <Button
            variant="primary"
            className="justify-self-end text-sm transition-transform duration-150 ease-out active:scale-[0.96]"
            onClick={advance}
          >
            {isLast ? "Start in Kairo" : "Next"}
            <ArrowRight
              size={14}
              weight="bold"
              className="transition-transform duration-150 ease-out group-hover:translate-x-0.5 motion-reduce:translate-x-0 motion-reduce:transition-none"
            />
          </Button>
        </div>

        <Dialog.Title className="sr-only">Introduction</Dialog.Title>
      </Dialog>
    </Dialog.Root>
  );
}
