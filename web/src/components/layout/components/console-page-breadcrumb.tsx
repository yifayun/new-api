import { Link, useLocation } from '@tanstack/react-router'
import { ChevronRight } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import { getConsoleBreadcrumbs } from '../lib/page-meta'

type ConsolePageBreadcrumbProps = {
  className?: string
}

export function ConsolePageBreadcrumb(props: ConsolePageBreadcrumbProps) {
  const { t } = useTranslation()
  const { pathname } = useLocation()
  const segments = getConsoleBreadcrumbs(pathname)

  if (segments.length === 0) {
    return null
  }

  return (
    <nav
      aria-label={t('Breadcrumb', { defaultValue: 'Breadcrumb' })}
      className={cn(
        'text-muted-foreground flex items-center text-sm',
        props.className
      )}
    >
      <ol className='flex flex-wrap items-center gap-1'>
        {segments.map((seg, i) => {
          const isLast = i === segments.length - 1
          const showLink = Boolean(seg.to) && !isLast

          return (
            <li key={`${seg.labelKey}-${i}`} className='flex items-center gap-1'>
              {i > 0 ? (
                <ChevronRight
                  className='size-3.5 shrink-0 opacity-60'
                  aria-hidden
                />
              ) : null}
              {showLink ? (
                <Link
                  to={seg.to!}
                  className='hover:text-foreground transition-colors'
                >
                  {t(seg.labelKey)}
                </Link>
              ) : (
                <span
                  className={
                    isLast ? 'text-foreground font-medium' : undefined
                  }
                >
                  {t(seg.labelKey)}
                </span>
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
