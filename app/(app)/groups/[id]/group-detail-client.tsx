'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Icon } from '@/components/fern/icon'
import { PageHeader } from '@/components/fern/page-header'
import { FernButton } from '@/components/fern/button'
import { EmptyState } from '@/components/fern/empty-state'
import { Money } from '@/components/fern/money'
import { GroupSheet } from '@/components/fern/sheets/group-sheet'
import { GroupMemberSheet } from '@/components/fern/sheets/group-member-sheet'
import { GroupShareScheduleSheet } from '@/components/fern/sheets/group-share-schedule-sheet'
import { GroupEntrySheet } from '@/components/fern/sheets/group-entry-sheet'
import { GroupReimbursementSheet } from '@/components/fern/sheets/group-reimbursement-sheet'
import { GroupStatementSheet } from '@/components/fern/sheets/group-statement-sheet'
import { fmt, signedFmt } from '@/lib/derive'
import { confirmDialog } from '@/lib/dialogs-store'
import { todayISO } from '@/lib/dates'
import { useServerAction } from '@/hooks/use-server-action'
import {
  groupBalanceInput,
  statementBalances,
  statementStatus,
  type GroupBalances,
  type GroupEntryFull,
} from '@/lib/group-math'
import type { GroupDetail } from '@/lib/queries/groups'
import type { Category, GroupMember, GroupReimbursement } from '@/lib/db-types'
import {
  updateGroup,
  setGroupActive,
  deleteGroup,
  addGroupMember,
  updateGroupMember,
  removeGroupMember,
  setGroupShareSchedule,
  deleteGroupSharePeriod,
  addGroupEntry,
  updateGroupEntry,
  deleteGroupEntry,
  addGroupReimbursement,
  updateGroupReimbursement,
  deleteGroupReimbursement,
  createGroupStatement,
  setStatementSettled,
  deleteGroupStatement,
} from '@/lib/actions/groups'

const CARD: React.CSSProperties = { marginBottom: 20 }
const CARD_TITLE: React.CSSProperties = {
  margin: '0 0 14px',
  fontSize: 15,
  fontWeight: 600,
  color: 'var(--ink)',
}

type Period = { startDate: string; endDate: string | null; rows: { memberId: string; percent: number }[] }

function toPeriods(shares: GroupDetail['shares']): Period[] {
  const byStart = new Map<string, Period>()
  for (const s of shares) {
    const p = byStart.get(s.startDate) ?? { startDate: s.startDate, endDate: s.endDate, rows: [] }
    p.rows.push({ memberId: s.memberId, percent: s.percent })
    p.endDate = s.endDate
    byStart.set(s.startDate, p)
  }
  return [...byStart.values()].sort((a, b) => b.startDate.localeCompare(a.startDate))
}

export function GroupDetailClient({
  group,
  balances,
  categories,
}: {
  group: GroupDetail
  balances: GroupBalances
  categories: Category[]
}) {
  const router = useRouter()
  const { run, pending } = useServerAction()
  const [editingGroup, setEditingGroup] = useState(false)
  const [memberSheet, setMemberSheet] = useState<{ item: GroupMember | null } | null>(null)
  const [shareSheet, setShareSheet] = useState(false)
  const [entrySheet, setEntrySheet] = useState<{ item: GroupEntryFull | null } | null>(null)
  const [reimbSheet, setReimbSheet] = useState<{ item: GroupReimbursement | null } | null>(null)
  const [statementSheet, setStatementSheet] = useState(false)

  const selfId = balances.selfId

  const memberName = useMemo(
    () => new Map(group.members.map((m) => [m.id, m.name])),
    [group.members],
  )
  const periods = useMemo(() => toPeriods(group.shares), [group.shares])
  const currentPeriod = periods.find((p) => p.endDate == null) ?? periods[0]
  const active = group.isActive === 1
  const hasActivity = group.entries.length > 0 || group.reimbursements.length > 0

  const youNet = balances.youNet
  const netTone = Math.abs(youNet) < 0.01 ? 'var(--ink-faint)' : youNet > 0 ? 'var(--sage-ink)' : 'var(--rose-ink)'
  const netText =
    Math.abs(youNet) < 0.01 ? 'You are settled up' : youNet > 0 ? 'You are owed' : 'You owe'

  const balanceInput = useMemo(() => groupBalanceInput(group), [group])
  const entries = useMemo(
    () => [...group.entries].sort((a, b) => b.date.localeCompare(a.date)),
    [group.entries],
  )
  const reimbursements = useMemo(
    () => [...group.reimbursements].sort((a, b) => b.date.localeCompare(a.date)),
    [group.reimbursements],
  )
  const today = todayISO()

  const saveEntry = (data: Parameters<typeof addGroupEntry>[1]) =>
    run(() =>
      entrySheet?.item
        ? updateGroupEntry(entrySheet.item.id, data)
        : addGroupEntry(group.id, data),
    )
  const saveReimbursement = (data: Parameters<typeof addGroupReimbursement>[1]) =>
    run(() =>
      reimbSheet?.item
        ? updateGroupReimbursement(reimbSheet.item.id, data)
        : addGroupReimbursement(group.id, data),
    )

  return (
    <div>
      <div style={{ marginBottom: 4 }}>
        <Link href="/groups" style={{ fontSize: 13, color: 'var(--ink-faint)', textDecoration: 'none' }}>
          <Icon name="chevronLeft" size={12} /> Groups
        </Link>
      </div>

      <PageHeader
        kicker={active ? 'Shared expenses' : 'Inactive · read-only'}
        title={<em>{group.name}</em>}
        actions={
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <FernButton tone="outline" onClick={() => setEditingGroup(true)}>
              <Icon name="edit" size={14} /> Edit
            </FernButton>
            <FernButton
              tone="outline"
              disabled={pending}
              onClick={() => run(() => setGroupActive(group.id, !active))}
            >
              {active ? 'Set inactive' : 'Reactivate'}
            </FernButton>
            <FernButton
              tone="danger"
              disabled={pending}
              onClick={async () => {
                if (
                  !(await confirmDialog({
                    message: `Delete group "${group.name}" and everything in it?`,
                    confirmLabel: 'Delete',
                    tone: 'danger',
                  }))
                )
                  return
                run(async () => {
                  await deleteGroup(group.id)
                  router.push('/groups')
                })
              }}
            >
              <Icon name="trash" size={14} /> Delete
            </FernButton>
          </div>
        }
      />

      {group.description && (
        <p style={{ color: 'var(--ink-soft)', fontSize: 13, marginTop: -12, marginBottom: 20 }}>
          {group.description}
        </p>
      )}

      {/* Balances */}
      <div className="fern-card" style={CARD}>
        <h3 style={CARD_TITLE}>Balance</h3>
        {!currentPeriod ? (
          <EmptyState
            illu="%"
            title="No percentage split yet"
            description="Add the members, then set who is responsible for what."
            style={{ padding: '32px 16px' }}
          />
        ) : (
          <>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
              <span style={{ fontSize: 13, color: 'var(--ink-faint)' }}>{netText}</span>
              <span style={{ color: netTone }}>
                <Money amount={Math.abs(youNet)} />
              </span>
            </div>

            {!hasActivity && (
              <p style={{ fontSize: 13, color: 'var(--ink-faint)', marginTop: 10 }}>
                No shared expenses yet. Add one from this page or allocate a movement to this group.
              </p>
            )}

            {group.members.length > 1 && hasActivity && (
              <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 6 }}>
                {balances.balances
                  .filter((b) => b.memberId !== balances.selfId)
                  .map((b) => (
                    <div
                      key={b.memberId}
                      style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}
                    >
                      <span style={{ color: 'var(--ink-soft)' }}>{memberName.get(b.memberId)}</span>
                      <span
                        style={{
                          fontFamily: 'var(--mono-fern)',
                          color: b.net > 0 ? 'var(--sage-ink)' : b.net < 0 ? 'var(--rose-ink)' : 'var(--ink-faint)',
                        }}
                      >
                        {b.net > 0 ? `owed ${fmt(b.net)}` : b.net < 0 ? `owes ${fmt(-b.net)}` : 'settled'}
                      </span>
                    </div>
                  ))}
              </div>
            )}

            {balances.suggestedSettlements.length > 0 && (
              <div style={{ marginTop: 16 }}>
                <div style={{ fontSize: 12, color: 'var(--ink-faint)', marginBottom: 6 }}>
                  Suggested settlements
                </div>
                {balances.suggestedSettlements.map((s, i) => (
                  <div key={i} style={{ fontSize: 13, fontFamily: 'var(--mono-fern)', color: 'var(--ink-soft)' }}>
                    {memberName.get(s.fromMemberId)} → {memberName.get(s.toMemberId)} {fmt(s.amount)}
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* Members */}
      <div className="fern-card" style={CARD}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={CARD_TITLE}>Members</h3>
          {active && (
            <FernButton tone="outline" onClick={() => setMemberSheet({ item: null })}>
              <Icon name="plus" size={14} /> Add member
            </FernButton>
          )}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {group.members.map((m) => {
            const pct = currentPeriod?.rows.find((r) => r.memberId === m.id)?.percent
            return (
              <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 14 }}>
                <span style={{ flex: 1, color: 'var(--ink)' }}>
                  {m.name}
                  {m.isSelf === 1 && (
                    <span style={{ color: 'var(--ink-faint)', fontSize: 12 }}> (you)</span>
                  )}
                </span>
                <span style={{ fontFamily: 'var(--mono-fern)', fontSize: 12, color: 'var(--ink-faint)' }}>
                  {pct != null ? `${pct}%` : '—'}
                </span>
                {active && (
                  <>
                    <button
                      type="button"
                      onClick={() => setMemberSheet({ item: m })}
                      style={iconBtn}
                      aria-label="Rename member"
                    >
                      <Icon name="edit" size={13} />
                    </button>
                    {m.isSelf !== 1 && (
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() => run(() => removeGroupMember(m.id))}
                        style={iconBtn}
                        aria-label="Remove member"
                      >
                        <Icon name="trash" size={13} />
                      </button>
                    )}
                  </>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Share schedule */}
      <div className="fern-card" style={CARD}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={CARD_TITLE}>Percentage split over time</h3>
          {active && group.members.length > 1 && (
            <FernButton tone="outline" onClick={() => setShareSheet(true)}>
              <Icon name="plus" size={14} /> Set new split
            </FernButton>
          )}
        </div>
        {periods.length === 0 ? (
          <p style={{ fontSize: 13, color: 'var(--ink-faint)', margin: 0 }}>
            {group.members.length > 1
              ? 'No split set yet.'
              : 'Add a second member first, then set the split.'}
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {periods.map((p) => (
              <div
                key={p.startDate}
                style={{ borderTop: '1px solid var(--line-soft)', paddingTop: 10, fontSize: 13 }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--ink-soft)' }}>
                  <span>
                    {p.startDate} → {p.endDate ?? 'now'}
                    {p.endDate == null && (
                      <span style={{ color: 'var(--sage-ink)', fontSize: 11 }}> · active</span>
                    )}
                  </span>
                  {active && periods.length > 1 && (
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => run(() => deleteGroupSharePeriod(group.id, p.startDate))}
                      style={iconBtn}
                      aria-label="Delete period"
                    >
                      <Icon name="trash" size={13} />
                    </button>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginTop: 4, fontFamily: 'var(--mono-fern)' }}>
                  {p.rows.map((r) => (
                    <span key={r.memberId} style={{ color: 'var(--ink)' }}>
                      {memberName.get(r.memberId)} {r.percent}%
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Shared items */}
      <div className="fern-card" style={CARD}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={CARD_TITLE}>Shared items</h3>
          {active && (
            <FernButton tone="outline" onClick={() => setEntrySheet({ item: null })}>
              <Icon name="plus" size={14} /> Add
            </FernButton>
          )}
        </div>
        {entries.length === 0 ? (
          <p style={{ fontSize: 13, color: 'var(--ink-faint)', margin: 0 }}>Nothing shared yet.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {entries.map((e) => (
              <button
                key={e.id}
                type="button"
                onClick={() => active && setEntrySheet({ item: e })}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  fontSize: 13,
                  background: 'none',
                  border: 'none',
                  borderTop: '1px solid var(--line-soft)',
                  padding: '8px 0 0',
                  cursor: active ? 'pointer' : 'default',
                  textAlign: 'left',
                  color: 'var(--ink)',
                }}
              >
                <span style={{ color: 'var(--ink-faint)', fontFamily: 'var(--mono-fern)', fontSize: 12 }}>
                  {e.date}
                </span>
                <span style={{ flex: 1 }}>
                  {e.description || (e.direction === 'income' ? 'Shared revenue' : 'Shared expense')}
                  {e.involvesAll === 0 && (
                    <span style={{ color: 'var(--ink-faint)', fontSize: 11 }}> · some members</span>
                  )}
                </span>
                <span style={{ color: 'var(--ink-faint)', fontSize: 12 }}>
                  {memberName.get(e.payerId)} paid
                </span>
                <span style={{ fontFamily: 'var(--mono-fern)' }}>
                  {e.direction === 'income' ? '+' : ''}
                  {fmt(e.amount)}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Reimbursements */}
      {group.members.length > 1 && (
        <div className="fern-card" style={CARD}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={CARD_TITLE}>Reimbursements</h3>
            {active && (
              <FernButton tone="outline" onClick={() => setReimbSheet({ item: null })}>
                <Icon name="plus" size={14} /> Record
              </FernButton>
            )}
          </div>
          {reimbursements.length === 0 ? (
            <p style={{ fontSize: 13, color: 'var(--ink-faint)', margin: 0 }}>
              No money moved between you and a member yet.
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {reimbursements.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => active && setReimbSheet({ item: r })}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    fontSize: 13,
                    background: 'none',
                    border: 'none',
                    borderTop: '1px solid var(--line-soft)',
                    padding: '8px 0 0',
                    cursor: active ? 'pointer' : 'default',
                    textAlign: 'left',
                    color: 'var(--ink)',
                  }}
                >
                  <span style={{ color: 'var(--ink-faint)', fontFamily: 'var(--mono-fern)', fontSize: 12 }}>
                    {r.date}
                  </span>
                  <span style={{ flex: 1 }}>
                    {r.direction === 'paid' ? 'You paid ' : 'From '}
                    {memberName.get(r.memberId)}
                    {r.note ? ` · ${r.note}` : ''}
                  </span>
                  <span
                    style={{
                      fontFamily: 'var(--mono-fern)',
                      color: r.direction === 'received' ? 'var(--sage-ink)' : 'var(--rose-ink)',
                    }}
                  >
                    {signedFmt(r.direction === 'received' ? r.amount : -r.amount)}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Statements */}
      {group.members.length > 1 && (
        <div className="fern-card" style={CARD}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={CARD_TITLE}>Statements</h3>
            {active && (
              <FernButton tone="outline" onClick={() => setStatementSheet(true)}>
                <Icon name="plus" size={14} /> New statement
              </FernButton>
            )}
          </div>
          {group.statements.length === 0 ? (
            <p style={{ fontSize: 13, color: 'var(--ink-faint)', margin: 0 }}>
              No settle-up statements yet.
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[...group.statements]
                .sort((a, b) => b.periodTo.localeCompare(a.periodTo))
                .map((s) => {
                  const win = statementBalances(balanceInput, s.periodFrom, s.periodTo)
                  const amount =
                    s.scope === 'member' && s.memberId
                      ? (win.balances.find((b) => b.memberId === s.memberId)?.net ?? 0)
                      : win.youNet
                  const status = statementStatus(s, today)
                  const label =
                    s.scope === 'member' && s.memberId
                      ? amount < 0
                        ? `${memberName.get(s.memberId)} owes ${fmt(-amount)}`
                        : `You owe ${memberName.get(s.memberId)} ${fmt(amount)}`
                      : win.youNet >= 0
                        ? `You are owed ${fmt(win.youNet)}`
                        : `You owe ${fmt(-win.youNet)}`
                  return (
                    <div
                      key={s.id}
                      style={{ borderTop: '1px solid var(--line-soft)', paddingTop: 10, fontSize: 13 }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ color: 'var(--ink-soft)' }}>
                          {s.scope === 'member' && s.memberId
                            ? `With ${memberName.get(s.memberId)}`
                            : 'Whole group'}{' '}
                          · {s.periodFrom} → {s.periodTo}
                        </span>
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                          <span style={{ fontSize: 11, color: statusColor(status.tone) }}>{status.label}</span>
                          {active && (
                            <>
                              <button
                                type="button"
                                disabled={pending}
                                onClick={() => run(() => setStatementSettled(s.id, !s.settledAt))}
                                style={{ ...iconBtn, fontSize: 11, width: 'auto', padding: '2px 6px' }}
                              >
                                {s.settledAt ? 'Reopen' : 'Settle'}
                              </button>
                              <button
                                type="button"
                                disabled={pending}
                                onClick={() => run(() => deleteGroupStatement(s.id))}
                                style={iconBtn}
                                aria-label="Delete statement"
                              >
                                <Icon name="trash" size={13} />
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                      <div style={{ marginTop: 4, fontFamily: 'var(--mono-fern)', color: 'var(--ink)' }}>
                        {label}
                        {s.dueDate && !s.settledAt && (
                          <span style={{ color: 'var(--ink-faint)', fontSize: 11 }}> · due {s.dueDate}</span>
                        )}
                      </div>
                      {s.note && (
                        <div style={{ fontSize: 11, color: 'var(--ink-faint)', marginTop: 2 }}>{s.note}</div>
                      )}
                    </div>
                  )
                })}
            </div>
          )}
        </div>
      )}

      <GroupSheet
        open={editingGroup}
        onClose={() => setEditingGroup(false)}
        item={group}
        onSave={(data) => run(() => updateGroup(group.id, data))}
      />

      <GroupMemberSheet
        open={memberSheet !== null}
        onClose={() => setMemberSheet(null)}
        item={memberSheet?.item ?? null}
        onSave={(name) =>
          run(() =>
            memberSheet?.item
              ? updateGroupMember(memberSheet.item.id, name)
              : addGroupMember(group.id, name),
          )
        }
      />

      <GroupShareScheduleSheet
        open={shareSheet}
        onClose={() => setShareSheet(false)}
        members={group.members}
        initial={currentPeriod?.rows}
        onSave={(date, shares) => run(() => setGroupShareSchedule(group.id, date, shares))}
      />

      <GroupEntrySheet
        open={entrySheet !== null}
        onClose={() => setEntrySheet(null)}
        members={group.members}
        categories={categories}
        selfId={selfId}
        item={entrySheet?.item ?? null}
        linkedMeta={
          entrySheet?.item?.transactionId
            ? group.linkedTx[entrySheet.item.transactionId] ?? null
            : null
        }
        onSave={saveEntry}
        onDelete={
          entrySheet?.item ? () => run(() => deleteGroupEntry(entrySheet.item!.id)) : undefined
        }
      />

      <GroupReimbursementSheet
        open={reimbSheet !== null}
        onClose={() => setReimbSheet(null)}
        members={group.members}
        categories={categories}
        statements={group.statements}
        item={reimbSheet?.item ?? null}
        linkedMeta={
          reimbSheet?.item?.transactionId
            ? group.linkedTx[reimbSheet.item.transactionId] ?? null
            : null
        }
        onSave={saveReimbursement}
        onDelete={
          reimbSheet?.item
            ? () => run(() => deleteGroupReimbursement(reimbSheet.item!.id))
            : undefined
        }
      />

      <GroupStatementSheet
        open={statementSheet}
        onClose={() => setStatementSheet(false)}
        members={group.members}
        settlementDelayDays={group.settlementDelayDays}
        onSave={(data) => run(() => createGroupStatement(group.id, data))}
      />
    </div>
  )
}

function statusColor(tone: 'green' | 'orange' | 'red' | 'neutral'): string {
  return tone === 'green'
    ? 'var(--sage-ink)'
    : tone === 'orange'
      ? 'var(--amber-ink, #b45309)'
      : tone === 'red'
        ? 'var(--rose-ink)'
        : 'var(--ink-faint)'
}

const iconBtn: React.CSSProperties = {
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  color: 'var(--ink-faint)',
  padding: 3,
  display: 'grid',
  placeItems: 'center',
  borderRadius: 6,
}
