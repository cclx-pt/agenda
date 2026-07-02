import { mondayFirstDay, toDateKey, WEEKDAYS_SHORT, STATUS_META, API_BADGE, isMultiDay, isPastDateKey, PAST_DAY_CLASS } from '../utils/calendarHelpers'
import { useEventColors } from '../hooks/useEventColors'
import { cn } from '@/lib/utils'

export default function WeekView({ year, month, day, eventsByDate, onSelectEvent, onDayClick }) {
  const { colorFor } = useEventColors()
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
      isPast: isPastDateKey(dateKey),
      events: eventsByDate[dateKey] || [],
    }
  })

  return (
    <div className="grid grid-cols-7 gap-2 max-[820px]:grid-cols-1">
      {days.map((col) => (
        <div key={col.dateKey} className={cn(
          'flex min-h-[340px] flex-col overflow-hidden rounded-lg border border-border bg-card max-[820px]:min-h-0',
          col.isToday && 'border-primary',
          col.isPast && PAST_DAY_CLASS,
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
              const st = STATUS_META[evt.status]
              const vis = colorFor(evt)
              return (
                <button
                  key={evt.id}
                  className={cn(
                    'flex w-full flex-col items-start gap-0.5 rounded-md px-2 py-1.5 text-left',
                    st && '[outline:1px_dashed_currentColor] [outline-offset:-2px]',
                    evt.featured && 'cclx-featured',
                  )}
                  style={{ background: st ? st.bg : vis.bg, color: vis.text }}
                  onClick={() => onSelectEvent(evt)}
                  title={st ? `${evt.title} — ${st.label}` : evt.title}
                >
                  <span className="flex w-full items-center gap-1 text-[0.6rem] font-bold uppercase tracking-wide opacity-85">
                    {evt.featured && <i className="ti ti-star-filled cclx-blink text-amber-500" aria-hidden="true" />}
                    <span className="truncate">{vis.catLabel}{evt.subcategory ? ` · ${evt.subcategory}` : ''}</span>
                    {isMultiDay(evt)
                      ? <i className="ti ti-arrows-horizontal ml-auto opacity-90" title="Vários dias" aria-hidden="true" />
                      : evt.timeStart && <span className="ml-auto opacity-90">{evt.timeStart}</span>}
                  </span>
                  <span className="line-clamp-2 text-[0.75rem] font-semibold leading-tight">{evt.title}</span>
                  <span className="text-[0.6rem] opacity-75">({evt.community})</span>
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
