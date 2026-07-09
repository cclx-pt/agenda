import { z } from 'zod'
import { randomUUID } from 'node:crypto'
import * as repo from './repository.js'
import * as externalRepo from '../external/repository.js'
import * as categoriesService from '../categories/service.js'
import * as subcategoriesService from '../subcategories/service.js'
import * as privacyTagsService from '../privacyTags/service.js'
import * as settingsService from '../settings/service.js'
import * as delegationsRepo from '../delegations/repository.js'
import * as approverScopesRepo from '../approverScopes/repository.js'
import * as usersRepo from '../users/repository.js'
import { sendEventStatusEmail, sendApprovalRequestEmail } from '../auth/email.js'
import { signApprovalToken } from '../approvals/token.js'
import { config } from '../config.js'
import { waitUntil } from '@vercel/functions'

// Erro de domínio com código HTTP associado.
export class EventError extends Error {
  constructor(status, message) {
    super(message)
    this.name = 'EventError'
    this.status = status
  }
}

// ── Validação ────────────────────────────────────────────────────
const isoDate = z.string().refine((v) => !Number.isNaN(Date.parse(v)), 'Data inválida.')

export const eventInputSchema = z
  .object({
    title: z.string().trim().min(1, 'O título é obrigatório.'),
    description: z.string().trim().optional().nullable(),
    startDatetime: isoDate,
    endDatetime: isoDate.optional().nullable(),
    allDay: z.boolean().optional(),
    location: z.string().trim().optional().nullable(),
    community: z.string().trim().optional(),
    category: z.string().trim().min(1).optional(),
    // Subcategoria (lista global). Obrigatória conforme a categoria (validado no
    // serviço). '' → null.
    subcategory: z.string().trim().optional().nullable(),
    // Destaque (blink no calendário), loop (carrossel TV) e evento geral
    // (aparece no Loop de todas as igrejas).
    featured: z.boolean().optional(),
    loop: z.boolean().optional(),
    isGeneral: z.boolean().optional(),
    isPrivate: z.boolean().optional(),
    // Aceita URL absoluto (http/https, ex.: banners da inChurch) ou caminho
    // relativo de upload servido pelo backend (ex.: /data/uploads/abc.png).
    bannerUrl: z
      .string()
      .trim()
      .refine((v) => v === '' || v.startsWith('/') || /^https?:\/\//i.test(v), 'URL de banner inválido.')
      .optional()
      .nullable(),
    // Cartazes dedicados ao Loop (TV) por formato: 16:9 (1920x1080) e 32:9
    // (3840x1080). Mesma validação do banner (upload relativo ou URL absoluto).
    loopImage16x9: z
      .string()
      .trim()
      .refine((v) => v === '' || v.startsWith('/') || /^https?:\/\//i.test(v), 'URL de cartaz do Loop inválido.')
      .optional()
      .nullable(),
    loopImage32x9: z
      .string()
      .trim()
      .refine((v) => v === '' || v.startsWith('/') || /^https?:\/\//i.test(v), 'URL de cartaz do Loop inválido.')
      .optional()
      .nullable(),
    // Etiqueta de privacidade. Obrigatória no formulário quando o evento é
    // privado (validado no frontend); aqui é apenas validada contra a BD se
    // fornecida, para não quebrar dados/legados sem etiqueta.
    privacyTag: z.string().trim().optional().nullable(),
    // Responsável do evento e inscrições (todos opcionais).
    organizerName: z.string().trim().max(200).optional().nullable(),
    organizerContact: z.string().trim().max(200).optional().nullable(),
    organizerPhone: z.string().trim().max(50).optional().nullable(),
    organizerEmail: z.string().trim().max(200).optional().nullable(),
    registrationUrl: z
      .string()
      .trim()
      .refine((v) => v === '' || /^https?:\/\//i.test(v), 'Link de inscrições inválido (use http/https).')
      .optional()
      .nullable(),
    // Anexo (PDF/imagem) e localização no mapa (todos opcionais).
    attachmentUrl: z
      .string()
      .trim()
      .refine((v) => v === '' || v.startsWith('/') || /^https?:\/\//i.test(v), 'URL de anexo inválido.')
      .optional()
      .nullable(),
    attachmentName: z.string().trim().max(255).optional().nullable(),
    mapUrl: z
      .string()
      .trim()
      .refine((v) => v === '' || /^https?:\/\//i.test(v), 'Link de mapa inválido.')
      .optional()
      .nullable(),
    mapLat: z.number().min(-90).max(90).optional().nullable(),
    mapLng: z.number().min(-180).max(180).optional().nullable(),
    // Ao criar, submeter logo para aprovação (em vez de guardar como rascunho).
    submit: z.boolean().optional(),
  })
  .refine(
    (d) => !d.endDatetime || Date.parse(d.endDatetime) >= Date.parse(d.startDatetime),
    { message: 'A data de fim não pode ser anterior à de início.', path: ['endDatetime'] }
  )

// Máximo de ocorrências geradas por série (limite de segurança).
const MAX_OCCURRENCES = 100
// As recorrências não podem ultrapassar 6 meses a partir do início.
const MAX_RECURRENCE_MONTHS = 6

// Recorrência opcional. Quando ausente (ou frequency='none'), o evento é único.
export const recurrenceSchema = z
  .object({
    frequency: z.enum(['daily', 'weekly', 'monthly']),
    interval: z.number().int().min(1).max(99).optional().default(1),
    end: z
      .object({
        type: z.enum(['count', 'date']),
        count: z.number().int().min(1).max(MAX_OCCURRENCES).optional(),
        date: isoDate.optional(),
      })
      .superRefine((e, ctx) => {
        if (e.type === 'count' && e.count == null) {
          ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Indique o número de ocorrências.' })
        }
        if (e.type === 'date' && !e.date) {
          ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Indique a data de fim da recorrência.' })
        }
      }),
  })
  .optional()
  .nullable()

// Fuso horário da igreja (igual ao do repositório). As recorrências avançam na
// "hora de parede" de Lisboa, para preservar o DIA DO MÊS (mensal a 31 → 28/Fev,
// 30/Abr, sem saltar meses) e a HORA LOCAL (incluindo mudanças de hora/DST),
// independentemente do fuso do servidor (o Vercel corre em UTC).
const EVENT_TIME_ZONE = 'Europe/Lisbon'
const wallClockFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: EVENT_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
})

// Componentes de "parede" (ano/mês/dia/hora/min/seg) de um instante, em Lisboa.
function wallParts(instant) {
  const p = {}
  for (const part of wallClockFormatter.formatToParts(instant)) {
    if (part.type !== 'literal') p[part.type] = part.value
  }
  return { year: +p.year, month: +p.month, day: +p.day, hour: +p.hour, minute: +p.minute, second: +p.second }
}

// Deslocação (ms) do fuso de Lisboa face ao UTC no instante dado.
function zoneOffsetMs(instant) {
  const p = wallParts(instant)
  return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - instant.getTime()
}

// Converte uma hora "de parede" de Lisboa num instante UTC (2 passagens para
// resolver corretamente junto às mudanças de hora/DST).
function wallClockToUtc({ year, month, day, hour, minute, second = 0 }) {
  const naive = Date.UTC(year, month - 1, day, hour, minute, second)
  let offset = zoneOffsetMs(new Date(naive))
  offset = zoneOffsetMs(new Date(naive - offset))
  return new Date(naive - offset)
}

// Número de dias do mês (month: 1..12).
function daysInMonth(year, month) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate()
}

// Avança a partir do início (na hora de parede de Lisboa) em N passos,
// preservando a hora local e o dia do mês (com clamp nos meses mais curtos).
// Devolve o instante UTC da ocorrência.
function advance(startInstant, frequency, steps, interval) {
  const w = wallParts(new Date(startInstant))
  const n = steps * interval
  if (frequency === 'monthly') {
    const total = w.month - 1 + n
    const year = w.year + Math.floor(total / 12)
    const month = (total % 12) + 1
    const day = Math.min(w.day, daysInMonth(year, month))
    return wallClockToUtc({ year, month, day, hour: w.hour, minute: w.minute, second: w.second })
  }
  const addDays = frequency === 'weekly' ? n * 7 : n
  const base = new Date(Date.UTC(w.year, w.month - 1, w.day))
  base.setUTCDate(base.getUTCDate() + addDays)
  return wallClockToUtc({
    year: base.getUTCFullYear(),
    month: base.getUTCMonth() + 1,
    day: base.getUTCDate(),
    hour: w.hour,
    minute: w.minute,
    second: w.second,
  })
}

// Gera as ocorrências (start/end ISO) a partir do primeiro evento e da regra de
// recorrência. A duração de cada ocorrência é mantida constante.
function generateOccurrences(startDatetime, endDatetime, recurrence) {
  const start = new Date(startDatetime)
  const durationMs = endDatetime ? Date.parse(endDatetime) - Date.parse(startDatetime) : null
  const { frequency, interval, end } = recurrence
  const limit =
    end.type === 'count' ? Math.min(end.count, MAX_OCCURRENCES) : MAX_OCCURRENCES
  const until = end.type === 'date' ? new Date(`${end.date}T23:59:59`) : null
  // Limite rígido: nunca gerar ocorrências além de 6 meses do início.
  const maxDate = new Date(start)
  maxDate.setMonth(maxDate.getMonth() + MAX_RECURRENCE_MONTHS)

  const occurrences = []
  for (let i = 0; i < limit; i += 1) {
    const occStart = advance(start, frequency, i, interval)
    if (occStart > maxDate) break
    if (until && occStart > until) break
    const occEnd = durationMs != null ? new Date(occStart.getTime() + durationMs) : null
    occurrences.push({
      startDatetime: occStart.toISOString(),
      endDatetime: occEnd ? occEnd.toISOString() : null,
    })
  }
  return occurrences
}

// ── Permissões ───────────────────────────────────────────────────
// Apenas o admin ignora o âmbito por igreja (acesso total a todas as igrejas).
const isAdmin = (role) => role === 'admin'
// Papéis que gerem e moderam eventos: o admin sem âmbito; aprovador e editor
// limitados às igrejas a que têm acesso. O visitante nunca entra aqui.
const canManageEvents = (role) => ['admin', 'aprovador', 'editor'].includes(role)
// "Ver tudo": admin e visitante veem sempre eventos privados; os restantes
// dependem da permissão can_view_private.
const canSeePrivate = (user) =>
  user.role === 'admin' || user.role === 'visitante' || user.canViewPrivate === true

// Acesso por igreja do utilizador: null/ausente = todas as igrejas.
function userChurches(user) {
  const ch = user?.churches
  return Array.isArray(ch) && ch.length > 0 ? ch : null
}

// Etiquetas de privacidade que o utilizador pode ver: null/ausente = todas.
function userPrivacyTags(user) {
  const tags = user?.privacyTags
  return Array.isArray(tags) && tags.length > 0 ? tags : null
}

// Verdadeiro se o utilizador tem acesso à igreja do evento (admin = sempre).
function canAccessChurch(user, community) {
  if (isAdmin(user.role)) return true
  const churches = userChurches(user)
  return churches === null || churches.includes(community)
}

// Delegação de aprovação (aditiva): verdadeiro se existe uma delegação ATIVA ao
// utilizador que cobre a igreja e a categoria do evento (church/category nulos
// na delegação = "todas"). Estende o âmbito de aprovação de um editor.
async function hasActiveDelegation(user, event) {
  if (!user?.sub) return false
  const delegations = await delegationsRepo.listActiveForDelegate(user.sub)
  return delegations.some(
    (d) =>
      (d.church == null || d.church === event.community) &&
      (d.category == null || d.category === event.category) &&
      (d.subcategory == null || d.subcategory === event.subcategory)
  )
}

// Âmbito do aprovador (complementar ao acesso por igreja): sem regras = tudo;
// com regras, o evento tem de casar (igreja e categoria) com pelo menos uma.
// Fail-open se a tabela ainda não existir (migração pendente).
async function matchesApproverScopes(approverId, event) {
  try {
    const scopes = await approverScopesRepo.listByApprover(approverId)
    if (scopes.length === 0) return true
    return scopes.some(
      (s) =>
        (s.church == null || s.church === event.community) &&
        (s.category == null || s.category === event.category) &&
        (s.subcategory == null || s.subcategory === event.subcategory) &&
        (s.privacyTag == null || s.privacyTag === event.privacyTag)
    )
  } catch (err) {
    console.error('[events] âmbito de aprovador indisponível (migração pendente?):', err?.message ?? err)
    return true
  }
}

// Verdadeiro se o utilizador pode moderar (aprovar/rejeitar) o evento: gere
// eventos E (tem acesso à igreja OU há uma delegação ativa que a cobre). Os
// aprovadores respeitam ainda o âmbito configurado (igreja/categoria).
async function canModerate(user, event) {
  if (!canManageEvents(user.role)) return false
  if (canAccessChurch(user, event.community)) {
    if (user.role === 'aprovador') return matchesApproverScopes(user.sub, event)
    return true
  }
  return hasActiveDelegation(user, event)
}

// Admin gere tudo; aprovador/editor gerem os eventos das suas igrejas.
function canEdit(user, event) {
  return canManageEvents(user.role) && canAccessChurch(user, event.community)
}

function ensureCanEdit(user, event) {
  if (!canEdit(user, event)) {
    throw new EventError(403, 'Sem permissão para alterar este evento.')
  }
}

// Notifica (por email, em segundo plano) o criador do evento sobre uma mudança
// de estado (aprovado/rejeitado/eliminado). Nunca bloqueia nem falha a operação.
// No Vercel, waitUntil mantém a função viva até o email sair; localmente é no-op.
function notifyCreator(event, status, { reason, actorId } = {}) {
  if (!event?.createdBy) return
  // Não enviar email a quem executou a própria ação sobre o seu evento.
  if (actorId && event.createdBy === actorId) return
  const task = (async () => {
    const creator = await usersRepo.findById(event.createdBy)
    if (!creator?.email || creator.isActive === false) return
    await sendEventStatusEmail(creator.email, {
      name: creator.name,
      eventTitle: event.title,
      status,
      reason,
      eventDate: event.date,
      eventTime: event.timeStart,
    })
  })().catch((err) => {
    console.error('[events] Falha ao notificar o criador do evento:', err?.message ?? err)
  })
  try {
    waitUntil(task)
  } catch {
    /* fora do runtime Vercel: no-op; o processo persistente conclui a task */
  }
}

// Moderadores a notificar quando um evento é submetido: admins ativos +
// aprovadores ativos com acesso à igreja + editores com delegação ativa que
// cobre (igreja, categoria).
async function listApproversFor(event) {
  const users = await usersRepo.list()
  const byId = new Map()
  for (const u of users) {
    if (!u.isActive) continue
    if (u.role === 'admin') {
      byId.set(u.id, u)
    } else if (u.role === 'aprovador') {
      const ch = Array.isArray(u.churches) && u.churches.length ? u.churches : null
      if ((ch === null || ch.includes(event.community)) && (await matchesApproverScopes(u.id, event))) {
        byId.set(u.id, u)
      }
    }
  }
  const delegateIds = await delegationsRepo.listActiveForEvent(event.community, event.category, event.subcategory)
  if (delegateIds.length) {
    for (const u of users) {
      if (u.isActive && delegateIds.includes(u.id)) byId.set(u.id, u)
    }
  }
  return [...byId.values()]
}

// Notifica (em segundo plano) os moderadores de que há um evento para aprovar,
// com um link seguro (token) para aprovar/rejeitar sem sessão. Exclui o autor.
function notifyApprovers(event, submitterId) {
  const task = (async () => {
    const approvers = await listApproversFor(event)
    const base = config.appUrl.replace(/\/+$/, '')
    for (const approver of approvers) {
      if (!approver?.email || approver.id === submitterId) continue
      const token = signApprovalToken({ eventId: event.id, approverId: approver.id })
      const link = `${base}/acao?t=${encodeURIComponent(token)}`
      await sendApprovalRequestEmail(approver.email, {
        name: approver.name,
        eventTitle: event.title,
        eventDate: event.date,
        eventTime: event.timeStart,
        community: event.community,
        link,
      })
    }
  })().catch((err) => {
    console.error('[events] Falha ao notificar aprovadores:', err?.message ?? err)
  })
  try {
    waitUntil(task)
  } catch {
    /* fora do runtime Vercel: no-op; o processo persistente conclui a task */
  }
}

// ── Leitura ──────────────────────────────────────────────────────

// Ordena por data/hora de início (eventos do SoR e externos misturados).
function sortByStart(events) {
  return events.sort((a, b) =>
    a.startDatetime < b.startDatetime ? -1 : a.startDatetime > b.startDatetime ? 1 : 0
  )
}

// Lê os eventos externos (inChurch) já guardados na BD, se a integração estiver
// ativa. São sempre públicos/publicados — entram em todas as vistas do calendário.
async function loadExternal({ from, to } = {}) {
  if (!(await settingsService.isExternalEnabled())) return []
  return externalRepo.list({ from, to })
}

/** Agenda pública: publicados e não privados do SoR + eventos externos (inChurch). */
export async function listPublic({ from, to } = {}) {
  const [sor, external] = await Promise.all([
    repo.list({ status: 'publicado', includePrivate: false, from, to }),
    loadExternal({ from, to }),
  ])
  return sortByStart([...sor, ...external])
}

/**
 * Categorias distintas em uso por qualquer evento (SoR, qualquer estado) e
 * pelos eventos externos (se a integração estiver ativa). Alimenta o filtro
 * dinâmico de categorias na barra lateral.
 */
export async function categoriesInUse() {
  const external = (await settingsService.isExternalEnabled())
    ? await externalRepo.distinctCategories()
    : []
  const sor = await repo.distinctCategories()
  return Array.from(new Set([...sor, ...external]))
}

/** Subcategorias distintas em uso por eventos do SoR (alimenta filtros). */
export async function subcategoriesInUse() {
  return repo.distinctSubcategories()
}

/**
 * Agenda para o calendário autenticado: eventos publicados (SoR), incluindo os
 * privados apenas se o utilizador tiver acesso (admin ou can_view_private), mais
 * os eventos externos (inChurch). Com `includeDrafts` (apenas staff), inclui
 * também rascunhos e pendentes do SoR.
 */
export async function listCalendar(user, { includeDrafts = false, from, to } = {}) {
  const includePrivate = canSeePrivate(user)
  const allowedPrivacyTags = userPrivacyTags(user)
  const external = await loadExternal({ from, to })

  // Sem rascunhos (ou utilizador sem gestão): apenas eventos publicados.
  if (!includeDrafts || !canManageEvents(user.role)) {
    const sor = await repo.list({ status: 'publicado', includePrivate, allowedPrivacyTags, from, to })
    return sortByStart([...sor, ...external])
  }
  // Admin vê rascunhos/pendentes de todas as igrejas.
  if (isAdmin(user.role)) {
    const sor = await repo.list({
      status: ['publicado', 'pendente', 'rascunho'],
      includePrivate,
      allowedPrivacyTags,
      from,
      to,
    })
    return sortByStart([...sor, ...external])
  }
  // Gestor com âmbito: publicados de todas as igrejas + rascunhos/pendentes
  // apenas das igrejas a que tem acesso.
  const communities = userChurches(user)
  const [published, drafts] = await Promise.all([
    repo.list({ status: 'publicado', includePrivate, allowedPrivacyTags, from, to }),
    repo.list({ status: ['pendente', 'rascunho'], communities, includePrivate, allowedPrivacyTags, from, to }),
  ])
  return sortByStart([...published, ...drafts, ...external])
}

/** Lista para gestão, filtrada conforme o papel e o acesso por igreja. */
export function listForUser(user) {
  if (isAdmin(user.role)) return repo.list()
  // Sem permissão de gestão (visitante): apenas eventos publicados.
  if (!canManageEvents(user.role)) return repo.list({ status: 'publicado' })
  // Aprovador/editor: eventos das igrejas a que têm acesso (null = todas).
  return repo.list({ communities: userChurches(user) })
}

// Estados relevantes para o painel de aprovações.
const APPROVAL_STATUSES = ['pendente', 'publicado', 'rejeitado']
function normalizeApprovalStatus(status) {
  if (status === 'todos' || status === 'all') return APPROVAL_STATUSES
  if (APPROVAL_STATUSES.includes(status)) return [status]
  return ['pendente']
}

/**
 * Lista para o painel de aprovações: eventos que o utilizador pode moderar,
 * filtrados por estado. O admin vê todos; aprovador/editor veem os das suas
 * igrejas MAIS os cobertos por delegações ativas.
 */
export async function listForApproval(user, { status } = {}) {
  const statuses = normalizeApprovalStatus(status)
  const all = await repo.list({ status: statuses })
  if (isAdmin(user.role)) return all
  const delegations = await delegationsRepo.listActiveForDelegate(user.sub)
  let scopes = []
  if (user.role === 'aprovador') {
    try {
      scopes = await approverScopesRepo.listByApprover(user.sub)
    } catch {
      scopes = []
    }
  }
  const inScope = (e) =>
    scopes.length === 0 ||
    scopes.some(
      (s) =>
        (s.church == null || s.church === e.community) &&
        (s.category == null || s.category === e.category) &&
        (s.subcategory == null || s.subcategory === e.subcategory) &&
        (s.privacyTag == null || s.privacyTag === e.privacyTag)
    )
  const byDelegation = (e) =>
    delegations.some(
      (d) =>
        (d.church == null || d.church === e.community) &&
        (d.category == null || d.category === e.category) &&
        (d.subcategory == null || d.subcategory === e.subcategory)
    )
  return all.filter((e) => {
    if (canAccessChurch(user, e.community)) {
      return user.role === 'aprovador' ? inScope(e) : true
    }
    return byDelegation(e)
  })
}

export async function getForUser(user, id) {
  const event = await repo.findById(id)
  if (!event) throw new EventError(404, 'Evento não encontrado.')
  // Não-gestores (visitante) só acedem a eventos publicados.
  if (!canManageEvents(user.role) && event.status !== 'publicado') {
    throw new EventError(403, 'Sem permissão para ver este evento.')
  }
  if (!canAccessChurch(user, event.community)) {
    throw new EventError(403, 'Sem permissão para ver este evento.')
  }
  return event
}

// ── Escrita ──────────────────────────────────────────────────────

// Transição direta rascunho→pendente ao criar com "submeter para aprovação".
async function markSubmitted(user, id) {
  const updated = await repo.updateStatus(id, { status: 'pendente', touchSubmitted: true })
  await repo.addHistory({
    eventId: id,
    actorId: user.sub,
    fromStatus: 'rascunho',
    toStatus: 'pendente',
    comment: 'Submetido para aprovação',
  })
  if (!updated.seriesId) notifyApprovers(updated, user.sub)
  return updated
}

// Auto-aprovação: admins e aprovadores publicam diretamente os eventos que
// submetem (sem passar por "pendente"). Ignora a separação de funções por ser o
// próprio a criar; o âmbito por igreja já foi validado em create().
async function autoPublish(user, id) {
  const updated = await repo.updateStatus(id, {
    status: 'publicado',
    rejectionReason: null,
    touchPublished: true,
  })
  await repo.addHistory({
    eventId: id,
    actorId: user.sub,
    fromStatus: 'rascunho',
    toStatus: 'publicado',
    comment: 'Aprovado automaticamente (criado por admin/aprovador)',
  })
  return updated
}

// ── Sobreposição de eventos ──────────────────────────────────────

// Modo de sobreposição efetivo para um evento: categoria → igreja → omissão.
function resolveOverlapMode(policy, { community, category }) {
  return (
    (category && policy.byCategory?.[category]) ||
    (community && policy.byChurch?.[community]) ||
    policy.default ||
    'off'
  )
}

// Intervalo [start, end) efetivo de um evento (Date), tratando o dia inteiro.
function effectiveRange({ startDatetime, endDatetime, allDay }) {
  const start = new Date(startDatetime)
  if (allDay) {
    const s = new Date(start)
    s.setHours(0, 0, 0, 0)
    const e = new Date(s)
    e.setDate(e.getDate() + 1)
    return { start: s, end: e }
  }
  const end = endDatetime ? new Date(endDatetime) : new Date(start.getTime() + 60 * 60 * 1000)
  return { start, end }
}

// Resumo de um conflito para o cliente. Não revela o título de eventos privados
// que o utilizador não pode ver.
function summarizeConflict(event, user) {
  const canSee = !event.isPrivate || canSeePrivate(user)
  return {
    id: event.id,
    title: canSee ? event.title : null,
    private: !!event.isPrivate,
    community: event.community,
    category: event.category,
    date: event.date,
    timeStart: event.timeStart,
    timeEnd: event.timeEnd,
    status: event.status,
  }
}

// Verifica sobreposições segundo a política. Lança EventError(409) com a lista
// de conflitos quando há colisão e não é permitido prosseguir.
async function assertOverlapOk(user, data, { excludeId, excludeSeriesId, allowOverlap } = {}) {
  const policy = await settingsService.getOverlapPolicy()
  const mode = resolveOverlapMode(policy, { community: data.community, category: data.category })
  if (mode === 'off') return
  const { start, end } = effectiveRange({
    startDatetime: data.startDatetime,
    endDatetime: data.endDatetime,
    allDay: data.allDay,
  })
  const overlaps = await repo.findOverlaps({ start, end, excludeId, excludeSeriesId })
  if (overlaps.length === 0) return
  // 'block': só admin pode forçar. 'warn': qualquer um pode forçar.
  const canForce = mode === 'block' ? isAdmin(user.role) && allowOverlap === true : allowOverlap === true
  if (canForce) return
  const err = new EventError(
    409,
    mode === 'block'
      ? 'Este horário sobrepõe-se a outro evento (sobreposição bloqueada).'
      : 'Este horário sobrepõe-se a outro evento.'
  )
  err.overlaps = overlaps.map((o) => summarizeConflict(o, user))
  err.overlapMode = mode
  throw err
}

// Pré-visualização de sobreposições (aviso em tempo real no formulário).
export async function overlapsPreview(user, { community, category, start, end, allDay, excludeId, excludeSeriesId } = {}) {
  if (!start) return { mode: 'off', conflicts: [] }
  const policy = await settingsService.getOverlapPolicy()
  const mode = resolveOverlapMode(policy, { community, category })
  if (mode === 'off') return { mode: 'off', conflicts: [] }
  const range = effectiveRange({
    startDatetime: start,
    endDatetime: end || null,
    allDay: allDay === true || allDay === 'true',
  })
  const overlaps = await repo.findOverlaps({ start: range.start, end: range.end, excludeId, excludeSeriesId })
  return { mode, conflicts: overlaps.map((o) => summarizeConflict(o, user)) }
}

// Normaliza e valida a subcategoria: '' → null; se indicada tem de existir; se a
// categoria a exige, é obrigatória. Escreve em `data.subcategory` o valor limpo.
async function assertSubcategoryOk(data) {
  const sub = data.subcategory && data.subcategory.trim() ? data.subcategory.trim() : null
  data.subcategory = sub
  if (sub) await subcategoriesService.assertKnownSubcategory(sub)
  if (!sub && (await categoriesService.requiresSubcategory(data.category ?? 'evento'))) {
    throw new EventError(400, 'Esta categoria exige uma subcategoria.')
  }
}

export async function create(user, input) {
  const data = eventInputSchema.parse(input)
  const recurrence = recurrenceSchema.parse(input.recurrence)
  await categoriesService.assertKnownCategory(data.category)
  await assertSubcategoryOk(data)
  await privacyTagsService.assertKnownPrivacyTag(data.privacyTag)
  if (!canAccessChurch(user, data.community ?? 'Sede')) {
    throw new EventError(403, 'Sem acesso a esta igreja.')
  }
  const submit = data.submit === true
  // Admins e aprovadores auto-aprovam (publicam) os eventos que submetem, sem
  // passar pela fila de aprovação. Rascunhos guardados continuam rascunhos.
  const autoApprove = submit && ['admin', 'aprovador'].includes(user.role)
  const allowOverlap = input.allowOverlap === true

  // Evento único.
  if (!recurrence) {
    await assertOverlapOk(user, data, { allowOverlap })
    const event = await repo.insert(data, user.sub)
    await repo.addHistory({
      eventId: event.id,
      actorId: user.sub,
      fromStatus: null,
      toStatus: 'rascunho',
      comment: 'Criado',
    })
    if (autoApprove) return autoPublish(user, event.id)
    return submit ? markSubmitted(user, event.id) : event
  }

  // Série recorrente: verifica TODAS as ocorrências antes de inserir qualquer uma.
  const occurrences = generateOccurrences(data.startDatetime, data.endDatetime, recurrence)
  for (const occ of occurrences) {
    await assertOverlapOk(
      user,
      { ...data, startDatetime: occ.startDatetime, endDatetime: occ.endDatetime },
      { allowOverlap }
    )
  }
  const seriesId = randomUUID()
  let first = null
  for (const occ of occurrences) {
    const event = await repo.insert(
      { ...data, startDatetime: occ.startDatetime, endDatetime: occ.endDatetime, seriesId },
      user.sub
    )
    await repo.addHistory({
      eventId: event.id,
      actorId: user.sub,
      fromStatus: null,
      toStatus: 'rascunho',
      comment: 'Criado (série)',
    })
    const created = autoApprove
      ? await autoPublish(user, event.id)
      : submit
        ? await markSubmitted(user, event.id)
        : event
    if (!first) first = created
  }
  return first
}

export async function update(user, id, input, { scope } = {}) {
  const existing = await repo.findById(id)
  if (!existing) throw new EventError(404, 'Evento não encontrado.')
  ensureCanEdit(user, existing)
  const data = eventInputSchema.parse(input)
  await categoriesService.assertKnownCategory(data.category)
  await assertSubcategoryOk(data)
  await privacyTagsService.assertKnownPrivacyTag(data.privacyTag)
  // Não permitir mover o evento para uma igreja sem acesso.
  if (!canAccessChurch(user, data.community ?? 'Sede')) {
    throw new EventError(403, 'Sem acesso a esta igreja.')
  }
  // Eventos publicados (aprovados): a data/hora não podem ser alteradas — apenas
  // rascunhos e pendentes permitem editar tudo. Preserva a data/hora existentes.
  if (existing.status === 'publicado') {
    data.startDatetime = existing.startDatetime
    data.endDatetime = existing.endDatetime
    data.allDay = existing.allDay
  }
  const allowOverlap = input.allowOverlap === true
  await assertOverlapOk(user, data, {
    excludeId: id,
    excludeSeriesId: scope === 'series' ? existing.seriesId : undefined,
    allowOverlap,
  })
  const updated = await repo.update(id, data)
  // Âmbito "série": replica os campos partilhados (exceto datas) nas restantes
  // ocorrências, mantendo a data/hora própria de cada uma.
  if (scope === 'series' && existing.seriesId) {
    await repo.updateSeriesShared(existing.seriesId, data, id)
  }
  return updated
}

export async function remove(user, id, { scope } = {}) {
  const existing = await repo.findById(id)
  if (!existing) throw new EventError(404, 'Evento não encontrado.')
  // Admin elimina qualquer evento; aprovador/editor apenas os das suas igrejas.
  if (!canManageEvents(user.role) || !canAccessChurch(user, existing.community)) {
    throw new EventError(403, 'Sem permissão para eliminar este evento.')
  }
  // Âmbito "série": elimina todas as ocorrências da mesma série.
  if (scope === 'series' && existing.seriesId) {
    await repo.removeSeries(existing.seriesId)
    notifyCreator(existing, 'eliminado', { actorId: user.sub })
    return
  }
  await repo.remove(id)
  notifyCreator(existing, 'eliminado', { actorId: user.sub })
}

// ── Fluxo de aprovação (máquina de estados) ─────────────────────

export async function submit(user, id) {
  const event = await repo.findById(id)
  if (!event) throw new EventError(404, 'Evento não encontrado.')
  ensureCanEdit(user, event)
  if (!['rascunho', 'rejeitado'].includes(event.status)) {
    throw new EventError(409, 'Só é possível submeter rascunhos ou eventos rejeitados.')
  }
  const updated = await repo.updateStatus(id, { status: 'pendente', touchSubmitted: true })
  await repo.addHistory({
    eventId: id,
    actorId: user.sub,
    fromStatus: event.status,
    toStatus: 'pendente',
    comment: 'Submetido para aprovação',
  })
  notifyApprovers(updated, user.sub)
  return updated
}

export async function approve(user, id) {
  if (!canManageEvents(user.role)) throw new EventError(403, 'Sem permissão para aprovar.')
  const event = await repo.findById(id)
  if (!event) throw new EventError(404, 'Evento não encontrado.')
  // Aprovador/editor só aprovam pedidos das igrejas a que têm acesso.
  if (!(await canModerate(user, event))) {
    throw new EventError(403, 'Sem acesso a esta igreja.')
  }
  if (event.status !== 'pendente') {
    throw new EventError(409, 'Apenas eventos pendentes podem ser aprovados.')
  }
  // Separação de funções (RA-09): aprovador não aprova o seu próprio evento; admin pode.
  if (user.role !== 'admin' && event.createdBy === user.sub) {
    throw new EventError(403, 'Não pode aprovar um evento que submeteu.')
  }
  const updated = await repo.updateStatus(id, {
    status: 'publicado',
    rejectionReason: null,
    touchPublished: true,
  })
  await repo.addHistory({
    eventId: id,
    actorId: user.sub,
    fromStatus: 'pendente',
    toStatus: 'publicado',
    comment: 'Aprovado',
  })
  notifyCreator(event, 'aprovado', { actorId: user.sub })
  return updated
}

export async function reject(user, id, reason) {
  if (!canManageEvents(user.role)) throw new EventError(403, 'Sem permissão para rejeitar.')
  const trimmed = (reason ?? '').trim()
  if (!trimmed) throw new EventError(400, 'É obrigatório indicar o motivo da rejeição.')
  const event = await repo.findById(id)
  if (!event) throw new EventError(404, 'Evento não encontrado.')
  // Aprovador/editor só rejeitam pedidos das igrejas a que têm acesso.
  if (!(await canModerate(user, event))) {
    throw new EventError(403, 'Sem acesso a esta igreja.')
  }
  if (event.status !== 'pendente') {
    throw new EventError(409, 'Apenas eventos pendentes podem ser rejeitados.')
  }
  const updated = await repo.updateStatus(id, { status: 'rejeitado', rejectionReason: trimmed })
  await repo.addHistory({
    eventId: id,
    actorId: user.sub,
    fromStatus: 'pendente',
    toStatus: 'rejeitado',
    comment: trimmed,
  })
  notifyCreator(event, 'rejeitado', { reason: trimmed, actorId: user.sub })
  return updated
}

export function history(id) {
  return repo.listHistory(id)
}
