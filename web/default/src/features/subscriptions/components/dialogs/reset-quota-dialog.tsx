import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { resetPlanSubscriptions } from '../../api'
import { useSubscriptions } from '../subscriptions-provider'

export function ResetQuotaDialog() {
  const { t } = useTranslation()
  const { open, setOpen, currentRow, triggerRefresh } = useSubscriptions()
  const [loading, setLoading] = useState(false)

  if (open !== 'reset-quota' || !currentRow) return null

  const planTitle = currentRow.plan.title || `#${currentRow.plan.id}`

  const handleConfirm = async () => {
    setLoading(true)
    try {
      const res = await resetPlanSubscriptions(currentRow.plan.id, {
        advance_reset_time: true,
      })
      if (res.success && res.data) {
        toast.success(
          t('Reset {{count}} subscription(s) for {{users}} user(s)', {
            count: res.data.reset_count,
            users: res.data.user_count,
          })
        )
        triggerRefresh()
        setOpen(null)
      }
    } catch {
      toast.error(t('Operation failed'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <ConfirmDialog
      open
      onOpenChange={(v) => !v && setOpen(null)}
      title={t('Confirm reset subscription quota')}
      desc={t(
        'This will reset used quota to zero for all active subscriptions under plan "{{plan}}". Continue?',
        { plan: planTitle }
      )}
      handleConfirm={handleConfirm}
      isLoading={loading}
      confirmText={t('Reset quota')}
    />
  )
}
