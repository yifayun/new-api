import { createFileRoute } from '@tanstack/react-router'
import { ConsolePageBreadcrumb, SectionPageLayout } from '@/components/layout'
import { Playground } from '@/features/playground'

export const Route = createFileRoute('/_authenticated/playground/')({
  component: PlaygroundPage,
})

function PlaygroundPage() {
  return (
    <SectionPageLayout
      mainClassName='p-0'
      contentAreaClassName='min-h-0 flex-1 overflow-hidden p-0'
    >
      <SectionPageLayout.Breadcrumb>
        <ConsolePageBreadcrumb />
      </SectionPageLayout.Breadcrumb>
      <SectionPageLayout.Content>
        <Playground />
      </SectionPageLayout.Content>
    </SectionPageLayout>
  )
}
