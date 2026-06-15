import { motion } from 'framer-motion'
import { CATEGORY_META, STATUS_META, formatTimeRange, formatDateLabel } from '../utils/calendarHelpers'
import { useModalA11y } from '../hooks/useModalA11y'
import styles from './EventDetail.module.css'

export default function EventDetail({ event, onClose, onBack, onExport, onDelete }) {
  const cat = CATEGORY_META[event.category] || CATEGORY_META.evento
  const status = STATUS_META[event.status]
  const containerRef = useModalA11y(onClose)

  return (
    <motion.div className={styles.overlay} onClick={e => { if (e.target === e.currentTarget) onClose() }}
      role="dialog" aria-modal="true" aria-label={event.title}
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}>

      <motion.div className={styles.modal}
        ref={containerRef} tabIndex={-1}
        initial={{ opacity: 0, y: 40, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 30, scale: 0.96 }}
        transition={{ duration: 0.3, ease: 'easeOut' }}>

        {/* Back button */}
        {onBack && (
          <button className={styles.backBtn} onClick={onBack}>
            <i className="ti ti-arrow-left" aria-hidden="true" />
            Voltar ao dia
          </button>
        )}

        {/* Image header */}
        <div className={styles.imgWrap}>
          {event.imageUrl
            ? <>
                <img src={event.imageUrl} alt={event.imageLabel || event.title} className={styles.img} />
                <div className={styles.imgOverlay} />
                {event.imageLabel && (
                  <div className={styles.imgBadge}>
                    <i className="ti ti-photo" aria-hidden="true" />
                    {event.imageLabel}
                  </div>
                )}
              </>
            : <div className={styles.imgPh}>
                <i className="ti ti-calendar-event" aria-hidden="true" />
                <span>Sem imagem</span>
              </div>
          }
          <button className={styles.closeBtn} onClick={onClose} aria-label="Fechar">
            <i className="ti ti-x" aria-hidden="true" />
          </button>
        </div>

        {/* Body */}
        <div className={`${styles.body} ${status ? styles.bodyDraft : ''}`}>
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
          </div>

          <h2 className={styles.title}>{event.title}</h2>

          <div className={styles.rows}>
            <div className={styles.row}>
              <i className="ti ti-calendar" aria-hidden="true" />
              <span>{formatDateLabel(event.date)}</span>
            </div>
            <div className={styles.row}>
              <i className="ti ti-clock" aria-hidden="true" />
              <span>{formatTimeRange(event.timeStart, event.timeEnd)}</span>
            </div>
            <div className={styles.row}>
              <i className="ti ti-map-pin" aria-hidden="true" />
              <span>{event.location}</span>
            </div>
            <div className={styles.row}>
              <i className="ti ti-user" aria-hidden="true" />
              <span>{event.responsible}</span>
            </div>
          </div>

          <hr className={styles.divider} />
          <p className={styles.desc}>{event.description}</p>

          <div className={styles.actions}>
            <button
              className={styles.icsBtn}
              onClick={() => onExport ? onExport(event) : null}
            >
              <i className="ti ti-calendar-share" aria-hidden="true" />
              Guardar no calendário
            </button>
            {onDelete && (
              <button
                className={styles.deleteBtn}
                onClick={() => onDelete(event)}
              >
                <i className="ti ti-trash" aria-hidden="true" />
                Eliminar
              </button>
            )}
          </div>
        </div>

      </motion.div>
    </motion.div>
  )
}
