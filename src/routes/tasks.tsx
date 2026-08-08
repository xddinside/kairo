import { createFileRoute } from '@tanstack/react-router'

import { RoutePlaceholder } from '../components/route-placeholder'
import { requireAuthenticatedRoute } from "../server/auth/functions";

export const Route = createFileRoute('/tasks')({
  beforeLoad: requireAuthenticatedRoute,
  component: TasksRoute,
})

function TasksRoute() {
  return <RoutePlaceholder path="/tasks" title="Tasks" />
}
