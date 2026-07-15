/**
 * Console breadcrumb segments derived from the current path.
 * labelKey values are i18n source keys (see web/default i18n locales).
 */

export type ConsoleBreadcrumbSegment = {
  labelKey: string
  /** When set, segment renders as a link (not used for the last segment). */
  to?: string
}

const DASHBOARD_SECTION_TITLE: Record<string, string> = {
  overview: 'Overview',
  models: 'Model Call Analytics',
  users: 'User Analytics',
}

const USAGE_LOGS_SECTION_TITLE: Record<string, string> = {
  common: 'Common Logs',
  drawing: 'Drawing Logs',
  task: 'Task Logs',
}

const SYS_SETTINGS_CATEGORY: Record<string, string> = {
  general: 'General',
  auth: 'Authentication',
  'request-limits': 'Request Limits',
  content: 'Content',
  integrations: 'Integrations',
  models: 'Models',
  maintenance: 'Maintenance',
}

/** Sub-page under /system-settings/:category/:section — title keys (subset; unknown ids title-cased). */
const SYS_SETTINGS_SECTION: Record<string, string> = {
  'system-info': 'System Information',
  quota: 'Quota Settings',
  pricing: 'Pricing',
  'checkin-settings': 'Checkin Settings',
  'system-behavior': 'System Behavior',
  'channel-affinity': 'Channel Affinity',
  'bot-protection': 'Bot Protection',
  'email-verification': 'Email Verification',
  'request-limits': 'Request Limits',
  'content-moderation': 'Content Moderation',
  'model-metadata': 'Model Metadata',
  'model-deployments': 'Model Deployments',
  'global-user-restrictions': 'Global User Restrictions',
  'sidebar-modules': 'Sidebar Modules',
  'cache-config': 'Cache Config',
  'rate-limits': 'Rate Limits',
  'system-monitoring': 'System Monitoring',
  'log-cleanup': 'Log Cleanup',
  'github-oauth': 'GitHub OAuth',
  'oidc': 'OIDC',
  'turnstile': 'Turnstile',
  'wechat': 'WeChat',
  'payment': 'Payment',
  'affiliate': 'Affiliate',
  'redemption-codes': 'Redemption Codes',
  'creem': 'Creem',
  'waffo': 'Waffo',
  'waffo-pancake': 'Waffo Pancake',
  'reseller': 'Reseller',
  'legal': 'Legal',
  'server-status': 'Server Status',
  'user-review': 'User Review',
  'user-deletion': 'User Deletion',
  'reseller-review': 'Reseller Review',
  'default': 'Default',
}

function normalizePathname(pathname: string): string {
  if (pathname.length > 1 && pathname.endsWith('/')) {
    return pathname.slice(0, -1)
  }
  return pathname
}

function titleizeSegment(id: string): string {
  return id
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

/**
 * Returns breadcrumb segments for authenticated console pages, or [] if none.
 */
export function getConsoleBreadcrumbs(pathname: string): ConsoleBreadcrumbSegment[] {
  const path = normalizePathname(pathname)

  if (/^\/chat\/\d+$/.test(path)) {
    return [
      { labelKey: 'General', to: '/dashboard/overview' },
      { labelKey: 'Chat' },
    ]
  }

  if (path === '/playground') {
    return [{ labelKey: 'Playground' }]
  }

  if (path === '/keys') {
    return [
      { labelKey: 'General', to: '/dashboard/overview' },
      { labelKey: 'API Keys' },
    ]
  }

  if (path === '/wallet') {
    return [
      { labelKey: 'General', to: '/dashboard/overview' },
      { labelKey: 'Wallet' },
    ]
  }

  if (path === '/profile') {
    return [
      { labelKey: 'General', to: '/dashboard/overview' },
      { labelKey: 'Profile' },
    ]
  }

  if (path === '/realname-guide') {
    return [
      { labelKey: 'General', to: '/dashboard/overview' },
      { labelKey: 'Real-name Guide' },
    ]
  }

  if (path === '/reseller') {
    return [
      { labelKey: 'General', to: '/dashboard/overview' },
      { labelKey: 'Reseller Center' },
    ]
  }

  if (path === '/chat2link') {
    return [{ labelKey: 'Chat' }]
  }

  const dashboardMatch = /^\/dashboard\/([^/]+)$/.exec(path)
  if (dashboardMatch) {
    const section = dashboardMatch[1]
    const title = DASHBOARD_SECTION_TITLE[section] ?? 'Overview'
    return [
      { labelKey: 'General', to: '/dashboard/overview' },
      { labelKey: title },
    ]
  }

  const usageMatch = /^\/usage-logs\/([^/]+)$/.exec(path)
  if (usageMatch) {
    const section = usageMatch[1]
    const leaf = USAGE_LOGS_SECTION_TITLE[section] ?? 'Usage Logs'
    return [
      { labelKey: 'General', to: '/dashboard/overview' },
      { labelKey: 'Usage Logs', to: '/usage-logs/common' },
      { labelKey: leaf },
    ]
  }

  if (path === '/channels') {
    return [
      { labelKey: 'Admin', to: '/dashboard/overview' },
      { labelKey: 'Channels' },
    ]
  }

  if (path === '/users') {
    return [
      { labelKey: 'Admin', to: '/dashboard/overview' },
      { labelKey: 'Users' },
    ]
  }

  if (path === '/redemption-codes') {
    return [
      { labelKey: 'Admin', to: '/dashboard/overview' },
      { labelKey: 'Redemption Codes' },
    ]
  }

  if (path === '/subscriptions') {
    return [
      { labelKey: 'Admin', to: '/dashboard/overview' },
      { labelKey: 'Subscription Management' },
    ]
  }

  if (path.startsWith('/enterprise-review')) {
    return [
      { labelKey: 'Admin', to: '/dashboard/overview' },
      { labelKey: 'Enterprise Review' },
    ]
  }

  if (path.startsWith('/account-delete-review')) {
    return [
      { labelKey: 'Admin', to: '/dashboard/overview' },
      { labelKey: 'Account deletion review' },
    ]
  }

  if (path.startsWith('/reseller-review')) {
    return [
      { labelKey: 'Admin', to: '/dashboard/overview' },
      { labelKey: 'Reseller Withdrawals' },
    ]
  }

  if (path.startsWith('/models')) {
    const modelsRest = path.replace(/^\/models\/?/, '')
    if (!modelsRest || modelsRest === 'metadata') {
      return [
        { labelKey: 'Admin', to: '/dashboard/overview' },
        { labelKey: 'Models', to: '/models/metadata' },
        { labelKey: 'Model Metadata' },
      ]
    }
    if (modelsRest.startsWith('deployments')) {
      return [
        { labelKey: 'Admin', to: '/dashboard/overview' },
        { labelKey: 'Models', to: '/models/metadata' },
        { labelKey: 'Model Deployments' },
      ]
    }
    return [
      { labelKey: 'Admin', to: '/dashboard/overview' },
      { labelKey: 'Models' },
    ]
  }

  const sysMatch = /^\/system-settings\/([^/]+)(?:\/([^/]+))?$/.exec(path)
  if (sysMatch) {
    const category = sysMatch[1]
    const section = sysMatch[2]
    const catLabel =
      SYS_SETTINGS_CATEGORY[category] ?? titleizeSegment(category)
    const crumbs: ConsoleBreadcrumbSegment[] = [
      {
        labelKey: 'System Settings',
        to: '/system-settings/general/system-info',
      },
      { labelKey: catLabel },
    ]
    if (section) {
      const secLabel =
        SYS_SETTINGS_SECTION[section] ?? titleizeSegment(section)
      crumbs.push({ labelKey: secLabel })
    }
    return crumbs
  }

  return []
}
