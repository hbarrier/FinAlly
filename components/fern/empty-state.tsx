import type { CSSProperties, ReactNode } from 'react'

interface EmptyStateProps {
  illu?: ReactNode
  title: ReactNode
  description?: ReactNode
  action?: ReactNode
  style?: CSSProperties
}

export function EmptyState({ illu = '◇', title, description, action, style }: EmptyStateProps) {
  return (
    <div className="fern-empty" style={style}>
      <div className="illu">{illu}</div>
      <h3 style={{ fontSize: 18, margin: '0 0 8px' }}>{title}</h3>
      {description && <p style={{ margin: 0 }}>{description}</p>}
      {action}
    </div>
  )
}
