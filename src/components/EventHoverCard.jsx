import { Calendar, CalendarDays, Church, Clock, Lock, MapPin } from 'lucide-react'

import { HoverCard, HoverCardTrigger, HoverCardContent } from './ui/hover-card'
import { useEventColors } from '../hooks/useEventColors'
import {
  STATUS_META,
  API_BADGE,
  formatTimeRange,
  formatDateLabel,
  formatDateRangeLabel,
  isMultiDay,
} from '../utils/calendarHelpers'

/**
 * Envolve um chip/linha de evento e mostra, ao passar o cursor (sem clicar),
 * uma pré-visualização compacta do cartão. O clique continua a abrir o detalhe.
 * Em ecrãs tácteis não abre (só há toque, sem hover) — o clique abre o detalhe.
 */
export default function EventHoverCard({ event, children, side = 'right', align = 'start' }) {
  const { colorFor, subColorMap } = useEventColors()
  const vis = colorFor(event)
  const status = STATUS_META[event.status]
  const subColor = event.subcategory ? subColorMap[event.subcategory] : null

  return (
    <HoverCard openDelay={180} closeDelay={80}>
      <HoverCardTrigger asChild>{children}</HoverCardTrigger>
      <HoverCardContent
        side={side}
        align={align}
        sideOffset={8}
        className="w-72 overflow-hidden p-0"
        onClick={(e) => e.stopPropagation()}
      >
        {event.imageUrl ? (
          <img src={event.imageUrl} alt="" loading="lazy" className="block aspect-video w-full object-cover" />
        ) : (
          <div className="flex aspect-video w-full items-center justify-center border-b border-border bg-muted text-muted-foreground">
            <CalendarDays className="h-6 w-6" aria-hidden="true" />
          </div>
        )}

        <div className="p-3">
          <div className="mb-1.5 flex flex-wrap items-center gap-1 empty:hidden">
            {event.featured && <i className="ti ti-star-filled text-[11px] text-amber-500" aria-hidden="true" />}
            <span className="inline-flex items-center gap-1 rounded-sm bg-muted px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-foreground">
              <Church className="h-2.5 w-2.5 text-primary" aria-hidden="true" />
              {event.community || event.responsible}
            </span>
            <span
              className="inline-block rounded-sm px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-widest"
              style={{ background: vis.catBg, color: vis.catText }}
            >
              {vis.catLabel}
            </span>
            {event.subcategory && (
              <span
                className="inline-block rounded-sm bg-muted px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-muted-foreground"
                style={subColor ? { background: subColor, color: '#334155' } : undefined}
              >
                {event.subcategory}
              </span>
            )}
            {event.privacyTag && (
              <span className="inline-flex items-center gap-1 rounded-sm bg-violet-600 px-1.5 py-0.5 text-[9px] font-extrabold uppercase tracking-wider text-white">
                <Lock className="h-2.5 w-2.5" aria-hidden="true" />
                {event.privacyTag}
              </span>
            )}
            {status && (
              <span className="inline-flex items-center gap-1 rounded-sm border border-dashed border-amber-500/60 bg-amber-500/10 px-1.5 py-0.5 text-[9px] font-extrabold uppercase tracking-wider text-amber-700">
                <i className={`ti ${status.icon}`} aria-hidden="true" />
                {status.label}
              </span>
            )}
            {event.isApi && (
              <span className="inline-flex items-center gap-1 rounded-sm bg-blue-500 px-1.5 py-0.5 text-[9px] font-extrabold uppercase tracking-wider text-white">
                {API_BADGE.label}
              </span>
            )}
          </div>

          <div className="mb-1.5 text-sm font-bold leading-tight text-foreground">{event.title}</div>

          <div className="flex flex-col gap-1 text-[11px] text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5 flex-shrink-0 text-primary" aria-hidden="true" />
              <span className="font-semibold capitalize text-foreground">
                {isMultiDay(event) ? formatDateRangeLabel(event.date, event.endDate) : formatDateLabel(event.date)}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5 flex-shrink-0 text-primary" aria-hidden="true" />
              {formatTimeRange(event.timeStart, event.timeEnd) || 'Dia inteiro'}
            </div>
            {event.location && (
              <div className="flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5 flex-shrink-0 text-primary" aria-hidden="true" />
                <span className="truncate">{event.location}</span>
              </div>
            )}
          </div>
        </div>
      </HoverCardContent>
    </HoverCard>
  )
}
