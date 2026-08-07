import { createFileRoute } from '@tanstack/react-router'

import { RoutePlaceholder } from '../components/route-placeholder'

export const Route = createFileRoute('/focus')({ component: FocusRoute })

function FocusRoute() {
  return <RoutePlaceholder path="/focus" title="Focus" />
}
