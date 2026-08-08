import { Badge } from "@cloudflare/kumo/components/badge";
import { Button } from "@cloudflare/kumo/components/button";
import { LayerCard } from "@cloudflare/kumo/components/layer-card";
import { Text } from "@cloudflare/kumo/components/text";
import { useKumoToastManager } from "@cloudflare/kumo/components/toast";
import {
  ArrowRight,
  Clock,
  FileText,
  Note,
  Pause,
  Play,
  Sparkle,
} from "@phosphor-icons/react";

import {
  contextSummary,
  planItems,
  type PlanItem,
} from "../canvas-data";
import {
  formatClock,
  formatDuration,
  useFocus,
  type FocusSession,
} from "./focus-store";

const planFiles = [
  { title: "AINN — Backpropagation worked examples", id: "ainn-backprop" },
  { title: "TOC — Pumping lemma checklist", id: "toc-pumping" },
] as const;

function CanvasFocusBlock({
  item,
  onOpenNote,
}: {
  item: PlanItem;
  onOpenNote: () => void;
}) {
  const { session, remainingMs, togglePause, startSession, prefs, setOpenFile } =
    useFocus();

  const active: FocusSession | null = session ?? null;
  const paused = active?.status === "paused";
  const time = active ? (remainingMs ?? 0) : 0;

  const start = () => {
    startSession({
      kind: "task",
      title: item.title,
      course: item.course,
      note: item.note ?? null,
      fileId: "ainn-backprop",
      windowMs: prefs.workMin * 60000,
      origin: "canvas",
      startedAt: Date.now(),
    });
  };

  return (
    <LayerCard className="px-5 py-5">
      <div className="grid gap-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="flex items-center gap-2 text-sm font-medium text-kumo-default">
            <span
              aria-hidden
              className={`size-1.5 rounded-full ${
                paused ? "bg-kumo-warning" : active ? "bg-kumo-brand" : "bg-kumo-success"
              }`}
            />
            {active ? (paused ? "Paused" : "Focus running") : `Now · ${item.window}`}
          </span>
          {active ? (
            <span className="text-sm text-kumo-subtle tabular-nums">
              {formatClock(time)}
            </span>
          ) : null}
        </div>
        <div className="grid gap-1.5">
          <Text as="h2" variant="heading3">
            {item.title}
          </Text>
          <p className="text-sm text-kumo-subtle">
            {item.course} · {formatDuration(prefs.workMin * 60000)} · {item.context}
          </p>
        </div>
        <p className="max-w-2xl text-sm leading-6 text-kumo-subtle">{item.reason}</p>
        <div className="flex flex-wrap items-center gap-2">
          {active ? (
            <>
              <Button
                variant="primary"
                className="min-w-28 justify-center text-sm transition-transform duration-150 ease-out active:scale-[0.96]"
                onClick={togglePause}
              >
                {paused ? (
                  <Play aria-hidden size={14} weight="bold" className="translate-x-px" />
                ) : (
                  <Pause aria-hidden size={14} weight="bold" />
                )}
                {paused ? "Resume" : "Pause"}
              </Button>
              <Button
                variant="ghost"
                aria-label={`Open file: ${planFiles[0].title}`}
                className="text-sm transition-transform duration-150 ease-out active:scale-[0.96]"
                onClick={() => setOpenFile(planFiles[0].id)}
              >
                <FileText aria-hidden size={14} weight="bold" />
                Open file
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="primary"
                className="min-w-28 justify-center text-sm transition-transform duration-150 ease-out active:scale-[0.96]"
                onClick={start}
              >
                <Play aria-hidden size={14} weight="bold" className="translate-x-px" />
                Start focus
              </Button>
              {item.note ? (
                <Button
                  variant="ghost"
                  className="text-sm transition-transform duration-150 ease-out active:scale-[0.96]"
                  onClick={onOpenNote}
                >
                  <Note aria-hidden size={14} weight="bold" /> Open note
                </Button>
              ) : null}
            </>
          )}
        </div>
      </div>
    </LayerCard>
  );
}

export function CanvasSurface({ onOpenFocus }: { onOpenFocus: () => void }) {
  const toast = useKumoToastManager();
  const { startSession, prefs } = useFocus();
  const [currentFocus, ...nextSteps] = planItems;

  return (
    <main className="bg-kumo-canvas">
      <div className="mx-auto w-full max-w-4xl px-4 py-8 pb-24 sm:px-6 md:py-10">
        <header className="mb-6 grid gap-1.5">
          <Text as="h1" variant="heading2">
            Canvas
          </Text>
          <p className="text-sm text-kumo-subtle">
            {contextSummary.courses} · {contextSummary.openTasks} ·{" "}
            <span className="font-medium text-kumo-warning">
              {contextSummary.overdue}
            </span>{" "}
            · {contextSummary.next}
          </p>
        </header>

        <div className="grid gap-6">
          <CanvasFocusBlock
            item={currentFocus}
            onOpenNote={() => {
              toast.add({
                title: "Note opened",
                description: currentFocus.note,
                timeout: 2500,
              });
            }}
          />

          <section className="grid gap-3" aria-labelledby="canvas-next-steps">
            <div className="flex items-end justify-between gap-3">
              <Text as="h2" variant="heading3" id="canvas-next-steps">
                Next steps
              </Text>
              <button
                type="button"
                className="flex min-h-8 items-center gap-1 text-sm font-medium text-kumo-default transition-transform duration-150 ease-out hover:text-kumo-strong active:scale-[0.96]"
              >
                All tasks <ArrowRight aria-hidden size={14} weight="bold" />
              </button>
            </div>
            <LayerCard>
              <ol className="divide-y divide-kumo-line">
                {nextSteps.map((item) => (
                  <li key={item.title} className="grid gap-2 px-5 py-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2 text-sm font-medium text-kumo-default">
                        <Clock aria-hidden size={15} weight="bold" /> {item.window}
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
                    <Button
                      variant="ghost"
                      className="w-fit justify-center text-sm transition-transform duration-150 ease-out active:scale-[0.96]"
                      onClick={() =>
                        startSession({
                          kind: "task",
                          title: item.title,
                          course: item.course,
                          note: item.note ?? null,
                          fileId: item.title.includes("Tutorial") ? "toc-pumping" : null,
                          windowMs: prefs.workMin * 60000,
                          origin: "canvas",
                          startedAt: Date.now(),
                        })
                      }
                    >
                      <Play aria-hidden size={14} weight="bold" className="translate-x-px" />
                      Focus
                    </Button>
                  </li>
                ))}
              </ol>
            </LayerCard>
          </section>

          <p className="flex items-center gap-1.5 text-sm text-kumo-subtle">
            <Sparkle aria-hidden size={14} weight="fill" className="text-kumo-brand" />
            Generated from your shared academic data
          </p>

          <button
            type="button"
            onClick={onOpenFocus}
            className="flex min-h-8 w-fit items-center gap-1 text-sm font-medium text-kumo-default transition-transform duration-150 ease-out hover:text-kumo-strong active:scale-[0.96]"
          >
            Open Focus route <ArrowRight aria-hidden size={14} weight="bold" />
          </button>
        </div>
      </div>
    </main>
  );
}
