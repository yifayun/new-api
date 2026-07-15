import { createFileRoute } from '@tanstack/react-router'
import { AdminResellerWithdrawals } from '@/features/reseller'

export const Route = createFileRoute('/_authenticated/reseller-review/')({
  component: AdminResellerWithdrawals,
})
