import { createFileRoute } from "@tanstack/react-router";

import { QuietA } from "../../components/proto/variant-a";

export const Route = createFileRoute("/canvas/")({
  head: () => ({
    meta: [{ title: "Canvas · Kairo" }],
  }),
  component: CanvasRoute,
});

function CanvasRoute() {
  return <QuietA todayRoute="/canvas/today" />;
}
