import * as React from 'react'
import { cn } from '@/lib/utils'
import { useUiTheme } from '@/context/ui-theme-provider'

function Table({ className, ...props }: React.ComponentProps<'table'>) {
  const { uiTheme } = useUiTheme()
  return (
    <div
      data-slot='table-container'
      className={cn(
        'relative w-full overflow-x-auto overflow-y-clip',
        uiTheme === 'aliyun' && 'rounded-lg border border-[#f0f0f0]',
        uiTheme === 'tencent' && 'rounded-xl border border-[#e7ebf0]'
      )}
    >
      <table
        data-slot='table'
        className={cn(
          'w-full caption-bottom text-sm',
          uiTheme === 'aliyun' && '[&_thead_tr]:bg-[#fafafa]',
          uiTheme === 'tencent' && '[&_thead_tr]:bg-[#f8fbff]',
          className
        )}
        {...props}
      />
    </div>
  )
}

function TableHeader({ className, ...props }: React.ComponentProps<'thead'>) {
  return (
    <thead
      data-slot='table-header'
      className={cn('[&_tr]:border-b', className)}
      {...props}
    />
  )
}

function TableBody({ className, ...props }: React.ComponentProps<'tbody'>) {
  return (
    <tbody
      data-slot='table-body'
      className={cn('[&_tr:last-child]:border-0', className)}
      {...props}
    />
  )
}

function TableFooter({ className, ...props }: React.ComponentProps<'tfoot'>) {
  return (
    <tfoot
      data-slot='table-footer'
      className={cn(
        'bg-muted/50 border-t font-medium [&>tr]:last:border-b-0',
        className
      )}
      {...props}
    />
  )
}

function TableRow({ className, ...props }: React.ComponentProps<'tr'>) {
  const { uiTheme } = useUiTheme()
  return (
    <tr
      data-slot='table-row'
      className={cn(
        'hover:bg-muted/50 data-[state=selected]:bg-muted border-b transition-colors',
        uiTheme === 'aliyun' && 'border-[#f0f0f0] hover:bg-[#fafafa]',
        uiTheme === 'tencent' && 'border-[#edf1f5] hover:bg-[#f8fbff]',
        className
      )}
      {...props}
    />
  )
}

function TableHead({ className, ...props }: React.ComponentProps<'th'>) {
  const { uiTheme } = useUiTheme()
  return (
    <th
      data-slot='table-head'
      className={cn(
        'text-foreground h-10 px-2 text-start align-middle font-medium whitespace-nowrap [&:has([role=checkbox])]:pe-0 [&>[role=checkbox]]:translate-y-[2px]',
        uiTheme === 'aliyun' && 'h-11 px-3 text-[#595959]',
        uiTheme === 'tencent' && 'h-11 px-3 text-[#4f5b6a]',
        className
      )}
      {...props}
    />
  )
}

function TableCell({ className, ...props }: React.ComponentProps<'td'>) {
  const { uiTheme } = useUiTheme()
  return (
    <td
      data-slot='table-cell'
      className={cn(
        'p-2 align-middle whitespace-nowrap [&:has([role=checkbox])]:pe-0 [&>[role=checkbox]]:translate-y-[2px]',
        uiTheme === 'aliyun' && 'px-3 py-2.5',
        uiTheme === 'tencent' && 'px-3 py-2.5',
        className
      )}
      {...props}
    />
  )
}

function TableCaption({
  className,
  ...props
}: React.ComponentProps<'caption'>) {
  return (
    <caption
      data-slot='table-caption'
      className={cn('text-muted-foreground mt-4 text-sm', className)}
      {...props}
    />
  )
}

export {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
  TableCaption,
}
