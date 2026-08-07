import { createFileRoute } from "@tanstack/react-router";

import { ProtoSwitcher } from "../../../components/proto/atoms";
import { TodayA } from "../../../components/proto/variant-a";

export const Route = createFileRoute("/proto/a/today")({
  head: () => ({
    meta: [{ title: "Today's plan · Kairo" }],
  }),
  component: ProtoATodayRoute,
});

function ProtoATodayRoute() {
  return (
    <>
      <TodayA />
      <ProtoSwitcher />
    </>
  );
}
