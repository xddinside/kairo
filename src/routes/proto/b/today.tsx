import { createFileRoute } from '@tanstack/react-router'

import { ProtoSwitcher } from '../../../components/proto/atoms'
import { TodayB } from '../../../components/proto/variant-b'

export const Route = createFileRoute('/proto/b/today')({
  component: ProtoBTodayRoute,
})

function ProtoBTodayRoute() {
  return (
    <>
      <TodayB />
      <ProtoSwitcher />
    </>
  )
}
