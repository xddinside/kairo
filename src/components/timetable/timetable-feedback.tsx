import { Button } from "@cloudflare/kumo/components/button";
import { LayerCard } from "@cloudflare/kumo/components/layer-card";
import { Text } from "@cloudflare/kumo/components/text";
import { ArrowUUpLeft, WarningCircle, X } from "@phosphor-icons/react";

import { TimetableShell } from "./timetable-shell";

/** Undo-capable status toast shown after a Timetable command settles. */
export function TimetableToast({
  message,
  undoToken,
  pending,
  onUndo,
  onDismiss,
}: {
  readonly message: string;
  readonly undoToken?: string;
  readonly pending?: boolean;
  readonly onUndo: () => void;
  readonly onDismiss: () => void;
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="lfc-rise fixed inset-x-4 bottom-4 z-50 flex items-center gap-2.5 rounded-xl bg-kumo-strong py-2.5 ps-4 pe-2 text-base text-kumo-inverse shadow-lg ring ring-white/10 sm:inset-x-auto sm:end-6 sm:bottom-6 sm:max-w-sm"
    >
      <span className="min-w-0 flex-1 text-pretty">{message}</span>
      {undoToken ? (
        <>
          <span aria-hidden="true" className="h-4 w-px shrink-0 bg-white/20" />
          <button
            type="button"
            disabled={pending}
            onClick={onUndo}
            className="flex shrink-0 items-center gap-1.5 rounded-lg px-2 py-1.5 font-medium transition-transform duration-150 ease-out hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/60 active:scale-[0.96] disabled:opacity-60"
          >
            <ArrowUUpLeft aria-hidden="true" size={15} weight="bold" />
            Undo
          </button>
        </>
      ) : null}
      <button
        type="button"
        aria-label="Dismiss notification"
        onClick={onDismiss}
        className="flex size-8 shrink-0 items-center justify-center rounded-lg text-white/70 transition-transform duration-150 ease-out hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/60 active:scale-[0.96]"
      >
        <X aria-hidden="true" size={15} weight="bold" />
      </button>
    </div>
  );
}

/** First-load recovery state for Timetable routes. */
export function TimetableError({ title, reset }: { readonly title: string; readonly reset: () => void }) {
  return (
    <TimetableShell>
      <main className="mx-auto w-full max-w-3xl px-4 py-16 sm:px-6 lg:px-10">
        <div className="flex flex-col items-center text-center">
          <span className="flex size-12 items-center justify-center rounded-xl bg-kumo-danger-tint text-kumo-danger ring ring-kumo-line">
            <WarningCircle aria-hidden="true" size={23} />
          </span>
          <div className="mt-5">
            <Text as="h1" variant="heading2">
              {title}
            </Text>
          </div>
          <Button
            className="mt-6 shadow-sm transition-transform duration-150 ease-out active:scale-[0.96]"
            onClick={reset}
          >
            Retry
          </Button>
        </div>
      </main>
    </TimetableShell>
  );
}

/** Final-shape loading placeholder that mirrors the Timetable agenda layout. */
export function TimetableLoading({ title }: { readonly title: string }) {
  return (
    <TimetableShell>
      <main
        aria-busy="true"
        aria-label={`Loading ${title}`}
        className="mx-auto w-full max-w-5xl px-4 py-8 pb-24 sm:px-6 md:py-12 lg:px-10"
      >
        <div className="flex items-center gap-3.5">
          <span className="size-11 shrink-0 animate-pulse rounded-xl bg-kumo-tint motion-reduce:animate-none" />
          <div className="grid gap-2">
            <span className="block h-7 w-40 animate-pulse rounded-md bg-kumo-tint motion-reduce:animate-none" />
            <span className="block h-4 w-56 animate-pulse rounded-md bg-kumo-tint motion-reduce:animate-none" />
          </div>
        </div>

        <LayerCard className="mt-8">
          <div className="flex items-center justify-between gap-3 px-3 py-3">
            <span className="block h-11 w-40 animate-pulse rounded-xl bg-kumo-tint motion-reduce:animate-none" />
            <span className="block h-4 w-36 animate-pulse rounded-md bg-kumo-tint motion-reduce:animate-none" />
          </div>
          <div className="grid grid-cols-7 gap-1 border-t border-kumo-line p-1">
            {[0, 1, 2, 3, 4, 5, 6].map((day) => (
              <span key={day} className="block h-16 animate-pulse rounded-sm bg-kumo-tint motion-reduce:animate-none" />
            ))}
          </div>
        </LayerCard>

        <div className="mt-8 grid gap-8">
          {[0, 1].map((group) => (
            <div key={group}>
              <span className="mb-2.5 block h-5 w-44 animate-pulse rounded-md bg-kumo-tint motion-reduce:animate-none" />
              <LayerCard>
                <div className="divide-y divide-kumo-line">
                  {[0, 1, 2].map((row) => (
                    <div key={row} className="flex items-center gap-4 px-4 py-4 sm:px-5">
                      <span className="block h-9 w-13 shrink-0 animate-pulse rounded-md bg-kumo-tint motion-reduce:animate-none" />
                      <span className="block h-9 flex-1 animate-pulse rounded-md bg-kumo-tint motion-reduce:animate-none" />
                    </div>
                  ))}
                </div>
              </LayerCard>
            </div>
          ))}
        </div>
      </main>
    </TimetableShell>
  );
}
