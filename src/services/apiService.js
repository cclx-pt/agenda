/**
 * apiService.js
 *
 * Fonte de dados da agenda pública: UMA origem — a base de dados (System of
 * Record). Os eventos da inChurch/inRadar já não são lidos ao vivo pelo
 * browser: são sincronizados periodicamente para a BD (ver
 * server/src/integrations/inchurchSync.js) e devolvidos juntos com os eventos
 * geridos pelo mesmo endpoint, marcados com `isApi: true` e id prefixado `ic-`.
 *
 * Endpoints:
 *  - `/data/events/public`   → agenda pública (publicados + externos).
 *  - `/data/events/calendar` → calendário autenticado (inclui privados/rascunhos
 *    conforme as permissões), também já com os eventos externos.
 *
 * Forma de evento (saída):
 * {
 *   id:          string
 *   title:       string
 *   category:    'culto' | 'evento' | 'formacao' | 'jovens'
 *   community:   string
 *   date:        'YYYY-MM-DD'
 *   endDate:     'YYYY-MM-DD' | null   (último dia; eventos de vários dias)
 *   timeStart:   'HH:MM' | null
 *   timeEnd:     'HH:MM' | null
 *   location:    string
 *   responsible: string
 *   description: string
 *   imageUrl:    string | null
 *   imageLabel:  string | null
 * }
 */

import { DEFAULT_CHURCH } from '../utils/churches.js'

const SOR_BASE = '/data/events'

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

// ── Mapeamento de eventos ────────────────────────────────────────

/** Evento da BD (SoR ou externo já mapeado pelo servidor) → evento da app. */
function mapSorEvent(e) {
  return {
    id: e.id,
    title: e.title,
    category: e.category || 'evento',
    subcategory: e.subcategory ?? null,
    community: e.community || DEFAULT_CHURCH,
    date: e.date,
    endDate: e.endDate ?? null,
    timeStart: e.timeStart ?? null,
    timeEnd: e.timeEnd ?? null,
    startDatetime: e.startDatetime ?? null,
    endDatetime: e.endDatetime ?? null,
    allDay: !!e.allDay,
    location: e.location || '',
    responsible: e.community || 'Igreja CCLX',
    description: e.description || '',
    imageUrl: e.bannerUrl || null,
    bannerUrl: e.bannerUrl || null,
    imageLabel: e.bannerUrl ? 'imagem do evento' : null,
    loopImage16x9: e.loopImage16x9 ?? null,
    loopImage32x9: e.loopImage32x9 ?? null,
    isPrivate: !!e.isPrivate,
    privacyTag: e.privacyTag ?? null,
    featured: !!e.featured,
    loop: !!e.loop,
    seriesId: e.seriesId ?? null,
    organizerName: e.organizerName ?? null,
    organizerContact: e.organizerContact ?? null,
    organizerPhone: e.organizerPhone ?? null,
    organizerEmail: e.organizerEmail ?? null,
    registrationUrl: e.registrationUrl ?? null,
    inviteSlug: e.inviteSlug ?? null,
    attachmentUrl: e.attachmentUrl ?? null,
    attachmentName: e.attachmentName ?? null,
    mapUrl: e.mapUrl ?? null,
    mapLat: e.mapLat ?? null,
    mapLng: e.mapLng ?? null,
    status: e.status || 'publicado',
    isApi: !!e.isApi,
  }
}

/** Eventos do Loop (carrossel TV) de uma igreja — mapeados para a app. */
export async function getLoop(church) {
  let res
  try {
    res = await fetch(`/data/loop/${encodeURIComponent(church)}`, { credentials: 'include' })
  } catch {
    throw new ApiError(0, 'Sem ligação ao servidor.')
  }
  if (!res.ok) throw new ApiError(res.status, res.statusText)
  const data = await res.json().catch(() => ({}))
  return {
    active: !!data.active,
    weeks: data.weeks ?? 4,
    format: data.format === '32:9' ? '32:9' : '16:9',
    secondsPerSlide: Number(data.secondsPerSlide) > 0 ? Number(data.secondsPerSlide) : 15,
    secondsPerSlideFeatured: Number(data.secondsPerSlideFeatured) > 0 ? Number(data.secondsPerSlideFeatured) : 30,
    church: data.church ?? church,
    events: Array.isArray(data.events) ? data.events.map(mapSorEvent) : [],
    fixedSlides: Array.isArray(data.fixedSlides)
      ? data.fixedSlides.filter((slide) => slide?.url && ['image', 'video'].includes(slide.type))
      : [],
  }
}

// ── Origens individuais ──────────────────────────────────────────

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

// Todos os eventos (geridos + externos da inChurch) vêm já combinados do
// servidor. Cache por combinação privados/rascunhos/datas.
const _sorCache = new Map() // chave: priv|draft|from|to → { events, time }
const CACHE_TTL = 5 * 60 * 1000 // 5 min

async function getSor(signal, { includePrivate, includeDrafts, from, to }) {
  const key = `priv:${includePrivate}|draft:${includeDrafts}|from:${from ?? ''}|to:${to ?? ''}`
  const cached = _sorCache.get(key)
  if (cached && Date.now() - cached.time < CACHE_TTL) return cached.events
  const events = await loadSor(signal, { includePrivate, includeDrafts, from, to })
  _sorCache.set(key, { events, time: Date.now() })
  return events
}

/**
 * Lê os eventos da base de dados (eventos geridos + externos da inChurch já
 * sincronizados), ordenados por data.
 */
async function combineEvents(signal, { includePrivate, includeDrafts, from, to }) {
  const events = await getSor(signal, { includePrivate, includeDrafts, from, to })
  if (signal?.aborted) {
    const abort = new Error('Aborted')
    abort.name = 'AbortError'
    throw abort
  }
  return [...events].sort((a, b) => a.date.localeCompare(b.date))
}

/**
 * Lê TODOS os eventos (geridos + externos) da base de dados.
 * Com `includePrivate`, inclui os eventos privados (requer sessão autorizada).
 * Com `includeDrafts`, inclui rascunhos/pendentes (requer staff).
 */
export async function fetchAllEvents({ signal, includePrivate = false, includeDrafts = false } = {}) {
  return combineEvents(signal, { includePrivate, includeDrafts, from: undefined, to: undefined })
}

/**
 * Lê os eventos de um intervalo de datas (YYYY-MM-DD), filtrado no servidor.
 */
export async function fetchEvents(from, to, { signal, includePrivate = false, includeDrafts = false } = {}) {
  return combineEvents(signal, { includePrivate, includeDrafts, from, to })
}

/**
 * Invalida a cache local (ex.: refresh manual ou após publicação/eliminação).
 */
export function clearEventCache() {
  _sorCache.clear()
}
