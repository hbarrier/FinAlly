'use client'

import { useEffect, useMemo, useState } from 'react'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Field } from '@/components/ui/field'
import { Icon } from '../icon'
import { SearchableSelect } from '../searchable-select'
import { fmt, type Transaction } from '@/lib/derive'
import type { GroupDetail, MovementGroupLink } from '@/lib/queries/groups'

export type AllocateInput = {
  groupId: string
  involvesAll: boolean
  participantMemberIds: string[]
}

interface GroupAllocationSheetProps {
  open: boolean
  onClose: () => void
  transaction: Transaction
  groups: GroupDetail[]
  currentLink: MovementGroupLink | null
  onAllocate: (input: AllocateInput) => void
  onUnallocate: () => void
}

export function GroupAllocationSheet({
  open,
  onClose,
  transaction,
  groups,
  currentLink,
  onAllocate,
  onUnallocate,
}: GroupAllocationSheetProps) {
  const isExpense = transaction.kind === 'expense'
  const [groupId, setGroupId] = useState<string | null>(null)
  const [involvesAll, setInvolvesAll] = useState(true)
  const [participants, setParticipants] = useState<Set<string>>(new Set())

  const selectedGroup = useMemo(
    () => groups.find((g) => g.id === groupId) ?? null,
    [groups, groupId],
  )

  useEffect(() => {
    if (!open) return
    setGroupId(null)
    setInvolvesAll(true)
    setParticipants(new Set())
  }, [open])

  useEffect(() => {
    setParticipants(new Set(selectedGroup?.members.map((m) => m.id) ?? []))
  }, [selectedGroup])

  const kindColor = isExpense ? 'var(--rose-ink)' : 'var(--sage-ink)'
  const kindBg = isExpense ? 'var(--rose-bg)' : 'var(--sage-bg)'

  const canSubmit = groupId != null && (involvesAll || participants.size > 0)

  const submit = () => {
    if (!groupId) return
    onAllocate({
      groupId,
      involvesAll,
      participantMemberIds: involvesAll ? [] : [...participants],
    })
    onClose()
  }

  const toggleParticipant = (id: string) =>
    setParticipants((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="right" className="fern-sheet-content">
        <SheetHeader>
          <SheetTitle className="fern-sheet-title">Allocate to a group</SheetTitle>
        </SheetHeader>

        <div className="fern-sheet-body">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderRadius: 10, background: 'var(--bg-sunken)' }}>
            <span style={{ fontFamily: 'var(--mono-fern)', fontWeight: 700, fontSize: 15, color: kindColor }}>
              {isExpense ? '−' : '+'}{fmt(Math.abs(Number(transaction.amount)))}
            </span>
            <span style={{ fontSize: 12, color: 'var(--ink-faint)' }}>·</span>
            <span style={{ fontSize: 12, color: 'var(--ink-soft)' }}>{transaction.date}</span>
            {transaction.note && (
              <span style={{ fontSize: 12, color: 'var(--ink-faint)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                · {transaction.note}
              </span>
            )}
            <span style={{ marginLeft: 'auto', fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 6, background: kindBg, color: kindColor, textTransform: 'capitalize' }}>
              {transaction.kind}
            </span>
          </div>

          {currentLink ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ padding: '12px 14px', borderRadius: 10, background: 'var(--bg-sunken)', display: 'flex', alignItems: 'center', gap: 10 }}>
                <Icon name="users" size={16} style={{ color: 'var(--teal-ink)', flexShrink: 0 }} />
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>{currentLink.groupName}</div>
                  <div style={{ fontSize: 12, color: 'var(--ink-faint)', marginTop: 2 }}>Shared item</div>
                </div>
              </div>
              <p style={{ margin: 0, fontSize: 13, color: 'var(--ink-soft)' }}>
                This movement is allocated to a group. Unallocating removes the group entry; the
                movement itself is untouched.
              </p>
              <button
                type="button"
                onClick={() => { onUnallocate(); onClose() }}
                className="fern-btn danger"
                style={{ padding: '10px 14px', borderRadius: 10, fontSize: 13 }}
              >
                <Icon name="x" size={14} /> Unallocate
              </button>
            </div>
          ) : groups.length === 0 ? (
            <p style={{ margin: 0, fontSize: 13, color: 'var(--ink-faint)', textAlign: 'center', padding: '20px 0' }}>
              No active groups. Create one first.
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <Field>
                <label className="fern-field-label">Group</label>
                <SearchableSelect
                  value={groupId}
                  onChange={setGroupId}
                  options={groups.map((g) => ({ value: g.id, label: g.name }))}
                  placeholder="Choose a group…"
                />
              </Field>

              {selectedGroup && (
                <div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13 }}>
                    <input type="checkbox" checked={involvesAll} onChange={(e) => setInvolvesAll(e.target.checked)} />
                    Everyone is involved
                  </label>
                  {!involvesAll && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8, marginLeft: 4 }}>
                      {selectedGroup.members.map((m) => (
                        <label key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13 }}>
                          <input type="checkbox" checked={participants.has(m.id)} onChange={() => toggleParticipant(m.id)} />
                          {m.name}{m.isSelf === 1 ? ' (you)' : ''}
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div className="fern-sheet-footer" style={{ marginTop: 0 }}>
                <button type="button" onClick={onClose} className="fern-btn sheet-secondary">Cancel</button>
                <button
                  type="button"
                  onClick={submit}
                  disabled={!canSubmit}
                  className="fern-btn sheet-primary primary"
                >
                  <Icon name="check" size={16} /> Allocate
                </button>
              </div>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
