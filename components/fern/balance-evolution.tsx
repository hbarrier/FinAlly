'use client'

import { useId, useMemo } from 'react'

interface BalanceEvolutionProps {
  series: number[] // length >= 2 (day 1..N or day 0..N)
  tone?: 'ok' | 'warn'
  height?: number
}

export function BalanceEvolution({ series, tone = 'ok', height = 200 }: BalanceEvolutionProps) {
  const gradId = useId()
  const grad = `bal-grad-${gradId}`

  const { path, area, w, h, padX, padY } = useMemo(() => {
    const w = 520
    const h = height
    const padX = 8
    const padY = 16
    const innerW = w - padX * 2
    const innerH = h - padY * 2

    const min = Math.min(...series)
    const max = Math.max(...series)
    const span = Math.max(1, max - min)

    const xScale = (i: number) => padX + (i / (series.length - 1)) * innerW
    const yScale = (v: number) => padY + (1 - (v - min) / span) * innerH

    const pts = series.map((v, i) => ({ x: xScale(i), y: yScale(v) }))
    const path = pts
      .map((p, i) => (i === 0 ? `M ${p.x} ${p.y}` : `L ${p.x} ${p.y}`))
      .join(' ')

    const area = `${path} L ${xScale(series.length - 1)} ${padY + innerH} L ${xScale(0)} ${padY + innerH} Z`

    return { path, area, w, h, padX, padY }
  }, [series, height])

  const stroke = tone === 'ok' ? 'var(--sage)' : 'var(--ink-faint)'
  const fillStop = tone === 'ok' ? 'var(--sage)' : 'var(--ink-soft)'

  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" style={{ width: '100%', height }}>
      <defs>
        <linearGradient id={grad} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={fillStop} stopOpacity="0.28" />
          <stop offset="100%" stopColor={fillStop} stopOpacity="0" />
        </linearGradient>
      </defs>

      <path d={area} fill={`url(#${grad})`} />
      <path d={path} stroke={stroke} strokeWidth="2" fill="none" />
    </svg>
  )
}

