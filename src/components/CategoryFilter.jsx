import { useMemo } from 'react'
import { ChevronDown, Tag } from 'lucide-react'
import { CATEGORY_META } from '../utils/calendarHelpers'

export default function CategoryFilter({ events, value, onChange }) {
  const categories = useMemo(() => {
    const present = new Set(events.map(e => e.category))
    const ordered = Object.keys(CATEGORY_META).filter(c => present.has(c))
    return ['Todos', ...ordered]
  }, [events])

  return (
    <div className="flex items-center gap-1.5 text-[13px] text-muted-foreground">
      <Tag className="h-3.5 w-3.5 flex-shrink-0" aria-hidden="true" />
      <div className="relative">
        <select
          className="cursor-pointer appearance-none rounded-md border border-input bg-background py-[5px] pl-2.5 pr-7 text-[11px] font-semibold tracking-wide text-foreground transition-colors hover:border-ring focus:border-ring focus:outline-none"
          value={value}
          onChange={e => onChange(e.target.value)}
          aria-label="Filtrar por tipo de evento"
        >
          {categories.map(c => (
            <option key={c} value={c}>
              {c === 'Todos' ? 'Todos' : CATEGORY_META[c].label}
            </option>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
      </div>
    </div>
  )
}
