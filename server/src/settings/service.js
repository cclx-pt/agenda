import { z } from 'zod'
import { config } from '../config.js'
import { normalizeLoop } from '../loop/config.js'
import * as repo from './repository.js'
import {
  normalizeRegistrationPortalConfig,
  parseStoredRegistrationPortalConfig,
} from './portalLinks.js'

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

// Links permanentes do portal público de inscrições (redes sociais, canais e
// outros destinos que não correspondem a eventos).
const REGISTRATION_PORTAL_LINKS_KEY = 'registration_portal_links'

export async function getRegistrationPortalConfig({ activeOnly = false } = {}) {
  const stored = await repo.get(REGISTRATION_PORTAL_LINKS_KEY)
  const config = parseStoredRegistrationPortalConfig(stored)
  return {
    ...config,
    links: activeOnly ? config.links.filter((link) => link.active) : config.links,
  }
}

export async function updateRegistrationPortalConfig(input, actorId) {
  const portal = normalizeRegistrationPortalConfig(input)
  await repo.set(REGISTRATION_PORTAL_LINKS_KEY, portal, actorId)
  return portal
}

// ── Métodos de pagamento (geridos na Administração de convites) ──
// app_settings key 'payment_methods' = [{ key, label, active, type, numbers? }].
// Cada método tem um TIPO de uma lista FIXA de comportamentos permitidos. A
// integração e a exigência de comprovativo são DERIVADAS do tipo (não são
// toggles livres). Pode haver VÁRIOS métodos do mesmo tipo (ex.: dois pontos de
// numerário). Só 'mbway-contribuir' tem integração (JotForm); TODOS os tipos
// exigem comprovativo. A lista ativa alimenta a configuração dos bilhetes.
const PAYMENT_METHODS_KEY = 'payment_methods'
const MAX_PAYMENT_METHODS = 24
const MAX_MBWAY_NUMBERS = 4

// Tipos permitidos e as suas regras (integração + comprovativo derivam daqui).
export const PAYMENT_METHOD_TYPES = {
  'mbway-contribuir': { label: 'MB WAY — Contribuir', integrated: true, requireReceipt: true },
  mbway: { label: 'MB WAY', integrated: false, requireReceipt: true },
  transferencia: { label: 'Transferência bancária', integrated: false, requireReceipt: true },
  'referencia-multibanco': { label: 'Referência Multibanco', integrated: false, requireReceipt: true },
  numerario: { label: 'Numerário', integrated: false, requireReceipt: true },
}
export const PAYMENT_METHOD_TYPE_KEYS = Object.keys(PAYMENT_METHOD_TYPES)

// Semente por omissão: um método por cada tipo permitido.
const DEFAULT_PAYMENT_METHODS = PAYMENT_METHOD_TYPE_KEYS.map((type) => ({
  key: type,
  label: PAYMENT_METHOD_TYPES[type].label,
  type,
}))

// Compat: export antigo (defaults enriquecidos, todos ativos).
export const PAYMENT_METHOD_DEFAULTS = DEFAULT_PAYMENT_METHODS.map((m) => enrichPaymentMethod({ ...m, active: true }))

// Gera uma chave (slug) estável e válida a partir de um nome/chave. Garante que
// começa por uma letra (prefixo 'm-') para não colidir com o formato dos slugs.
export function paymentMethodKey(value) {
  const slug = String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove acentos
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
  if (!slug) return ''
  return /^[a-z]/.test(slug) ? slug : `m-${slug}`
}

// Limpa e limita os números MB WAY (só dígitos, mín. 9, até 4, sem repetidos).
function cleanMbwayNumbers(value) {
  if (!Array.isArray(value)) return []
  const out = []
  for (const n of value) {
    const digits = String(n ?? '').replace(/\D/g, '').slice(0, 15)
    if (digits.length >= 9 && !out.includes(digits)) out.push(digits)
    if (out.length >= MAX_MBWAY_NUMBERS) break
  }
  return out
}

// Acrescenta a um método os campos DERIVADOS do tipo (integração/comprovativo) e
// normaliza os números (só para o tipo 'mbway').
function enrichPaymentMethod(m) {
  const rules = PAYMENT_METHOD_TYPES[m.type]
  return {
    key: m.key,
    label: m.label,
    active: m.active !== false,
    type: m.type,
    integrated: rules.integrated,
    requireReceipt: rules.requireReceipt,
    numbers: m.type === 'mbway' ? cleanMbwayNumbers(m.numbers) : [],
  }
}

// Normaliza a lista guardada: descarta entradas sem tipo válido (reset dos dados
// antigos) e gera chaves únicas. Sem métodos válidos → semeia os defaults.
function normalizePaymentMethods(stored) {
  const list = Array.isArray(stored) ? stored : []
  const result = []
  const used = new Set()
  for (const m of list) {
    if (!m || typeof m !== 'object') continue
    if (!PAYMENT_METHOD_TYPE_KEYS.includes(m.type)) continue // tipo inválido/ausente → descartado
    const label = typeof m.label === 'string' ? m.label.trim().slice(0, 60) : ''
    if (!label) continue
    let key = paymentMethodKey(m.key || label)
    if (!key) continue
    if (used.has(key)) {
      let i = 2
      while (used.has(`${key}-${i}`)) i += 1
      key = `${key}-${i}`
    }
    used.add(key)
    result.push(enrichPaymentMethod({ key, label, active: m.active, type: m.type, numbers: m.numbers }))
    if (result.length >= MAX_PAYMENT_METHODS) break
  }
  if (!result.length) return DEFAULT_PAYMENT_METHODS.map((m) => enrichPaymentMethod({ ...m, active: true }))
  return result
}

/** Lista completa de métodos de pagamento para o Admin. */
export async function getPaymentMethods() {
  return normalizePaymentMethods(await repo.get(PAYMENT_METHODS_KEY))
}

/** Só os métodos ativos (para a configuração dos bilhetes e a página pública). */
export async function getActivePaymentMethods() {
  return (await getPaymentMethods()).filter((m) => m.active)
}

/** Valida e persiste os métodos de pagamento (admin). */
export async function updatePaymentMethods(input, actorId) {
  const next = normalizePaymentMethods(Array.isArray(input) ? input : [])
  await repo.set(PAYMENT_METHODS_KEY, next, actorId)
  return next
}

// ── Definições gerais dos convites (Administração de convites) ──
// app_settings key 'invite_settings' = { paymentInfo: { iban, beneficiary, mbEntity } }.
// São os dados que o conector de pagamento "manual" usa nas instruções de
// transferência/referência. Quando um campo fica vazio, usa-se o valor de
// config.payments (env) como recurso — por isso é sempre seguro.
const INVITE_SETTINGS_KEY = 'invite_settings'

function normalizeInviteSettings(stored) {
  const s = stored && typeof stored === 'object' ? stored : {}
  const pi = s.paymentInfo && typeof s.paymentInfo === 'object' ? s.paymentInfo : {}
  const str = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '')
  return {
    paymentInfo: {
      iban: str(pi.iban, 40),
      beneficiary: str(pi.beneficiary, 120),
      mbEntity: str(pi.mbEntity, 10),
    },
  }
}

/** Definições dos convites tal como guardadas (campos vazios = usar o valor por omissão). */
export async function getInviteSettings() {
  return normalizeInviteSettings(await repo.get(INVITE_SETTINGS_KEY))
}

/** Dados de pagamento EFETIVOS: definições guardadas com recurso a config.payments (env). */
export async function getInvitePaymentInfo() {
  const { paymentInfo } = await getInviteSettings()
  return {
    iban: paymentInfo.iban || config.payments.iban,
    beneficiary: paymentInfo.beneficiary || config.payments.beneficiary,
    mbEntity: paymentInfo.mbEntity || config.payments.mbEntity,
  }
}

/** Valida e persiste as definições dos convites (admin). */
export async function updateInviteSettings(input, actorId) {
  const next = normalizeInviteSettings(input)
  await repo.set(INVITE_SETTINGS_KEY, next, actorId)
  return next
}

// ── Configuração do Loop + CCLX (múltiplos "loops" nomeados, para TV) ──
// app_settings key 'loop' = { [slug]: { name, community, active, showGeneral,
// weeks, format, secondsPerSlide, secondsPerSlideFeatured, fixedSlides } }.
// `community`: nome de igreja OU '' (= todas as igrejas). `slug` (chave) é
// estável e usado no URL público /loop/<slug>. Config antiga (chaveada por
// igreja, sem `name`) é migrada em leitura (name=community=igreja da chave).
const LOOP_KEY = 'loop'

// Texto → slug seguro em URL (sem acentos).
function loopSlug(str) {
  return String(str ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/**
 * Mapa dos loops { [slug]: { name, community, active, ... } } (admin).
 * Migra config antiga (chaveada por igreja, sem `name`) para o novo formato.
 */
export async function getLoopConfig() {
  const stored = await repo.get(LOOP_KEY)
  const raw = stored && typeof stored === 'object' ? stored : {}
  const out = {}
  for (const [key, val] of Object.entries(raw)) {
    if (!key || !val || typeof val !== 'object') continue
    const legacy = val.name === undefined && val.community === undefined
    const merged = legacy ? { ...val, name: key, community: key } : val
    const slug = loopSlug(val.slug || merged.name || key)
    if (!slug || out[slug]) continue
    out[slug] = normalizeLoop(merged)
  }
  return out
}

/** Loop efetivo pelo slug (aceita slug ou nome de igreja antigo). */
export async function getLoopBySlug(slugOrChurch) {
  const all = await getLoopConfig()
  const want = loopSlug(slugOrChurch)
  return all[want] ? { slug: want, ...all[want] } : null
}

/** Valida e persiste os loops (admin). Aceita array ou mapa; chaveia por slug. */
export async function updateLoopConfig(input, actorId) {
  const raw = input && typeof input === 'object' ? input : {}
  const list = Array.isArray(raw)
    ? raw
    : Object.entries(raw).map(([slug, cfg]) => ({ slug, ...(cfg && typeof cfg === 'object' ? cfg : {}) }))
  const out = {}
  for (const cfg of list) {
    if (!cfg || typeof cfg !== 'object') continue
    const loop = normalizeLoop(cfg)
    if (!loop.name) continue // um loop precisa de nome
    const base = loopSlug(cfg.slug || loop.name)
    if (!base) continue
    let slug = base
    let n = 2
    while (out[slug]) slug = `${base}-${n++}`
    out[slug] = loop
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
