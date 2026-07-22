// Utilitários puros da página de convite (sem componentes, para não disparar o
// aviso react-refresh de "só componentes" no ficheiro de cartões).

export function fmtDate(value) {
  if (!value) return ''
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return String(value)
  return d.toLocaleDateString('pt-PT', { day: 'numeric', month: 'long', year: 'numeric' })
}

export function fmtTime(value) {
  if (!value) return ''
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })
}

export function fmtDateRange(start, end) {
  if (!start) return ''
  if (!end) return fmtDate(start)
  const a = new Date(start)
  const b = new Date(end)
  if (a.toDateString() === b.toDateString()) return fmtDate(start)
  return `${fmtDate(start)} – ${fmtDate(end)}`
}

// Token pessoal (?g=) do URL atual, se existir.
function currentGuestToken() {
  if (typeof window === 'undefined') return null
  return new URLSearchParams(window.location.search).get('g')
}
// URL da página dedicada de inscrição (/invite/<slug>/inscricao), preservando ?g= e
// (opcional) pré-selecionando um bilhete via ?ticket=.
export function inviteRsvpHref(slug, ticketId) {
  const g = currentGuestToken()
  const params = new URLSearchParams()
  if (ticketId) params.set('ticket', ticketId)
  if (g) params.set('g', g)
  const qs = params.toString()
  return `/invite/${encodeURIComponent(slug)}/inscricao${qs ? `?${qs}` : ''}`
}
// URL da landing do convite (/invite/<slug>), preservando ?g=.
export function inviteHomeHref(slug) {
  const g = currentGuestToken()
  const base = `/invite/${encodeURIComponent(slug)}`
  return g ? `${base}?g=${encodeURIComponent(g)}` : base
}

// Rótulo de preço/tipo de um bilhete (lista "Custo" + seletor).
export function ticketPrice(t) {
  if (!t) return ''
  if (t.kind === 'gratis') return 'Grátis'
  if (t.kind === 'voluntaria') {
    return t.price != null && t.price > 0
      ? `Doação (sugerido ${Number(t.price).toFixed(2)} ${t.currency || 'EUR'})`
      : 'Doação (valor à escolha)'
  }
  return t.price != null && t.price > 0 ? `${Number(t.price).toFixed(2)} ${t.currency || 'EUR'}` : 'Grátis'
}

// Situação (estado combinado) de uma inscrição, derivada de rsvpState + paymentState:
//  - Confirmada (rsvp confirmado + pagamento não aplicável/pago → grátis/doação ou pago aprovado)
//  - Pendente comprovativo (rsvp confirmado + pagamento pendente → bilhete Pago à espera do comprovativo)
//  - Aprovação de comprovativo pendente (comprovativo carregado, a aguardar o organizador)
//  - Lista de espera / Cancelada / Expirada / Pendente
export const SITUACAO_LABEL = {
  confirmada: 'Confirmada',
  comprovativo: 'Pendente comprovativo',
  validacao: 'Aprovação de comprovativo pendente',
  espera: 'Lista de espera',
  cancelada: 'Cancelada',
  expirada: 'Expirada',
  pendente: 'Pendente',
}
export const SITUACAO_BADGE = {
  confirmada: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-400',
  comprovativo: 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-400',
  validacao: 'bg-sky-100 text-sky-800 dark:bg-sky-500/15 dark:text-sky-400',
  espera: 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-400',
  cancelada: 'bg-red-100 text-red-800 dark:bg-red-500/15 dark:text-red-400',
  expirada: 'bg-muted text-muted-foreground',
  pendente: 'bg-muted text-muted-foreground',
}
export function inscricaoSituacao(guest) {
  const rsvp = guest?.rsvpState
  const pay = guest?.paymentState
  if (rsvp === 'declined') return 'cancelada'
  if (rsvp === 'waitlisted') return 'espera'
  if (rsvp === 'confirmed') {
    if (pay === 'pending') return 'comprovativo'
    if (pay === 'awaiting_validation') return 'validacao'
    if (pay === 'expired') return 'expirada'
    return 'confirmada'
  }
  return 'pendente'
}

// Converte um link de YouTube/Vimeo num URL de embed, ou devolve null.
export function toEmbed(url) {
  if (!url) return null
  const yt = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]+)/)
  if (yt) return `https://www.youtube.com/embed/${yt[1]}`
  const vm = url.match(/vimeo\.com\/(\d+)/)
  if (vm) return `https://player.vimeo.com/video/${vm[1]}`
  return null
}

// Gera um data-URL .ics a partir das datas do convite (add-to-calendar).
export function buildIcs(inv) {
  if (!inv?.startDatetime) return null
  const dt = (v) => {
    const d = new Date(v)
    if (Number.isNaN(d.getTime())) return null
    return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
  }
  const start = dt(inv.startDatetime)
  if (!start) return null
  const end = inv.endDatetime
    ? dt(inv.endDatetime)
    : dt(new Date(new Date(inv.startDatetime).getTime() + 2 * 3600 * 1000))
  const esc = (s) => String(s ?? '').replace(/([,;\\])/g, '\\$1').replace(/\n/g, '\\n')
  const uid = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : String(Date.now())
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//CCLX//Convites//PT',
    'BEGIN:VEVENT',
    `UID:${uid}@cclx.pt`,
    `DTSTART:${start}`,
    `DTEND:${end}`,
    `SUMMARY:${esc(inv.title)}`,
    inv.location ? `LOCATION:${esc(inv.location)}` : '',
    'END:VEVENT',
    'END:VCALENDAR',
  ].filter(Boolean)
  return 'data:text/calendar;charset=utf-8,' + encodeURIComponent(lines.join('\r\n'))
}
