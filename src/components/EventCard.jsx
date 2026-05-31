import { CATEGORY_META, formatTimeRange } from '../utils/calendarHelpers'
import styles from './EventCard.module.css'

export default function EventCard({ event, onClick }) {
  const cat = CATEGORY_META[event.category] || CATEGORY_META.evento

  return (
    <div className={styles.card} onClick={() => onClick(event)} role="button" tabIndex={0}
      onKeyDown={e => e.key === 'Enter' && onClick(event)}>

      {event.imageUrl
        ? <img className={styles.img} src={event.imageUrl} alt={event.imageLabel || event.title} loading="lazy" />
        : <div className={styles.imgPh}>
            <i className="ti ti-calendar-event" aria-hidden="true" />
          </div>
      }

      <div className={styles.body}>
        <span className={styles.tag}
          style={{ background: cat.bgVar, color: cat.colorVar }}>
          {cat.label}
        </span>

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
        </div>

        <p className={styles.desc}>{event.description}</p>
      </div>
    </div>
  )
}
