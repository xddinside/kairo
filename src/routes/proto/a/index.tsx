import { createFileRoute } from '@tanstack/react-router'

import { ProtoSwitcher } from '../../../components/proto/atoms'
import { QuietA } from '../../../components/proto/variant-a'

export const Route = createFileRoute('/proto/a/')({
  component: ProtoAQuietRoute,
})

function ProtoAQuietRoute() {
  return (
    <>
      <QuietA />
      <ProtoSwitcher />
    </>
  )
}
