/**
 * apiService.js
 *
 * Fonte de dados da agenda pública: junta DUAS origens.
 *
 *  1. inChurch / inRadar — eventos reais lidos da API pública (`/api/event/`).
 *     As credenciais são injetadas no proxy (nunca expostas ao browser).
 *  2. System of Record (SoR) — eventos publicados na própria gestão
 *     (`/data/events/public`).
 *
 * Os dois conjuntos são combinados e ordenados por data. Se uma das origens
 * falhar, a agenda mostra à mesma os eventos da outra (leitura resiliente).
 *
 * Forma de evento (saída):
 * {
 *   id:          string
 *   title:       string
 *   category:    'culto' | 'evento' | 'formacao' | 'jovens'
 *   community:   string
 *   date:        'YYYY-MM-DD'
 *   timeStart:   'HH:MM' | null
 *   timeEnd:     'HH:MM' | null
 *   location:    string
 *   responsible: string
 *   description: string
 *   imageUrl:    string | null
 *   imageLabel:  string | null
 * }
 */

import { DEFAULT_CHURCH, inferChurchFromText } from '../utils/churches.js'

const INCHURCH_BASE = '/api'
const SOR_BASE = '/data/events'
const INTEGRATION_BASE = '/data/integration'
const PAGE_SIZE = 200

// ── Error handling ───────────────────────────────────────────────

const STATUS_MESSAGES = {
  400: 'Pedido inválido ao servidor da agenda.',
  401: 'Sessão não autorizada.',
  403: 'Sem permissão para aceder a estes eventos.',
  404: 'Recurso não encontrado no servidor da agenda.',
  429: 'Demasiados pedidos. Tenta novamente dentro de momentos.',
  500: 'Erro interno no servidor da agenda. Tenta mais tarde.',
  502: 'O servidor da agenda está temporariamente indisponível.',
  503: 'Serviço da agenda indisponível. Tenta mais tarde.',
}

export class ApiError extends Error {
  constructor(status, statusText) {
    const message =
      STATUS_MESSAGES[status] ||
      (status === 0
        ? statusText || 'Sem ligação à rede ou ao servidor.'
        : status >= 500
          ? 'Erro no servidor da agenda. Tenta mais tarde.'
          : `Erro ao contactar o servidor (${status}).`)
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.statusText = statusText
  }
}

// ── inChurch: leitura paginada ───────────────────────────────────

async function inchurchFetch(path, signal) {
  const res = await fetch(`${INCHURCH_BASE}${path}`, { signal })
  if (!res.ok) throw new ApiError(res.status, res.statusText)
  return res.json()
}

async function fetchInchurchPages(path, signal) {
  let all = []
  let offset = 0

  while (true) {
    const page = await inchurchFetch(`${path}?limit=${PAGE_SIZE}&offset=${offset}`, signal)
    all = all.concat(page.results || [])
    if (!page.next) break
    offset += PAGE_SIZE
  }

  return all
}

// ── inChurch: inferência de categoria pelo nome ──────────────────

const CATEGORY_RULES = [
  { pattern: /celebra[çc][aã]o|culto|worship/i, category: 'culto' },
  { pattern: /loud|jovens|youth|teen|young/i, category: 'jovens' },
  { pattern: /grupo|crescimento|\bgc\b|forma[çc][aã]o|escola|estudo|b1|be\s*one|oficina|logos/i, category: 'formacao' },
]

function inferCategory(name) {
  const n = name || ''
  for (const rule of CATEGORY_RULES) {
    if (rule.pattern.test(n)) return rule.category
  }
  return 'evento'
}

// ── inChurch: inferência de comunidade (igreja) pelo nome ────────

function inferCommunity(raw) {
  // 1. Usa `responsible_church` diretamente da API quando disponível.
  if (raw.responsible_church?.name) return raw.responsible_church.name
  // 2. Caso contrário, tenta inferir a partir do nome do evento.
  return inferChurchFromText(raw.name) || DEFAULT_CHURCH
}

// ── Mapeamento de eventos ────────────────────────────────────────

function pad2(n) { return String(n).padStart(2, '0') }

/** inChurch (raw) → evento da app */
function mapInchurchEvent(raw) {
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
    id: `ic-${raw.id}`,
    title: raw.name,
    category: inferCategory(raw.name),
    community: inferCommunity(raw),
    date,
    timeStart,
    timeEnd,
    location,
    responsible: raw.responsible_church?.name || 'Igreja CCLX',
    description: raw.description || '',
    imageUrl: raw.image || raw.app_image || null,
    imageLabel: raw.image ? 'foto do evento' : null,
    status: 'publicado',
    isApi: true,
  }
}

/** SoR → evento da app */
function mapSorEvent(e) {
  return {
    id: e.id,
    title: e.title,
    category: e.category || 'evento',
    community: e.community || DEFAULT_CHURCH,
    date: e.date,
    timeStart: e.timeStart ?? null,
    timeEnd: e.timeEnd ?? null,
    location: e.location || '',
    responsible: e.community || 'Igreja CCLX',
    description: e.description || '',
    imageUrl: e.bannerUrl || null,
    imageLabel: e.bannerUrl ? 'imagem do evento' : null,
    isPrivate: !!e.isPrivate,
    status: e.status || 'publicado',
    isApi: false,
  }
}

// ── Origens individuais ──────────────────────────────────────────

/** Lê o estado público da integração inChurch. Em caso de erro, assume ativa. */
async function isInchurchEnabled(signal) {
  try {
    const res = await fetch(`${INTEGRATION_BASE}/public`, {
      signal,
      credentials: 'include',
    })
    if (!res.ok) return true
    const { enabled } = await res.json()
    return enabled !== false
  } catch {
    return true
  }
}

async function loadInchurch(signal) {
  if (!(await isInchurchEnabled(signal))) return []
  const raw = await fetchInchurchPages('/event/', signal)
  return raw.filter(e => e.show_on_calendar).map(mapInchurchEvent)
}

async function loadSor(signal, { includePrivate = false, includeDrafts = false, from, to } = {}) {
  // Com privados, usa o calendário autenticado (publicados + privados se autorizado);
  // caso contrário usa a agenda pública (apenas publicados não privados).
  // Com `includeDrafts` (staff), o calendário inclui também rascunhos/pendentes.
  // `from`/`to` (YYYY-MM-DD) restringem o intervalo no servidor.
  const params = new URLSearchParams()
  if (includeDrafts) params.set('drafts', 'true')
  if (from) params.set('from', from)
  if (to) params.set('to', to)
  const base = includePrivate || includeDrafts ? `${SOR_BASE}/calendar` : `${SOR_BASE}/public`
  const qs = params.toString()
  const path = qs ? `${base}?${qs}` : base
  let res
  try {
    res = await fetch(path, { signal, credentials: 'include' })
  } catch (err) {
    if (err.name === 'AbortError') throw err
    throw new ApiError(0, 'Sem ligação à rede ou ao servidor.')
  }
  if (!res.ok) throw new ApiError(res.status, res.statusText)
  const { events = [] } = await res.json()
  return events.map(mapSorEvent)
}

// ── Public API ───────────────────────────────────────────────────

// A inChurch é lida UMA vez e mantida em cache (a API não filtra por data).
// O SoR é lido por intervalo, com cache por combinação privados/rascunhos/datas.
let _inchurchCache = null // { events, time }
const _sorCache = new Map() // chave: priv|draft|from|to → { events, time }
const CACHE_TTL = 5 * 60 * 1000   // 5 min

async function getInchurch(signal) {
  if (_inchurchCache && Date.now() - _inchurchCache.time < CACHE_TTL) {
    return _inchurchCache.events
  }
  const events = await loadInchurch(signal)
  _inchurchCache = { events, time: Date.now() }
  return events
}

async function getSor(signal, { includePrivate, includeDrafts, from, to }) {
  const key = `priv:${includePrivate}|draft:${includeDrafts}|from:${from ?? ''}|to:${to ?? ''}`
  const cached = _sorCache.get(key)
  if (cached && Date.now() - cached.time < CACHE_TTL) return cached.events
  const events = await loadSor(signal, { includePrivate, includeDrafts, from, to })
  _sorCache.set(key, { events, time: Date.now() })
  return events
}

function inDateRange(dateKey, from, to) {
  if (from && dateKey < from) return false
  if (to && dateKey > to) return false
  return true
}

/**
 * Lê e junta os eventos da inChurch (cache única, filtrada por data no cliente)
 * e do System of Record (filtrado por data no servidor).
 * Se uma origem falhar, devolve à mesma os eventos da outra.
 */
async function combineEvents(signal, { includePrivate, includeDrafts, from, to }) {
  const [inchurch, sor] = await Promise.allSettled([
    getInchurch(signal),
    getSor(signal, { includePrivate, includeDrafts, from, to }),
  ])

  if (signal?.aborted) {
    const abort = new Error('Aborted')
    abort.name = 'AbortError'
    throw abort
  }

  // Ambas as origens falharam → propaga o erro.
  if (inchurch.status === 'rejected' && sor.status === 'rejected') {
    throw sor.reason instanceof ApiError ? sor.reason : inchurch.reason
  }

  const inchurchEvents =
    inchurch.status === 'fulfilled'
      ? inchurch.value.filter((e) => inDateRange(e.date, from, to))
      : []
  const sorEvents = sor.status === 'fulfilled' ? sor.value : []

  return [...inchurchEvents, ...sorEvents].sort((a, b) => a.date.localeCompare(b.date))
}

/**
 * Lê e junta TODOS os eventos da inChurch e do System of Record.
 * Com `includePrivate`, inclui os eventos privados (requer sessão autorizada).
 * Com `includeDrafts`, inclui rascunhos/pendentes (requer staff).
 */
export async function fetchAllEvents({ signal, includePrivate = false, includeDrafts = false } = {}) {
  return combineEvents(signal, { includePrivate, includeDrafts, from: undefined, to: undefined })
}

/**
 * Lê os eventos de um intervalo de datas (YYYY-MM-DD). O SoR é filtrado no
 * servidor; a inChurch é lida uma vez e filtrada no cliente.
 */
export async function fetchEvents(from, to, { signal, includePrivate = false, includeDrafts = false } = {}) {
  return combineEvents(signal, { includePrivate, includeDrafts, from, to })
}

/**
 * Invalida a cache local (ex.: refresh manual ou após publicação/eliminação).
 */
export function clearEventCache() {
  _inchurchCache = null
  _sorCache.clear()
}
