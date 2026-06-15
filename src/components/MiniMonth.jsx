import {
  MONTHS_PT, WEEKDAYS_SHORT,
  daysInMonth, mondayFirstDay, toDateKey, STATUS_META
} from '../utils/calendarHelpers'
import styles from './MiniMonth.module.css'

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
    <div className={`${styles.wrap} ${styles[size]}`}>
      <div className={styles.title}>{MONTHS_PT[month]}</div>
      <div className={styles.grid}>
        {WEEKDAYS_SHORT.map(w => (
          <div key={w} className={styles.dow}>{w.charAt(0)}</div>
        ))}
        {cells.map((cell, idx) => (
          <div
            key={cell.dateKey || `pad-${idx}`}
            className={[
              styles.day,
              !cell.current  ? styles.other    : '',
              cell.isToday   ? styles.today    : '',
              cell.hasEvents ? styles.hasEvts  : '',
              cell.hasDraft  ? styles.dayDraft : '',
            ].join(' ')}
            onClick={() => cell.current && cell.hasEvents && onDayClick(cell.dateKey, cell.events)}
            title={cell.current && cell.hasEvents ? `${cell.day}: ${cell.events.length} evento(s)` : undefined}
          >
            <span className={styles.num}>{cell.day}</span>
            {(size === 'md' || size === 'sm') && cell.hasEvents && (
              <span className={styles.bar} />
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
