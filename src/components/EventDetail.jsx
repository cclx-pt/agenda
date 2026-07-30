import { motion } from 'framer-motion'
import {
  ArrowLeft,
  Calendar,
  CalendarDays,
  CalendarPlus,
  Clock,
  Image as ImageIcon,
  Lock,
  Church,
  MapPin,
  Paperclip,
  Pencil,
  Trash2,
  Ticket,
  UserCheck,
  X,
} from 'lucide-react'

import { STATUS_META, API_BADGE, formatTimeRange, formatDateLabel, formatDateRangeLabel, isMultiDay } from '../utils/calendarHelpers'
import { useModalA11y } from '../hooks/useModalA11y'
import { useEventColors } from '../hooks/useEventColors'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export default function EventDetail({ event, onClose, onBack, onExport, onDelete, onEdit }) {
  const status = STATUS_META[event.status]
  const { colorFor, subColorMap } = useEventColors()
  const vis = colorFor(event)
  const subColor = event.subcategory ? subColorMap[event.subcategory] : null
  const contactStr =
    [event.organizerPhone, event.organizerEmail].filter(Boolean).join(' · ') ||
    event.organizerContact ||
    ''
  const containerRef = useModalA11y(onClose)

  return (
    <motion.div className="fixed inset-0 z-[300] flex items-start justify-center bg-black/60 pt-12 max-[600px]:items-end max-[600px]:pt-0" onClick={e => { if (e.target === e.currentTarget) onClose() }}
      role="dialog" aria-modal="true" aria-label={event.title}
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}>

      <motion.div className="flex max-h-[84vh] w-[420px] max-w-[94vw] flex-col overflow-hidden rounded-lg border bg-background shadow-lg max-[600px]:max-h-[92vh] max-[600px]:w-full max-[600px]:max-w-full max-[600px]:rounded-b-none"
        ref={containerRef} tabIndex={-1}
        initial={{ opacity: 0, y: 40, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 30, scale: 0.96 }}
        transition={{ duration: 0.3, ease: 'easeOut' }}>

        {onBack && (
          <button className="flex flex-shrink-0 items-center gap-1.5 px-3.5 pt-2.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground transition-colors hover:text-foreground" onClick={onBack}>
            <ArrowLeft className="h-3 w-3" aria-hidden="true" />
            Voltar ao dia
          </button>
        )}

        <div className="relative h-[170px] flex-shrink-0 bg-muted max-[600px]:h-[150px]">
          {event.imageUrl
            ? <>
                <img src={event.imageUrl} alt={event.imageLabel || event.title} className="block h-full w-full object-cover brightness-[0.82]" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/55 to-transparent" />
                {event.imageLabel && (
                  <div className="absolute bottom-2.5 left-3 flex items-center gap-1 rounded-sm bg-primary px-2 py-[3px] text-[9px] font-bold uppercase tracking-wider text-primary-foreground">
                    <ImageIcon className="h-2.5 w-2.5" aria-hidden="true" />
                    {event.imageLabel}
                  </div>
                )}
              </>
            : <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-muted-foreground">
                <CalendarDays className="h-8 w-8" aria-hidden="true" />
                <span className="text-[10px] uppercase tracking-wider">Sem imagem</span>
              </div>
          }
          <button className="absolute right-2.5 top-2.5 flex h-7 w-7 items-center justify-center rounded-full bg-black/45 text-white transition-colors hover:bg-black/75" onClick={onClose} aria-label="Fechar">
            <X className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </div>

        <div className={cn('flex-1 overflow-y-auto px-5 pb-5 pt-[18px]', status && 'bg-destructive/5')}>
          <div className="mb-2.5 flex flex-wrap items-center gap-2 empty:hidden">
            {event.featured && <i className="ti ti-star-filled cclx-blink text-[13px] text-amber-500" aria-hidden="true" />}
            <span className="inline-flex items-center gap-1 rounded-sm bg-muted px-2 py-[3px] text-[9px] font-bold uppercase tracking-wide text-foreground">
              <Church className="h-2.5 w-2.5 text-primary" aria-hidden="true" />
              {event.community || event.responsible}
            </span>
            <span className="inline-block rounded-sm px-2 py-[3px] text-[9px] font-bold uppercase tracking-widest"
              style={{ background: vis.catBg, color: vis.catText }}>
              {vis.catLabel}
            </span>
            {event.subcategory && (
              <span className="inline-block rounded-sm bg-muted px-2 py-[3px] text-[9px] font-bold uppercase tracking-wide text-muted-foreground"
                style={subColor ? { background: subColor, color: '#334155' } : undefined}>
                {event.subcategory}
              </span>
            )}
            {event.privacyTag && (
              <span className="inline-flex items-center gap-1 rounded-sm bg-violet-600 px-2 py-[3px] text-[9px] font-extrabold uppercase tracking-wider text-white" title={`Privacidade: ${event.privacyTag}`}>
                <Lock className="h-2.5 w-2.5" aria-hidden="true" />
                {event.privacyTag}
              </span>
            )}
            {status && (
              <span className="inline-flex items-center gap-1 rounded-sm border border-dashed border-amber-500/60 bg-amber-500/10 px-2 py-[3px] text-[9px] font-extrabold uppercase tracking-wider text-amber-700">
                <i className={`ti ${status.icon}`} aria-hidden="true" />
                {status.label}
              </span>
            )}
            {event.isApi && (
              <span className="inline-flex items-center gap-1 rounded-sm bg-blue-500 px-2 py-[3px] text-[9px] font-extrabold uppercase tracking-wider text-white" title={API_BADGE.title}>
                <i className={`ti ${API_BADGE.icon}`} aria-hidden="true" />
                {API_BADGE.label}
              </span>
            )}
          </div>

          <h2 className="mb-3.5 text-[22px] font-extrabold uppercase leading-[1.15] tracking-wide text-foreground">{event.title}</h2>

          <div className="mb-0.5 flex flex-col gap-2.5">
            {/* Data */}
            <div className="flex items-start gap-2.5 text-xs text-muted-foreground">
              <Calendar className="mt-px h-3.5 w-3.5 flex-shrink-0 text-primary" aria-hidden="true" />
              <span className="capitalize text-foreground">{isMultiDay(event) ? formatDateRangeLabel(event.date, event.endDate) : formatDateLabel(event.date)}</span>
            </div>
            {/* Hora */}
            <div className="flex items-start gap-2.5 text-xs text-muted-foreground">
              <Clock className="mt-px h-3.5 w-3.5 flex-shrink-0 text-primary" aria-hidden="true" />
              <span>{formatTimeRange(event.timeStart, event.timeEnd) || 'Dia inteiro'}</span>
            </div>
            {/* Local */}
            {event.location && (
              <div className="flex items-start gap-2.5 text-xs text-muted-foreground">
                <MapPin className="mt-px h-3.5 w-3.5 flex-shrink-0 text-primary" aria-hidden="true" />
                <span>{event.location}</span>
              </div>
            )}
            {/* Contacto */}
            {(event.organizerName || contactStr) && (
              <div className="flex items-start gap-2.5 text-xs text-muted-foreground">
                <UserCheck className="mt-px h-3.5 w-3.5 flex-shrink-0 text-primary" aria-hidden="true" />
                <span className="min-w-0 break-words">
                  {event.organizerName && <span className="font-semibold text-foreground">{event.organizerName}</span>}
                  {contactStr ? (event.organizerName ? ` (${contactStr})` : contactStr) : ''}
                </span>
              </div>
            )}
            {/* Inscrições — convite interno (landing) ou link externo */}
            {(event.inviteSlug || event.registrationUrl) && (
              <div className="flex items-start gap-2.5 text-xs text-muted-foreground">
                <Ticket className="mt-px h-3.5 w-3.5 flex-shrink-0 text-primary" aria-hidden="true" />
                <a
                  href={event.inviteSlug ? `/invite/${event.inviteSlug}` : event.registrationUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-semibold text-primary underline underline-offset-2 hover:opacity-80"
                >
                  Inscrições
                </a>
              </div>
            )}
            {/* Google Maps */}
            {event.mapUrl && (
              <div className="flex items-start gap-2.5 text-xs text-muted-foreground">
                <MapPin className="mt-px h-3.5 w-3.5 flex-shrink-0 text-primary" aria-hidden="true" />
                <a
                  href={event.mapUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-semibold text-primary underline underline-offset-2 hover:opacity-80"
                >
                  Ver no Google Maps
                </a>
              </div>
            )}
            {/* Anexo */}
            {event.attachmentUrl && (
              <div className="flex items-start gap-2.5 text-xs text-muted-foreground">
                <Paperclip className="mt-px h-3.5 w-3.5 flex-shrink-0 text-primary" aria-hidden="true" />
                <a
                  href={event.attachmentUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-semibold text-primary underline underline-offset-2 hover:opacity-80"
                >
                  {event.attachmentName || 'Anexo'}
                </a>
              </div>
            )}
            {/* Organizado por (comunidade) */}
            <div className="flex items-start gap-2.5 text-xs text-muted-foreground">
              <Church className="mt-px h-3.5 w-3.5 flex-shrink-0 text-primary" aria-hidden="true" />
              <span>Organizado por: <span className="font-semibold text-foreground">{event.community || event.responsible}</span></span>
            </div>
          </div>

          <hr className="my-3.5 border-border" />
          <p className="mb-[18px] text-[13px] leading-[1.7] text-muted-foreground">{event.description}</p>

          <div className="flex flex-wrap gap-2.5">
            <Button className="flex-1" onClick={() => onExport ? onExport(event) : null}>
              <CalendarPlus className="h-4 w-4" aria-hidden="true" />
              Guardar no calendário
            </Button>
            {onEdit && (
              <Button variant="outline" className="flex-1" onClick={() => onEdit(event)}>
                <Pencil className="h-4 w-4" aria-hidden="true" />
                Editar
              </Button>
            )}
            {onDelete && (
              <Button variant="outline" className="flex-1 border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground" onClick={() => onDelete(event)}>
                <Trash2 className="h-4 w-4" aria-hidden="true" />
                Eliminar
              </Button>
            )}
          </div>
        </div>

      </motion.div>
    </motion.div>
  )
}
