'use client'

interface CashflowRiverProps {
  income: number
  expense: number
  days?: number
}

export function CashflowRiver({ income, expense, days = 30 }: CashflowRiverProps) {
  const w = 520, h = 200
  const padLeft = 4, padRight = 16, padY = 16
  const innerW = w - padLeft - padRight
  const innerH = h - padY * 2
  const zeroY = padY + innerH / 2

  const data: { t: number; i: number; e: number }[] = []
  let ci = 0, ce = 0

  for (let i = 0; i < days; i++) {
    const tphase = i / (days - 1)
    const iDelta = income * (0.6 + 0.8 * Math.sin(tphase * Math.PI * 1.3 + 0.4)) / days
    const eDelta = expense * (0.6 + 0.8 * Math.cos(tphase * Math.PI * 1.1 + 0.8)) / days
    ci += Math.max(0, iDelta)
    ce += Math.max(0, eDelta)
    data.push({ t: tphase, i: ci, e: -ce })
  }

  const maxVal = Math.max(income, expense, 1)
  // positive → above zero (smaller y), negative → below zero (larger y)
  const yScale = (v: number) => zeroY - (v / maxVal) * (innerH / 2)
  const xScale = (t: number) => padLeft + t * innerW

  const line = (key: 'i' | 'e') =>
    data
      .map((d, idx) => {
        const x = xScale(d.t)
        const y = yScale(d[key])
        if (idx === 0) return `M ${x} ${y}`
        const prev = data[idx - 1]
        const px = xScale(prev.t)
        const py = yScale(prev[key])
        const cx = (x + px) / 2
        return `Q ${cx} ${py} ${x} ${y}`
      })
      .join(' ')

  const area = (key: 'i' | 'e') =>
    `${line(key)} L ${xScale(1)} ${zeroY} L ${xScale(0)} ${zeroY} Z`

  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="none"
      style={{ width: '100%', height: 200 }}
    >
      <defs>
        <linearGradient id="river-in" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="var(--sage)" stopOpacity="0.35" />
          <stop offset="100%" stopColor="var(--sage)" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="river-out" x1="0" x2="0" y1="1" y2="0">
          <stop offset="0%" stopColor="var(--rose)" stopOpacity="0.35" />
          <stop offset="100%" stopColor="var(--rose)" stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* Horizontal axis at zero */}
      <line
        x1={padLeft} x2={w - padRight} y1={zeroY} y2={zeroY}
        stroke="var(--line)" strokeWidth="1"
      />

      {/* Income area and line (above zero) */}
      <path d={area('i')} fill="url(#river-in)" />
      <path d={line('i')} stroke="var(--sage)" strokeWidth="2" fill="none" />

      {/* Expense area and line (below zero) */}
      <path d={area('e')} fill="url(#river-out)" />
      <path d={line('e')} stroke="var(--rose)" strokeWidth="2" fill="none" />
    </svg>
  )
}
