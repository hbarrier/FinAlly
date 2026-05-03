'use client'

import { useState, useRef, useTransition } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { SearchableSelect } from '@/components/fern/searchable-select'
import { Icon } from '@/components/fern/icon'
import { importTransactions, type MerchantMappingPayload, type ImportRow } from '@/lib/actions/import'
import type { RecurringWithAmounts } from '@/lib/derive'
import type { Merchant } from '@/lib/db-types'

interface ImportWizardProps {
  open: boolean
  onClose: () => void
  merchants: Merchant[]
  recurring: RecurringWithAmounts[]
}

// ─── CSV parsing ───────────────────────────────────────────────────────────

type ParsedRow = {
  merchantName: string
  date: string
  amount: number
}

function parseCSVLine(line: string): string[] {
  const cols: string[] = []
  let inQuote = false
  let cur = ''
  // detect delimiter: semicolon or comma
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      inQuote = !inQuote
    } else if ((ch === ',' || ch === ';') && !inQuote) {
      cols.push(cur)
      cur = ''
    } else {
      cur += ch
    }
  }
  cols.push(cur)
  return cols
}

function parseDate(raw: string): string | null {
  const s = raw.trim()
  // ISO YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s
  // DD/MM/YYYY or DD.MM.YYYY (European/French default)
  const dmy = s.match(/^(\d{1,2})[\/.](\d{1,2})[\/.](\d{4})$/)
  if (dmy) {
    const [, d, m, y] = dmy
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
  }
  return null
}

function parseCSV(text: string): ParsedRow[] {
  const lines = text.trim().split(/\r?\n/)
  const rows: ParsedRow[] = []

  for (const line of lines) {
    if (!line.trim()) continue
    const cols = parseCSVLine(line)
    const merchantName = cols[0]?.trim().replace(/^"|"$/g, '')
    const dateRaw = cols[1]?.trim().replace(/^"|"$/g, '')
    const amountRaw = cols[2]?.trim().replace(/^"|"$/g, '')

    if (!merchantName || !dateRaw || !amountRaw) continue

    const date = parseDate(dateRaw)
    if (!date) continue // skip header rows or unparseable dates

    const amount = parseFloat(amountRaw.replace(',', '.').replace(/[^\d.-]/g, ''))
    if (isNaN(amount) || amount <= 0) continue

    rows.push({ merchantName, date, amount })
  }

  return rows
}

// ─── Merchant mapping state ─────────────────────────────────────────────────

type MerchantState = {
  csvName: string
  // 'new:same' | 'new:custom' | 'existing:{id}'
  selectValue: string
  customName: string
  recurringId: string | null
}

function buildMerchantStates(
  uniqueNames: string[],
  existingMerchants: Merchant[],
): MerchantState[] {
  return uniqueNames.map((csvName) => {
    const match = existingMerchants.find(
      (m) => m.name.toLowerCase() === csvName.toLowerCase(),
    )
    return {
      csvName,
      selectValue: match ? `existing:${match.id}` : 'new:same',
      customName: csvName,
      recurringId: null,
    }
  })
}

function autoSuggestRecurring(csvName: string, recurring: RecurringWithAmounts[]): string | null {
  const lower = csvName.toLowerCase()
  const match = recurring.find(
    (r) =>
      r.kind === 'expense' &&
      (r.name.toLowerCase().includes(lower) || lower.includes(r.name.toLowerCase())),
  )
  return match?.id ?? null
}

// ─── Shared styles ───────────────────────────────────────────────────────────

const label: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  color: 'var(--ink-soft)',
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
}

const pill: React.CSSProperties = {
  display: 'inline-block',
  padding: '2px 8px',
  borderRadius: 20,
  fontSize: 11,
  fontWeight: 600,
  background: 'var(--bg-sunken)',
  color: 'var(--ink-soft)',
}

const stepBtn = (active: boolean): React.CSSProperties => ({
  flex: 1,
  padding: '10px 16px',
  borderRadius: 10,
  border: 'none',
  fontSize: 13,
  fontWeight: 600,
  cursor: 'pointer',
  background: active ? 'var(--terracotta)' : 'var(--bg-sunken)',
  color: active ? 'white' : 'var(--ink-soft)',
})

// ─── Component ───────────────────────────────────────────────────────────────

export function ImportWizard({
  open,
  onClose,
  merchants: existingMerchants,
  recurring,
}: ImportWizardProps) {
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([])
  const [merchantStates, setMerchantStates] = useState<MerchantState[]>([])
  const [fileName, setFileName] = useState('')
  const [error, setError] = useState('')
  const [isPending, startTransition] = useTransition()
  const fileRef = useRef<HTMLInputElement>(null)

  const reset = () => {
    setStep(1)
    setParsedRows([])
    setMerchantStates([])
    setFileName('')
    setError('')
    if (fileRef.current) fileRef.current.value = ''
  }

  const handleClose = () => {
    reset()
    onClose()
  }

  // Step 1 — parse file
  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setError('')
    setFileName(file.name)
    const reader = new FileReader()
    reader.onload = (ev) => {
      const text = ev.target?.result as string
      const rows = parseCSV(text)
      if (rows.length === 0) {
        setError('No valid rows found. Make sure the file has merchant (A), date (B), and amount (C) columns.')
        return
      }
      setParsedRows(rows)
    }
    reader.readAsText(file)
  }

  const goToStep2 = () => {
    const uniqueNames = [...new Set(parsedRows.map((r) => r.merchantName))]
    const states = buildMerchantStates(uniqueNames, existingMerchants)
    // auto-suggest recurring
    const withRecurring = states.map((s) => ({
      ...s,
      recurringId: autoSuggestRecurring(s.csvName, recurring),
    }))
    setMerchantStates(withRecurring)
    setStep(2)
  }

  const updateMerchant = (csvName: string, patch: Partial<MerchantState>) => {
    setMerchantStates((prev) =>
      prev.map((s) => (s.csvName === csvName ? { ...s, ...patch } : s)),
    )
  }

  // Build options for the merchant-mapping select
  const merchantSelectOptions = (csvName: string) => [
    { value: 'new:same', label: `Create "${csvName}"` },
    { value: 'new:custom', label: 'Create with different name…' },
    ...existingMerchants
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((m) => ({ value: `existing:${m.id}`, label: m.name, group: 'Existing merchants' })),
  ]

  // Recurring options
  const recurringOptions = recurring
    .filter((r) => r.kind === 'expense')
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((r) => ({ value: r.id, label: r.name }))

  // Step 3 — import
  const handleImport = () => {
    const mappings: MerchantMappingPayload[] = merchantStates.map((s) => {
      if (s.selectValue === 'new:same') {
        return { csvName: s.csvName, action: 'create-same', existingMerchantId: null, customName: s.csvName, recurringId: s.recurringId }
      } else if (s.selectValue === 'new:custom') {
        return { csvName: s.csvName, action: 'create-custom', existingMerchantId: null, customName: s.customName, recurringId: s.recurringId }
      } else {
        const id = s.selectValue.replace('existing:', '')
        return { csvName: s.csvName, action: 'map-existing', existingMerchantId: id, customName: '', recurringId: s.recurringId }
      }
    })

    const rows: ImportRow[] = parsedRows.map((r) => ({
      merchantCsvName: r.merchantName,
      date: r.date,
      amount: r.amount,
    }))

    startTransition(async () => {
      await importTransactions({ merchantMappings: mappings, rows })
      handleClose()
    })
  }

  const newMerchantCount = merchantStates.filter(
    (s) => s.selectValue === 'new:same' || s.selectValue === 'new:custom',
  ).length

  // Step indicator
  const stepLabel = step === 1 ? 'Upload file' : step === 2 ? 'Map merchants' : 'Link recurring'

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent
        showCloseButton
        style={{ maxWidth: 660, background: 'var(--bg-elevated)', border: 'none', padding: 0, gap: 0 }}
      >
        <DialogHeader style={{ padding: '20px 24px 16px', borderBottom: '1px solid var(--line-soft)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Icon name="upload" size={16} style={{ color: 'var(--ink-soft)' }} />
            <DialogTitle style={{ color: 'var(--ink)', fontSize: 15, fontWeight: 700 }}>
              Import CSV
            </DialogTitle>
            <span style={{ ...pill, marginLeft: 4 }}>Step {step}/3 — {stepLabel}</span>
          </div>
        </DialogHeader>

        <div style={{ padding: '20px 24px', maxHeight: '65vh', overflowY: 'auto' }}>

          {/* ── Step 1: Upload ── */}
          {step === 1 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <p style={{ margin: 0, fontSize: 13, color: 'var(--ink-soft)', lineHeight: 1.6 }}>
                Export your spreadsheet as <strong>.csv</strong> (File → Save As → CSV).
                The file must have: <strong>A</strong> = merchant name, <strong>B</strong> = date, <strong>C</strong> = amount.
              </p>

              <label
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 8,
                  padding: '32px 24px',
                  borderRadius: 12,
                  border: '2px dashed var(--line)',
                  background: 'var(--bg-sunken)',
                  cursor: 'pointer',
                  transition: 'border-color 0.15s',
                }}
              >
                <Icon name="fileText" size={28} style={{ color: 'var(--ink-faint)' }} />
                <span style={{ fontSize: 13, color: 'var(--ink-soft)', fontWeight: 600 }}>
                  {fileName || 'Click to choose a CSV file'}
                </span>
                {fileName && parsedRows.length > 0 && (
                  <span style={{ fontSize: 12, color: 'var(--sage-ink)' }}>
                    {parsedRows.length} rows parsed
                  </span>
                )}
                <input
                  ref={fileRef}
                  type="file"
                  accept=".csv,text/csv"
                  style={{ display: 'none' }}
                  onChange={handleFile}
                />
              </label>

              {error && (
                <p style={{ margin: 0, fontSize: 12, color: 'var(--rose-ink)', padding: '10px 14px', background: 'var(--rose-bg)', borderRadius: 8 }}>
                  {error}
                </p>
              )}

              {parsedRows.length > 0 && (
                <div>
                  <p style={{ ...label, marginBottom: 8 }}>Preview (first 5 rows)</p>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--line)' }}>
                        {['Merchant', 'Date', 'Amount'].map((h) => (
                          <th key={h} style={{ textAlign: 'left', padding: '6px 8px', color: 'var(--ink-soft)', fontWeight: 600, fontSize: 11 }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {parsedRows.slice(0, 5).map((r, i) => (
                        <tr key={i} style={{ borderBottom: '1px solid var(--line-soft)' }}>
                          <td style={{ padding: '6px 8px', color: 'var(--ink)' }}>{r.merchantName}</td>
                          <td style={{ padding: '6px 8px', color: 'var(--ink-soft)', fontFamily: 'var(--mono-fern)' }}>{r.date}</td>
                          <td style={{ padding: '6px 8px', color: 'var(--ink-soft)', fontFamily: 'var(--mono-fern)' }}>{r.amount.toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {parsedRows.length > 5 && (
                    <p style={{ margin: '6px 0 0 8px', fontSize: 11, color: 'var(--ink-faint)' }}>
                      + {parsedRows.length - 5} more rows
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ── Step 2: Merchant mapping ── */}
          {step === 2 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <p style={{ margin: 0, fontSize: 13, color: 'var(--ink-soft)', lineHeight: 1.6 }}>
                Map each merchant from your file to an existing one, or create a new entry.
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, paddingBottom: 4, borderBottom: '1px solid var(--line)' }}>
                <span style={label}>From file</span>
                <span style={label}>Map to</span>
              </div>
              {merchantStates.map((s) => (
                <div key={s.csvName} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, alignItems: 'center' }}>
                    <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {s.csvName}
                    </span>
                    <SearchableSelect
                      value={s.selectValue}
                      onChange={(v) => updateMerchant(s.csvName, { selectValue: v ?? 'new:same', customName: s.csvName })}
                      options={merchantSelectOptions(s.csvName)}
                      placeholder="Choose…"
                    />
                  </div>
                  {s.selectValue === 'new:custom' && (
                    <div style={{ paddingLeft: '50%' }}>
                      <input
                        className="fern-input"
                        placeholder="New merchant name"
                        value={s.customName}
                        onChange={(e) => updateMerchant(s.csvName, { customName: e.target.value })}
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* ── Step 3: Recurring mapping ── */}
          {step === 3 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <p style={{ margin: 0, fontSize: 13, color: 'var(--ink-soft)', lineHeight: 1.6 }}>
                Optionally link each merchant to a recurring expense. Leave blank to skip.
              </p>
              {recurringOptions.length === 0 ? (
                <p style={{ fontSize: 13, color: 'var(--ink-faint)', fontStyle: 'italic' }}>
                  No recurring expenses defined yet — you can link later.
                </p>
              ) : (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, paddingBottom: 4, borderBottom: '1px solid var(--line)' }}>
                    <span style={label}>Merchant</span>
                    <span style={label}>Recurring expense</span>
                  </div>
                  {merchantStates.map((s) => {
                    const resolvedName = s.selectValue === 'new:custom'
                      ? s.customName
                      : s.selectValue === 'new:same'
                        ? s.csvName
                        : existingMerchants.find((m) => `existing:${m.id}` === s.selectValue)?.name ?? s.csvName

                    return (
                      <div key={s.csvName} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, alignItems: 'center' }}>
                        <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {resolvedName}
                        </span>
                        <SearchableSelect
                          value={s.recurringId}
                          onChange={(v) => updateMerchant(s.csvName, { recurringId: v })}
                          options={recurringOptions}
                          placeholder="None"
                          nullable
                          nullLabel="No recurring link"
                        />
                      </div>
                    )
                  })}
                </>
              )}

              {/* Summary */}
              <div style={{ marginTop: 8, padding: '14px 16px', borderRadius: 10, background: 'var(--bg-sunken)', display: 'flex', flexDirection: 'column', gap: 4 }}>
                <div style={{ fontSize: 13, color: 'var(--ink)', fontWeight: 600 }}>
                  Ready to import
                </div>
                <div style={{ fontSize: 12, color: 'var(--ink-soft)' }}>
                  {parsedRows.length} transaction{parsedRows.length !== 1 ? 's' : ''}, all marked as cleared
                </div>
                {newMerchantCount > 0 && (
                  <div style={{ fontSize: 12, color: 'var(--ink-soft)' }}>
                    {newMerchantCount} new merchant{newMerchantCount !== 1 ? 's' : ''} will be created
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer nav */}
        <div style={{ display: 'flex', gap: 8, padding: '16px 24px', borderTop: '1px solid var(--line-soft)' }}>
          {step > 1 && (
            <button
              type="button"
              onClick={() => setStep((s) => (s - 1) as 1 | 2 | 3)}
              style={{ padding: '10px 16px', borderRadius: 10, border: 'none', fontSize: 13, fontWeight: 600, cursor: 'pointer', background: 'var(--bg-sunken)', color: 'var(--ink-soft)', display: 'flex', alignItems: 'center', gap: 6 }}
            >
              <Icon name="chevronLeft" size={14} /> Back
            </button>
          )}
          <button
            type="button"
            onClick={handleClose}
            style={{ padding: '10px 16px', borderRadius: 10, border: 'none', fontSize: 13, cursor: 'pointer', background: 'var(--bg-sunken)', color: 'var(--ink-soft)' }}
          >
            Cancel
          </button>

          {step < 3 && (
            <button
              type="button"
              disabled={step === 1 && parsedRows.length === 0}
              onClick={step === 1 ? goToStep2 : () => setStep(3)}
              style={{ ...stepBtn(step === 1 ? parsedRows.length > 0 : true), flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
            >
              Next <Icon name="chevronRight" size={14} />
            </button>
          )}

          {step === 3 && (
            <button
              type="button"
              disabled={isPending}
              onClick={handleImport}
              style={{ ...stepBtn(true), flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
            >
              {isPending ? 'Importing…' : (
                <><Icon name="upload" size={14} /> Import {parsedRows.length} transactions</>
              )}
            </button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
