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
