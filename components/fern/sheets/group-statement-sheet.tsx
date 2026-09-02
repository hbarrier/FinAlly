'use client'

import { useEffect, useState } from 'react'
import { SheetShell } from '../sheet-shell'
import { addDays, todayISO } from '@/lib/dates'
import type { GroupMember } from '@/lib/db-types'

export type GroupStatementSaveData = {
  scope: 'member' | 'group'
  memberId: string | null
  periodFrom: string
  periodTo: string
  dueDate: string | null
  note: string | null
}

interface GroupStatementSheetProps {
  open: boolean
  onClose: () => void
  members: GroupMember[]
  settlementDelayDays: number | null
  onSave: (data: GroupStatementSaveData) => void
}

export function GroupStatementSheet({
  open,
  onClose,
  members,
  settlementDelayDays,
  onSave,
}: GroupStatementSheetProps) {
  const others = members.filter((m) => m.isSelf !== 1)
  const [scope, setScope] = useState<'member' | 'group'>(others.length > 1 ? 'group' : 'member')
  const [memberId, setMemberId] = useState(others[0]?.id ?? '')
  const [periodFrom, setPeriodFrom] = useState('')
  const [periodTo, setPeriodTo] = useState(todayISO())
  const [dueDate, setDueDate] = useState('')
  const [dueTouched, setDueTouched] = useState(false)
  const [note, setNote] = useState('')

  useEffect(() => {
    if (!open) return
    setScope(others.length > 1 ? 'group' : 'member')
    setMemberId(others[0]?.id ?? '')
    setPeriodFrom('')
    setPeriodTo(todayISO())
    setDueDate('')
    setDueTouched(false)
    setNote('')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  // Auto-fill the due date from the group delay until the user edits it.
  useEffect(() => {
    if (dueTouched || settlementDelayDays == null || periodTo.length !== 10) return
    setDueDate(addDays(periodTo, settlementDelayDays))
  }, [periodTo, settlementDelayDays, dueTouched])

  const valid =
    periodFrom.length === 10 &&
    periodTo.length === 10 &&
    periodFrom <= periodTo &&
    (scope === 'group' || memberId !== '')

  const submit = () => {
    onSave({
      scope,
      memberId: scope === 'member' ? memberId : null,
      periodFrom,
      periodTo,
      dueDate: dueDate.length === 10 ? dueDate : null,
      note: note.trim() || null,
    })
    onClose()
  }

  return (
    <SheetShell
      open={open}
      onClose={onClose}
      title="New statement"
      primary={{ label: 'Create', icon: 'check', onClick: submit, disabled: !valid }}
    >
      <div className="fern-type-toggle" style={{ marginBottom: 0 }}>
        <button
          type="button"
          className={scope === 'member' ? 'active' : ''}
          onClick={() => setScope('member')}
        >
          With one member
        </button>
        <button
          type="button"
          className={scope === 'group' ? 'active' : ''}
          onClick={() => setScope('group')}
        >
          Whole group
        </button>
      </div>

      {scope === 'member' && (
        <div>
          <label className="fern-field-label">Member</label>
          <select className="fern-input" value={memberId} onChange={(e) => setMemberId(e.target.value)}>
            {others.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </div>
      )}

      <div style={{ display: 'flex', gap: 10 }}>
        <div style={{ flex: 1 }}>
          <label className="fern-field-label">Period from</label>
          <input
            type="date"
            className="fern-input"
            value={periodFrom}
            onChange={(e) => setPeriodFrom(e.target.value)}
          />
        </div>
        <div style={{ flex: 1 }}>
          <label className="fern-field-label">Period to</label>
          <input
            type="date"
            className="fern-input"
            value={periodTo}
            onChange={(e) => setPeriodTo(e.target.value)}
          />
        </div>
      </div>

      <div>
        <label className="fern-field-label">Due date (optional)</label>
        <input
          type="date"
          className="fern-input"
          value={dueDate}
          onChange={(e) => {
            setDueTouched(true)
            setDueDate(e.target.value)
          }}
        />
      </div>

      <div>
        <label className="fern-field-label">Note</label>
        <input
          className="fern-input"
          placeholder="Optional"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </div>
    </SheetShell>
  )
}
