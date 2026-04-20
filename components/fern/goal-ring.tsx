import { COLOR_VARS } from './color-vars'

interface GoalRingProps {
  pct: number
  color?: string
  size?: number
}

export function GoalRing({ pct, color = 'sage', size = 120 }: GoalRingProps) {
  const r = size * 0.4
  const cx = size / 2
  const cy = size / 2
  const c = 2 * Math.PI * r
  const dash = c * Math.min(1, pct)
  const solid = COLOR_VARS[color]?.solid ?? 'var(--sage)'

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={cx} cy={cy} r={r} stroke="var(--bg-sunken)" strokeWidth="9" fill="none" />
      <circle
        cx={cx}
        cy={cy}
        r={r}
        stroke={solid}
        strokeWidth="9"
        fill="none"
        strokeLinecap="round"
        strokeDasharray={`${dash} ${c}`}
        transform={`rotate(-90 ${cx} ${cy})`}
        style={{ transition: 'stroke-dasharray .6s' }}
      />
    </svg>
  )
}
