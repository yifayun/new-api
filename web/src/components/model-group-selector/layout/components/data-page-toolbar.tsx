import { cn } from '@/lib/utils'

export type DataPageToolbarProps = {
  /** Primary filters / search cluster */
  left?: React.ReactNode
  /** Actions: refresh, export, column visibility, etc. */
  right?: React.ReactNode
  /** Pin below the page title band while scrolling the content column */
  sticky?: boolean
  className?: string
}

export function DataPageToolbar(props: DataPageToolbarProps) {
  return (
    <div
      className={cn(
        'bg-background/95 flex flex-col gap-2 border-b pb-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4',
        props.sticky &&
          'supports-[backdrop-filter]:bg-background/80 sticky top-0 z-20 -mx-4 mb-3 border-border px-4 pt-1 backdrop-blur',
        props.className
      )}
    >
      <div className='flex min-w-0 flex-1 flex-wrap items-center gap-2'>
        {props.left}
      </div>
      {props.right != null ? (
        <div className='flex shrink-0 flex-wrap items-center justify-end gap-2'>
          {props.right}
        </div>
      ) : null}
    </div>
  )
}
