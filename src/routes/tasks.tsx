import { createFileRoute } from '@tanstack/react-router'

import { RoutePlaceholder } from '../components/route-placeholder'

export const Route = createFileRoute('/tasks')({ component: TasksRoute })

function TasksRoute() {
  return <RoutePlaceholder path="/tasks" title="Tasks" />
}
