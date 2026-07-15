import { useTranslation } from 'react-i18next'
import { ConsolePageBreadcrumb, SectionPageLayout } from '@/components/layout'
import { ApiKeysDialogs } from './components/api-keys-dialogs'
import { ApiKeysProvider } from './components/api-keys-provider'
import { ApiKeysTable } from './components/api-keys-table'

export function ApiKeys() {
  const { t } = useTranslation()
  return (
    <ApiKeysProvider>
      <SectionPageLayout>
        <SectionPageLayout.Breadcrumb>
          <ConsolePageBreadcrumb />
        </SectionPageLayout.Breadcrumb>
        <SectionPageLayout.Title>{t('API Keys')}</SectionPageLayout.Title>
        <SectionPageLayout.Description>
          {t('Manage your API keys for accessing the service')}
        </SectionPageLayout.Description>
        <SectionPageLayout.Content>
          <ApiKeysTable />
        </SectionPageLayout.Content>
      </SectionPageLayout>

      <ApiKeysDialogs />
    </ApiKeysProvider>
  )
}
