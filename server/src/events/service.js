import { z } from 'zod'
import { randomUUID } from 'node:crypto'
import * as repo from './repository.js'
import * as categoriesService from '../categories/service.js'
import * as privacyTagsService from '../privacyTags/service.js'

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
    isPrivate: z.boolean().optional(),
    // Aceita URL absoluto (http/https, ex.: banners da inChurch) ou caminho
    // relativo de upload servido pelo backend (ex.: /data/uploads/abc.png).
    bannerUrl: z
      .string()
      .trim()
      .refine((v) => v === '' || v.startsWith('/') || /^https?:\/\//i.test(v), 'URL de banner inválido.')
      .optional()
      .nullable(),
    // Etiqueta de privacidade. Obrigatória no formulário quando o evento é
    // privado (validado no frontend); aqui é apenas validada contra a BD se
    // fornecida, para não quebrar dados/legados sem etiqueta.
    privacyTag: z.string().trim().optional().nullable(),
  })
  .refine(
    (d) => !d.endDatetime || Date.parse(d.endDatetime) >= Date.parse(d.startDatetime),
    { message: 'A data de fim não pode ser anterior à de início.', path: ['endDatetime'] }
  )

// Máximo de ocorrências geradas por série (limite de segurança, sobretudo para
// recorrências "para sempre").
const MAX_OCCURRENCES = 200

// Recorrência opcional. Quando ausente (ou frequency='none'), o evento é único.
export const recurrenceSchema = z
  .object({
    frequency: z.enum(['daily', 'weekly', 'monthly']),
    interval: z.number().int().min(1).max(99).optional().default(1),
    end: z
      .object({
        type: z.enum(['never', 'count', 'date']),
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

// Avança uma data em N unidades de frequência, preservando a hora.
function advance(date, frequency, steps, interval) {
  const d = new Date(date)
  const n = steps * interval
  if (frequency === 'daily') d.setDate(d.getDate() + n)
  else if (frequency === 'weekly') d.setDate(d.getDate() + n * 7)
  else if (frequency === 'monthly') d.setMonth(d.getMonth() + n)
  return d
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

  const occurrences = []
  for (let i = 0; i < limit; i += 1) {
    const occStart = advance(start, frequency, i, interval)
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

// Admin gere tudo; aprovador/editor gerem os eventos das suas igrejas.
function canEdit(user, event) {
  return canManageEvents(user.role) && canAccessChurch(user, event.community)
}

function ensureCanEdit(user, event) {
  if (!canEdit(user, event)) {
    throw new EventError(403, 'Sem permissão para alterar este evento.')
  }
}

// ── Leitura ──────────────────────────────────────────────────────

/** Agenda pública: apenas publicados e não privados. */
export function listPublic({ from, to } = {}) {
  return repo.list({ status: 'publicado', includePrivate: false, from, to })
}

/**
 * Agenda para o calendário autenticado: eventos publicados, incluindo os
 * privados apenas se o utilizador tiver acesso (admin ou can_view_private).
 * Com `includeDrafts` (apenas staff), inclui também rascunhos e pendentes.
 */
export async function listCalendar(user, { includeDrafts = false, from, to } = {}) {
  const includePrivate = canSeePrivate(user)
  const allowedPrivacyTags = userPrivacyTags(user)
  // Sem rascunhos (ou utilizador sem gestão): apenas eventos publicados.
  if (!includeDrafts || !canManageEvents(user.role)) {
    return repo.list({ status: 'publicado', includePrivate, allowedPrivacyTags, from, to })
  }
  // Admin vê rascunhos/pendentes de todas as igrejas.
  if (isAdmin(user.role)) {
    return repo.list({ status: ['publicado', 'pendente', 'rascunho'], includePrivate, allowedPrivacyTags, from, to })
  }
  // Gestor com âmbito: publicados de todas as igrejas + rascunhos/pendentes
  // apenas das igrejas a que tem acesso.
  const communities = userChurches(user)
  const [published, drafts] = await Promise.all([
    repo.list({ status: 'publicado', includePrivate, allowedPrivacyTags, from, to }),
    repo.list({ status: ['pendente', 'rascunho'], communities, includePrivate, allowedPrivacyTags, from, to }),
  ])
  return [...published, ...drafts].sort((a, b) =>
    a.startDatetime < b.startDatetime ? -1 : a.startDatetime > b.startDatetime ? 1 : 0
  )
}

/** Lista para gestão, filtrada conforme o papel e o acesso por igreja. */
export function listForUser(user) {
  if (isAdmin(user.role)) return repo.list()
  // Sem permissão de gestão (visitante): apenas eventos publicados.
  if (!canManageEvents(user.role)) return repo.list({ status: 'publicado' })
  // Aprovador/editor: eventos das igrejas a que têm acesso (null = todas).
  return repo.list({ communities: userChurches(user) })
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

export async function create(user, input) {
  const data = eventInputSchema.parse(input)
  const recurrence = recurrenceSchema.parse(input.recurrence)
  await categoriesService.assertKnownCategory(data.category)
  await privacyTagsService.assertKnownPrivacyTag(data.privacyTag)
  if (!canAccessChurch(user, data.community ?? 'Sede')) {
    throw new EventError(403, 'Sem acesso a esta igreja.')
  }

  // Evento único: comportamento original.
  if (!recurrence) {
    const event = await repo.insert(data, user.sub)
    await repo.addHistory({
      eventId: event.id,
      actorId: user.sub,
      fromStatus: null,
      toStatus: 'rascunho',
      comment: 'Criado',
    })
    return event
  }

  // Série recorrente: materializa cada ocorrência partilhando um series_id.
  const occurrences = generateOccurrences(data.startDatetime, data.endDatetime, recurrence)
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
    if (!first) first = event
  }
  return first
}

export async function update(user, id, input, { scope } = {}) {
  const existing = await repo.findById(id)
  if (!existing) throw new EventError(404, 'Evento não encontrado.')
  ensureCanEdit(user, existing)
  const data = eventInputSchema.parse(input)
  await categoriesService.assertKnownCategory(data.category)
  await privacyTagsService.assertKnownPrivacyTag(data.privacyTag)
  // Não permitir mover o evento para uma igreja sem acesso.
  if (!canAccessChurch(user, data.community ?? 'Sede')) {
    throw new EventError(403, 'Sem acesso a esta igreja.')
  }
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
    return
  }
  await repo.remove(id)
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
  return updated
}

export async function approve(user, id) {
  if (!canManageEvents(user.role)) throw new EventError(403, 'Sem permissão para aprovar.')
  const event = await repo.findById(id)
  if (!event) throw new EventError(404, 'Evento não encontrado.')
  // Aprovador/editor só aprovam pedidos das igrejas a que têm acesso.
  if (!canAccessChurch(user, event.community)) {
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
  return updated
}

export async function reject(user, id, reason) {
  if (!canManageEvents(user.role)) throw new EventError(403, 'Sem permissão para rejeitar.')
  const trimmed = (reason ?? '').trim()
  if (!trimmed) throw new EventError(400, 'É obrigatório indicar o motivo da rejeição.')
  const event = await repo.findById(id)
  if (!event) throw new EventError(404, 'Evento não encontrado.')
  // Aprovador/editor só rejeitam pedidos das igrejas a que têm acesso.
  if (!canAccessChurch(user, event.community)) {
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
  return updated
}

export function history(id) {
  return repo.listHistory(id)
}
