'use client'

import { useMemo } from 'react'
import { Icon } from '@/components/fern/icon'
import { CatSwatch } from '@/components/fern/cat-swatch'
import { SegmentedControl } from '@/components/fern/segmented-control'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command'
import { PAYMENT_METHODS, paymentMethodLabel, paymentMethodIcon, type PaymentMethod } from '@/lib/payment-method'
import type { Category } from '@/lib/derive'
import type { Merchant } from '@/lib/db-types'

const REIMB_OPTIONS = [
  { group: 'Summary', value: 'unresolved', label: 'Open work' },
  { group: 'Summary', value: 'resolved', label: 'Fully resolved' },
  { group: 'Expenses', value: 'expense:not_reimbursed', label: 'Not reimbursed' },
  { group: 'Expenses', value: 'expense:partially_reimbursed', label: 'Partially reimbursed' },
  { group: 'Expenses', value: 'expense:reimbursed', label: 'Reimbursed' },
  { group: 'Expenses', value: 'expense:manually_settled', label: 'Manually settled' },
  { group: 'Income', value: 'income:unmapped', label: 'Unmapped income' },
  { group: 'Income', value: 'income:claim_linked', label: 'Claim linked' },
  { group: 'Income', value: 'income:partially_allocated', label: 'Partially allocated' },
  { group: 'Income', value: 'income:fully_allocated', label: 'Fully allocated' },
] as const

interface TransactionFiltersProps {
  q: string
  onQChange: (q: string) => void
  kindFilter: string
  onKindFilterChange: (v: string) => void
  clearedFilter: 'all' | 'cleared' | 'uncleared'
  onClearedFilterChange: (v: 'all' | 'cleared' | 'uncleared') => void
  showNa: boolean
  onShowNaChange: (v: boolean) => void
  catFilter: Set<string>
  catFilterOpen: boolean
  onCatFilterOpenChange: (v: boolean) => void
  onCatFilterChange: (v: Set<string>) => void
  categories: Category[]
  merchantFilter: Set<string>
  merchantFilterOpen: boolean
  onMerchantFilterOpenChange: (v: boolean) => void
  onMerchantFilterChange: (v: Set<string>) => void
  merchants: Merchant[]
  methodFilter: Set<PaymentMethod>
  methodFilterOpen: boolean
  onMethodFilterOpenChange: (v: boolean) => void
  onMethodFilterChange: (v: Set<PaymentMethod>) => void
  reimbursementFilter: Set<string>
  reimbFilterOpen: boolean
  onReimbFilterOpenChange: (v: boolean) => void
  onReimbursementFilterChange: (v: Set<string>) => void
  showReimbursementFilter: boolean
  showNaToggle: boolean
}

export function TransactionFilters({
  q, onQChange,
  kindFilter, onKindFilterChange,
  clearedFilter, onClearedFilterChange,
  showNa, onShowNaChange,
  catFilter, catFilterOpen, onCatFilterOpenChange, onCatFilterChange, categories,
  merchantFilter, merchantFilterOpen, onMerchantFilterOpenChange, onMerchantFilterChange, merchants,
  methodFilter, methodFilterOpen, onMethodFilterOpenChange, onMethodFilterChange,
  reimbursementFilter, reimbFilterOpen, onReimbFilterOpenChange, onReimbursementFilterChange,
  showReimbursementFilter, showNaToggle,
}: TransactionFiltersProps) {
  const merchantsSortedByName = useMemo(
    () => [...merchants].sort((a, b) => a.name.localeCompare(b.name)),
    [merchants],
  )

  const catFilterLabel = useMemo(() => {
    if (catFilter.size === 0) return 'All categories'
    return categories.filter((c) => catFilter.has(c.id)).map((c) => c.name).sort((a, b) => a.localeCompare(b)).join(', ')
  }, [catFilter, categories])

  const merchantFilterLabel = useMemo(() => {
    if (merchantFilter.size === 0) return 'All merchants'
    return merchantsSortedByName.filter((m) => merchantFilter.has(m.id)).map((m) => m.name).join(', ')
  }, [merchantFilter, merchantsSortedByName])

  const methodFilterLabel = useMemo(() => {
    if (methodFilter.size === 0) return 'All payment types'
    return [...methodFilter].map((m) => paymentMethodLabel(m)).sort((a, b) => a.localeCompare(b)).join(', ')
  }, [methodFilter])

  const reimbFilterLabel = useMemo(() => {
    if (reimbursementFilter.size === 0) return 'All reimbursement states'
    return REIMB_OPTIONS.filter((o) => reimbursementFilter.has(o.value)).map((o) => o.label).join(', ')
  }, [reimbursementFilter])

  return (
    <>
      {/* Row 2: Search + toggle filters */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: 220, background: 'var(--bg-elevated)', borderRadius: 10, padding: '0 12px', border: '1.5px solid var(--line)', flexShrink: 0 }}>
          <Icon name="search" size={16} style={{ color: 'var(--ink-faint)', flexShrink: 0 }} />
          <input
            style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', fontSize: 14, color: 'var(--ink)', padding: '10px 0', minWidth: 0 }}
            placeholder="Search…"
            value={q}
            onChange={(e) => onQChange(e.target.value)}
          />
          {q && (
            <button onClick={() => onQChange('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-faint)', padding: 0, display: 'grid', placeItems: 'center' }}>
              <Icon name="x" size={14} />
            </button>
          )}
        </div>
        <SegmentedControl
          value={kindFilter}
          onChange={onKindFilterChange}
          options={[{ value: 'all', label: 'All' }, { value: 'expense', label: 'Expenses' }, { value: 'income', label: 'Income' }]}
        />
        <SegmentedControl
          value={clearedFilter}
          onChange={(v) => onClearedFilterChange(v as 'all' | 'cleared' | 'uncleared')}
          options={[{ value: 'all', label: 'All' }, { value: 'cleared', label: 'Cleared' }, { value: 'uncleared', label: 'Pending' }]}
        />
        {showNaToggle && (
          <div className="fern-segmented">
            <button type="button" className={showNa ? 'active' : ''} onClick={() => onShowNaChange(!showNa)}>
              Show N/A
            </button>
          </div>
        )}
      </div>

      {/* Row 3: Dropdown filters */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
        <Popover open={catFilterOpen} onOpenChange={onCatFilterOpenChange}>
          <PopoverTrigger asChild>
            <button type="button" className="fern-select" style={{ maxWidth: 220, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{catFilterLabel}</span>
              {catFilter.size > 0 && <span style={{ fontSize: 12, color: 'var(--ink-faint)', flexShrink: 0 }}>{catFilter.size}</span>}
            </button>
          </PopoverTrigger>
          {catFilterOpen && (
            <PopoverContent style={{ padding: 0, width: 260 }} align="start">
              <Command>
                <CommandInput placeholder="Search categories…" />
                <CommandList>
                  <CommandEmpty>No results</CommandEmpty>
                  <CommandGroup heading="Categories">
                    {categories.map((c) => (
                      <CommandItem
                        key={c.id}
                        value={c.name}
                        data-checked={catFilter.has(c.id) ? 'true' : 'false'}
                        onSelect={() => onCatFilterChange((() => { const next = new Set(catFilter); if (next.has(c.id)) next.delete(c.id); else next.add(c.id); return next })())}
                      >
                        <CatSwatch color={c.color} icon={c.icon ?? 'tag'} size={16} />
                        {c.name}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                  {catFilter.size > 0 && (
                    <CommandGroup>
                      <CommandItem value="Clear categories" onSelect={() => onCatFilterChange(new Set())}>Clear</CommandItem>
                    </CommandGroup>
                  )}
                </CommandList>
              </Command>
            </PopoverContent>
          )}
        </Popover>

        <Popover open={merchantFilterOpen} onOpenChange={onMerchantFilterOpenChange}>
          <PopoverTrigger asChild>
            <button type="button" className="fern-select" style={{ maxWidth: 320, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{merchantFilterLabel}</span>
              {merchantFilter.size > 0 && <span style={{ fontSize: 12, color: 'var(--ink-faint)', flexShrink: 0 }}>{merchantFilter.size}</span>}
            </button>
          </PopoverTrigger>
          {merchantFilterOpen && (
            <PopoverContent style={{ padding: 0, width: 320 }} align="start">
              <Command>
                <CommandInput placeholder="Search merchants…" />
                <CommandList>
                  <CommandEmpty>No results</CommandEmpty>
                  <CommandGroup heading="Merchants">
                    {merchantsSortedByName.map((m) => (
                      <CommandItem
                        key={m.id}
                        value={m.name}
                        data-checked={merchantFilter.has(m.id) ? 'true' : 'false'}
                        style={{ whiteSpace: 'nowrap' }}
                        onSelect={() => onMerchantFilterChange((() => { const next = new Set(merchantFilter); if (next.has(m.id)) next.delete(m.id); else next.add(m.id); return next })())}
                      >
                        {m.name}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                  {merchantFilter.size > 0 && (
                    <CommandGroup>
                      <CommandItem value="Clear merchants" onSelect={() => onMerchantFilterChange(new Set())}>Clear</CommandItem>
                    </CommandGroup>
                  )}
                </CommandList>
              </Command>
            </PopoverContent>
          )}
        </Popover>

        <Popover open={methodFilterOpen} onOpenChange={onMethodFilterOpenChange}>
          <PopoverTrigger asChild>
            <button type="button" className="fern-select" style={{ maxWidth: 220, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{methodFilterLabel}</span>
              {methodFilter.size > 0 && <span style={{ fontSize: 12, color: 'var(--ink-faint)', flexShrink: 0 }}>{methodFilter.size}</span>}
            </button>
          </PopoverTrigger>
          {methodFilterOpen && (
            <PopoverContent style={{ padding: 0, width: 260 }} align="start">
              <Command>
                <CommandInput placeholder="Search payment types…" />
                <CommandList>
                  <CommandEmpty>No results</CommandEmpty>
                  <CommandGroup heading="Payment types">
                    {PAYMENT_METHODS.map((m) => (
                      <CommandItem
                        key={m}
                        value={paymentMethodLabel(m)}
                        data-checked={methodFilter.has(m) ? 'true' : 'false'}
                        onSelect={() => onMethodFilterChange((() => { const next = new Set(methodFilter); if (next.has(m)) next.delete(m); else next.add(m); return next })())}
                      >
                        <Icon name={paymentMethodIcon(m)} size={14} style={{ color: 'var(--ink-faint)' }} />
                        {paymentMethodLabel(m)}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                  {methodFilter.size > 0 && (
                    <CommandGroup>
                      <CommandItem value="Clear payment types" onSelect={() => onMethodFilterChange(new Set())}>Clear</CommandItem>
                    </CommandGroup>
                  )}
                </CommandList>
              </Command>
            </PopoverContent>
          )}
        </Popover>

        {showReimbursementFilter && (
        <Popover open={reimbFilterOpen} onOpenChange={onReimbFilterOpenChange}>
          <PopoverTrigger asChild>
            <button type="button" className="fern-select" style={{ maxWidth: 260, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{reimbFilterLabel}</span>
              {reimbursementFilter.size > 0 && <span style={{ fontSize: 12, color: 'var(--ink-faint)', flexShrink: 0 }}>{reimbursementFilter.size}</span>}
            </button>
          </PopoverTrigger>
          {reimbFilterOpen && (
            <PopoverContent style={{ padding: 0, width: 280 }} align="start">
              <Command>
                <CommandInput placeholder="Search states…" />
                <CommandList>
                  <CommandEmpty>No results</CommandEmpty>
                  {(['Summary', 'Expenses', 'Income'] as const).map((group) => (
                    <CommandGroup key={group} heading={group}>
                      {REIMB_OPTIONS.filter((o) => o.group === group).map((o) => (
                        <CommandItem
                          key={o.value}
                          value={o.label}
                          data-checked={reimbursementFilter.has(o.value) ? 'true' : 'false'}
                          onSelect={() => onReimbursementFilterChange((() => { const next = new Set(reimbursementFilter); if (next.has(o.value)) next.delete(o.value); else next.add(o.value); return next })())}
                        >
                          {o.label}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  ))}
                  {reimbursementFilter.size > 0 && (
                    <CommandGroup>
                      <CommandItem value="Clear states" onSelect={() => onReimbursementFilterChange(new Set())}>Clear</CommandItem>
                    </CommandGroup>
                  )}
                </CommandList>
              </Command>
            </PopoverContent>
          )}
        </Popover>
        )}
      </div>
    </>
  )
}
