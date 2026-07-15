import * as React from 'react'
import { cn } from '@/lib/utils'
import { useUiTheme } from '@/context/ui-theme-provider'

function Input({ className, type, ...props }: React.ComponentProps<'input'>) {
  const { uiTheme } = useUiTheme()

  if (uiTheme === 'aliyun') {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { Input: AntInput } = require('antd') as typeof import('antd')
    return (
      <AntInput
        type={type}
        className={className}
        {...(props as any)}
        data-slot='input'
      />
    )
  }

  if (uiTheme === 'tencent') {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { Input: TInput } =
      require('tdesign-react') as typeof import('tdesign-react')
    return (
      <TInput
        type={type as any}
        className={className}
        {...(props as any)}
      />
    )
  }

  return (
    <input
      type={type}
      data-slot='input'
      className={cn(
        'file:text-foreground placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground dark:bg-input/30 border-input h-9 w-full min-w-0 rounded-md border bg-transparent px-3 py-1 text-base shadow-xs transition-[color,box-shadow] outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm',
        'focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]',
        'aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive',
        className
      )}
      {...props}
    />
  )
}

export { Input }
