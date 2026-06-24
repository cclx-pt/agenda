import { useMemo } from 'react'
import { ChevronDown, Church } from 'lucide-react'
import { compareChurches } from '../utils/churches'

export default function CommunityFilter({ events, value, onChange }) {
  const communities = useMemo(() => {
    const set = new Set(events.map(e => e.community).filter(Boolean))
    return ['Todas', ...Array.from(set).sort(compareChurches)]
  }, [events])

  return (
    <div className="flex items-center gap-1.5 text-[13px] text-muted-foreground">
      <Church className="h-3.5 w-3.5 flex-shrink-0" aria-hidden="true" />
      <div className="relative">
        <select
          className="cursor-pointer appearance-none rounded-md border border-input bg-background py-[5px] pl-2.5 pr-7 text-[11px] font-semibold tracking-wide text-foreground transition-colors hover:border-ring focus:border-ring focus:outline-none"
          value={value}
          onChange={e => onChange(e.target.value)}
          aria-label="Filtrar por igreja"
        >
          {communities.map(c => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
      </div>
    </div>
  )
}
