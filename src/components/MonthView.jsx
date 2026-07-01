import {
  WEEKDAYS_SHORT, MONTHS_PT,
  daysInMonth, mondayFirstDay, toDateKey, CATEGORY_META, STATUS_META, API_BADGE
} from '../utils/calendarHelpers'
import { cn } from '@/lib/utils'

export default function MonthView({ year, month, eventsByDate, selectedKey, onDayClick, onSelectEvent }) {
  const firstDay = mondayFirstDay(new Date(year, month, 1))
  const totalDays = daysInMonth(year, month)
  const prevDays  = daysInMonth(year, month - 1)
  const today     = new Date()
  const isThisMonth = today.getFullYear() === year && today.getMonth() === month

  const cells = []

  // Previous month trailing days
  for (let i = firstDay - 1; i >= 0; i--) {
    cells.push({ day: prevDays - i, current: false, dateKey: null })
  }

  // Current month days
  for (let d = 1; d <= totalDays; d++) {
    const dateKey = toDateKey(year, month, d)
    cells.push({
      day: d,
      current: true,
      dateKey,
      isToday: isThisMonth && today.getDate() === d,
      events: eventsByDate[dateKey] || [],
    })
  }

  // Next month leading days
  const remaining = (7 - (cells.length % 7)) % 7
  for (let i = 1; i <= remaining; i++) {
    cells.push({ day: i, current: false, dateKey: null })
  }

  return (
    <div className="w-full">
      {/* Day of week headers */}
      <div className="grid grid-cols-7 border-b border-border">
        {WEEKDAYS_SHORT.map(w => (
          <div key={w} className="py-2 text-center text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{w}</div>
        ))}
      </div>

      {/* Day cells */}
      <div className="grid grid-cols-7">
        {cells.map((cell, idx) => {
          const col = idx % 7
          const isWeekend = col >= 5
          const isSelected = cell.current && cell.dateKey === selectedKey

          return (
            <div
              key={cell.dateKey || `pad-${idx}`}
              className={cn(
                'min-h-[88px] cursor-pointer border-b border-r border-border p-1.5 outline-none transition-colors hover:bg-accent focus-visible:relative focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring [&:nth-child(7n)]:border-r-0 max-[600px]:min-h-[58px] max-[600px]:p-1',
                !cell.current && 'pointer-events-none cursor-default bg-muted/30 opacity-45',
                cell.isToday && 'bg-muted/40',
                isWeekend && cell.current && 'bg-muted/20',
                isSelected && 'relative z-10 ring-2 ring-inset ring-ring',
              )}
              onClick={() => cell.current && onDayClick(cell.dateKey, cell.events)}
              role={cell.current ? 'button' : undefined}
              tabIndex={cell.current ? 0 : undefined}
              onKeyDown={e => e.key === 'Enter' && cell.current && onDayClick(cell.dateKey, cell.events)}
              aria-label={cell.current ? `${cell.day} de ${MONTHS_PT[month]}` : undefined}
            >
              <div className="mb-1 flex items-center justify-between">
                <span className={cn(
                  'flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-semibold text-muted-foreground max-[600px]:h-[18px] max-[600px]:w-[18px] max-[600px]:text-[10px]',
                  cell.isToday && 'bg-primary font-bold text-primary-foreground',
                )}>
                  {cell.day}
                </span>
              </div>

              {cell.events?.slice(0, 2).map(evt => {
                const cat = CATEGORY_META[evt.category] || CATEGORY_META.evento
                const st = STATUS_META[evt.status]
                return (
                  <div key={evt.id}
                    className={cn(
                      'mb-0.5 flex cursor-pointer items-center gap-[3px] overflow-hidden whitespace-nowrap rounded-sm px-1.5 py-0.5 text-[10px] font-semibold tracking-wide hover:brightness-95 max-[600px]:gap-0.5 max-[600px]:px-[3px] max-[600px]:py-px max-[600px]:text-[8px]',
                      st && '[outline:1px_dashed_currentColor] [outline-offset:-2px]',
                    )}
                    style={{ background: st ? st.bg : cat.bgVar, color: cat.colorVar }}
                    title={`${evt.title} (${evt.community})${st ? ` — ${st.label}` : ''}`}
                    onClick={(e) => { e.stopPropagation(); onSelectEvent?.(evt) }}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); onSelectEvent?.(evt) } }}>
                    {evt.imageUrl && <span className="h-[5px] w-[5px] flex-shrink-0 rounded-[1px] bg-current opacity-80" />}
                    <span className="h-1 w-1 flex-shrink-0 rounded-full opacity-70" style={{ background: cat.colorVar }} />
                    <span className="overflow-hidden text-ellipsis whitespace-nowrap">{evt.title} <span className="opacity-70">({evt.community})</span></span>
                    {st && <i className={`ti ${st.icon} ml-auto flex-shrink-0 text-[9px] opacity-85`} aria-hidden="true" />}
                    {evt.isApi && <span className="ml-auto flex-shrink-0 rounded-sm bg-blue-500 px-1 text-[8px] font-extrabold leading-normal text-white" title={API_BADGE.title}>{API_BADGE.label}</span>}
                  </div>
                )
              })}

              {cell.events?.length > 2 && (
                <div className="px-1 py-px text-[9px] tracking-wide text-muted-foreground max-[600px]:text-[8px]">+{cell.events.length - 2}</div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
