'use client'

import { useState, useTransition } from 'react'
import { Icon } from '@/components/fern/icon'
import { GoalRing } from '@/components/fern/goal-ring'
import { GoalSheet } from '@/components/fern/sheets/goal-sheet'
import { fmt } from '@/lib/derive'
import { addGoal, updateGoal, deleteGoal } from '@/lib/actions/goals'
import type { InferSelectModel } from 'drizzle-orm'
import type { goals } from '@/lib/schema'

type Goal = InferSelectModel<typeof goals>

interface GoalsClientProps {
  goals: Goal[]
}

export function GoalsClient({ goals: goalsList }: GoalsClientProps) {
  const [editing, setEditing] = useState<string | 'new' | null>(null)
  const [, startTransition] = useTransition()

  const editingItem = editing && editing !== 'new' ? goalsList.find((g) => g.id === editing) : null

  const handleSave = async (data: Parameters<typeof addGoal>[0]) => {
    startTransition(async () => {
      if (editing && editing !== 'new') {
        await updateGoal(editing, data)
      } else {
        await addGoal(data)
      }
    })
    setEditing(null)
  }

  const handleContribute = async (g: Goal) => {
    const add = prompt('Add to this goal (€)', '50')
    const n = Number(add)
    if (n > 0) {
      startTransition(async () => {
        await updateGoal(g.id, { saved: (g.saved ?? 0) + n })
      })
    }
  }

  return (
    <div>
      <div className="fern-page-header">
        <div>
          <div className="fern-page-kicker">Something to aim for</div>
          <h1 className="fern-page-title">Savings <em>goals</em></h1>
        </div>
        <button
          onClick={() => setEditing('new')}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 16px', borderRadius: 12, background: 'var(--terracotta)', color: 'white', border: 'none', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}
        >
          <Icon name="plus" size={16} /> New goal
        </button>
      </div>

      {goalsList.length === 0 ? (
        <div className="fern-empty">
          <div className="illu">☼</div>
          <h3 style={{ fontSize: 18, margin: '0 0 8px' }}>No goals yet</h3>
          <p style={{ margin: 0 }}>A trip, a new bike, an emergency fund — tell Fern what you&apos;re saving toward.</p>
          <button onClick={() => setEditing('new')} style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 10, border: '1.5px solid var(--line)', background: 'transparent', cursor: 'pointer', fontSize: 13, color: 'var(--ink)' }}>
            <Icon name="plus" size={14} /> Create first goal
          </button>
        </div>
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
                    Due {new Date(g.deadline + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
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
                  <button onClick={() => { if (confirm('Delete this goal?')) startTransition(async () => { await deleteGoal(g.id) }) }} style={{ background: 'none', border: '1.5px solid var(--line)', borderRadius: 10, cursor: 'pointer', color: 'var(--ink-soft)', padding: '7px 10px', display: 'grid', placeItems: 'center' }}>
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
