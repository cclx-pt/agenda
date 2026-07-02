import { Calendar, CalendarDays, Church, Clock, Lock, MapPin, Paperclip, Phone, Ticket } from 'lucide-react'

import { STATUS_META, API_BADGE, formatTimeRange, formatDateLabel } from '../utils/calendarHelpers'
import { useEventColors } from '../hooks/useEventColors'
import { cn } from '@/lib/utils'

export default function EventCard({ event, onClick }) {
  const status = STATUS_META[event.status]
  const { colorFor, subColorMap } = useEventColors()
  const vis = colorFor(event)
  const subColor = event.subcategory ? subColorMap[event.subcategory] : null

  return (
    <div
      className={cn(
        'group cursor-pointer border-b border-border outline-none transition-colors last:border-b-0 hover:bg-accent focus:bg-accent',
        status && 'bg-destructive/5 hover:bg-destructive/10 focus:bg-destructive/10',
        event.featured && 'cclx-featured',
      )}
      onClick={() => onClick(event)} role="button" tabIndex={0}
      onKeyDown={e => e.key === 'Enter' && onClick(event)}>

      {event.imageUrl
        ? <img className="block aspect-video w-full object-cover brightness-[0.88] transition-[filter] group-hover:brightness-100" src={event.imageUrl} alt={event.imageLabel || event.title} loading="lazy" />
        : <div className="flex aspect-video w-full items-center justify-center border-b border-border bg-muted text-muted-foreground">
            <CalendarDays className="h-6 w-6" aria-hidden="true" />
          </div>
      }

      <div className="px-3.5 pb-3.5 pt-2.5">
        <div className="mb-[7px] flex flex-wrap items-center gap-1.5 empty:hidden">
          {event.featured && <i className="ti ti-star-filled cclx-blink text-[12px] text-amber-500" aria-hidden="true" />}
          <span className="inline-flex items-center gap-1 rounded-sm bg-muted px-[7px] py-0.5 text-[9px] font-bold uppercase tracking-wide text-foreground">
            <Church className="h-2.5 w-2.5 text-primary" aria-hidden="true" />
            {event.community || event.responsible}
          </span>
          <span className="inline-block rounded-sm px-[7px] py-0.5 text-[9px] font-bold uppercase tracking-widest"
            style={{ background: vis.catBg, color: vis.catText }}>
            {vis.catLabel}
          </span>
          {event.subcategory && (
            <span className="inline-block rounded-sm bg-muted px-[7px] py-0.5 text-[9px] font-bold uppercase tracking-wide text-muted-foreground"
              style={subColor ? { background: subColor, color: '#334155' } : undefined}>
              {event.subcategory}
            </span>
          )}
          {event.privacyTag && (
            <span className="inline-flex items-center gap-1 rounded-sm bg-violet-600 px-[7px] py-0.5 text-[9px] font-extrabold uppercase tracking-wider text-white" title={`Privacidade: ${event.privacyTag}`}>
              <Lock className="h-2.5 w-2.5" aria-hidden="true" />
              {event.privacyTag}
            </span>
          )}
          {status && (
            <span className="inline-flex items-center gap-1 rounded-sm border border-dashed border-amber-500/60 bg-amber-500/10 px-[7px] py-0.5 text-[9px] font-extrabold uppercase tracking-wider text-amber-700">
              <i className={`ti ${status.icon}`} aria-hidden="true" />
              {status.label}
            </span>
          )}
          {event.isApi && (
            <span className="inline-flex items-center gap-1 rounded-sm bg-blue-500 px-[7px] py-0.5 text-[9px] font-extrabold uppercase tracking-wider text-white" title={API_BADGE.title}>
              <i className={`ti ${API_BADGE.icon}`} aria-hidden="true" />
              {API_BADGE.label}
            </span>
          )}
        </div>

        <div className="mb-2 text-sm font-bold leading-tight tracking-wide text-foreground">{event.title}</div>

        <div className="mb-2 flex flex-col gap-1.5 text-[11px] text-muted-foreground">
          {/* Data */}
          <div className="flex items-center gap-[7px]">
            <Calendar className="h-3.5 w-3.5 flex-shrink-0 text-primary" aria-hidden="true" />
            <span className="font-semibold capitalize text-foreground">{formatDateLabel(event.date)}</span>
          </div>
          {/* Hora */}
          <div className="flex items-center gap-[7px]">
            <Clock className="h-3.5 w-3.5 flex-shrink-0 text-primary" aria-hidden="true" />
            {formatTimeRange(event.timeStart, event.timeEnd) || 'Dia inteiro'}
          </div>
          {/* Local */}
          {event.location && (
            <div className="flex items-center gap-[7px]">
              <MapPin className="h-3.5 w-3.5 flex-shrink-0 text-primary" aria-hidden="true" />
              <span className="truncate">{event.location}</span>
            </div>
          )}
          {/* Contacto */}
          {(event.organizerPhone || event.organizerEmail || event.organizerContact) && (
            <div className="flex items-center gap-[7px]">
              <Phone className="h-3.5 w-3.5 flex-shrink-0 text-primary" aria-hidden="true" />
              <span className="truncate">{event.organizerPhone || event.organizerEmail || event.organizerContact}</span>
            </div>
          )}
          {/* Inscrições */}
          {event.registrationUrl && (
            <div className="flex items-center gap-[7px]">
              <Ticket className="h-3.5 w-3.5 flex-shrink-0 text-primary" aria-hidden="true" />
              <a href={event.registrationUrl} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}
                className="font-semibold text-primary underline underline-offset-2 hover:opacity-80">
                Inscrições
              </a>
            </div>
          )}
          {/* Google Maps */}
          {event.mapUrl && (
            <div className="flex items-center gap-[7px]">
              <MapPin className="h-3.5 w-3.5 flex-shrink-0 text-primary" aria-hidden="true" />
              <a href={event.mapUrl} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}
                className="font-semibold text-primary underline underline-offset-2 hover:opacity-80">
                Ver no Google Maps
              </a>
            </div>
          )}
          {/* Organizado por (comunidade) */}
          <div className="flex items-center gap-[7px]">
            <Church className="h-3.5 w-3.5 flex-shrink-0 text-primary" aria-hidden="true" />
            <span className="truncate">
              Organizado por:{' '}
              <span className="font-semibold text-foreground">{event.organizerName || event.community || event.responsible}</span>
              {event.organizerName && (event.community || event.responsible)
                ? ` (${event.community || event.responsible})`
                : ''}
            </span>
          </div>
        </div>

        {event.attachmentUrl && (
          <div className="mb-2 flex flex-wrap gap-1.5">
            <a href={event.attachmentUrl} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}
              className="inline-flex items-center gap-1 rounded-sm bg-muted px-2 py-0.5 text-[10px] font-semibold text-foreground transition-colors hover:bg-accent">
              <Paperclip className="h-3 w-3" aria-hidden="true" /> {event.attachmentName || 'Anexo'}
            </a>
          </div>
        )}

        <p className="border-t border-border pt-2 text-[11px] leading-relaxed text-muted-foreground">{event.description}</p>
      </div>
    </div>
  )
}
