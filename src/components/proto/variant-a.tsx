import { Text } from "@cloudflare/kumo/components/text";

import {
  CurrentFocusBlock,
  DockedPromptBar,
  NextStepsBlock,
  PromptBar,
  SuggestionChips,
  type TodayRoute,
  ViewHeader,
} from "./atoms";
import { demoPrompt, planItems } from "./canvas-data";

type CanvasAProps = {
  inSidebarShell?: boolean;
  todayRoute?: TodayRoute;
};

export function QuietA({ todayRoute = "/proto/a/today" }: CanvasAProps) {
  return (
    <main className="bg-kumo-canvas">
      <div className="mx-auto flex min-h-screen w-full max-w-3xl flex-col items-center justify-center gap-8 px-6 pt-0 pb-20 text-center">
        <div className="mt-12">
          <Text as="h1" variant="heading1">
            What do you want to work on?
          </Text>
        </div>
        <div className="w-full">
          <PromptBar submitTo={todayRoute} />
        </div>
        <SuggestionChips to={todayRoute} />
      </div>
    </main>
  );
}

export function TodayA({
  inSidebarShell = false,
  todayRoute = "/proto/a/today",
}: CanvasAProps) {
  const [now, next, later] = planItems;
  return (
    <main className="bg-kumo-canvas">
      <div className="mx-auto flex min-h-screen w-full max-w-2xl flex-col gap-8 px-6 pt-12 pb-44">
        <ViewHeader />
        <div className="grid gap-6">
          <CurrentFocusBlock item={now} />
          <NextStepsBlock items={[next, later]} />
        </div>
      </div>
      <DockedPromptBar
        defaultValue={demoPrompt}
        inSidebarShell={inSidebarShell}
        submitTo={todayRoute}
      />
    </main>
  );
}
