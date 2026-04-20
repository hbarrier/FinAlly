'use client'

import { useState } from 'react'
import { ChevronsUpDown, Check } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'

export interface SelectOption {
  value: string
  label: string
  group?: string
}

interface SearchableSelectProps {
  value: string | null
  onChange: (value: string | null) => void
  options: SelectOption[]
  placeholder?: string
  searchPlaceholder?: string
  emptyText?: string
  nullable?: boolean
  nullLabel?: string
}

export function SearchableSelect({
  value,
  onChange,
  options,
  placeholder = 'Select…',
  searchPlaceholder = 'Search…',
  emptyText = 'No results',
  nullable = false,
  nullLabel = 'None',
}: SearchableSelectProps) {
  const [open, setOpen] = useState(false)

  const selectedOption = options.find((o) => o.value === value)

  const groups = options.reduce<Record<string, SelectOption[]>>((acc, opt) => {
    const g = opt.group ?? ''
    if (!acc[g]) acc[g] = []
    acc[g].push(opt)
    return acc
  }, {})

  const hasGroups = Object.keys(groups).some((k) => k !== '')

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          role="combobox"
          aria-expanded={open}
          className="fern-select"
          style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
        >
          <span style={{ color: selectedOption ? 'var(--ink)' : 'var(--ink-faint)' }}>
            {selectedOption ? selectedOption.label : placeholder}
          </span>
          <ChevronsUpDown size={14} style={{ color: 'var(--ink-soft)', flexShrink: 0, marginLeft: 8 }} />
        </button>
      </PopoverTrigger>
      <PopoverContent
        style={{ padding: 0, width: 'var(--radix-popover-trigger-width)', minWidth: 200 }}
        align="start"
      >
        <Command>
          <CommandInput placeholder={searchPlaceholder} />
          <CommandList>
            <CommandEmpty>{emptyText}</CommandEmpty>
            {nullable && (
              <CommandGroup>
                <CommandItem
                  value="__null__"
                  onSelect={() => { onChange(null); setOpen(false) }}
                >
                  <Check size={14} style={{ opacity: value === null ? 1 : 0, marginRight: 6, flexShrink: 0 }} />
                  {nullLabel}
                </CommandItem>
              </CommandGroup>
            )}
            {hasGroups
              ? Object.entries(groups).map(([group, opts]) => (
                  <CommandGroup key={group} heading={group}>
                    {opts.map((opt) => (
                      <CommandItem
                        key={opt.value}
                        value={opt.label}
                        onSelect={() => { onChange(opt.value); setOpen(false) }}
                      >
                        <Check size={14} style={{ opacity: opt.value === value ? 1 : 0, marginRight: 6, flexShrink: 0 }} />
                        {opt.label}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                ))
              : (
                <CommandGroup>
                  {(groups[''] ?? []).map((opt) => (
                    <CommandItem
                      key={opt.value}
                      value={opt.label}
                      onSelect={() => { onChange(opt.value); setOpen(false) }}
                    >
                      <Check size={14} style={{ opacity: opt.value === value ? 1 : 0, marginRight: 6, flexShrink: 0 }} />
                      {opt.label}
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
