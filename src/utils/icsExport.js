/**
 * icsExport.js
 * Generates and downloads .ics (iCalendar) files
 * compatible with Google Calendar, Apple Calendar, Outlook, etc.
 */

function pad(n) {
  return String(n).padStart(2, '0')
}

/**
 * Convert a date string 'YYYY-MM-DD' + time 'HH:MM' into iCal DTSTART format
 * Returns: '20260614T183000'
 */
function toICSDate(dateStr, timeStr) {
  const [y, m, d] = dateStr.split('-')
  const [h, min] = (timeStr || '00:00').split(':')
  return `${y}${m}${d}T${h}${pad(parseInt(min))}00`
}

/**
 * Escape special characters for iCal text fields
 */
function icsEscape(str) {
  if (!str) return ''
  return str
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n')
}

/**
 * Fold long lines (iCal spec: lines > 75 chars must be folded)
 */
function foldLine(line) {
  const MAX = 75
  if (line.length <= MAX) return line
  let result = ''
  let i = 0
  while (i < line.length) {
    if (i === 0) {
      result += line.slice(0, MAX)
      i = MAX
    } else {
      result += '\r\n ' + line.slice(i, i + MAX - 1)
      i += MAX - 1
    }
  }
  return result
}

/**
 * Build a VEVENT block for a single event
 */
function buildVEvent(event) {
  const dtStart = toICSDate(event.date, event.timeStart)
  const dtEnd = event.timeEnd
    ? toICSDate(event.date, event.timeEnd)
    : toICSDate(event.date, event.timeStart) // fallback: same time

  const now = new Date()
  const stamp = `${now.getFullYear()}${pad(now.getMonth()+1)}${pad(now.getDate())}T${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`

  const lines = [
    'BEGIN:VEVENT',
    foldLine(`UID:${event.id}@cclx.pt`),
    foldLine(`DTSTAMP:${stamp}`),
    foldLine(`DTSTART:${dtStart}`),
    foldLine(`DTEND:${dtEnd}`),
    foldLine(`SUMMARY:${icsEscape(event.title)}`),
    foldLine(`LOCATION:${icsEscape(event.location)}`),
    foldLine(`DESCRIPTION:${icsEscape(event.description)}`),
    foldLine(`CATEGORIES:${icsEscape(event.category.toUpperCase())}`),
    foldLine(`ORGANIZER;CN=${icsEscape(event.responsible)}:mailto:geral@cclx.pt`),
    'END:VEVENT',
  ]

  return lines.join('\r\n')
}

/**
 * Download a single event as .ics
 */
export function downloadEventICS(event) {
  const content = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//CCLX//Agenda//PT',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    buildVEvent(event),
    'END:VCALENDAR',
  ].join('\r\n')

  triggerDownload(content, `${slugify(event.title)}.ics`)
}

/**
 * Download multiple events (e.g. whole month / view) as .ics
 */
export function downloadMultipleICS(events, filename = 'cclx-agenda.ics') {
  const vevents = events.map(buildVEvent).join('\r\n')

  const content = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//CCLX//Agenda//PT',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:CCLX Agenda',
    'X-WR-TIMEZONE:Europe/Lisbon',
    vevents,
    'END:VCALENDAR',
  ].join('\r\n')

  triggerDownload(content, filename)
}

function slugify(str) {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

function triggerDownload(content, filename) {
  const blob = new Blob([content], { type: 'text/calendar;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

// ── Calendar URL builders (single event) ─────────────────────────

/**
 * Build a Google Calendar "Add Event" URL for a single event.
 */
export function googleCalendarUrl(event) {
  const dtStart = toICSDate(event.date, event.timeStart)
  const dtEnd = event.timeEnd
    ? toICSDate(event.date, event.timeEnd)
    : toICSDate(event.date, event.timeStart)

  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: event.title,
    dates: `${dtStart}/${dtEnd}`,
    details: event.description || '',
    location: event.location || '',
    ctz: 'Europe/Lisbon',
  })
  return `https://calendar.google.com/calendar/render?${params}`
}

/**
 * Build an Outlook Web "Add Event" URL for a single event.
 */
export function outlookCalendarUrl(event) {
  const start = `${event.date}T${event.timeStart || '00:00'}:00`
  const end = event.timeEnd
    ? `${event.date}T${event.timeEnd}:00`
    : start

  const params = new URLSearchParams({
    path: '/calendar/action/compose',
    rru: 'addevent',
    subject: event.title,
    startdt: start,
    enddt: end,
    body: event.description || '',
    location: event.location || '',
  })
  return `https://outlook.live.com/calendar/0/action/compose?${params}`
}

/**
 * Build a Yahoo Calendar "Add Event" URL for a single event.
 */
export function yahooCalendarUrl(event) {
  const dtStart = toICSDate(event.date, event.timeStart)
  const dtEnd = event.timeEnd
    ? toICSDate(event.date, event.timeEnd)
    : toICSDate(event.date, event.timeStart)

  const params = new URLSearchParams({
    v: '60',
    title: event.title,
    st: dtStart,
    et: dtEnd,
    desc: event.description || '',
    in_loc: event.location || '',
  })
  return `https://calendar.yahoo.com/?${params}`
}
