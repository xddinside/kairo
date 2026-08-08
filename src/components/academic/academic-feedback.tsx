import { Button } from "@cloudflare/kumo/components/button";
import { LayerCard } from "@cloudflare/kumo/components/layer-card";
import { WarningCircle } from "@phosphor-icons/react";

import { AcademicShell } from "./academic-shell";

/** Undo-capable status toast for academic commands. */
export function AcademicToast({ message, undoToken, pending, onUndo }: { readonly message: string; readonly undoToken?: string; readonly pending?: boolean; readonly onUndo: () => void }) {
  return <div role="status" aria-live="polite" className="fixed right-4 bottom-4 z-50 flex max-w-sm items-center gap-3 rounded-lg bg-kumo-strong px-4 py-3 text-sm text-kumo-inverse shadow-lg"><span>{message}</span>{undoToken ? <button type="button" disabled={pending} onClick={onUndo} className="min-h-11 font-medium underline underline-offset-4 transition-transform duration-150 ease-out active:scale-[0.96]">Undo</button> : null}</div>;
}

/** First-load recovery state for academic routes. */
export function AcademicError({ title, reset }: { readonly title: string; readonly reset: () => void }) {
  return <AcademicShell><main className="mx-auto max-w-3xl px-4 py-12"><WarningCircle aria-hidden="true" size={28} className="text-kumo-danger" /><h1 className="mt-3 text-2xl font-semibold">{title}</h1><Button className="mt-5 min-h-11 transition-transform duration-150 ease-out active:scale-[0.96]" onClick={reset}>Retry</Button></main></AcademicShell>;
}

/** Final-shape loading rows for academic routes. */
export function AcademicLoading({ title }: { readonly title: string }) {
  return <AcademicShell><main className="mx-auto max-w-5xl px-4 py-8"><h1 className="text-2xl font-semibold">{title}</h1><div aria-label={`Loading ${title}`} className="mt-8 grid gap-3">{[0, 1, 2].map((value) => <LayerCard key={value} className="h-24 animate-pulse bg-kumo-tint motion-reduce:animate-none" />)}</div></main></AcademicShell>;
}
