import { createFileRoute } from "@tanstack/react-router";

import { CanvasHome } from "../../components/canvas/canvas-home";

export const Route = createFileRoute("/canvas/")({
  head: () => ({
    meta: [{ title: "Canvas · Kairo" }],
  }),
  component: CanvasRoute,
});

function CanvasRoute() {
  return <CanvasHome />;
}
