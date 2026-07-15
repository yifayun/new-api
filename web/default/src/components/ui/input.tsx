/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/
import { Input as InputPrimitive } from '@base-ui/react/input'
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
    <InputPrimitive
      type={type}
      data-slot='input'
      className={cn(
        'border-input file:text-foreground placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 disabled:bg-input/50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:bg-input/30 dark:disabled:bg-input/80 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 h-8 w-full min-w-0 rounded-lg border bg-transparent px-2.5 py-1 text-base transition-colors outline-none file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-sm file:font-medium focus-visible:ring-3 focus-visible:ring-inset disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:ring-3 aria-invalid:ring-inset md:text-sm',
        className
      )}
      {...props}
    />
  )
}

export { Input }
