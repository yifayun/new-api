import { createFileRoute, redirect } from '@tanstack/react-router'
import { ResellerCenter } from '@/features/reseller'
import { getSelf } from '@/lib/api'
import { useAuthStore } from '@/stores/auth-store'
import type { AuthUser } from '@/stores/auth-store'

export const Route = createFileRoute('/_authenticated/reseller/')({
  beforeLoad: async () => {
    const res = await getSelf().catch(() => null)
    if (res?.success && res.data) {
      useAuthStore.getState().auth.setUser(res.data as AuthUser)
      if ((res.data as AuthUser).reseller_portal_allowed === false) {
        throw redirect({ to: '/dashboard/overview' })
      }
    }
  },
  component: ResellerCenter,
})
