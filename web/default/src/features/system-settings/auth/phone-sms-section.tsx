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
import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import * as z from 'zod'

import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'

import {
  SettingsForm,
  SettingsSwitchContent,
  SettingsSwitchItem,
} from '../components/settings-form-layout'
import { SettingsPageFormActions } from '../components/settings-page-context'
import { SettingsSection } from '../components/settings-section'
import { useUpdateOption } from '../hooks/use-update-option'

const phoneSmsSchema = z.object({
  PhoneVerificationEnabled: z.boolean(),
  RealNameVerificationEnabled: z.boolean(),
  RealNameRequiredPayment: z.string().optional(),
  AliyunSMSAccessKeyId: z.string().optional(),
  AliyunSMSAccessKeySecret: z.string().optional(),
  AliyunSMSSignName: z.string().optional(),
  AliyunSMSTemplateCode: z.string().optional(),
  ZhimaGatewayURL: z.string().optional(),
  ZhimaAppId: z.string().optional(),
  ZhimaAppAuthToken: z.string().optional(),
  ZhimaPrivateKey: z.string().optional(),
  ZhimaAlipayPublicKey: z.string().optional(),
})

type PhoneSmsFormValues = z.infer<typeof phoneSmsSchema>

type PhoneSmsSectionProps = {
  defaultValues: PhoneSmsFormValues
}

export function PhoneSmsSection({ defaultValues }: PhoneSmsSectionProps) {
  const { t } = useTranslation()
  const updateOption = useUpdateOption()

  const form = useForm<PhoneSmsFormValues>({
    resolver: zodResolver(phoneSmsSchema),
    defaultValues,
  })

  useEffect(() => {
    form.reset(defaultValues)
  }, [defaultValues, form])

  const onSubmit = async (data: PhoneSmsFormValues) => {
    const updates = Object.entries(data).filter(
      ([key, value]) =>
        value !== defaultValues[key as keyof PhoneSmsFormValues] &&
        !(typeof value === 'string' && value === '' && key.includes('Secret'))
    )

    for (const [key, value] of updates) {
      await updateOption.mutateAsync({ key, value: value as string | boolean })
    }
  }

  return (
    <SettingsSection title={t('Phone & real-name verification')}>
      <Form {...form}>
        <SettingsForm onSubmit={form.handleSubmit(onSubmit)}>
          <SettingsPageFormActions
            onSave={form.handleSubmit(onSubmit)}
            isSaving={updateOption.isPending}
          />

          <FormField
            control={form.control}
            name='PhoneVerificationEnabled'
            render={({ field }) => (
              <SettingsSwitchItem>
                <SettingsSwitchContent>
                  <FormLabel>{t('Phone verification')}</FormLabel>
                  <FormDescription>
                    {t(
                      'Require SMS verification code when registering with a phone number'
                    )}
                  </FormDescription>
                </SettingsSwitchContent>
                <FormControl>
                  <Switch
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                </FormControl>
              </SettingsSwitchItem>
            )}
          />

          <FormField
            control={form.control}
            name='RealNameVerificationEnabled'
            render={({ field }) => (
              <SettingsSwitchItem>
                <SettingsSwitchContent>
                  <FormLabel>{t('Real-name verification')}</FormLabel>
                  <FormDescription>
                    {t(
                      'Require users to complete real-name verification before using the API'
                    )}
                  </FormDescription>
                </SettingsSwitchContent>
                <FormControl>
                  <Switch
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                </FormControl>
              </SettingsSwitchItem>
            )}
          />

          <FormField
            control={form.control}
            name='RealNameRequiredPayment'
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('Required top-up after approval')}</FormLabel>
                <FormControl>
                  <Input placeholder='0' {...field} />
                </FormControl>
                <FormDescription>
                  {t(
                    'Minimum paid top-up amount required after real-name approval (0 to disable)'
                  )}
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className='text-muted-foreground pt-2 text-sm font-medium'>
            {t('Aliyun SMS settings')}
          </div>
          <FormField
            control={form.control}
            name='AliyunSMSAccessKeyId'
            render={({ field }) => (
              <FormItem>
                <FormLabel>AccessKey ID</FormLabel>
                <FormControl>
                  <Input {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name='AliyunSMSAccessKeySecret'
            render={({ field }) => (
              <FormItem>
                <FormLabel>AccessKey Secret</FormLabel>
                <FormControl>
                  <Input type='password' placeholder='••••••••' {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name='AliyunSMSSignName'
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('SMS sign name')}</FormLabel>
                <FormControl>
                  <Input {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name='AliyunSMSTemplateCode'
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('SMS template code')}</FormLabel>
                <FormControl>
                  <Input {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className='text-muted-foreground pt-2 text-sm font-medium'>
            {t('Zhima (Alipay) real-name settings')}
          </div>
          <FormField
            control={form.control}
            name='ZhimaGatewayURL'
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('Gateway URL')}</FormLabel>
                <FormControl>
                  <Input {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name='ZhimaAppId'
            render={({ field }) => (
              <FormItem>
                <FormLabel>AppId</FormLabel>
                <FormControl>
                  <Input {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name='ZhimaAppAuthToken'
            render={({ field }) => (
              <FormItem>
                <FormLabel>App Auth Token</FormLabel>
                <FormControl>
                  <Input type='password' placeholder='••••••••' {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name='ZhimaPrivateKey'
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('Private key')}</FormLabel>
                <FormControl>
                  <Input type='password' placeholder='••••••••' {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name='ZhimaAlipayPublicKey'
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('Alipay public key')}</FormLabel>
                <FormControl>
                  <Input type='password' placeholder='••••••••' {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </SettingsForm>
      </Form>
    </SettingsSection>
  )
}
