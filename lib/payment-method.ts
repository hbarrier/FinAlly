export const PAYMENT_METHODS = ['card', 'transfer', 'cash', 'check', 'debit', 'paypal'] as const
export type PaymentMethod = (typeof PAYMENT_METHODS)[number]

export function defaultPaymentMethodForKind(kind: 'expense' | 'income'): PaymentMethod {
  return kind === 'income' ? 'transfer' : 'card'
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

