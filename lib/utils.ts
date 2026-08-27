import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { alertDialog } from "@/lib/dialogs-store"

export const REIMBURSEMENT_CATEGORY_NAME = 'Remboursements'

export const parseDecimal = (v: string) => Number(v.replace(',', '.'))

export function runAction(fn: () => Promise<unknown>): () => Promise<void> {
  return async () => {
    try {
      await fn()
    } catch (e) {
      void alertDialog(e instanceof Error ? e.message : 'An error occurred')
    }
  }
}

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function nanoid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 10)
}
