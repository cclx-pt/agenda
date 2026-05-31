/**
 * apiService.js
 *
 * Integration with inChurch / inRadar public API.
 * Credentials are injected server-side by the Vite proxy (never exposed to the browser).
 *
 * Expected event shape (output):
 * {
 *   id:          string
 *   title:       string
 *   category:    'culto' | 'evento' | 'formacao' | 'jovens'
 *   date:        'YYYY-MM-DD'
 *   timeStart:   'HH:MM'
 *   timeEnd:     'HH:MM' | null
 *   location:    string
 *   responsible: string
 *   description: string
 *   imageUrl:    string | null
 *   imageLabel:  string | null
 * }
 */

const API_BASE = '/api'
const PAGE_SIZE = 200

// ── Low-level fetch ──────────────────────────────────────────────

async function apiFetch(path, signal) {
  const res = await fetch(`${API_BASE}${path}`, { signal })
  if (!res.ok) throw new Error(`API ${res.status}: ${res.statusText}`)
  return res.json()
}

/**
 * Fetch all pages of a paginated endpoint sequentially.
 */
async function fetchAllPages(path, signal) {
  let all = []
  let offset = 0

  while (true) {
    const page = await apiFetch(`${path}?limit=${PAGE_SIZE}&offset=${offset}`, signal)
    all = all.concat(page.results)
    if (!page.next) break
    offset += PAGE_SIZE
  }

  return all
}

// ── Category inference from event name ───────────────────────────

const CATEGORY_RULES = [
  { pattern: /celebra[çc][aã]o|culto|worship/i, category: 'culto' },
  { pattern: /loud|jovens|youth|teen|young/i,    category: 'jovens' },
  { pattern: /grupo|crescimento|\bgc\b|forma[çc][aã]o|escola|estudo|b1|be\s*one|oficina|logos/i, category: 'formacao' },
]

function inferCategory(name) {
  const n = name || ''
  for (const rule of CATEGORY_RULES) {
    if (rule.pattern.test(n)) return rule.category
  }
  return 'evento'
}

// ── Map inChurch event → app event ───────────────────────────────

function pad2(n) { return String(n).padStart(2, '0') }

function mapEvent(raw) {
  const start = new Date(raw.start_datetime)
  const end = raw.end_datetime ? new Date(raw.end_datetime) : null

  const date = raw.start_datetime.split('T')[0]
  const timeStart = `${pad2(start.getHours())}:${pad2(start.getMinutes())}`
  const timeEnd = end ? `${pad2(end.getHours())}:${pad2(end.getMinutes())}` : null

  const loc = raw.location
  const location = loc
    ? [loc.address, loc.address_number, loc.neighborhood, loc.city]
        .filter(Boolean).join(', ')
    : ''

  return {
    id: String(raw.id),
    title: raw.name,
    category: inferCategory(raw.name),
    date,
    timeStart,
    timeEnd,
    location,
    responsible: raw.responsible_church?.name || 'Igreja CCLX',
    description: raw.description || '',
    imageUrl: raw.image || raw.app_image || null,
    imageLabel: raw.image ? 'foto do evento' : null,
  }
}

// ── Public API ───────────────────────────────────────────────────

let _cache = null

/**
 * Fetch all active, calendar-visible events from inChurch.
 */
export async function fetchAllEvents({ signal } = {}) {
  if (_cache) return _cache

  const rawEvents = await fetchAllPages('/event/', signal)

  _cache = rawEvents
    .filter(e => e.show_on_calendar)
    .map(mapEvent)
    .sort((a, b) => a.date.localeCompare(b.date))

  return _cache
}

/**
 * Fetch events for a given date range.
 */
export async function fetchEvents(from, to, { signal } = {}) {
  const all = await fetchAllEvents({ signal })
  return all.filter(e => e.date >= from && e.date <= to)
}

/**
 * Invalidate the local cache (e.g. for manual refresh).
 */
export function clearEventCache() {
  _cache = null
}
