import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { Loader2, QrCode } from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import { ConsolePageBreadcrumb, SectionPageLayout } from '@/components/layout'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

type RealNameStatus =
  | 'none'
  | 'pending'
  | 'passed'
  | 'rejected'
  | 'enterprise_pending'
  | 'enterprise_rejected'

type StatusResponse = {
  success: boolean
  message?: string
  data?: {
    real_name_status?: RealNameStatus
    real_name_type?: 'personal' | 'enterprise'
    realname_required_payment?: number
    realname_paid_total?: number
  }
}

type InitiateResponse = {
  success: boolean
  message?: string
  data?: {
    status?: RealNameStatus
    certify_url?: string
    certify_alipays_url?: string
    certify_form?: string
  }
}

const DEFAULT_STATUS: RealNameStatus = 'none'

function statusLabel(status: RealNameStatus, t: (k: string) => string) {
  const map: Record<RealNameStatus, string> = {
    none: t('Not verified'),
    pending: t('Pending'),
    passed: t('Passed'),
    rejected: t('Rejected'),
    enterprise_pending: t('Enterprise pending review'),
    enterprise_rejected: t('Enterprise review rejected'),
  }
  return map[status] || status
}

export function RealNameGuide() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [statusLoading, setStatusLoading] = useState(false)
  const [showQrModal, setShowQrModal] = useState(false)
  const [realNameAppUrl, setRealNameAppUrl] = useState('')

  const [realNameStatus, setRealNameStatus] =
    useState<RealNameStatus>(DEFAULT_STATUS)
  const [requiredPayment, setRequiredPayment] = useState(0)
  const [paidTotal, setPaidTotal] = useState(0)
  const [form, setForm] = useState({
    real_name_type: 'personal' as 'personal' | 'enterprise',
    real_name: '',
    id_card: '',
    company_name: '',
    company_tax_no: '',
    business_license_image: '',
  })

  const isEnterprise = form.real_name_type === 'enterprise'
  const isPending = realNameStatus === 'pending'

  const refreshStatus = useCallback(
    async (showToast = false) => {
      setStatusLoading(true)
      try {
        const res = await api.post<StatusResponse>('/api/user/realname/refresh')
        if (!res.data?.success) {
          toast.error(res.data?.message || t('Failed to refresh status'))
          return
        }
        const data = res.data.data
        const nextStatus = data?.real_name_status || DEFAULT_STATUS
        setRealNameStatus(nextStatus)
        setRequiredPayment(Number(data?.realname_required_payment || 0))
        setPaidTotal(Number(data?.realname_paid_total || 0))
        if (data?.real_name_type) {
          setForm((prev) => ({ ...prev, real_name_type: data.real_name_type! }))
        }
        if (showToast) {
          toast.success(t('Status updated'))
        }
      } catch (error) {
        const message =
          error instanceof Error ? error.message : t('Failed to refresh status')
        toast.error(message)
      } finally {
        setStatusLoading(false)
      }
    },
    [t]
  )

  const fetchInitialStatus = useCallback(async () => {
    setStatusLoading(true)
    try {
      const res = await api.get<StatusResponse>('/api/user/realname/status')
      if (!res.data?.success) return
      const data = res.data.data
      setRealNameStatus(data?.real_name_status || DEFAULT_STATUS)
      setRequiredPayment(Number(data?.realname_required_payment || 0))
      setPaidTotal(Number(data?.realname_paid_total || 0))
      if (data?.real_name_type) {
        setForm((prev) => ({ ...prev, real_name_type: data.real_name_type! }))
      }
    } finally {
      setStatusLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchInitialStatus()
  }, [fetchInitialStatus])

  useEffect(() => {
    if (!isPending) return
    const timer = window.setInterval(() => {
      refreshStatus(false)
    }, 5000)
    return () => window.clearInterval(timer)
  }, [isPending, refreshStatus])

  const handleUpload = (file?: File | null) => {
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      const base64 = reader.result
      if (typeof base64 === 'string') {
        setForm((prev) => ({ ...prev, business_license_image: base64 }))
      }
    }
    reader.readAsDataURL(file)
  }

  const startRealName = async () => {
    if (!form.real_name || !form.id_card) {
      toast.error(t('Please enter real name and ID card number'))
      return
    }
    if (
      isEnterprise &&
      (!form.company_name || !form.company_tax_no || !form.business_license_image)
    ) {
      toast.error(
        t('Enterprise verification requires company name, tax number and business license')
      )
      return
    }

    setLoading(true)
    try {
      const res = await api.post<InitiateResponse>(
        '/api/user/realname/initiate',
        form
      )
      if (!res.data?.success) {
        toast.error(res.data?.message || t('Failed to initiate verification'))
        return
      }
      const data = res.data.data
      setRealNameStatus(data?.status || 'pending')

      const isMobile = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent)
      const certifyUrl = data?.certify_url
      const certifyAlipaysUrl = data?.certify_alipays_url
      const certifyForm = data?.certify_form

      if (isMobile && certifyAlipaysUrl) {
        window.location.href = certifyAlipaysUrl
      } else if (certifyForm) {
        const popup = window.open('', '_blank')
        if (popup) {
          popup.document.open()
          popup.document.write(certifyForm)
          popup.document.close()
        } else if (certifyUrl) {
          window.open(certifyUrl, '_blank')
        }
      } else if (certifyUrl) {
        if (!isMobile && certifyAlipaysUrl) {
          setRealNameAppUrl(certifyAlipaysUrl)
          setShowQrModal(true)
        } else {
          window.open(certifyUrl, '_blank')
        }
      }

      toast.success(
        isEnterprise
          ? t(
              'Enterprise verification initiated. Complete face verification first, then wait for admin review.'
            )
          : t('Verification initiated. Complete it in Alipay, then refresh status.')
      )
    } catch (error) {
      const message =
        error instanceof Error ? error.message : t('Failed to initiate verification')
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }

  const canSwitchToPersonal = useMemo(
    () => form.real_name_type !== 'enterprise',
    [form.real_name_type]
  )

  return (
    <>
      <SectionPageLayout contentAreaClassName='min-h-0 flex-1 overflow-auto px-4 pb-4'>
        <SectionPageLayout.Breadcrumb>
          <ConsolePageBreadcrumb />
        </SectionPageLayout.Breadcrumb>
        <SectionPageLayout.Content>
          <div className='mx-auto w-full max-w-3xl py-4 sm:py-6'>
            <Card>
              <CardHeader>
                <CardTitle>{t('Real-name verification guide')}</CardTitle>
              </CardHeader>
              <CardContent className='space-y-5'>
              <div className='text-sm'>
                {t('Current status')}: <strong>{statusLabel(realNameStatus, t)}</strong>
              </div>

              {requiredPayment > 0 && (
                <div className='text-sm'>
                  {t('Required top-up after approval')}: {requiredPayment.toFixed(2)} /{' '}
                  {t('Current paid')}: {paidTotal.toFixed(2)}
                </div>
              )}

              <Tabs
                value={form.real_name_type}
                onValueChange={(value) => {
                  if (
                    form.real_name_type === 'enterprise' &&
                    value === 'personal' &&
                    !canSwitchToPersonal
                  ) {
                    toast.error(t('Enterprise verification cannot be downgraded'))
                    return
                  }
                  setForm((prev) => ({
                    ...prev,
                    real_name_type: value as 'personal' | 'enterprise',
                  }))
                }}
              >
                <TabsList className='grid w-full grid-cols-2'>
                  <TabsTrigger value='personal'>{t('Personal')}</TabsTrigger>
                  <TabsTrigger value='enterprise'>{t('Enterprise')}</TabsTrigger>
                </TabsList>
              </Tabs>

              <div className='grid gap-4'>
                <div>
                  <Label>{t('Real Name')}</Label>
                  <Input
                    value={form.real_name}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, real_name: e.target.value }))
                    }
                  />
                </div>
                <div>
                  <Label>{t('ID Card Number')}</Label>
                  <Input
                    value={form.id_card}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, id_card: e.target.value }))
                    }
                  />
                </div>

                {isEnterprise && (
                  <>
                    <div>
                      <Label>{t('Company Name')}</Label>
                      <Input
                        value={form.company_name}
                        onChange={(e) =>
                          setForm((prev) => ({
                            ...prev,
                            company_name: e.target.value,
                          }))
                        }
                      />
                    </div>
                    <div>
                      <Label>{t('Company Tax Number')}</Label>
                      <Input
                        value={form.company_tax_no}
                        onChange={(e) =>
                          setForm((prev) => ({
                            ...prev,
                            company_tax_no: e.target.value,
                          }))
                        }
                      />
                    </div>
                    <div className='space-y-2'>
                      <Label>{t('Business License Image URL/Base64')}</Label>
                      <Input
                        value={form.business_license_image}
                        onChange={(e) =>
                          setForm((prev) => ({
                            ...prev,
                            business_license_image: e.target.value,
                          }))
                        }
                      />
                      <Input
                        type='file'
                        accept='image/*'
                        onChange={(e) => handleUpload(e.target.files?.[0])}
                      />
                    </div>
                  </>
                )}
              </div>

                <div className='flex flex-wrap gap-2'>
                  <Button onClick={startRealName} disabled={loading}>
                    {loading ? (
                      <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                    ) : null}
                    {t('Initiate verification')}
                  </Button>
                  <Button variant='outline' onClick={() => refreshStatus(true)}>
                    {statusLoading ? (
                      <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                    ) : null}
                    {t('Refresh status')}
                  </Button>
                  <Button
                    variant='outline'
                    onClick={() => navigate({ to: '/profile' })}
                  >
                    {t('Go to profile')}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </SectionPageLayout.Content>
      </SectionPageLayout>

      <Dialog open={showQrModal} onOpenChange={setShowQrModal}>
        <DialogContent className='sm:max-w-md'>
          <DialogHeader>
            <DialogTitle className='flex items-center gap-2'>
              <QrCode className='h-4 w-4' />
              {t('Scan with Alipay')}
            </DialogTitle>
            <DialogDescription>
              {t('If Alipay did not open automatically, scan this QR code.')}
            </DialogDescription>
          </DialogHeader>
          <div className='flex justify-center py-2'>
            {realNameAppUrl ? <QRCodeSVG value={realNameAppUrl} size={220} /> : null}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
