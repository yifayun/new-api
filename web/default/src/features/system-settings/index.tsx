import { Outlet } from '@tanstack/react-router'
import { ConsolePageBreadcrumb, SectionPageLayout } from '@/components/layout'

export function SystemSettings() {
  return (
    <SectionPageLayout contentAreaClassName='min-h-0 flex-1 overflow-auto px-4 pt-6 pb-4'>
      <SectionPageLayout.Breadcrumb>
        <ConsolePageBreadcrumb />
      </SectionPageLayout.Breadcrumb>
      <SectionPageLayout.Content>
        <Outlet />
      </SectionPageLayout.Content>
    </SectionPageLayout>
  )
}
