import { config } from '../config.js'

// A API pública da inChurch só documenta GET em /event/. Estas chamadas de
// escrita (PUT/DELETE) são tentadas conforme a configuração da integração;
// se a conta não tiver acesso de escrita, a resposta é tratada como falha
// (registada, mas não bloqueia a operação no System of Record).

const TIMEOUT_MS = 10_000

function authHeader() {
  const creds = Buffer.from(
    `${config.inradar.apiKey ?? ''}:${config.inradar.apiSecret ?? ''}`
  ).toString('base64')
  return `Basic ${creds}`
}

function isConfigured() {
  return Boolean(config.inradar.apiKey && config.inradar.apiSecret)
}

// A inChurch usa datetime sem timezone (ex.: 2026-04-04T09:30:00).
function toApiDatetime(iso) {
  return new Date(iso).toISOString().slice(0, 19)
}

// Mapeia o evento do SoR para o payload da inChurch.
function toInchurchPayload(event) {
  return {
    name: event.title,
    description: event.description ?? '',
    start_datetime: toApiDatetime(event.startDatetime),
    end_datetime: event.endDatetime ? toApiDatetime(event.endDatetime) : null,
    show_on_calendar: true,
    ...(event.bannerUrl ? { image: event.bannerUrl } : {}),
  }
}

async function request(method, path, body) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    const res = await fetch(`${config.inradar.baseUrl}${path}`, {
      method,
      headers: {
        Authorization: authHeader(),
        'X-API-Version': config.inradar.apiVersion,
        Accept: 'application/json',
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    })
    const text = await res.text()
    let parsed = null
    try {
      parsed = text ? JSON.parse(text) : null
    } catch {
      /* resposta não-JSON */
    }
    return { ok: res.ok, status: res.status, body: parsed }
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Envia um evento para a inChurch. Usa PUT em `/event/{externalId}/` quando já
 * existe referência externa; caso contrário cria via POST em `/event/`.
 * Devolve `{ ok, status, externalId }`.
 */
export async function pushEvent(event) {
  if (!isConfigured()) {
    return { ok: false, status: 0, error: 'Credenciais inChurch não configuradas.' }
  }
  const payload = toInchurchPayload(event)
  const path = event.externalId ? `/event/${event.externalId}/` : '/event/'
  const method = event.externalId ? 'PUT' : 'POST'
  const res = await request(method, path, payload)
  const externalId = res.body?.id != null ? String(res.body.id) : (event.externalId ?? null)
  return { ...res, externalId }
}

/** Remove (DELETE) um evento na inChurch pela referência externa. */
export async function deleteEvent(externalId) {
  if (!isConfigured()) {
    return { ok: false, status: 0, error: 'Credenciais inChurch não configuradas.' }
  }
  if (!externalId) {
    return { ok: false, status: 0, error: 'Evento sem referência externa.' }
  }
  return request('DELETE', `/event/${externalId}/`)
}
