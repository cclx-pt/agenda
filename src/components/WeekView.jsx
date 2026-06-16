import { mondayFirstDay, toDateKey, WEEKDAYS_SHORT, CATEGORY_META, STATUS_META, API_BADGE } from '../utils/calendarHelpers'
import styles from './WeekView.module.css'

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
    <div className={styles.grid}>
      {days.map((col) => (
        <div key={col.dateKey} className={`${styles.col} ${col.isToday ? styles.today : ''}`}>
          <button
            className={styles.colHead}
            onClick={() => onDayClick(col.dateKey, col.events)}
            title="Ver dia"
          >
            <span className={styles.dow}>{col.label}</span>
            <span className={styles.dayNum}>{col.dayNum}</span>
          </button>
          <div className={styles.colBody}>
            {col.events.map((evt) => {
              const cat = CATEGORY_META[evt.category] || CATEGORY_META.evento
              const st = STATUS_META[evt.status]
              return (
                <button
                  key={evt.id}
                  className={`${styles.evt} ${st ? styles.evtDraft : ''}`}
                  style={{ background: st ? st.bg : cat.bgVar, color: cat.colorVar }}
                  onClick={() => onSelectEvent(evt)}
                  title={st ? `${evt.title} — ${st.label}` : evt.title}
                >
                  {evt.timeStart && <span className={styles.evtTime}>{evt.timeStart}</span>}
                  <span className={styles.evtTitle}>{evt.title}</span>
                  {st && (
                    <span className={styles.evtStatus}>
                      <i className={`ti ${st.icon}`} aria-hidden="true" />
                      {st.label}
                    </span>
                  )}
                  {evt.isApi && (
                    <span className={styles.apiTag} title={API_BADGE.title}>
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
