import { useState, useCallback, useMemo, lazy, Suspense } from 'react'
import { getRouteApi, useNavigate } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { useAuthStore } from '@/stores/auth-store'
import { ROLE } from '@/lib/roles'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ConsolePageBreadcrumb, SectionPageLayout } from '@/components/layout'
import { ChartCardSkeleton, StatGridSkeleton } from '@/components/page-states'
import {
  CardStaggerContainer,
  CardStaggerItem,
  FadeIn,
} from '@/components/page-transition'
import { ModelsFilter } from './components/models/models-filter-dialog'
import { AnnouncementsPanel } from './components/overview/announcements-panel'
import { ApiInfoPanel } from './components/overview/api-info-panel'
import { FAQPanel } from './components/overview/faq-panel'
import { SummaryCards } from './components/overview/summary-cards'
import { UptimePanel } from './components/overview/uptime-panel'
import { DEFAULT_TIME_GRANULARITY } from './constants'
import {
  type DashboardSectionId,
  DASHBOARD_DEFAULT_SECTION,
  DASHBOARD_SECTION_IDS,
} from './section-registry'
import { type DashboardFilters, type QuotaDataItem } from './types'

const route = getRouteApi('/_authenticated/dashboard/$section')

const LazyLogStatCards = lazy(() =>
  import('./components/models/log-stat-cards').then((m) => ({
    default: m.LogStatCards,
  }))
)

const LazyModelCharts = lazy(() =>
  import('./components/models/model-charts').then((m) => ({
    default: m.ModelCharts,
  }))
)

const LazyConsumptionDistributionChart = lazy(() =>
  import('./components/models/consumption-distribution-chart').then((m) => ({
    default: m.ConsumptionDistributionChart,
  }))
)

const LazyUserCharts = lazy(() =>
  import('./components/users/user-charts').then((m) => ({
    default: m.UserCharts,
  }))
)

const SECTION_META: Record<
  DashboardSectionId,
  { titleKey: string; descriptionKey: string }
> = {
  overview: {
    titleKey: 'Overview',
    descriptionKey: 'View dashboard overview and statistics',
  },
  models: {
    titleKey: 'Model Call Analytics',
    descriptionKey: 'View model call count analytics and charts',
  },
  users: {
    titleKey: 'User Analytics',
    descriptionKey: 'View user consumption statistics and charts',
  },
}

export function Dashboard() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const params = route.useParams()
  const userRole = useAuthStore((state) => state.auth.user?.role)
  const activeSection = (params.section ??
    DASHBOARD_DEFAULT_SECTION) as DashboardSectionId

  const [modelFilters, setModelFilters] = useState<DashboardFilters>({})
  const [modelData, setModelData] = useState<QuotaDataItem[]>([])
  const [dataLoading, setDataLoading] = useState(false)

  const handleFilterChange = useCallback((filters: DashboardFilters) => {
    setModelFilters(filters)
  }, [])

  const handleResetFilters = useCallback(() => {
    setModelFilters({})
  }, [])

  const handleDataUpdate = useCallback(
    (data: QuotaDataItem[], loading: boolean) => {
      setModelData(data)
      setDataLoading(loading)
    },
    []
  )

  const meta = SECTION_META[activeSection] ?? SECTION_META.overview
  const isAdmin = Boolean(userRole && userRole >= ROLE.ADMIN)
  const visibleSections = useMemo(
    () =>
      DASHBOARD_SECTION_IDS.filter(
        (section) => section !== 'overview' && (section !== 'users' || isAdmin)
      ),
    [isAdmin]
  )
  const handleSectionChange = useCallback(
    (section: string) => {
      void navigate({
        to: '/dashboard/$section',
        params: { section: section as DashboardSectionId },
      })
    },
    [navigate]
  )
  const showSectionTabs = activeSection !== 'overview' && visibleSections.length > 1

  return (
    <SectionPageLayout>
      <SectionPageLayout.Breadcrumb>
        <ConsolePageBreadcrumb />
      </SectionPageLayout.Breadcrumb>
      <SectionPageLayout.Title>{t(meta.titleKey)}</SectionPageLayout.Title>
      <SectionPageLayout.Description>
        {t(meta.descriptionKey)}
      </SectionPageLayout.Description>
      {activeSection === 'models' && (
        <SectionPageLayout.Actions>
          <ModelsFilter
            onFilterChange={handleFilterChange}
            onReset={handleResetFilters}
          />
        </SectionPageLayout.Actions>
      )}
      <SectionPageLayout.Content>
        <div className='space-y-4'>
          {showSectionTabs && (
            <Tabs value={activeSection} onValueChange={handleSectionChange}>
              <TabsList className='h-auto max-w-full flex-wrap justify-start'>
                {visibleSections.map((section) => (
                  <TabsTrigger key={section} value={section}>
                    {t(SECTION_META[section].titleKey)}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          )}
          {activeSection === 'overview' && (
            <>
              <SummaryCards />
              <CardStaggerContainer className='grid grid-cols-1 gap-4 lg:grid-cols-2'>
                <CardStaggerItem>
                  <ApiInfoPanel />
                </CardStaggerItem>
                <CardStaggerItem>
                  <AnnouncementsPanel />
                </CardStaggerItem>
                <CardStaggerItem>
                  <FAQPanel />
                </CardStaggerItem>
                <CardStaggerItem>
                  <UptimePanel />
                </CardStaggerItem>
              </CardStaggerContainer>
            </>
          )}
          {activeSection === 'models' && (
            <>
              <FadeIn>
                <Suspense fallback={<StatGridSkeleton />}>
                  <LazyLogStatCards
                    filters={modelFilters}
                    onDataUpdate={handleDataUpdate}
                  />
                </Suspense>
              </FadeIn>
              <FadeIn delay={0.1}>
                <Suspense fallback={<ChartCardSkeleton />}>
                  <LazyConsumptionDistributionChart
                    data={modelData}
                    loading={dataLoading}
                    timeGranularity={
                      modelFilters.time_granularity || DEFAULT_TIME_GRANULARITY
                    }
                  />
                </Suspense>
              </FadeIn>
              <FadeIn delay={0.15}>
                <Suspense fallback={<ChartCardSkeleton />}>
                  <LazyModelCharts
                    data={modelData}
                    loading={dataLoading}
                    timeGranularity={
                      modelFilters.time_granularity || DEFAULT_TIME_GRANULARITY
                    }
                  />
                </Suspense>
              </FadeIn>
            </>
          )}
          {activeSection === 'users' && (
            <FadeIn>
              <Suspense fallback={<ChartCardSkeleton />}>
                <LazyUserCharts />
              </Suspense>
            </FadeIn>
          )}
        </div>
      </SectionPageLayout.Content>
    </SectionPageLayout>
  )
}
