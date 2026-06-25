import { motion } from 'framer-motion'
import { CalendarPlus, ChevronRight, Info, X } from 'lucide-react'

import {
  downloadEventICS,
  downloadMultipleICS,
  googleCalendarUrl,
  outlookCalendarUrl,
  yahooCalendarUrl,
} from '../utils/icsExport'
import { useModalA11y } from '../hooks/useModalA11y'

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
    color: 'hsl(var(--sc-primary))',
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
  const containerRef = useModalA11y(onClose)

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
      className="fixed inset-0 z-[300] flex items-start justify-center bg-black/60 pt-20 max-[480px]:items-end max-[480px]:pt-0"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
      role="dialog" aria-modal="true" aria-label="Exportar para calendário"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
    >
      <motion.div
        className="w-[360px] max-w-[92vw] overflow-hidden rounded-lg border bg-background shadow-lg max-[480px]:w-full max-[480px]:rounded-b-none"
        ref={containerRef} tabIndex={-1}
        initial={{ opacity: 0, y: 30, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 20, scale: 0.97 }}
        transition={{ duration: 0.25, ease: 'easeOut' }}
      >
        <div className="flex items-center justify-between px-[18px] pb-2 pt-4">
          <h3 className="flex items-center gap-2 text-[15px] font-bold text-foreground">
            <CalendarPlus className="h-[18px] w-[18px]" aria-hidden="true" />
            Exportar para calendário
          </h3>
          <button
            type="button"
            className="rounded p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
            onClick={onClose}
            aria-label="Fechar"
          >
            <X className="h-[18px] w-[18px]" aria-hidden="true" />
          </button>
        </div>

        <div className="truncate px-[18px] pb-3 text-xs font-medium text-muted-foreground">
          {isSingle ? event.title : `${events.length} eventos`}
        </div>

        <div className="flex flex-col gap-1 px-2.5 pb-2.5">
          {TARGETS.map((t) => {
            const disabled = !isSingle && t.singleOnly
            return (
              <button
                key={t.id}
                className="flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left text-sm font-medium text-foreground transition-colors hover:bg-accent hover:text-accent-foreground disabled:pointer-events-none disabled:opacity-40"
                onClick={() => !disabled && handlePick(t.id)}
                disabled={disabled}
                title={disabled ? 'Disponível apenas para evento único' : `Exportar para ${t.label}`}
              >
                <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md bg-muted text-lg" style={{ color: t.color }}>
                  <i className={t.icon} aria-hidden="true" />
                </span>
                <span className="flex-1">{t.label}</span>
                {disabled && (
                  <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">1 evento</span>
                )}
                <ChevronRight className="h-4 w-4 text-muted-foreground opacity-50" aria-hidden="true" />
              </button>
            )
          })}
        </div>

        {!isSingle && (
          <div className="flex items-center gap-1.5 border-t border-border px-[18px] pb-3.5 pt-2.5 text-[11px] text-muted-foreground">
            <Info className="h-3.5 w-3.5 flex-shrink-0" aria-hidden="true" />
            Para Google, Outlook ou Yahoo, abre cada evento individualmente.
          </div>
        )}
      </motion.div>
    </motion.div>
  )
}
