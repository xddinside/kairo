import { Text } from '@cloudflare/kumo/components/text'

import {
  ClassesCard,
  ContextLine,
  NotesCard,
  PlanItemCard,
  PromptBox,
  SuggestionChips,
  ViewHeader,
} from './atoms'
import { demoPrompt, planItems } from './canvas-data'

function CommandBar({ value }: { value?: string }) {
  return (
    <header className="sticky top-0 z-10 border-b border-kumo-line bg-kumo-base">
      <div className="mx-auto flex max-w-6xl items-center gap-4 px-6 py-3">
        <Text as="span" variant="heading3" DANGEROUS_className="whitespace-nowrap">
          Canvas
        </Text>
        <PromptBox defaultValue={value} submitTo="/proto/c/today" />
      </div>
    </header>
  )
}

export function QuietC() {
  return (
    <main className="min-h-screen bg-kumo-canvas">
      <CommandBar />
      <div className="mx-auto grid max-w-2xl justify-items-center gap-6 px-6 pt-28">
        <div className="grid justify-items-center gap-1.5">
          <ContextLine align="center" />
          <Text as="h1" variant="heading1">
            What do you want to work on?
          </Text>
        </div>
        <Text variant="secondary" size="sm">
          Ask above, or start from a suggestion — the workspace fills in below.
        </Text>
        <SuggestionChips to="/proto/c/today" />
      </div>
    </main>
  )
}

export function TodayC() {
  const [now, next, later] = planItems
  return (
    <main className="min-h-screen bg-kumo-canvas">
      <CommandBar value={demoPrompt} />
      <div className="mx-auto grid max-w-6xl grid-cols-1 gap-4 px-6 py-6 lg:grid-cols-12">
        <div className="lg:col-span-12">
          <ViewHeader />
        </div>
        <div className="lg:col-span-5">
          <PlanItemCard item={now} emphasized />
        </div>
        <div className="grid content-start gap-4 lg:col-span-4">
          <PlanItemCard item={next} />
          <PlanItemCard item={later} />
        </div>
        <div className="grid content-start gap-4 lg:col-span-3">
          <ClassesCard />
          <NotesCard />
        </div>
      </div>
    </main>
  )
}
