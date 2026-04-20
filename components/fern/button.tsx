import type { ButtonHTMLAttributes } from 'react'

type Tone = 'primary' | 'outline' | 'ghost' | 'teal' | 'danger'

interface FernButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  tone?: Tone
}

export function FernButton({ tone = 'primary', className, ...props }: FernButtonProps) {
  const cls = ['fern-btn', tone, className].filter(Boolean).join(' ')
  return <button {...props} className={cls} />
}
