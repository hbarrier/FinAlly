import { cn } from '@/lib/utils'

interface ChipProps {
  children: React.ReactNode
  tone?: 'income' | 'expense' | 'recurring' | 'scheduled'
  className?: string
}

export function Chip({ children, tone, className }: ChipProps) {
  return (
    <span className={cn('fern-chip', tone, className)}>
      {children}
    </span>
  )
}
