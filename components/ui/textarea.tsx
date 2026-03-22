import * as React from 'react'

import { cn } from '@/lib/utils'

function Textarea({ className, ...props }: React.ComponentProps<'textarea'>) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        'border-input placeholder:text-muted-foreground flex field-sizing-content min-h-20 w-full rounded-lg border bg-background/80 px-3 py-2 text-sm shadow-none transition-[border-color,background-color] outline-none focus-visible:border-primary focus-visible:bg-background focus-visible:ring-0 disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...props}
    />
  )
}

export { Textarea }
