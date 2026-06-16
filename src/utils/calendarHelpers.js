import { format, getDaysInMonth, getDay, parse } from 'date-fns'
import { pt } from 'date-fns/locale'

export const MONTHS_PT = [
  'Janeiro','Fevereiro','Março','Abril','Maio','Junho',
  'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'
]

export const MONTHS_SHORT = [
  'Jan','Fev','Mar','Abr','Mai','Jun',
  'Jul','Ago','Set','Out','Nov','Dez'
]

export const WEEKDAYS_SHORT = ['Seg','Ter','Qua','Qui','Sex','Sáb','Dom']
export const WEEKDAYS_FULL  = ['segunda','terça','quarta','quinta','sexta','sábado','domingo']

/** Monday-first day of week index (0=Mon … 6=Sun) */
export function mondayFirstDay(date) {
  return (getDay(date) + 6) % 7
}

/** How many days in a given month */
export function daysInMonth(year, month) {
  return getDaysInMonth(new Date(year, month))
}

/** Build a YYYY-MM-DD string */
export function toDateKey(year, month, day) {
  return format(new Date(year, month, day), 'yyyy-MM-dd')
}

/** Parse YYYY-MM-DD into { year, month (0-based), day } */
export function parseDateKey(key) {
  const d = parse(key, 'yyyy-MM-dd', new Date())
  return { year: d.getFullYear(), month: d.getMonth(), day: d.getDate() }
}

/** Group events array by date key */
export function groupByDate(events) {
  return events.reduce((acc, evt) => {
    if (!acc[evt.date]) acc[evt.date] = []
    acc[evt.date].push(evt)
    return acc
  }, {})
}

/**
 * Intervalo de datas (YYYY-MM-DD, inclusivo) coberto por uma vista do calendário.
 * `day` é o dia âncora (1..31) usado pelas vistas diária e semanal.
 */
export function rangeForView(view, year, month, day = 1) {
  if (view === 'day') {
    const k = toDateKey(year, month, day)
    return { from: k, to: k }
  }
  if (view === 'week') {
    const dow = mondayFirstDay(new Date(year, month, day)) // 0=Seg … 6=Dom
    const monday = new Date(year, month, day - dow)
    const sunday = new Date(year, month, day - dow + 6)
    return {
      from: toDateKey(monday.getFullYear(), monday.getMonth(), monday.getDate()),
      to: toDateKey(sunday.getFullYear(), sunday.getMonth(), sunday.getDate()),
    }
  }
  if (view === 'year') {
    return { from: toDateKey(year, 0, 1), to: toDateKey(year, 11, 31) }
  }
  const span = view === 'quarter' ? 3 : view === 'semester' ? 6 : 1
  const end = new Date(year, month + span, 0) // último dia do último mês do intervalo
  return {
    from: toDateKey(year, month, 1),
    to: toDateKey(end.getFullYear(), end.getMonth(), end.getDate()),
  }
}

/** Format time range "10:30 – 12:00" or just "10:30" */
export function formatTimeRange(start, end) {
  if (!end || end === start) return start
  return `${start} – ${end}`
}

/** Pretty print a date key for display */
export function formatDateLabel(dateKey) {
  const d = parse(dateKey, 'yyyy-MM-dd', new Date())
  const weekday = format(d, 'EEEE', { locale: pt })
  const cap = weekday.charAt(0).toUpperCase() + weekday.slice(1)
  const day = d.getDate()
  return `${cap}, ${day} de ${MONTHS_PT[d.getMonth()]} ${d.getFullYear()}`
}

/** Numeric date "dd/mm/aaaa" from a yyyy-MM-dd key. */
export function formatDateNumeric(dateKey) {
  if (!dateKey) return ''
  const d = parse(dateKey, 'yyyy-MM-dd', new Date())
  if (Number.isNaN(d.getTime())) return ''
  return format(d, 'dd/MM/yyyy')
}

/** Numeric date + time "dd/mm/aaaa HH:mm" from an ISO string or Date. */
export function formatDateTimeNumeric(value) {
  if (!value) return ''
  const d = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(d.getTime())) return ''
  return format(d, 'dd/MM/yyyy HH:mm')
}

/** Numeric date "dd/mm/aaaa" (sem hora) a partir de um ISO string ou Date. */
export function formatDateNumericValue(value) {
  if (!value) return ''
  const d = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(d.getTime())) return ''
  return format(d, 'dd/MM/yyyy')
}

export const CATEGORY_META = {
  culto: {
    label: 'Celebração',
    colorVar: 'var(--evt-culto-text)',
    bgVar: 'var(--evt-culto-bg)',
  },
  evento: {
    label: 'Evento',
    colorVar: 'var(--evt-evento-text)',
    bgVar: 'var(--evt-evento-bg)',
  },
  formacao: {
    label: 'Formação',
    colorVar: 'var(--evt-formacao-text)',
    bgVar: 'var(--evt-formacao-bg)',
  },
  jovens: {
    label: 'Jovens',
    colorVar: 'var(--evt-jovens-text)',
    bgVar: 'var(--evt-jovens-bg)',
  },
}

// Estado editorial do evento. Eventos publicados nao mostram selo; rascunhos e
// pendentes mostram-se so a gestores (admin/aprovador/editor), com indicacao visual.
// `bg` = fundo vermelho leve usado para assinalar drafts em todas as vistas.
const DRAFT_BG = 'rgba(226, 87, 76, 0.16)'
export const STATUS_META = {
  rascunho: { label: 'Rascunho', icon: 'ti-pencil', bg: DRAFT_BG },
  pendente: { label: 'Pendente', icon: 'ti-clock-pause', bg: DRAFT_BG },
}

// Selo para eventos importados da API externa (inChurch / inRadar).
export const API_BADGE = { label: 'APP', icon: 'ti-cloud-download', title: 'Evento importado da inChurch (APP)' }
