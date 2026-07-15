import { createFileRoute } from '@tanstack/react-router'
import { AccountDeleteReview } from '@/features/account-delete-review'

export const Route = createFileRoute('/_authenticated/account-delete-review/')({
  component: AccountDeleteReview,
})
