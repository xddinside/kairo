import { Button } from "@cloudflare/kumo/components/button";
import { WarningCircle } from "@phosphor-icons/react";
import { createFileRoute, notFound } from "@tanstack/react-router";

import { SavedCanvas } from "../components/canvas/saved-canvas";
import { getCanvas } from "../server/canvas/functions";

export const Route = createFileRoute("/canvas/$canvasId")({
  loader: async ({ params }) => {
    const detail = await getCanvas({ data: { canvasId: params.canvasId } });
    if (!detail) throw notFound();
    return detail;
  },
  head: ({ loaderData }) => ({
    meta: [{ title: `${loaderData?.canvas.title ?? "Canvas"} · Kairo` }],
  }),
  pendingComponent: CanvasLoading,
  errorComponent: CanvasError,
  component: SavedCanvasRoute,
});

function SavedCanvasRoute() {
  return <SavedCanvas detail={Route.useLoaderData()} />;
}

function CanvasLoading() {
  return <main className="min-h-screen bg-kumo-canvas px-6 py-10"><div aria-label="Loading canvas" className="mx-auto h-40 max-w-3xl animate-pulse rounded-xl bg-kumo-tint motion-reduce:animate-none" /></main>;
}

function CanvasError({ reset }: { readonly reset: () => void }) {
  return <main className="min-h-screen bg-kumo-canvas px-6 py-16 text-center"><WarningCircle aria-hidden="true" size={28} className="mx-auto text-kumo-danger" /><h1 className="mt-3 text-xl font-semibold">Canvas unavailable</h1><Button className="mt-5" onClick={reset}>Retry</Button></main>;
}
