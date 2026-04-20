import { splitCents } from '@/lib/derive'

interface MoneyProps {
  amount: number
}

export function Money({ amount }: MoneyProps) {
  const { sign, whole, cents } = splitCents(amount)
  return (
    <div className="fern-hero-amount">
      <span className="cur">{sign}€</span>
      <span>{whole}</span>
      <span className="cents">,{cents}</span>
    </div>
  )
}
