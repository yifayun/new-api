/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/
import { Link } from '@tanstack/react-router'
import { BadgeCheck, Phone, Shield } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useStatus } from '@/hooks/use-status'

import type { UserProfile } from '../types'

function statusLabel(
  status: string | undefined,
  t: (key: string) => string
): string {
  switch (status) {
    case 'passed':
      return t('Passed')
    case 'pending':
      return t('Pending')
    case 'rejected':
      return t('Rejected')
    case 'enterprise_pending':
      return t('Enterprise pending review')
    case 'enterprise_rejected':
      return t('Enterprise review rejected')
    case 'none':
    case undefined:
    case '':
      return t('Not verified')
    default:
      return status
  }
}

type AccountVerificationCardProps = {
  profile: UserProfile | null
  loading: boolean
}

export function AccountVerificationCard({
  profile,
  loading,
}: AccountVerificationCardProps) {
  const { t } = useTranslation()
  const { status } = useStatus()
  const phoneVerificationEnabled = !!status?.phone_verification
  const realnameEnabled = !!status?.realname_verification

  if (!phoneVerificationEnabled && !realnameEnabled) {
    return null
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className='h-6 w-40' />
        </CardHeader>
        <CardContent className='space-y-3'>
          <Skeleton className='h-4 w-full' />
          <Skeleton className='h-4 w-3/4' />
        </CardContent>
      </Card>
    )
  }

  if (!profile) return null

  return (
    <Card>
      <CardHeader>
        <CardTitle className='flex items-center gap-2 text-base'>
          <Shield className='h-4 w-4' />
          {t('Account verification')}
        </CardTitle>
      </CardHeader>
      <CardContent className='space-y-4'>
        {phoneVerificationEnabled && (
          <div className='flex items-start justify-between gap-3'>
            <div className='space-y-1'>
              <div className='text-muted-foreground flex items-center gap-2 text-sm'>
                <Phone className='h-3.5 w-3.5' />
                {t('Phone number')}
              </div>
              <div className='text-sm font-medium'>
                {profile.phone || t('Not bound')}
              </div>
            </div>
            <span className='text-muted-foreground text-xs'>
              {profile.phone_verified ? t('Verified') : t('Not verified')}
            </span>
          </div>
        )}

        {realnameEnabled && (
          <div className='space-y-3 border-t pt-4'>
            <div className='flex items-start justify-between gap-3'>
              <div className='space-y-1'>
                <div className='text-muted-foreground flex items-center gap-2 text-sm'>
                  <BadgeCheck className='h-3.5 w-3.5' />
                  {t('Real-name verification')}
                </div>
                <div className='text-sm font-medium'>
                  {profile.real_name_name || t('Not verified')}
                </div>
                <div className='text-muted-foreground text-xs'>
                  {statusLabel(profile.real_name_status, t)}
                  {profile.real_name_type === 'enterprise'
                    ? ` · ${t('Enterprise')}`
                    : profile.real_name_type === 'personal'
                      ? ` · ${t('Personal')}`
                      : ''}
                </div>
              </div>
              <Button asChild size='sm' variant='outline'>
                <Link to='/realname-guide'>
                  {profile.real_name_verified
                    ? t('View / upgrade')
                    : t('Go to verify')}
                </Link>
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
