import { createFileRoute } from '@tanstack/react-router'

import { ProtoSwitcher } from '../../../components/proto/atoms'
import { TodayC } from '../../../components/proto/variant-c'

export const Route = createFileRoute('/proto/c/today')({
  component: ProtoCTodayRoute,
})

function ProtoCTodayRoute() {
  return (
    <>
      <TodayC />
      <ProtoSwitcher />
    </>
  )
}
