import EventCard from './EventCard'
import { CalendarPlus, CalendarX } from 'lucide-react'
import { toDateKey, formatDateLabel, isPastDateKey, PAST_DAY_CLASS } from '../utils/calendarHelpers'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export default function DayView({ year, month, day, eventsByDate, onSelectEvent, onExport }) {
  const dateKey = toDateKey(year, month, day)
  const events = eventsByDate[dateKey] || []
  const isPast = isPastDateKey(dateKey)

  return (
    <div className="mx-auto w-full max-w-[720px]">
      <div className="mb-[18px] flex flex-wrap items-center justify-between gap-2.5 max-[600px]:mb-3">
        <div className="text-[1.25rem] font-bold capitalize text-foreground max-[600px]:text-[1.1rem]">{formatDateLabel(dateKey)}</div>
        <div className="flex items-center gap-3.5 text-[0.9rem] text-muted-foreground">
          <span>
            {events.length === 0
              ? 'Sem eventos'
              : `${events.length} evento${events.length > 1 ? 's' : ''}`}
          </span>
          {events.length > 0 && onExport && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onExport(events, `cclx-${dateKey}.ics`)}
              title="Exportar dia para calendário"
            >
              <CalendarPlus className="h-4 w-4" aria-hidden="true" />
              <span>Exportar</span>
            </Button>
          )}
        </div>
      </div>

      {events.length === 0 ? (
        <div className={cn('flex flex-col items-center gap-3 px-5 py-16 text-muted-foreground max-[600px]:py-10', isPast && PAST_DAY_CLASS)}>
          <CalendarX className="h-10 w-10 opacity-50" aria-hidden="true" />
          <span>Nenhum evento neste dia</span>
        </div>
      ) : (
        <div className={cn('overflow-hidden rounded-lg border border-border bg-card', isPast && PAST_DAY_CLASS)}>
          {events.map((evt) => (
            <EventCard key={evt.id} event={evt} onClick={onSelectEvent} />
          ))}
        </div>
      )}
    </div>
  )
}
