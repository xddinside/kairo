import { createFileRoute } from '@tanstack/react-router'

import { ProtoSwitcher } from '../../../components/proto/atoms'
import { QuietC } from '../../../components/proto/variant-c'

export const Route = createFileRoute('/proto/c/')({
  component: ProtoCQuietRoute,
})

function ProtoCQuietRoute() {
  return (
    <>
      <QuietC />
      <ProtoSwitcher />
    </>
  )
}
