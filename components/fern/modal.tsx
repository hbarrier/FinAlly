'use client'

import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

interface ModalProps {
  open: boolean
  onClose: () => void
  title: ReactNode
  children: ReactNode
  footer?: ReactNode
  className?: string
}

/** Centered pop-up modal in the app's UI. For confirmations, alerts and short info panels. */
export function Modal({ open, onClose, title, children, footer, className }: ModalProps) {
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className={cn('fern-modal-content', className)}>
        <DialogHeader>
          <DialogTitle className="fern-sheet-title">{title}</DialogTitle>
        </DialogHeader>
        <div className="fern-modal-body">{children}</div>
        {footer && <div className="fern-sheet-footer">{footer}</div>}
      </DialogContent>
    </Dialog>
  )
}
