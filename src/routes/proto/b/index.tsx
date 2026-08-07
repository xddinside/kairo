import { createFileRoute } from '@tanstack/react-router'

import { ProtoSwitcher } from '../../../components/proto/atoms'
import { QuietB } from '../../../components/proto/variant-b'

export const Route = createFileRoute('/proto/b/')({
  component: ProtoBQuietRoute,
})

function ProtoBQuietRoute() {
  return (
    <>
      <QuietB />
      <ProtoSwitcher />
    </>
  )
}
