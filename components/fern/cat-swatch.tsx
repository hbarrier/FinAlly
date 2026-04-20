import { Icon } from './icon'
import { COLOR_VARS } from './color-vars'

interface CatSwatchProps {
  color?: string
  icon?: string
  size?: number
}

export function CatSwatch({ color = 'teal', icon = 'tag', size = 34 }: CatSwatchProps) {
  const vars = COLOR_VARS[color] ?? COLOR_VARS.teal
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: Math.round(size * 0.3),
        background: vars.bg,
        color: vars.ink,
        display: 'grid',
        placeItems: 'center',
        flexShrink: 0,
      }}
    >
      <Icon name={icon} size={Math.round(size * 0.5)} />
    </div>
  )
}
