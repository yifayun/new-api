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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

import { SettingsForm } from '../components/settings-form-layout'
import { SettingsPageFormActions } from '../components/settings-page-context'
import { SettingsSection } from '../components/settings-section'
import { useUpdateOption } from '../hooks/use-update-option'

const filingSchema = z.object({
  CompanyName: z.string().optional(),
  ICPRecordNumber: z.string().optional(),
  ICPRecordLink: z.string().optional(),
  PublicSecurityRecordNumber: z.string().optional(),
  PublicSecurityRecordLink: z.string().optional(),
  TelecomValueAddedLicense: z.string().optional(),
  TelecomValueAddedLicenseLink: z.string().optional(),
  RecordBarLayout: z.enum(['wrap', 'single']),
})

type FilingFormValues = z.infer<typeof filingSchema>

type FilingSectionProps = {
  defaultValues: FilingFormValues
}

export function FilingSection({ defaultValues }: FilingSectionProps) {
  const { t } = useTranslation()
  const updateOption = useUpdateOption()

  const form = useForm<FilingFormValues>({
    resolver: zodResolver(filingSchema),
    defaultValues,
  })

  useEffect(() => {
    form.reset(defaultValues)
  }, [defaultValues, form])

  const onSubmit = async (data: FilingFormValues) => {
    const updates = Object.entries(data).filter(
      ([key, value]) => value !== defaultValues[key as keyof FilingFormValues]
    )
    for (const [key, value] of updates) {
      await updateOption.mutateAsync({ key, value: value as string })
    }
  }

  return (
    <SettingsSection title={t('Filing & compliance bar')}>
      <Form {...form}>
        <SettingsForm onSubmit={form.handleSubmit(onSubmit)}>
          <SettingsPageFormActions
            onSave={form.handleSubmit(onSubmit)}
            isSaving={updateOption.isPending}
          />

          <FormField
            control={form.control}
            name='CompanyName'
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('Company name')}</FormLabel>
                <FormControl>
                  <Input {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name='ICPRecordNumber'
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('ICP filing number')}</FormLabel>
                <FormControl>
                  <Input {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name='ICPRecordLink'
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('ICP filing link')}</FormLabel>
                <FormControl>
                  <Input placeholder='https://' {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name='PublicSecurityRecordNumber'
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('Public security filing number')}</FormLabel>
                <FormControl>
                  <Input {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name='PublicSecurityRecordLink'
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('Public security filing link')}</FormLabel>
                <FormControl>
                  <Input placeholder='https://' {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name='TelecomValueAddedLicense'
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('Telecom value-added license')}</FormLabel>
                <FormControl>
                  <Input {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name='TelecomValueAddedLicenseLink'
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('Telecom value-added license link')}</FormLabel>
                <FormControl>
                  <Input placeholder='https://' {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name='RecordBarLayout'
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('Record bar layout')}</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value='wrap'>{t('Wrap')}</SelectItem>
                    <SelectItem value='single'>{t('Single line')}</SelectItem>
                  </SelectContent>
                </Select>
                <FormDescription>
                  {t('How filing information is arranged in the site footer')}
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </SettingsForm>
      </Form>
    </SettingsSection>
  )
}
