import { createFileRoute } from '@tanstack/react-router'
import { RealNameGuide } from '@/features/realname-guide'

export const Route = createFileRoute('/_authenticated/realname-guide/')({
  component: RealNameGuide,
})
