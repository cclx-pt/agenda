import { mondayFirstDay, toDateKey, WEEKDAYS_SHORT, CATEGORY_META, STATUS_META, API_BADGE } from '../utils/calendarHelpers'
import { cn } from '@/lib/utils'

export default function WeekView({ year, month, day, eventsByDate, onSelectEvent, onDayClick }) {
  const dow = mondayFirstDay(new Date(year, month, day))
  const today = new Date()

  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(year, month, day - dow + i)
    const dateKey = toDateKey(d.getFullYear(), d.getMonth(), d.getDate())
    return {
      dateKey,
      label: WEEKDAYS_SHORT[i],
      dayNum: d.getDate(),
      isToday: d.toDateString() === today.toDateString(),
      events: eventsByDate[dateKey] || [],
    }
  })

  return (
    <div className="grid grid-cols-7 gap-2 max-[820px]:grid-cols-1">
      {days.map((col) => (
        <div key={col.dateKey} className={cn(
          'flex min-h-[340px] flex-col overflow-hidden rounded-lg border border-border bg-card max-[820px]:min-h-0',
          col.isToday && 'border-primary',
        )}>
          <button
            className="flex flex-col items-center gap-0.5 border-b border-border px-1 py-2.5 text-foreground transition-colors hover:bg-accent max-[820px]:flex-row max-[820px]:justify-start max-[820px]:gap-2"
            onClick={() => onDayClick(col.dateKey, col.events)}
            title="Ver dia"
          >
            <span className="text-[0.7rem] uppercase tracking-wide text-muted-foreground">{col.label}</span>
            <span className={cn('text-[1.1rem] font-bold', col.isToday && 'text-primary')}>{col.dayNum}</span>
          </button>
          <div className="flex flex-1 flex-col gap-1.5 overflow-y-auto p-2">
            {col.events.map((evt) => {
              const cat = CATEGORY_META[evt.category] || CATEGORY_META.evento
              const st = STATUS_META[evt.status]
              return (
                <button
                  key={evt.id}
                  className={cn(
                    'flex w-full flex-col items-start gap-0.5 rounded-md px-2 py-1.5 text-left',
                    st && '[outline:1px_dashed_currentColor] [outline-offset:-2px]',
                  )}
                  style={{ background: st ? st.bg : cat.bgVar, color: cat.colorVar }}
                  onClick={() => onSelectEvent(evt)}
                  title={st ? `${evt.title} — ${st.label}` : evt.title}
                >
                  {evt.timeStart && <span className="text-[0.65rem] font-bold opacity-85">{evt.timeStart}</span>}
                  <span className="line-clamp-2 text-[0.75rem] leading-tight">{evt.title}</span>
                  <span className="text-[0.6rem] opacity-75">{evt.community}</span>
                  {st && (
                    <span className="mt-0.5 inline-flex items-center gap-[3px] text-[0.6rem] font-extrabold uppercase tracking-wide opacity-90">
                      <i className={`ti ${st.icon}`} aria-hidden="true" />
                      {st.label}
                    </span>
                  )}
                  {evt.isApi && (
                    <span className="mt-0.5 inline-flex items-center gap-[3px] rounded bg-blue-500 px-1.5 py-px text-[0.6rem] font-extrabold uppercase tracking-wide text-white" title={API_BADGE.title}>
                      <i className={`ti ${API_BADGE.icon}`} aria-hidden="true" />
                      {API_BADGE.label}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}
