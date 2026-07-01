import { CalendarDays, Church, Clock, Lock, MapPin, Paperclip } from 'lucide-react'

import { CATEGORY_META, STATUS_META, API_BADGE, formatTimeRange } from '../utils/calendarHelpers'
import { cn } from '@/lib/utils'

export default function EventCard({ event, onClick }) {
  const cat = CATEGORY_META[event.category] || CATEGORY_META.evento
  const status = STATUS_META[event.status]

  return (
    <div
      className={cn(
        'group cursor-pointer border-b border-border outline-none transition-colors last:border-b-0 hover:bg-accent focus:bg-accent',
        status && 'bg-destructive/5 hover:bg-destructive/10 focus:bg-destructive/10',
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
        <div className="mb-[7px] flex flex-wrap items-center gap-1.5">
          <span className="inline-block rounded-sm px-[7px] py-0.5 text-[9px] font-bold uppercase tracking-widest"
            style={{ background: cat.bgVar, color: cat.colorVar }}>
            {cat.label}
          </span>
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

        <div className="mb-2 flex flex-col gap-1">
          <div className="flex items-center gap-[7px] text-[11px] text-muted-foreground">
            <Clock className="h-3 w-3 flex-shrink-0 text-muted-foreground" aria-hidden="true" />
            {formatTimeRange(event.timeStart, event.timeEnd)}
          </div>
          <div className="flex items-center gap-[7px] text-[11px] text-muted-foreground">
            <MapPin className="h-3 w-3 flex-shrink-0 text-muted-foreground" aria-hidden="true" />
            {event.location}
          </div>
          <div className="flex items-center gap-[7px] text-[11px] text-muted-foreground">
            <Church className="h-3 w-3 flex-shrink-0 text-muted-foreground" aria-hidden="true" />
            {event.responsible}
          </div>
        </div>

        {(event.mapUrl || event.attachmentUrl) && (
          <div className="mb-2 flex flex-wrap gap-1.5">
            {event.mapUrl && (
              <a href={event.mapUrl} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}
                className="inline-flex items-center gap-1 rounded-sm bg-muted px-2 py-0.5 text-[10px] font-semibold text-foreground transition-colors hover:bg-accent">
                <MapPin className="h-3 w-3" aria-hidden="true" /> Mapa
              </a>
            )}
            {event.attachmentUrl && (
              <a href={event.attachmentUrl} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}
                className="inline-flex items-center gap-1 rounded-sm bg-muted px-2 py-0.5 text-[10px] font-semibold text-foreground transition-colors hover:bg-accent">
                <Paperclip className="h-3 w-3" aria-hidden="true" /> Anexo
              </a>
            )}
          </div>
        )}

        <p className="border-t border-border pt-2 text-[11px] leading-relaxed text-muted-foreground">{event.description}</p>
      </div>
    </div>
  )
}
