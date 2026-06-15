import EventCard from './EventCard'
import { toDateKey, formatDateLabel } from '../utils/calendarHelpers'
import styles from './DayView.module.css'

export default function DayView({ year, month, day, eventsByDate, onSelectEvent, onExport }) {
  const dateKey = toDateKey(year, month, day)
  const events = eventsByDate[dateKey] || []

  return (
    <div className={styles.wrap}>
      <div className={styles.header}>
        <div className={styles.label}>{formatDateLabel(dateKey)}</div>
        <div className={styles.count}>
          <span>
            {events.length === 0
              ? 'Sem eventos'
              : `${events.length} evento${events.length > 1 ? 's' : ''}`}
          </span>
          {events.length > 0 && onExport && (
            <button
              className={styles.exportBtn}
              onClick={() => onExport(events, `cclx-${dateKey}.ics`)}
              title="Exportar dia para calendário"
            >
              <i className="ti ti-calendar-share" aria-hidden="true" />
              <span>Exportar</span>
            </button>
          )}
        </div>
      </div>

      {events.length === 0 ? (
        <div className={styles.empty}>
          <i className="ti ti-calendar-off" aria-hidden="true" />
          <span>Nenhum evento neste dia</span>
        </div>
      ) : (
        <div className={styles.list}>
          {events.map((evt) => (
            <EventCard key={evt.id} event={evt} onClick={onSelectEvent} />
          ))}
        </div>
      )}
    </div>
  )
}
