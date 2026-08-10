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

type DeleteRequestRow = {
  id: number
  user_id: number
  username?: string
  status: string
  reason?: string
  requested_at?: number
  reviewed_at?: number
  reviewer_name?: string
}

function formatTs(sec?: number) {
  if (!sec) return '—'
  const d = new Date(sec * 1000)
  return d.toLocaleString()
}

export function AccountDeleteReview() {
  const { t } = useTranslation()
  const [tab, setTab] = useState<
    'pending' | 'approved' | 'rejected' | 'canceled' | 'all'
  >('pending')
  const [loading, setLoading] = useState(false)
  const [rows, setRows] = useState<DeleteRequestRow[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize] = useState(20)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        p: String(page),
        page_size: String(pageSize),
      })
      if (tab !== 'all') {
        params.set('status', tab)
      }
      const res = await api.get(`/api/user/delete_request?${params.toString()}`)
      if (!res.data?.success) {
        toast.error(res.data?.message || t('Load failed'))
        return
      }
      const data = res.data.data || {}
      setRows(Array.isArray(data.items) ? data.items : [])
      setTotal(Number(data.total) || 0)
    } catch (error) {
      const message =
        error instanceof Error ? error.message : t('Failed to load data')
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }, [page, pageSize, tab, t])

  useEffect(() => {
    load()
  }, [load])

  const approve = async (id: number) => {
    if (
      !window.confirm(
        t(
          'Approve this account deletion? The user will be permanently removed.'
        )
      )
    ) {
      return
    }
    try {
      const res = await api.post(`/api/user/delete_request/${id}/approve`, {})
      if (!res.data?.success) {
        toast.error(res.data?.message || t('Operation failed'))
        return
      }
      toast.success(t('User deleted successfully'))
      await load()
    } catch (error) {
      const message =
        error instanceof Error ? error.message : t('Operation failed')
      toast.error(message)
    }
  }

  const reject = async (id: number) => {
    const reason = window.prompt(t('Reject reason (optional)'), '')
    if (reason === null) return
    try {
      const res = await api.post(`/api/user/delete_request/${id}/reject`, {
        reason: reason || '',
      })
      if (!res.data?.success) {
        toast.error(res.data?.message || t('Operation failed'))
        return
      }
      toast.success(t('Request rejected'))
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
          <CardTitle>{t('Account deletion review')}</CardTitle>
          <div className='flex flex-wrap gap-2'>
            {(
              [
                ['pending', t('Pending')],
                ['approved', t('Approved')],
                ['rejected', t('Rejected')],
                ['canceled', t('Canceled')],
                ['all', t('All')],
              ] as const
            ).map(([key, label]) => (
              <Button
                key={key}
                size='sm'
                variant={tab === key ? 'default' : 'outline'}
                onClick={() => {
                  setTab(key)
                  setPage(1)
                }}
              >
                {label}
              </Button>
            ))}
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className='text-muted-foreground py-8 text-center text-sm'>
              {t('Loading...')}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>{t('User ID')}</TableHead>
                  <TableHead>{t('Username')}</TableHead>
                  <TableHead>{t('Status')}</TableHead>
                  <TableHead>{t('Requested at')}</TableHead>
                  <TableHead>{t('Reviewed at')}</TableHead>
                  <TableHead>{t('Reviewer')}</TableHead>
                  <TableHead>{t('Reason')}</TableHead>
                  <TableHead className='text-right'>{t('Actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className='text-center'>
                      {t('No data')}
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell>{r.id}</TableCell>
                      <TableCell>{r.user_id}</TableCell>
                      <TableCell>{r.username || '—'}</TableCell>
                      <TableCell>{r.status}</TableCell>
                      <TableCell>{formatTs(r.requested_at)}</TableCell>
                      <TableCell>{formatTs(r.reviewed_at)}</TableCell>
                      <TableCell>{r.reviewer_name || '—'}</TableCell>
                      <TableCell>{r.reason || '—'}</TableCell>
                      <TableCell className='text-right'>
                        {r.status === 'pending' ? (
                          <div className='flex justify-end gap-2'>
                            <Button
                              size='sm'
                              variant='default'
                              onClick={() => approve(r.id)}
                            >
                              {t('Approve')}
                            </Button>
                            <Button
                              size='sm'
                              variant='destructive'
                              onClick={() => reject(r.id)}
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
          )}
          <div className='text-muted-foreground mt-4 text-sm'>
            {t('Total')}: {total}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
