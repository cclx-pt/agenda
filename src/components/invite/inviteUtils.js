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
// URL da página dedicada de inscrição (/invite/<slug>/inscricao), preservando ?g=.
export function inviteRsvpHref(slug) {
  const g = currentGuestToken()
  const base = `/invite/${encodeURIComponent(slug)}/inscricao`
  return g ? `${base}?g=${encodeURIComponent(g)}` : base
}
// URL da landing do convite (/invite/<slug>), preservando ?g=.
export function inviteHomeHref(slug) {
  const g = currentGuestToken()
  const base = `/invite/${encodeURIComponent(slug)}`
  return g ? `${base}?g=${encodeURIComponent(g)}` : base
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
