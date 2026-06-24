import { motion } from 'framer-motion'
import { CalendarPlus, CalendarX, X } from 'lucide-react'

import EventCard from './EventCard'
import { formatDateLabel } from '../utils/calendarHelpers'
import { useModalA11y } from '../hooks/useModalA11y'
import { Button } from '@/components/ui/button'

export default function DayPopup({ dateKey, events, onClose, onSelectEvent, onExport }) {
  const containerRef = useModalA11y(onClose)

  const label = formatDateLabel(dateKey)

  return (
    <motion.div className="fixed inset-0 z-[200] flex items-start justify-center bg-black/60 pt-16 max-[600px]:items-end max-[600px]:pt-0" onClick={e => { if (e.target === e.currentTarget) onClose() }}
      role="dialog" aria-modal="true" aria-label={`Eventos: ${label}`}
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}>

      <motion.div className="flex max-h-[78vh] w-[380px] max-w-[94vw] flex-col overflow-hidden rounded-lg border bg-background shadow-lg max-[600px]:w-full max-[600px]:rounded-b-none"
        ref={containerRef} tabIndex={-1}
        initial={{ opacity: 0, y: 30, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 20, scale: 0.97 }}
        transition={{ duration: 0.25, ease: 'easeOut' }}>
        <div className="flex flex-shrink-0 items-start justify-between gap-2 border-b border-border px-4 pb-3 pt-3.5">
          <div>
            <div className="mb-0.5 text-xs font-bold uppercase tracking-wider text-foreground">{label}</div>
            <div className="text-[11px] tracking-wide text-muted-foreground">
              {events.length === 0
                ? 'Sem eventos'
                : `${events.length} evento${events.length > 1 ? 's' : ''}`}
            </div>
          </div>
          <div className="flex flex-shrink-0 items-center gap-2">
            {events.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onExport && onExport(events, `cclx-${dateKey}.ics`)}
                title="Exportar dia para calendário"
              >
                <CalendarPlus className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Exportar</span>
              </Button>
            )}
            <button type="button" className="p-0.5 text-muted-foreground transition-colors hover:text-foreground" onClick={onClose} aria-label="Fechar">
              <X className="h-[18px] w-[18px]" aria-hidden="true" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {events.length === 0
            ? <div className="flex flex-col items-center gap-2.5 p-10 text-[11px] uppercase tracking-wider text-muted-foreground">
                <CalendarX className="h-8 w-8" aria-hidden="true" />
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
