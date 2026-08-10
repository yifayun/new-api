import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

type ReviewItem = {
  id: number
  username?: string
  display_name?: string
  real_name_company_name?: string
  real_name_company_tax_no?: string
  real_name_name?: string
  real_name_id_card?: string
  real_name_status?: string
}

type ReviewData = {
  items: ReviewItem[]
  total: number
}

function maskIdCard(idCard?: string) {
  const s = String(idCard || '').trim()
  if (s.length < 8) return s || '—'
  return `${s.slice(0, 4)}****${s.slice(-4)}`
}

function reviewStatusLabel(status: string | undefined, t: (k: string) => string) {
  switch (status) {
    case 'enterprise_pending':
      return t('Enterprise pending review')
    case 'enterprise_rejected':
      return t('Enterprise review rejected')
    case 'passed':
      return t('Passed')
    case 'pending':
      return t('Pending')
    case 'rejected':
      return t('Rejected')
    case 'none':
      return t('Not verified')
    default:
      return status || '—'
  }
}

export function EnterpriseReview() {
  const { t } = useTranslation()
  const [tab, setTab] = useState<'enterprise_pending' | 'enterprise_rejected'>(
    'enterprise_pending'
  )
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<ReviewData>({ items: [], total: 0 })

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.get(
        `/api/user/enterprise-review?status=${encodeURIComponent(tab)}&p=0&page_size=100`
      )
      if (!res.data?.success) {
        toast.error(res.data?.message || t('Load failed'))
        return
      }
      setData({
        items: Array.isArray(res.data?.data?.items) ? res.data.data.items : [],
        total: Number(res.data?.data?.total) || 0,
      })
    } catch (error) {
      const message =
        error instanceof Error ? error.message : t('Failed to load data')
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }, [tab, t])

  useEffect(() => {
    load()
  }, [load])

  const doReview = async (userId: number, action: 'approve' | 'reject') => {
    const remark = window.prompt(
      action === 'approve'
        ? t('Review note (optional)')
        : t('Reject reason (optional)'),
      ''
    )
    if (remark === null) return
    try {
      const res = await api.post(
        `/api/user/${userId}/realname/company/${action}`,
        { remark }
      )
      if (!res.data?.success) {
        toast.error(res.data?.message || t('Operation failed'))
        return
      }
      toast.success(
        action === 'approve'
          ? t('Review approved successfully')
          : t('Review rejected successfully')
      )
      await load()
    } catch (error) {
      const message =
        error instanceof Error ? error.message : t('Operation failed')
      toast.error(message)
    }
  }

  return (
    <div className='space-y-4'>
      <Card>
        <CardHeader className='space-y-2'>
          <CardTitle>{t('Enterprise real-name review')}</CardTitle>
          <div className='flex gap-2'>
            <Button
              size='sm'
              variant={tab === 'enterprise_pending' ? 'default' : 'outline'}
              onClick={() => setTab('enterprise_pending')}
            >
              {t('Pending')}
            </Button>
            <Button
              size='sm'
              variant={tab === 'enterprise_rejected' ? 'default' : 'outline'}
              onClick={() => setTab('enterprise_rejected')}
            >
              {t('Rejected')}
            </Button>
            <Button size='sm' variant='outline' onClick={load} disabled={loading}>
              {loading ? t('Loading...') : t('Refresh')}
            </Button>
          </div>
        </CardHeader>
        <CardContent className='space-y-3'>
          <div className='text-muted-foreground text-sm'>
            {t('Total records')}: {data.total}
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>{t('Username')}</TableHead>
                <TableHead>{t('Company')}</TableHead>
                <TableHead>{t('Tax Number')}</TableHead>
                <TableHead>{t('Name')}</TableHead>
                <TableHead>{t('ID Card')}</TableHead>
                <TableHead>{t('Status')}</TableHead>
                <TableHead>{t('Actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className='text-muted-foreground text-center'>
                    {loading ? t('Loading...') : t('No data')}
                  </TableCell>
                </TableRow>
              ) : (
                data.items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>{item.id}</TableCell>
                    <TableCell>{item.username || '—'}</TableCell>
                    <TableCell>{item.real_name_company_name || '—'}</TableCell>
                    <TableCell>{item.real_name_company_tax_no || '—'}</TableCell>
                    <TableCell>{item.real_name_name || '—'}</TableCell>
                    <TableCell>{maskIdCard(item.real_name_id_card)}</TableCell>
                    <TableCell>
                      {reviewStatusLabel(item.real_name_status, t)}
                    </TableCell>
                    <TableCell>
                      {item.real_name_status === 'enterprise_pending' ? (
                        <div className='flex gap-2'>
                          <Button
                            size='sm'
                            onClick={() => doReview(item.id, 'approve')}
                          >
                            {t('Approve')}
                          </Button>
                          <Button
                            size='sm'
                            variant='destructive'
                            onClick={() => doReview(item.id, 'reject')}
                          >
                            {t('Reject')}
                          </Button>
                        </div>
                      ) : (
                        '—'
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
