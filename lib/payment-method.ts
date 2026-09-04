export const PAYMENT_METHODS = ['card', 'transfer', 'cash', 'check', 'debit', 'paypal'] as const
export type PaymentMethod = (typeof PAYMENT_METHODS)[number]

export function defaultPaymentMethodForKind(kind: 'expense' | 'income' | 'saving' | 'interest'): PaymentMethod {
  if (kind === 'saving' || kind === 'interest') return 'transfer'
  return kind === 'income' ? 'transfer' : 'card'
}

/** `<Icon>` name for a payment method. */
export function paymentMethodIcon(method: PaymentMethod): string {
  switch (method) {
    case 'card':
      return 'wallet'
    case 'transfer':
      return 'bank'
    case 'cash':
      return 'sparkle'
    case 'check':
      return 'fileText'
    case 'debit':
      return 'bank'
    case 'paypal':
      return 'wallet'
  }
}

export function paymentMethodLabel(method: PaymentMethod): string {
  switch (method) {
    case 'card':
      return 'CB'
    case 'transfer':
      return 'Virement'
    case 'cash':
      return 'Cash'
    case 'check':
      return 'Chèque'
    case 'debit':
      return 'Prélèvement'
    case 'paypal':
      return 'PayPal'
  }
}

