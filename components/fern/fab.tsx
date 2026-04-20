import type { ButtonHTMLAttributes } from 'react'
import { Icon } from './icon'

interface FabProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string
}

export function Fab({ label, ...props }: FabProps) {
  return (
    <button {...props} className="fern-fab" aria-label={label}>
      <Icon name="plus" size={26} />
    </button>
  )
}
