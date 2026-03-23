import { ReactNode } from 'react'

export function PageShell({ children, width = 'max-w-2xl', className = '' }: { children: ReactNode; width?: string; className?: string }) {
  return <div className={`mx-auto w-full ${width} ${className}`.trim()}>{children}</div>
}
