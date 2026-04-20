import type { ReactNode } from 'react'

interface PageHeaderProps {
  kicker?: ReactNode
  title: ReactNode
  actions?: ReactNode
}

export function PageHeader({ kicker, title, actions }: PageHeaderProps) {
  return (
    <div className="fern-page-header">
      <div>
        {kicker && <div className="fern-page-kicker">{kicker}</div>}
        <h1 className="fern-page-title">{title}</h1>
      </div>
      {actions}
    </div>
  )
}
