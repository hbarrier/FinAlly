'use client'

import { useEffect, useState } from 'react'
import { SheetShell } from '../sheet-shell'
import { parseDecimal } from '@/lib/utils'
import { todayISO } from '@/lib/dates'
import type { GroupMember } from '@/lib/db-types'

interface GroupShareScheduleSheetProps {
  open: boolean
  onClose: () => void
  members: GroupMember[]
  /** Percentages to pre-fill (e.g. the currently active period). */
  initial?: { memberId: string; percent: number }[]
  defaultDate?: string
  onSave: (effectiveDate: string, shares: { memberId: string; percent: number }[]) => void
}

export function GroupShareScheduleSheet({
  open,
  onClose,
  members,
  initial,
  defaultDate,
  onSave,
}: GroupShareScheduleSheetProps) {
  const [date, setDate] = useState(defaultDate ?? todayISO())
  const [values, setValues] = useState<Record<string, string>>({})

  useEffect(() => {
    if (!open) return
    setDate(defaultDate ?? todayISO())
    const seed: Record<string, string> = {}
    for (const m of members) {
      const found = initial?.find((i) => i.memberId === m.id)
      seed[m.id] = found ? String(found.percent) : ''
    }
    setValues(seed)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const parsed = members.map((m) => ({ member: m, percent: parseDecimal(values[m.id] ?? '') || 0 }))
  const total = parsed.reduce((s, p) => s + p.percent, 0)
  const valid = date.length === 10 && Math.abs(total - 100) < 0.01

  const submit = () => {
    onSave(
      date,
      parsed.map((p) => ({ memberId: p.member.id, percent: p.percent })),
    )
    onClose()
  }

  return (
    <SheetShell
      open={open}
      onClose={onClose}
      title="Set percentage split"
      primary={{ label: 'Save', icon: 'check', onClick: submit, disabled: !valid }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <label className="fern-field-label">Effective from</label>
        <input
          type="date"
          className="fern-input"
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />
        <span style={{ fontSize: 12, color: 'var(--ink-faint)' }}>
          The current split is closed the day before this date.
        </span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 8 }}>
        {members.map((m) => (
          <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ flex: 1, fontSize: 14, color: 'var(--ink)' }}>
              {m.name}
              {m.isSelf === 1 && (
                <span style={{ color: 'var(--ink-faint)', fontSize: 12 }}> (you)</span>
              )}
            </span>
            <input
              className="fern-input"
              inputMode="decimal"
              style={{ width: 90, textAlign: 'right' }}
              placeholder="0"
              value={values[m.id] ?? ''}
              onChange={(e) => setValues((v) => ({ ...v, [m.id]: e.target.value }))}
            />
            <span style={{ color: 'var(--ink-faint)', width: 14 }}>%</span>
          </div>
        ))}
      </div>

      <div
        style={{
          marginTop: 10,
          fontSize: 13,
          fontFamily: 'var(--mono-fern)',
          color: Math.abs(total - 100) < 0.01 ? 'var(--sage-ink)' : 'var(--rose-ink)',
        }}
      >
        Total: {total}% {Math.abs(total - 100) < 0.01 ? '' : '(must be 100%)'}
      </div>
    </SheetShell>
  )
}
