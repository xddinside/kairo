import { createFileRoute } from '@tanstack/react-router'

import { RoutePlaceholder } from '../components/route-placeholder'

export const Route = createFileRoute('/deadlines')({
  component: DeadlinesRoute,
})

function DeadlinesRoute() {
  return <RoutePlaceholder path="/deadlines" title="Deadlines" />
}
