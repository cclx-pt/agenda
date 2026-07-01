import { createHash } from 'node:crypto'
import { config } from '../config.js'
import * as externalRepo from '../external/repository.js'
import * as settings from '../settings/service.js'

/**
 * inchurchSync.js — sincronização periódica inChurch/inRadar → base de dados.
 *
 * O calendário lê SÓ da BD. Esta sincronização vai buscar o instantâneo
 * completo de eventos à API pública da inChurch (que não suporta filtro por
 * data nem "modificado desde") e reconcilia com a tabela `external_events`:
 *   - na API e não na BD            → INSERT
 *   - na API e na BD, mudou (hash)  → UPDATE
 *   - na BD e já não na API         → DELETE
 *
 * É acionada por: o botão "Sincronizar agora" (admin), o Vercel Cron
 * (GET /data/integration/sync/cron) e o agendador em processo (index.js local).
 */

const DEFAULT_CHURCH = 'Sede'
const CHURCH_NAMES = [
  'Sede',
  'Açores',
  'Almada',
  'Barreiro',
  'Caldas Da Rainha',
  'Coruche',
  'Moita',
  'Porto',
]
const PAGE_SIZE = 200
const TIMEOUT_MS = 20_000

// ── Inferência (porta da lógica do frontend apiService.js) ───────

// Todos os eventos importados da API recebem sempre a categoria fixa "Aplicação".
const API_CATEGORY = 'aplicacao'

function inferChurchFromText(text) {
  const t = text || ''
  for (const name of CHURCH_NAMES) {
    if (name === DEFAULT_CHURCH) continue
    if (t.toLowerCase().includes(name.toLowerCase())) return name
  }
  if (/\bsede\b/i.test(t)) return DEFAULT_CHURCH
  return null
}

function inferCommunity(raw) {
  if (raw.responsible_church?.name) return raw.responsible_church.name
  return inferChurchFromText(raw.name) || DEFAULT_CHURCH
}

function buildLocation(loc) {
  if (!loc) return ''
  return [loc.address, loc.address_number, loc.neighborhood, loc.city].filter(Boolean).join(', ')
}

/** inChurch (raw) → forma de sincronização (alinhada com external/repository). */
function mapInchurchEvent(raw) {
  return {
    externalId: String(raw.id),
    title: raw.name,
    description: raw.description || '',
    startDatetime: raw.start_datetime,
    endDatetime: raw.end_datetime || null,
    location: buildLocation(raw.location),
    community: inferCommunity(raw),
    category: API_CATEGORY,
    imageUrl: raw.image || raw.app_image || null,
  }
}

// Hash estável dos campos relevantes — deteta alterações entre sincronizações.
function contentHash(ev) {
  return createHash('sha256')
    .update(
      JSON.stringify([
        ev.title,
        ev.description,
        ev.startDatetime,
        ev.endDatetime,
        ev.location,
        ev.community,
        ev.category,
        ev.imageUrl,
      ])
    )
    .digest('hex')
}

// ── Leitura paginada da API inChurch ─────────────────────────────

function isConfigured() {
  return Boolean(config.inradar.apiKey && config.inradar.apiSecret)
}

function authHeader() {
  const creds = Buffer.from(
    `${config.inradar.apiKey ?? ''}:${config.inradar.apiSecret ?? ''}`
  ).toString('base64')
  return `Basic ${creds}`
}

async function fetchPage(offset) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    const res = await fetch(`${config.inradar.baseUrl}/event/?limit=${PAGE_SIZE}&offset=${offset}`, {
      headers: {
        Authorization: authHeader(),
        'X-API-Version': config.inradar.apiVersion,
        Accept: 'application/json',
      },
      signal: controller.signal,
    })
    if (!res.ok) {
      throw new Error(`A API da inChurch respondeu ${res.status}.`)
    }
    return res.json()
  } finally {
    clearTimeout(timer)
  }
}

async function fetchAllInchurchEvents() {
  let all = []
  let offset = 0
  while (true) {
    const page = await fetchPage(offset)
    all = all.concat(page.results || [])
    if (!page.next) break
    offset += PAGE_SIZE
  }
  return all
}

// ── Reconciliação ────────────────────────────────────────────────

async function reconcile(mapped) {
  const withHash = mapped.map((ev) => ({ ...ev, contentHash: contentHash(ev) }))
  const existing = await externalRepo.listKeys()
  const existingHash = new Map(existing.map((r) => [r.external_id, r.content_hash]))
  const apiIds = withHash.map((e) => e.externalId)
  const apiIdSet = new Set(apiIds)

  let inserted = 0
  let updated = 0
  let unchanged = 0
  const toWrite = []
  for (const ev of withHash) {
    const prev = existingHash.get(ev.externalId)
    if (prev === undefined) {
      inserted++
      toWrite.push(ev)
    } else if (prev !== ev.contentHash) {
      updated++
      toWrite.push(ev)
    } else {
      unchanged++
    }
  }
  if (toWrite.length) await externalRepo.bulkUpsert(toWrite)

  const removed = existing.filter((r) => !apiIdSet.has(r.external_id))
  const deleted = removed.length ? await externalRepo.pruneNotIn(apiIds) : 0

  return { fetched: withHash.length, inserted, updated, deleted, unchanged }
}

// ── Orquestração ─────────────────────────────────────────────────

// Trava em memória: evita execuções sobrepostas (cron + agendador + manual).
let running = false

/**
 * Executa uma sincronização. Com `force`, ignora o intervalo configurado
 * (botão "Sincronizar agora"); caso contrário só corre se já passou o intervalo
 * desde a última sincronização bem-sucedida. Devolve um resumo do resultado.
 */
export async function runSync({ force = false } = {}) {
  if (!isConfigured()) return { ok: false, skipped: 'not-configured' }

  const { enabled, intervalMinutes } = await settings.getRawIntegration()
  if (!enabled) return { ok: false, skipped: 'disabled' }
  if (running) return { ok: false, skipped: 'running' }

  const prev = (await settings.getSyncState()) || {}
  if (!force && prev.lastSyncAt) {
    const elapsed = Date.now() - new Date(prev.lastSyncAt).getTime()
    if (elapsed < intervalMinutes * 60_000) {
      return { ok: false, skipped: 'not-due' }
    }
  }

  running = true
  try {
    const raw = await fetchAllInchurchEvents()
    const mapped = raw.filter((e) => e.show_on_calendar).map(mapInchurchEvent)

    // Salvaguarda: um instantâneo vazio é quase sempre um problema transitório
    // da API — nunca apagar a tabela toda nesse caso.
    if (mapped.length === 0) {
      const error = 'A API não devolveu eventos; sincronização ignorada para não apagar dados.'
      await settings.setSyncState({
        ...prev,
        lastStatus: 'error',
        lastError: error,
        lastFinishedAt: new Date().toISOString(),
      })
      return { ok: false, error }
    }

    const counts = await reconcile(mapped)
    const finishedAt = new Date().toISOString()
    await settings.setSyncState({
      lastSyncAt: finishedAt,
      lastFinishedAt: finishedAt,
      lastStatus: 'ok',
      lastError: null,
      lastCounts: counts,
    })
    console.log(
      `[sync] inChurch OK — ${counts.fetched} eventos (` +
        `+${counts.inserted} / ~${counts.updated} / -${counts.deleted})`
    )
    return { ok: true, ...counts }
  } catch (err) {
    // Em caso de erro NÃO avança `lastSyncAt` (para a próxima tentativa não ser
    // adiada pelo intervalo), apenas regista o estado de erro.
    await settings.setSyncState({
      ...prev,
      lastStatus: 'error',
      lastError: err.message,
      lastFinishedAt: new Date().toISOString(),
    })
    console.error('[sync] inChurch falhou:', err.message)
    return { ok: false, error: err.message }
  } finally {
    running = false
  }
}

/**
 * Purga manual (admin): remove TODOS os eventos externos guardados na base de
 * dados. Não altera o estado da sincronização — se a integração continuar ativa,
 * os eventos voltam a ser importados na próxima sincronização. Devolve o número
 * de linhas removidas.
 */
export async function purgeExternal() {
  const deleted = await externalRepo.purge()
  console.log(`[sync] purga manual — ${deleted} eventos externos removidos`)
  return { ok: true, deleted }
}

// ── Agendador em processo (apenas standalone/local; NÃO no Vercel) ──

let timer = null

/**
 * Inicia um agendador em processo que tenta sincronizar periodicamente. Cada
 * tique chama `runSync` sem `force` — a própria runSync decide se já é altura
 * (com base no intervalo configurado). Usado pelo arranque local/standalone
 * (index.js). No Vercel é o Vercel Cron que aciona o endpoint.
 */
export function startSyncScheduler({ tickMs = 60_000 } = {}) {
  if (timer) return
  const tick = () => {
    runSync({ force: false }).catch((err) =>
      console.error('[sync] erro inesperado no agendador:', err.message)
    )
  }
  timer = setInterval(tick, tickMs)
  if (timer.unref) timer.unref()
  // Primeira tentativa pouco depois do arranque (dá tempo à app de estabilizar).
  setTimeout(tick, 5_000).unref?.()
  console.log('[sync] agendador de sincronização inChurch iniciado')
}

export function stopSyncScheduler() {
  if (timer) {
    clearInterval(timer)
    timer = null
  }
}
