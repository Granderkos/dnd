import { ReactNode } from 'react'

export function PageShell({ children, width = 'max-w-4xl' }: { children: ReactNode; width?: string }) {
  return <div className={`mx-auto w-full ${width}`}>{children}</div>
}
