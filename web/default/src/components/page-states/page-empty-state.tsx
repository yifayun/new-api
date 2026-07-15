import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

export type PageEmptyStateProps = {
  icon?: ReactNode
  title: ReactNode
  description?: ReactNode
  action?: ReactNode
  className?: string
}

export function PageEmptyState(props: PageEmptyStateProps) {
  return (
    <div
      className={cn(
        'border-border flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed px-6 py-14 text-center',
        props.className
      )}
    >
      {props.icon != null ? (
        <div className='text-muted-foreground'>{props.icon}</div>
      ) : null}
      <div className='space-y-1'>
        <p className='text-base font-medium'>{props.title}</p>
        {props.description != null ? (
          <p className='text-muted-foreground max-w-md text-sm'>
            {props.description}
          </p>
        ) : null}
      </div>
      {props.action != null ? props.action : null}
    </div>
  )
}
