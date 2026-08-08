import { createFileRoute } from '@tanstack/react-router'

import { RoutePlaceholder } from '../components/route-placeholder'
import { requireAuthenticatedRoute } from "../server/auth/functions";

export const Route = createFileRoute('/deadlines')({
  beforeLoad: requireAuthenticatedRoute,
  component: DeadlinesRoute,
})

function DeadlinesRoute() {
  return <RoutePlaceholder path="/deadlines" title="Deadlines" />
}
