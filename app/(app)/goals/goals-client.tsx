'use client'

import { useState, useTransition } from 'react'
import { Icon } from '@/components/fern/icon'
import { GoalRing } from '@/components/fern/goal-ring'
import { GoalSheet } from '@/components/fern/sheets/goal-sheet'
import { PageHeader } from '@/components/fern/page-header'
import { FernButton } from '@/components/fern/button'
import { EmptyState } from '@/components/fern/empty-state'
import { fmt, formatDate } from '@/lib/derive'
import { addGoal, updateGoal, deleteGoal } from '@/lib/actions/goals'
import { runAction } from '@/lib/utils'
import type { Goal } from '@/lib/db-types'

interface GoalsClientProps {
  goals: Goal[]
}

export function GoalsClient({ goals: goalsList }: GoalsClientProps) {
  const [editing, setEditing] = useState<string | 'new' | null>(null)
  const [, startTransition] = useTransition()

  const editingItem = editing && editing !== 'new' ? goalsList.find((g) => g.id === editing) : null

  const handleSave = async (data: Parameters<typeof addGoal>[0]) => {
    startTransition(runAction(async () => {
      if (editing && editing !== 'new') {
        await updateGoal(editing, data)
      } else {
        await addGoal(data)
      }
    }))
    setEditing(null)
  }

  const handleContribute = async (g: Goal) => {
    const add = prompt('Add to this goal (€)', '50')
    const n = Number(add)
    if (n > 0) {
      startTransition(runAction(async () => {
        await updateGoal(g.id, { saved: (g.saved ?? 0) + n })
      }))
    }
  }

  return (
    <div>
      <PageHeader
        kicker="Something to aim for"
        title={<>Savings <em>goals</em></>}
        actions={
          <FernButton onClick={() => setEditing('new')}>
            <Icon name="plus" size={16} /> New goal
          </FernButton>
        }
      />

      {goalsList.length === 0 ? (
        <EmptyState
          illu="☼"
          title="No goals yet"
          description={<>A trip, a new bike, an emergency fund — tell Fern what you&apos;re saving toward.</>}
          action={
            <FernButton
              tone="outline"
              onClick={() => setEditing('new')}
              style={{ marginTop: 12, padding: '8px 14px', borderRadius: 10, fontSize: 13, background: 'transparent', color: 'var(--ink)' }}
            >
              <Icon name="plus" size={14} /> Create first goal
            </FernButton>
          }
        />
      ) : (
        <div className="fern-goals-grid">
          {goalsList.map((g) => {
            const pct = (g.saved ?? 0) / (g.target ?? 1)
            return (
              <div key={g.id} className="fern-goal-card">
                <div style={{ position: 'relative', width: 100, height: 100 }}>
                  <GoalRing pct={pct} color={g.color} size={100} />
                  <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }}>
                    <Icon name={g.icon ?? 'cat-seed'} size={28} style={{ color: 'var(--ink-soft)' }} />
                  </div>
                </div>
                <h4 style={{ margin: '12px 0 4px', fontSize: 15, fontWeight: 600, color: 'var(--ink)' }}>{g.name}</h4>
                <div style={{ fontSize: 12, color: 'var(--ink-faint)', marginBottom: 12 }}>
                  {fmt(g.saved ?? 0)} of {fmt(g.target)} · {(pct * 100).toFixed(0)}%
                </div>
                {g.deadline && (
                  <div style={{ fontSize: 11, color: 'var(--ink-faint)', marginBottom: 12, fontFamily: 'var(--mono-fern)' }}>
                    Due {formatDate(g.deadline + 'T12:00:00', 'en-US', { month: 'short', year: 'numeric' })}
                  </div>
                )}
                <div style={{ width: '100%', height: 1, background: 'var(--line-soft)', margin: '0 0 12px' }} />
                <div style={{ display: 'flex', gap: 6, width: '100%' }}>
                  <button
                    onClick={() => handleContribute(g)}
                    style={{ flex: 1, fontSize: 12, padding: '7px 10px', borderRadius: 10, border: '1.5px solid var(--line)', background: 'transparent', cursor: 'pointer', color: 'var(--ink)', fontWeight: 500 }}
                  >
                    + Contribute
                  </button>
                  <button onClick={() => setEditing(g.id)} style={{ background: 'none', border: '1.5px solid var(--line)', borderRadius: 10, cursor: 'pointer', color: 'var(--ink-soft)', padding: '7px 10px', display: 'grid', placeItems: 'center' }}>
                    <Icon name="edit" size={14} />
                  </button>
                  <button onClick={() => { if (confirm('Delete this goal?')) startTransition(runAction(async () => { await deleteGoal(g.id) })) }} style={{ background: 'none', border: '1.5px solid var(--line)', borderRadius: 10, cursor: 'pointer', color: 'var(--ink-soft)', padding: '7px 10px', display: 'grid', placeItems: 'center' }}>
                    <Icon name="trash" size={14} />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <GoalSheet
        open={!!editing}
        onClose={() => setEditing(null)}
        item={editingItem ?? null}
        onSave={handleSave}
      />
    </div>
  )
}
