import { Skeleton } from '@/components/ui/skeleton'

type StatGridSkeletonProps = {
  /** Number of metric columns at lg breakpoint */
  columnCount?: number
}

export function StatGridSkeleton(props: StatGridSkeletonProps) {
  const n = props.columnCount ?? 5
  const lgCols =
    n === 5 ? 'lg:grid-cols-5' : n === 4 ? 'lg:grid-cols-4' : 'lg:grid-cols-3'

  return (
    <div className='overflow-hidden rounded-lg border'>
      <div
        className={`divide-border/60 grid grid-cols-2 divide-x sm:grid-cols-3 ${lgCols}`}
      >
        {Array.from({ length: n }).map((_, i) => (
          <div key={i} className='px-4 py-3.5 sm:px-5 sm:py-4'>
            <Skeleton className='h-3.5 w-16' />
            <Skeleton className='mt-2 h-7 w-20' />
            <Skeleton className='mt-1.5 h-3.5 w-28' />
          </div>
        ))}
      </div>
    </div>
  )
}
