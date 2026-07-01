import { z } from 'zod'
import { config } from '../config.js'
import * as repo from './repository.js'

// Chave da definição da integração com a inChurch.
const KEY = 'inchurch_integration'
// Chave do estado (só de leitura para a UI) da última sincronização.
const STATE_KEY = 'inchurch_sync_state'

const DEFAULTS = { enabled: true, intervalMinutes: 30 }

export const integrationSchema = z.object({
  enabled: z.boolean(),
  // Intervalo de sincronização em minutos (1 min a 24 h).
  intervalMinutes: z.number().int().min(1).max(1440).optional(),
})

/** Definição em bruto (interruptor + intervalo), com os valores por omissão. */
export async function getRawIntegration() {
  const stored = await repo.get(KEY)
  // Compatibilidade com o formato antigo (syncEnabled) — assume ativo se ausente.
  const enabled =
    typeof stored?.enabled === 'boolean'
      ? stored.enabled
      : typeof stored?.syncEnabled === 'boolean'
        ? stored.syncEnabled
        : DEFAULTS.enabled
  const intervalMinutes =
    Number.isInteger(stored?.intervalMinutes) && stored.intervalMinutes > 0
      ? stored.intervalMinutes
      : DEFAULTS.intervalMinutes
  return { enabled, intervalMinutes }
}

/** Verdadeiro se a integração inChurch está ativa (eventos externos visíveis). */
export async function isExternalEnabled() {
  const { enabled } = await getRawIntegration()
  return enabled
}

/** Estado da última sincronização (timestamps, contagens, erro) ou null. */
export async function getSyncState() {
  return (await repo.get(STATE_KEY)) || null
}

/** Persiste o estado da sincronização (escrito apenas pelo serviço de sync). */
export async function setSyncState(state) {
  await repo.set(STATE_KEY, state, null)
  return state
}

/**
 * Definição para a UI: interruptor + intervalo + estado da última sincronização
 * + contexto só de leitura (base URL e se as credenciais estão configuradas).
 * As credenciais nunca são expostas.
 */
export async function getIntegration() {
  const settings = await getRawIntegration()
  const sync = await getSyncState()
  return {
    ...settings,
    sync,
    baseUrl: config.inradar.baseUrl,
    credentialsConfigured: Boolean(config.inradar.apiKey && config.inradar.apiSecret),
  }
}

/** Valida e persiste interruptor + intervalo; devolve a definição para a UI. */
export async function updateIntegration(input, actorId) {
  const current = await getRawIntegration()
  const data = integrationSchema.parse({ ...current, ...input })
  await repo.set(
    KEY,
    { enabled: data.enabled, intervalMinutes: data.intervalMinutes ?? current.intervalMinutes },
    actorId
  )
  return getIntegration()
}

// Chave das sobreposições de tradução (i18n) geridas pelo admin.
const TRANSLATIONS_KEY = 'translations'

/** Sobreposições de tradução: { lang: { key: value } }. Vazio por omissão. */
export async function getTranslations() {
  return (await repo.get(TRANSLATIONS_KEY)) || {}
}

/** Valida e persiste as sobreposições de tradução (admin). */
export async function updateTranslations(input, actorId) {
  const clean = {}
  if (input && typeof input === 'object') {
    for (const [lang, dict] of Object.entries(input)) {
      if (dict && typeof dict === 'object' && !Array.isArray(dict)) {
        const entries = {}
        for (const [k, v] of Object.entries(dict)) {
          if (typeof v === 'string' && v.length <= 500) entries[k] = v
        }
        if (Object.keys(entries).length) clean[lang] = entries
      }
    }
  }
  await repo.set(TRANSLATIONS_KEY, clean, actorId)
  return clean
}
