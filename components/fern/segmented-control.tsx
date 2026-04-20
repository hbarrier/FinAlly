'use client'

interface Option {
  value: string
  label: string
}

interface SegmentedControlProps {
  value: string
  onChange: (value: string) => void
  options: Option[]
}

export function SegmentedControl({ value, onChange, options }: SegmentedControlProps) {
  return (
    <div className="fern-segmented">
      {options.map((o) => (
        <button
          key={o.value}
          className={value === o.value ? 'active' : ''}
          onClick={() => onChange(o.value)}
          type="button"
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}
