'use client'

export function YearPicker({
  years,
  selectedYear,
  onSelect,
}: {
  years: string[]
  selectedYear: string | number
  onSelect: (year: string) => void
}) {
  return (
    <div className="fern-segmented">
      {years.map((y) => (
        <button
          key={y}
          type="button"
          className={String(selectedYear) === y ? 'active' : ''}
          onClick={() => onSelect(y)}
        >
          {y}
        </button>
      ))}
    </div>
  )
}
