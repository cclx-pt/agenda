// Gera um feed iCalendar (VCALENDAR) a partir dos eventos, para SUBSCRIÇÃO
// (os apps de calendário leem o URL periodicamente). Formato compatível com
// Google Calendar, Apple Calendar e Outlook.

function pad(n) {
  return String(n).padStart(2, '0')
}

function icsEscape(str) {
  if (!str) return ''
  return String(str)
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n')
}

// Dobra linhas com mais de 74 chars (RFC 5545).
function foldLine(line) {
  const MAX = 74
  if (line.length <= MAX) return line
  let out = line.slice(0, MAX)
  let i = MAX
  while (i < line.length) {
    out += '\r\n ' + line.slice(i, i + MAX - 1)
    i += MAX - 1
  }
  return out
}

const compact = (dateStr) => String(dateStr).replace(/-/g, '')

function timed(dateStr, timeStr) {
  const [h, m] = (timeStr || '00:00').split(':')
  return `${compact(dateStr)}T${pad(parseInt(h, 10))}${pad(parseInt(m, 10))}00`
}

function nextDay(dateStr) {
  const d = new Date(`${dateStr}T00:00:00`)
  d.setDate(d.getDate() + 1)
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`
}

function buildVEvent(event, stamp) {
  const lines = ['BEGIN:VEVENT', foldLine(`UID:${event.id}@cclx.pt`), `DTSTAMP:${stamp}`]
  const allDay = event.allDay || !event.timeStart
  if (allDay) {
    lines.push(`DTSTART;VALUE=DATE:${compact(event.date)}`)
    lines.push(`DTEND;VALUE=DATE:${nextDay(event.date)}`)
  } else {
    lines.push(`DTSTART:${timed(event.date, event.timeStart)}`)
    lines.push(`DTEND:${timed(event.date, event.timeEnd || event.timeStart)}`)
  }
  lines.push(foldLine(`SUMMARY:${icsEscape(event.title)}`))
  if (event.location) lines.push(foldLine(`LOCATION:${icsEscape(event.location)}`))
  const desc = [event.description, event.community && `Comunidade: ${event.community}`]
    .filter(Boolean)
    .join('\\n')
  if (desc) lines.push(foldLine(`DESCRIPTION:${icsEscape(desc)}`))
  if (event.category) lines.push(foldLine(`CATEGORIES:${icsEscape(String(event.category).toUpperCase())}`))
  lines.push('END:VEVENT')
  return lines.join('\r\n')
}

/** Constrói o texto VCALENDAR completo a partir de uma lista de eventos. */
export function buildCalendar(events, { name = 'Agenda CCLX' } = {}) {
  const now = new Date()
  const stamp =
    `${now.getUTCFullYear()}${pad(now.getUTCMonth() + 1)}${pad(now.getUTCDate())}` +
    `T${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}${pad(now.getUTCSeconds())}Z`
  const head = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//CCLX//Agenda//PT',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    foldLine(`X-WR-CALNAME:${icsEscape(name)}`),
    'X-WR-TIMEZONE:Europe/Lisbon',
    'REFRESH-INTERVAL;VALUE=DURATION:PT12H',
    'X-PUBLISHED-TTL:PT12H',
  ]
  const body = (events || []).map((e) => buildVEvent(e, stamp))
  return `${[...head, ...body, 'END:VCALENDAR'].join('\r\n')}\r\n`
}
