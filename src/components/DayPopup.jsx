import { motion } from 'framer-motion'
import EventCard from './EventCard'
import { formatDateLabel } from '../utils/calendarHelpers'
import { useModalA11y } from '../hooks/useModalA11y'
import styles from './DayPopup.module.css'

export default function DayPopup({ dateKey, events, onClose, onSelectEvent, onExport }) {
  const containerRef = useModalA11y(onClose)

  const label = formatDateLabel(dateKey)

  return (
    <motion.div className={styles.overlay} onClick={e => { if (e.target === e.currentTarget) onClose() }}
      role="dialog" aria-modal="true" aria-label={`Eventos: ${label}`}
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}>

      <motion.div className={styles.popup}
        ref={containerRef} tabIndex={-1}
        initial={{ opacity: 0, y: 30, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 20, scale: 0.97 }}
        transition={{ duration: 0.25, ease: 'easeOut' }}>
        <div className={styles.header}>
          <div>
            <div className={styles.dateLabel}>{label}</div>
            <div className={styles.count}>
              {events.length === 0
                ? 'Sem eventos'
                : `${events.length} evento${events.length > 1 ? 's' : ''}`}
            </div>
          </div>
          <div className={styles.headerActions}>
            {events.length > 0 && (
              <button
                className={styles.icsBtn}
                onClick={() => onExport && onExport(events, `cclx-${dateKey}.ics`)}
                title="Exportar dia para calendário"
              >
                <i className="ti ti-calendar-share" aria-hidden="true" />
                <span>Exportar</span>
              </button>
            )}
            <button className={styles.closeBtn} onClick={onClose} aria-label="Fechar">
              <i className="ti ti-x" aria-hidden="true" />
            </button>
          </div>
        </div>

        <div className={styles.body}>
          {events.length === 0
            ? <div className={styles.empty}>
                <i className="ti ti-calendar-off" aria-hidden="true" />
                <span>Nenhum evento neste dia</span>
              </div>
            : events.map(evt => (
                <EventCard key={evt.id} event={evt} onClick={onSelectEvent} />
              ))
          }
        </div>
      </motion.div>
    </motion.div>
  )
}
