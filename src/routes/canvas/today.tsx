import { createFileRoute } from "@tanstack/react-router";

import { TodayA } from "../../components/proto/variant-a";

export const Route = createFileRoute("/canvas/today")({
  head: () => ({
    meta: [{ title: "Today's plan · Kairo" }],
  }),
  component: CanvasTodayRoute,
});

function CanvasTodayRoute() {
  return <TodayA inSidebarShell todayRoute="/canvas/today" />;
}
