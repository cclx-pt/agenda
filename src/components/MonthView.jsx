import {
  WEEKDAYS_SHORT, MONTHS_PT,
  daysInMonth, mondayFirstDay, toDateKey, CATEGORY_META, STATUS_META, API_BADGE
} from '../utils/calendarHelpers'
import styles from './MonthView.module.css'

export default function MonthView({ year, month, eventsByDate, selectedKey, onDayClick }) {
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
    <div className={styles.wrap}>
      {/* Day of week headers */}
      <div className={styles.dowRow}>
        {WEEKDAYS_SHORT.map(w => (
          <div key={w} className={styles.dow}>{w}</div>
        ))}
      </div>

      {/* Day cells */}
      <div className={styles.grid}>
        {cells.map((cell, idx) => {
          const col = idx % 7
          const isWeekend = col >= 5
          const isSelected = cell.current && cell.dateKey === selectedKey
          const cls = [
            styles.day,
            !cell.current  ? styles.other    : '',
            cell.isToday   ? styles.today    : '',
            isSelected     ? styles.selected : '',
            isWeekend      ? styles.weekend  : '',
          ].join(' ')

          return (
            <div
              key={cell.dateKey || `pad-${idx}`}
              className={cls}
              onClick={() => cell.current && onDayClick(cell.dateKey, cell.events)}
              role={cell.current ? 'button' : undefined}
              tabIndex={cell.current ? 0 : undefined}
              onKeyDown={e => e.key === 'Enter' && cell.current && onDayClick(cell.dateKey, cell.events)}
              aria-label={cell.current ? `${cell.day} de ${MONTHS_PT[month]}` : undefined}
            >
              <div className={styles.dayNum}>
                <span className={`${styles.dayNumVal} ${cell.isToday ? styles.todayNum : ''} ${isWeekend && cell.current ? styles.weekendNum : ''}`}>
                  {cell.day}
                </span>
              </div>

              {cell.events?.slice(0, 2).map(evt => {
                const cat = CATEGORY_META[evt.category] || CATEGORY_META.evento
                const st = STATUS_META[evt.status]
                return (
                  <div key={evt.id} className={`${styles.evt} ${st ? styles.evtDraft : ''}`}
                    style={{ background: st ? st.bg : cat.bgVar, color: cat.colorVar }}
                    title={st ? `${evt.title} — ${st.label}` : evt.title}>
                    {evt.imageUrl && <span className={styles.imgDot} />}
                    <span className={styles.evtDot} style={{ background: cat.colorVar }} />
                    <span className={styles.evtTitle}>{evt.title}</span>
                    {st && <i className={`ti ${st.icon} ${styles.evtDraftIcon}`} aria-hidden="true" />}
                    {evt.isApi && <span className={styles.apiTag} title={API_BADGE.title}>{API_BADGE.label}</span>}
                  </div>
                )
              })}

              {cell.events?.length > 2 && (
                <div className={styles.more}>+{cell.events.length - 2}</div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
