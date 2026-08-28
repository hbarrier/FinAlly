'use client'

import type { ReactNode } from 'react'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Icon } from './icon'

type PrimaryTone = 'primary' | 'teal'

interface SheetShellProps {
  open: boolean
  onClose: () => void
  title: ReactNode
  compact?: boolean
  modal?: boolean
  children: ReactNode
  primary: {
    label: ReactNode
    icon?: string
    onClick: () => void
    disabled?: boolean
    tone?: PrimaryTone
  }
  cancelLabel?: ReactNode
  secondaryAction?: ReactNode
}

export function SheetShell({
  open,
  onClose,
  title,
  compact,
  modal,
  children,
  primary,
  cancelLabel = 'Cancel',
  secondaryAction,
}: SheetShellProps) {
  const cls = ['fern-sheet-content', compact ? 'compact' : null]
    .filter(Boolean)
    .join(' ')
  const primaryTone = primary.tone ?? 'primary'
  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()} modal={modal}>
      <SheetContent
        side="right"
        className={cls}
        onInteractOutside={modal === false ? (e) => e.preventDefault() : undefined}
      >
        <SheetHeader>
          <SheetTitle className="fern-sheet-title">{title}</SheetTitle>
        </SheetHeader>

        <div className="fern-sheet-body">
          {children}

          <div className="fern-sheet-footer">
            {secondaryAction}
            <button
              type="button"
              onClick={onClose}
              className="fern-btn sheet-secondary"
            >
              {cancelLabel}
            </button>
            <button
              type="button"
              onClick={primary.onClick}
              disabled={primary.disabled}
              className={`fern-btn sheet-primary ${primaryTone}`}
            >
              {primary.icon && <Icon name={primary.icon} size={16} />}
              {primary.label}
            </button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
