import {
  MONTHS_PT, WEEKDAYS_SHORT,
  daysInMonth, mondayFirstDay, toDateKey, STATUS_META
} from '../utils/calendarHelpers'
import { cn } from '@/lib/utils'

export default function MiniMonth({ year, month, eventsByDate, onDayClick, size = 'md' }) {
  const firstDay = mondayFirstDay(new Date(year, month, 1))
  const totalDays = daysInMonth(year, month)
  const prevDays  = daysInMonth(year, month - 1)
  const today     = new Date()
  const isThisMonth = today.getFullYear() === year && today.getMonth() === month

  const cells = []
  for (let i = firstDay - 1; i >= 0; i--)
    cells.push({ day: prevDays - i, current: false })

  for (let d = 1; d <= totalDays; d++) {
    const dateKey = toDateKey(year, month, d)
    const events  = eventsByDate[dateKey] || []
    cells.push({
      day: d, current: true, dateKey,
      isToday: isThisMonth && today.getDate() === d,
      hasEvents: events.length > 0,
      hasDraft: events.some(e => STATUS_META[e.status]),
      events,
    })
  }

  const rem = (7 - (cells.length % 7)) % 7
  for (let i = 1; i <= rem; i++) cells.push({ day: i, current: false })

  return (
    <div className="rounded border border-border bg-card p-3">
      <div className="mb-2 text-center text-[11px] font-bold uppercase tracking-wider text-foreground">{MONTHS_PT[month]}</div>
      <div className="grid grid-cols-7 gap-px">
        {WEEKDAYS_SHORT.map(w => (
          <div key={w} className="py-0.5 text-center text-[8px] font-bold text-muted-foreground">{w.charAt(0)}</div>
        ))}
        {cells.map((cell, idx) => (
          <div
            key={cell.dateKey || `pad-${idx}`}
            className={cn(
              'relative flex flex-col items-center justify-center overflow-hidden border border-border bg-card transition-colors',
              size === 'md' && 'min-h-[32px]',
              size === 'sm' && 'min-h-[24px]',
              size === 'xs' && 'min-h-[18px]',
              cell.hasEvents && 'cursor-pointer bg-primary/10 hover:bg-primary/20',
              cell.hasDraft && 'bg-destructive/15 hover:bg-destructive/25',
              !cell.current && '!bg-muted/40 opacity-35',
              cell.isToday && '!border-primary !bg-primary',
            )}
            onClick={() => cell.current && cell.hasEvents && onDayClick(cell.dateKey, cell.events)}
            title={cell.current && cell.hasEvents ? `${cell.day}: ${cell.events.length} evento(s)` : undefined}
          >
            <span className={cn(
              'text-[8px] font-medium leading-none text-muted-foreground',
              size === 'sm' && 'text-[7px]',
              size === 'xs' && 'text-[6px]',
              cell.isToday && 'font-bold !text-primary-foreground',
            )}>{cell.day}</span>
            {(size === 'md' || size === 'sm') && cell.hasEvents && (
              <span className="mt-0.5 block h-0.5 w-3/5 rounded-sm bg-primary" />
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
