import { CATEGORY_META, STATUS_META, API_BADGE, formatTimeRange } from '../utils/calendarHelpers'
import styles from './EventCard.module.css'

export default function EventCard({ event, onClick }) {
  const cat = CATEGORY_META[event.category] || CATEGORY_META.evento
  const status = STATUS_META[event.status]

  return (
    <div className={`${styles.card} ${status ? styles.cardDraft : ''}`} onClick={() => onClick(event)} role="button" tabIndex={0}
      onKeyDown={e => e.key === 'Enter' && onClick(event)}>

      {event.imageUrl
        ? <img className={styles.img} src={event.imageUrl} alt={event.imageLabel || event.title} loading="lazy" />
        : <div className={styles.imgPh}>
            <i className="ti ti-calendar-event" aria-hidden="true" />
          </div>
      }

      <div className={styles.body}>
        <div className={styles.tags}>
          <span className={styles.tag}
            style={{ background: cat.bgVar, color: cat.colorVar }}>
            {cat.label}
          </span>
          {status && (
            <span className={styles.statusBadge}>
              <i className={`ti ${status.icon}`} aria-hidden="true" />
              {status.label}
            </span>
          )}
          {event.isApi && (
            <span className={styles.apiBadge} title={API_BADGE.title}>
              <i className={`ti ${API_BADGE.icon}`} aria-hidden="true" />
              {API_BADGE.label}
            </span>
          )}
        </div>

        <div className={styles.title}>{event.title}</div>

        <div className={styles.meta}>
          <div className={styles.row}>
            <i className="ti ti-clock" aria-hidden="true" />
            {formatTimeRange(event.timeStart, event.timeEnd)}
          </div>
          <div className={styles.row}>
            <i className="ti ti-map-pin" aria-hidden="true" />
            {event.location}
          </div>
          <div className={styles.row}>
            <i className="ti ti-building-church" aria-hidden="true" />
            {event.responsible}
          </div>
        </div>

        <p className={styles.desc}>{event.description}</p>
      </div>
    </div>
  )
}
