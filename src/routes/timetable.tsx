import { createFileRoute } from '@tanstack/react-router'

import { RoutePlaceholder } from '../components/route-placeholder'

export const Route = createFileRoute('/timetable')({
  component: TimetableRoute,
})

function TimetableRoute() {
  return <RoutePlaceholder path="/timetable" title="Timetable" />
}
