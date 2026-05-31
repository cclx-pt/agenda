import { useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  downloadEventICS,
  downloadMultipleICS,
  googleCalendarUrl,
  outlookCalendarUrl,
  yahooCalendarUrl,
} from '../utils/icsExport'
import styles from './ExportModal.module.css'

const TARGETS = [
  {
    id: 'google',
    label: 'Google Calendar',
    icon: 'ti ti-brand-google',
    color: '#4285F4',
    singleOnly: true,
  },
  {
    id: 'outlook',
    label: 'Outlook',
    icon: 'ti ti-brand-windows',
    color: '#0078D4',
    singleOnly: true,
  },
  {
    id: 'yahoo',
    label: 'Yahoo Calendar',
    icon: 'ti ti-mail',
    color: '#6001D2',
    singleOnly: true,
  },
  {
    id: 'apple',
    label: 'Apple Calendar',
    icon: 'ti ti-brand-apple',
    color: '#333',
    singleOnly: false,
  },
  {
    id: 'ics',
    label: 'Ficheiro .ics',
    icon: 'ti ti-download',
    color: 'var(--accent)',
    singleOnly: false,
  },
]

/**
 * ExportModal - lets the user pick a destination calendar.
 *
 * Props:
 *   events   – array of events to export (1 or more)
 *   filename – suggested filename for .ics download
 *   onClose  – close callback
 */
export default function ExportModal({ events, filename, onClose }) {
  const isSingle = events.length === 1
  const event = isSingle ? events[0] : null

  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  const handlePick = (target) => {
    switch (target) {
      case 'google':
        if (event) window.open(googleCalendarUrl(event), '_blank', 'noopener')
        break
      case 'outlook':
        if (event) window.open(outlookCalendarUrl(event), '_blank', 'noopener')
        break
      case 'yahoo':
        if (event) window.open(yahooCalendarUrl(event), '_blank', 'noopener')
        break
      case 'apple':
      case 'ics':
        if (isSingle) {
          downloadEventICS(event)
        } else {
          downloadMultipleICS(events, filename || 'cclx-agenda.ics')
        }
        break
    }
    onClose()
  }

  return (
    <motion.div
      className={styles.overlay}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
      role="dialog" aria-modal="true" aria-label="Exportar para calendário"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
    >
      <motion.div
        className={styles.modal}
        initial={{ opacity: 0, y: 30, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 20, scale: 0.97 }}
        transition={{ duration: 0.25, ease: 'easeOut' }}
      >
        <div className={styles.header}>
          <h3 className={styles.title}>
            <i className="ti ti-calendar-share" aria-hidden="true" />
            Exportar para calendário
          </h3>
          <button className={styles.closeBtn} onClick={onClose} aria-label="Fechar">
            <i className="ti ti-x" aria-hidden="true" />
          </button>
        </div>

        <div className={styles.subtitle}>
          {isSingle
            ? event.title
            : `${events.length} eventos`}
        </div>

        <div className={styles.options}>
          {TARGETS.map((t) => {
            const disabled = !isSingle && t.singleOnly
            return (
              <button
                key={t.id}
                className={`${styles.option} ${disabled ? styles.disabled : ''}`}
                onClick={() => !disabled && handlePick(t.id)}
                disabled={disabled}
                title={disabled ? 'Disponível apenas para evento único' : `Exportar para ${t.label}`}
              >
                <span className={styles.optIcon} style={{ color: t.color }}>
                  <i className={t.icon} aria-hidden="true" />
                </span>
                <span className={styles.optLabel}>{t.label}</span>
                {disabled && (
                  <span className={styles.optBadge}>1 evento</span>
                )}
                <i className="ti ti-chevron-right" aria-hidden="true" />
              </button>
            )
          })}
        </div>

        {!isSingle && (
          <div className={styles.hint}>
            <i className="ti ti-info-circle" aria-hidden="true" />
            Para Google, Outlook ou Yahoo, abre cada evento individualmente.
          </div>
        )}
      </motion.div>
    </motion.div>
  )
}
