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

// Chave da personalização de marca (logótipo) gerida pelo admin.
const BRANDING_KEY = 'branding'

/** Personalização de marca: { logoUrl, subcategoryColors }. Vazio (predefinido) por omissão. */
export async function getBranding() {
  const stored = await repo.get(BRANDING_KEY)
  const logoUrl =
    stored && typeof stored.logoUrl === 'string' && stored.logoUrl.trim()
      ? stored.logoUrl.trim()
      : null
  const subcategoryColors = !!stored?.subcategoryColors
  return { logoUrl, subcategoryColors }
}

/**
 * Valida e persiste a personalização de marca (admin). Passar logoUrl vazio/nulo
 * repõe o logótipo predefinido. `subcategoryColors` ativa as cores das
 * subcategorias no calendário.
 */
export async function updateBranding(input, actorId) {
  const raw = typeof input?.logoUrl === 'string' ? input.logoUrl.trim() : ''
  const logoUrl = raw && raw.length <= 1000 ? raw : null
  const subcategoryColors = input?.subcategoryColors === true
  await repo.set(BRANDING_KEY, { logoUrl, subcategoryColors }, actorId)
  return { logoUrl, subcategoryColors }
}

// ── Configuração do Loop (carrossel público por igreja, para TV) ──
// app_settings key 'loop' = { [igreja]: { active, showGeneral, weeks, format } }.
const LOOP_KEY = 'loop'
const LOOP_FORMATS = ['16:9', '32:9']
const LOOP_DEFAULTS = { active: false, showGeneral: true, weeks: 4, format: '16:9', secondsPerSlide: 15, secondsPerSlideFeatured: 30 }

function normalizeLoopChurch(cfg) {
  const c = cfg && typeof cfg === 'object' ? cfg : {}
  const weeks = Number(c.weeks)
  const sps = Number(c.secondsPerSlide)
  const spsFeat = Number(c.secondsPerSlideFeatured)
  return {
    active: !!c.active,
    showGeneral: c.showGeneral !== false, // por omissão true
    weeks: Number.isInteger(weeks) && weeks >= 1 && weeks <= 52 ? weeks : LOOP_DEFAULTS.weeks,
    // Formato do ecrã da TV: 16:9 (1920x1080) ou 32:9 (3840x1080, ultrawide).
    format: LOOP_FORMATS.includes(c.format) ? c.format : LOOP_DEFAULTS.format,
    // Duração de cada slide (segundos): normal e em destaque.
    secondsPerSlide:
      Number.isFinite(sps) && sps >= 3 && sps <= 120 ? Math.round(sps) : LOOP_DEFAULTS.secondsPerSlide,
    secondsPerSlideFeatured:
      Number.isFinite(spsFeat) && spsFeat >= 3 && spsFeat <= 300
        ? Math.round(spsFeat)
        : LOOP_DEFAULTS.secondsPerSlideFeatured,
  }
}

/** Mapa completo { [igreja]: { active, showGeneral, weeks } } (admin). */
export async function getLoopConfig() {
  const stored = await repo.get(LOOP_KEY)
  return stored && typeof stored === 'object' ? stored : {}
}

/** Configuração efetiva (com omissões) para uma igreja (nome insensível a maiúsculas). */
export async function getLoopConfigForChurch(church) {
  const all = await getLoopConfig()
  const key = Object.keys(all).find((k) => k.toLowerCase() === String(church ?? '').toLowerCase())
  return normalizeLoopChurch(key ? all[key] : null)
}

/** Valida e persiste o mapa de configuração do Loop (admin). */
export async function updateLoopConfig(input, actorId) {
  const raw = input && typeof input === 'object' ? input : {}
  const out = {}
  for (const [church, cfg] of Object.entries(raw)) {
    if (!church) continue
    out[church] = normalizeLoopChurch(cfg)
  }
  await repo.set(LOOP_KEY, out, actorId)
  return out
}

// Chave da política de sobreposição de eventos gerida pelo admin.
const OVERLAP_KEY = 'overlap_policy'
const OVERLAP_MODES = ['off', 'warn', 'block']

function cleanOverlapMap(m) {
  const out = {}
  if (m && typeof m === 'object' && !Array.isArray(m)) {
    for (const [k, v] of Object.entries(m)) {
      if (typeof k === 'string' && OVERLAP_MODES.includes(v)) out[k] = v
    }
  }
  return out
}

/**
 * Política de sobreposição: { default, byCategory:{slug:mode}, byChurch:{name:mode} }.
 * mode = 'off' (não verifica) | 'warn' (avisa, deixa forçar) | 'block' (recusa;
 * só admin força). Por omissão 'off'.
 */
export async function getOverlapPolicy() {
  const s = await repo.get(OVERLAP_KEY)
  return {
    default: OVERLAP_MODES.includes(s?.default) ? s.default : 'off',
    byCategory: cleanOverlapMap(s?.byCategory),
    byChurch: cleanOverlapMap(s?.byChurch),
  }
}

/** Valida e persiste a política de sobreposição (admin). */
export async function updateOverlapPolicy(input, actorId) {
  const clean = {
    default: OVERLAP_MODES.includes(input?.default) ? input.default : 'off',
    byCategory: cleanOverlapMap(input?.byCategory),
    byChurch: cleanOverlapMap(input?.byChurch),
  }
  await repo.set(OVERLAP_KEY, clean, actorId)
  return clean
}
