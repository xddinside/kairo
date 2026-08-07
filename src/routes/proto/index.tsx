import { createFileRoute } from '@tanstack/react-router'

import { ProtoSwitcher } from '../../components/proto/atoms'
import { ProtoIndex } from '../../components/proto/proto-index'

export const Route = createFileRoute('/proto/')({
  component: ProtoIndexRoute,
})

function ProtoIndexRoute() {
  return (
    <>
      <ProtoIndex />
      <ProtoSwitcher />
    </>
  )
}
