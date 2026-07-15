import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { ConsolePageBreadcrumb, SectionPageLayout } from '@/components/layout'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  createResellerWithdrawal,
  getAdminResellerWithdrawals,
  getResellerProfile,
  getResellerProfit,
  getResellerProfitRecords,
  getResellerUsers,
  getResellerWithdrawals,
  updateResellerProfile,
} from './api'

export function ResellerCenter() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [amount, setAmount] = useState(0)
  const [account, setAccount] = useState('')
  const [remark, setRemark] = useState('')
  const [profileForm, setProfileForm] = useState({
    host: '',
    logo: '',
    site_name: '',
    name: '',
    markup_rate: 0,
  })
  const profile = useQuery({
    queryKey: ['reseller-profile'],
    queryFn: getResellerProfile,
  })
  const profit = useQuery({
    queryKey: ['reseller-profit'],
    queryFn: getResellerProfit,
  })
  const profitRecords = useQuery({
    queryKey: ['reseller-profit-records'],
    queryFn: () => getResellerProfitRecords({ p: 1, page_size: 10 }),
  })
  const users = useQuery({
    queryKey: ['reseller-users'],
    queryFn: () => getResellerUsers({ p: 1, page_size: 10 }),
  })
  const withdrawals = useQuery({
    queryKey: ['reseller-withdrawals'],
    queryFn: () => getResellerWithdrawals({ p: 1, page_size: 10 }),
  })

  const saveProfile = useMutation({
    mutationFn: updateResellerProfile,
    onSuccess: (res) => {
      if (res.success) {
        toast.success(t('Saved successfully'))
        queryClient.invalidateQueries({ queryKey: ['reseller-profile'] })
        queryClient.invalidateQueries({ queryKey: ['reseller-profit'] })
      } else {
        toast.error(res.message || t('Save failed'))
      }
    },
    onError: (error: Error) => {
      toast.error(error.message || t('Save failed'))
    },
  })
  const submitWithdrawal = useMutation({
    mutationFn: createResellerWithdrawal,
    onSuccess: (res) => {
      if (res.success) {
        toast.success(t('Withdrawal request submitted'))
        setAmount(0)
        setRemark('')
        queryClient.invalidateQueries({ queryKey: ['reseller-profit'] })
        queryClient.invalidateQueries({ queryKey: ['reseller-withdrawals'] })
      } else {
        toast.error(res.message || t('Submit failed'))
      }
    },
    onError: (error: Error) => {
      toast.error(error.message || t('Submit failed'))
    },
  })

  const profileData = profile.data?.data
  const profitData = profit.data?.data
  const profitItems = profitRecords.data?.data?.items ?? []
  const userItems = users.data?.data?.items ?? []
  const withdrawalItems = withdrawals.data?.data?.items ?? []

  useEffect(() => {
    if (!profileData) {
      return
    }
    setProfileForm({
      host: profileData.host || '',
      logo: profileData.logo || '',
      site_name: profileData.site_name || '',
      name: profileData.name || '',
      markup_rate: profileData.markup_rate || 0,
    })
  }, [profileData])

  return (
    <SectionPageLayout>
      <SectionPageLayout.Breadcrumb>
        <ConsolePageBreadcrumb />
      </SectionPageLayout.Breadcrumb>
      <SectionPageLayout.Title>{t('Reseller Center')}</SectionPageLayout.Title>
      <SectionPageLayout.Description>
        {t('Manage your reseller profile, profits, users and withdrawals')}
      </SectionPageLayout.Description>
      <SectionPageLayout.Content>
        <div className='space-y-6 text-sm'>
          <div className='rounded border p-4'>
            <div className='mb-3 font-medium'>{t('Profile & Branding')}</div>
            <div className='grid gap-3 md:grid-cols-2'>
              <Input
                placeholder={t('Site Name')}
                value={profileForm.site_name}
                onChange={(event) =>
                  setProfileForm((prev) => ({ ...prev, site_name: event.target.value }))
                }
              />
              <Input
                placeholder={t('Reseller Name')}
                value={profileForm.name}
                onChange={(event) =>
                  setProfileForm((prev) => ({ ...prev, name: event.target.value }))
                }
              />
              <Input
                placeholder={t('Domain')}
                value={profileForm.host}
                onChange={(event) =>
                  setProfileForm((prev) => ({ ...prev, host: event.target.value }))
                }
              />
              <Input
                placeholder={t('Logo URL')}
                value={profileForm.logo}
                onChange={(event) =>
                  setProfileForm((prev) => ({ ...prev, logo: event.target.value }))
                }
              />
              <Input
                type='number'
                step='0.01'
                min={0}
                placeholder={t('Markup Rate')}
                value={profileForm.markup_rate}
                onChange={(event) =>
                  setProfileForm((prev) => ({
                    ...prev,
                    markup_rate: Number(event.target.value || 0),
                  }))
                }
              />
            </div>
            <div className='mt-3'>
              <Button
                onClick={() => saveProfile.mutate(profileForm)}
                disabled={saveProfile.isPending}
              >
                {t('Save Changes')}
              </Button>
            </div>
          </div>

          <div className='grid gap-3 md:grid-cols-4'>
            <div className='rounded border p-3'>
              <div className='text-muted-foreground text-xs'>{t('Today Profit')}</div>
              <div className='text-lg font-semibold'>{profitData?.today_profit ?? 0}</div>
            </div>
            <div className='rounded border p-3'>
              <div className='text-muted-foreground text-xs'>{t('Total Profit')}</div>
              <div className='text-lg font-semibold'>{profitData?.total_profit ?? 0}</div>
            </div>
            <div className='rounded border p-3'>
              <div className='text-muted-foreground text-xs'>{t('Withdrawable')}</div>
              <div className='text-lg font-semibold'>{profitData?.withdrawable ?? 0}</div>
            </div>
            <div className='rounded border p-3'>
              <div className='text-muted-foreground text-xs'>{t('Pending Withdrawal')}</div>
              <div className='text-lg font-semibold'>
                {profitData?.pending_withdrawal ?? 0}
              </div>
            </div>
          </div>

          <div className='rounded border p-4'>
            <div className='mb-3 font-medium'>{t('Apply Withdrawal')}</div>
            <div className='grid gap-3 md:grid-cols-3'>
              <Input
                type='number'
                min={1}
                value={amount || ''}
                placeholder={t('Amount')}
                onChange={(event) => setAmount(Number(event.target.value || 0))}
              />
              <Input
                value={account}
                placeholder={t('Withdrawal account')}
                onChange={(event) => setAccount(event.target.value)}
              />
              <Input
                value={remark}
                placeholder={t('Remark')}
                onChange={(event) => setRemark(event.target.value)}
              />
            </div>
            <div className='mt-3'>
              <Button
                disabled={submitWithdrawal.isPending || !amount || !account}
                onClick={() => submitWithdrawal.mutate({ amount, account, remark })}
              >
                {t('Submit')}
              </Button>
            </div>
          </div>

          <div className='rounded border p-4'>
            <div className='mb-3 font-medium'>{t('Profit Records')}</div>
            <div className='space-y-2'>
              {profitItems.map((item: any) => (
                <div key={item.id} className='grid grid-cols-4 gap-2 rounded border p-2 text-xs'>
                  <span>{t('ID:')} {item.id}</span>
                  <span>{t('User:')} {item.user_id}</span>
                  <span>{t('Base:')} {item.base_quota}</span>
                  <span>{t('Profit:')} {item.markup_quota}</span>
                </div>
              ))}
            </div>
          </div>

          <div className='rounded border p-4'>
            <div className='mb-3 font-medium'>{t('Users')}</div>
            <div className='space-y-2'>
              {userItems.map((item: any) => (
                <div key={item.id} className='grid grid-cols-4 gap-2 rounded border p-2 text-xs'>
                  <span>{t('ID:')} {item.id}</span>
                  <span>{item.username}</span>
                  <span>{item.email}</span>
                  <span>{item.phone}</span>
                </div>
              ))}
            </div>
          </div>

          <div className='rounded border p-4'>
            <div className='mb-3 font-medium'>{t('Withdrawals')}</div>
            <div className='space-y-2'>
              {withdrawalItems.map((item: any) => (
                <div key={item.id} className='grid grid-cols-4 gap-2 rounded border p-2 text-xs'>
                  <span>{t('ID:')} {item.id}</span>
                  <span>{item.amount}</span>
                  <span>{item.status}</span>
                  <span>{item.account}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </SectionPageLayout.Content>
    </SectionPageLayout>
  )
}

export function AdminResellerWithdrawals() {
  const { t } = useTranslation()
  const query = useQuery({
    queryKey: ['admin-reseller-withdrawals'],
    queryFn: () => getAdminResellerWithdrawals({ p: 1, page_size: 20 }),
  })
  return (
    <SectionPageLayout>
      <SectionPageLayout.Breadcrumb>
        <ConsolePageBreadcrumb />
      </SectionPageLayout.Breadcrumb>
      <SectionPageLayout.Title>
        {t('Reseller Withdrawal Review')}
      </SectionPageLayout.Title>
      <SectionPageLayout.Description>
        {t('Review reseller withdrawal requests')}
      </SectionPageLayout.Description>
      <SectionPageLayout.Content>
        <pre className='rounded border p-3 text-sm'>
          {JSON.stringify(query.data?.data?.items ?? [], null, 2)}
        </pre>
      </SectionPageLayout.Content>
    </SectionPageLayout>
  )
}
