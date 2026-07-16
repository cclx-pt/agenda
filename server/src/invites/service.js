import { z } from 'zod'
import { randomBytes, randomUUID } from 'node:crypto'
import { waitUntil } from '@vercel/functions'
import * as repo from './repository.js'
import * as eventsRepo from '../events/repository.js'
import { config } from '../config.js'
import { sendRsvpConfirmationEmail } from '../auth/email.js'

// Erro de domínio com código HTTP associado.
export class InviteError extends Error {
  constructor(status, message) {
    super(message)
    this.name = 'InviteError'
    this.status = status
  }
}

// ── Permissões (mesmo modelo de papéis dos eventos) ──────────────
const isAdmin = (role) => role === 'admin'
const canManage = (role) => ['admin', 'aprovador', 'editor'].includes(role)

function userChurches(user) {
  const ch = user?.churches
  return Array.isArray(ch) && ch.length > 0 ? ch : null
}
function canAccessChurch(user, community) {
  if (isAdmin(user.role)) return true
  if (!community) return true
  const churches = userChurches(user)
  return churches === null || churches.includes(community)
}
function ensureCanManage(user) {
  if (!canManage(user.role)) throw new InviteError(403, 'Sem permissão para gerir convites.')
}

// ── Slug ─────────────────────────────────────────────────────────
function slugify(str) {
  return (
    String(str ?? '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // remove acentos
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 120) || 'convite'
  )
}
async function generateUniqueSlug(title) {
  const base = slugify(title)
  for (let i = 0; i < 10; i += 1) {
    const slug = `${base}-${randomBytes(3).toString('hex')}`
    if (!(await repo.slugExists(slug))) return slug
  }
  return `${base}-${randomUUID().slice(0, 8)}`
}

// ── Validação ────────────────────────────────────────────────────
const isoDate = z
  .string()
  .refine((v) => !Number.isNaN(Date.parse(v)), 'Data inválida.')
  .optional()
  .nullable()

const COST_TYPES = ['gratuito', 'pago', 'voluntario']
const PAYMENT_METHODS = ['mbway', 'transferencia', 'referencia']

// Tipos de bloco conhecidos (allowlist; o conteúdo é JSONB flexível por tipo).
const BLOCK_TYPES = [
  'cabecalho',
  'banner',
  'info_extra',
  'convite_narrativo',
  'oradores',
  'agenda',
  'workshops',
  'rsvp',
  'pagamento',
  'localizacao',
  'partilha',
  'faqs',
  'rodape',
]

const inviteInputSchema = z.object({
  eventId: z.string().uuid().optional().nullable(),
  title: z.string().trim().min(1, 'O título é obrigatório.'),
  bannerUrl: z
    .string()
    .trim()
    .refine((v) => v === '' || v.startsWith('/') || /^https?:\/\//i.test(v), 'URL de banner inválido.')
    .optional()
    .nullable(),
  colorTheme: z.string().trim().max(20).optional().nullable(),
  startDatetime: isoDate,
  endDatetime: isoDate,
  location: z.string().trim().max(300).optional().nullable(),
  mapUrl: z
    .string()
    .trim()
    .refine((v) => v === '' || /^https?:\/\//i.test(v), 'Link de localização inválido.')
    .optional()
    .nullable(),
  metaTitle: z.string().trim().max(200).optional().nullable(),
  metaDescription: z.string().trim().max(300).optional().nullable(),
  metaImageUrl: z
    .string()
    .trim()
    .refine((v) => v === '' || v.startsWith('/') || /^https?:\/\//i.test(v), 'URL inválido.')
    .optional()
    .nullable(),
  costType: z.enum(COST_TYPES).optional(),
  costAmount: z.number().min(0).max(1000000).optional().nullable(),
  costCurrency: z.string().trim().max(8).optional(),
  paymentMethods: z.array(z.enum(PAYMENT_METHODS)).optional().nullable(),
  // Método de pagamento ÚNICO (substitui a lista). Mantemos payment_methods
  // sincronizado internamente para o conector.
  paymentMethod: z.enum(PAYMENT_METHODS).optional().nullable(),
  rsvpEnabled: z.boolean().optional(),
  registrationMode: z.enum(['none', 'external', 'internal']).optional(),
  registrationUrl: z
    .string()
    .trim()
    .refine((v) => v === '' || /^https?:\/\//i.test(v), 'Link de inscrição inválido.')
    .optional()
    .nullable(),
  // Datas de INSCRIÇÃO (janela): abertura e fecho. As datas do EVENTO são
  // start/endDatetime (herdadas do evento associado ou manuais).
  rsvpStartDatetime: isoDate,
  rsvpDeadline: isoDate,
  useEventBanner: z.boolean().optional(),
  capacity: z.number().int().min(1).max(1000000).optional().nullable(),
  community: z.string().trim().max(120).optional().nullable(),
})

// Bilhete (tipo) de um convite. Tipos: individual, grátis (0€), oferta
// voluntária (valor livre) e grupo (abre secção de inscrição do grupo).
const ticketSchema = z.object({
  id: z.string().uuid().optional().nullable(),
  name: z.string().trim().min(1, 'Indique o nome do bilhete.').max(120),
  kind: z.enum(['individual', 'gratis', 'voluntaria', 'grupo']).optional().default('individual'),
  price: z.number().min(0).max(1000000).optional().nullable(),
  currency: z.string().trim().max(8).optional(),
  capacity: z.number().int().min(1).max(1000000).optional().nullable(),
  groupSize: z.number().int().min(1).max(1000).optional().nullable(),
  description: z.string().trim().max(500).optional().nullable(),
  paymentMethod: z.enum(PAYMENT_METHODS).optional().nullable(),
  active: z.boolean().optional().default(true),
})
const ticketsSchema = z.array(ticketSchema).max(50)

const blockSchema = z.object({
  type: z.enum(BLOCK_TYPES),
  content: z.record(z.any()).optional().default({}),
  visible: z.boolean().optional().default(true),
})
const blocksSchema = z.array(blockSchema).max(100)

const rsvpSchema = z.object({
  name: z.string().trim().min(1, 'Indique o seu nome.').max(200),
  email: z.string().trim().email('Email inválido.').max(200).optional().nullable(),
  phone: z.string().trim().max(50).optional().nullable(),
  guestsCount: z.number().int().min(1).max(50).optional().default(1),
  attend: z.boolean().optional().default(true),
  ticketId: z.string().uuid().optional().nullable(),
  extra: z.record(z.any()).optional().nullable(),
})

// ── Auxiliares de evento associado e pagamento ───────────────────

// Valida que o evento associado existe (se indicado). A herança de título/datas
// é feita no frontend; a origem do banner resolve-se na leitura (resolveInviteBanner).
async function assertEventOk(eventId) {
  if (!eventId) return
  const ev = await eventsRepo.findById(eventId)
  if (!ev) throw new InviteError(400, 'Evento associado não encontrado.')
}

// Método único → mantém payment_methods coerente (lista de 1) para o conector/payload.
function normalizePayment(data) {
  data.paymentMethods = data.paymentMethod ? [data.paymentMethod] : null
}

// Um bilhete é gratuito se for do tipo "grátis" ou (não-voluntária) sem preço > 0.
function ticketIsFree(t) {
  if (!t) return true
  if (t.kind === 'gratis') return true
  if (t.kind === 'voluntaria') return false
  return !(Number(t.price) > 0)
}

// Banner efetivo: o do evento associado (se "usar imagem do evento") ou o próprio.
async function resolveInviteBanner(invite) {
  if (invite.useEventBanner && invite.eventId) {
    const ev = await eventsRepo.findById(invite.eventId).catch(() => null)
    if (ev?.bannerUrl) return ev.bannerUrl
  }
  return invite.bannerUrl
}

// ── Escrita (organizador) ────────────────────────────────────────

export async function create(user, input) {
  ensureCanManage(user)
  const data = inviteInputSchema.parse(input)
  if (!canAccessChurch(user, data.community)) {
    throw new InviteError(403, 'Sem acesso a esta igreja.')
  }
  await assertEventOk(data.eventId)
  normalizePayment(data)
  data.slug = await generateUniqueSlug(data.title)
  const invite = await repo.insert(data, user.sub)
  // Semeia um bloco banner mínimo para a página não nascer vazia.
  await repo.replaceBlocks(invite.id, [
    { type: 'banner', visible: true, content: {} },
    { type: 'rsvp', visible: true, content: { ctaLabel: 'Inscrever-me' } },
    { type: 'pagamento', visible: true, content: {} },
    { type: 'partilha', visible: true, content: {} },
  ])
  return getForEditor(user, invite.id)
}

export async function listForUser(user) {
  ensureCanManage(user)
  if (isAdmin(user.role)) return repo.list()
  const churches = userChurches(user)
  const all = await repo.list()
  // Editores/aprovadores veem os convites das suas igrejas (ou sem igreja) e os que criaram.
  return all.filter(
    (i) => churches === null || i.community == null || churches.includes(i.community) || i.createdBy === user.sub
  )
}

// Convite completo para o editor (inclui blocos e métricas), sem filtro de visibilidade.
export async function getForEditor(user, id) {
  ensureCanManage(user)
  const invite = await repo.findById(id)
  if (!invite) throw new InviteError(404, 'Convite não encontrado.')
  if (!canAccessChurch(user, invite.community)) {
    throw new InviteError(403, 'Sem acesso a este convite.')
  }
  const [blocks, views, tickets] = await Promise.all([
    repo.listBlocks(id),
    repo.countViews(id),
    repo.listTicketsWithSold(id),
  ])
  let event = null
  if (invite.eventId) {
    const ev = await eventsRepo.findById(invite.eventId).catch(() => null)
    if (ev) {
      event = {
        id: ev.id,
        title: ev.title,
        bannerUrl: ev.bannerUrl ?? null,
        startDatetime: ev.startDatetime,
        endDatetime: ev.endDatetime,
        location: ev.location ?? null,
        mapUrl: ev.mapUrl ?? null,
      }
    }
  }
  return { ...invite, blocks, views, tickets, event }
}

export async function update(user, id, input) {
  ensureCanManage(user)
  const existing = await repo.findById(id)
  if (!existing) throw new InviteError(404, 'Convite não encontrado.')
  if (!canAccessChurch(user, existing.community)) {
    throw new InviteError(403, 'Sem acesso a este convite.')
  }
  const data = inviteInputSchema.parse(input)
  if (!canAccessChurch(user, data.community)) {
    throw new InviteError(403, 'Sem acesso a esta igreja.')
  }
  await assertEventOk(data.eventId)
  normalizePayment(data)
  await repo.update(id, data)
  return getForEditor(user, id)
}

export async function replaceBlocks(user, id, input) {
  ensureCanManage(user)
  const existing = await repo.findById(id)
  if (!existing) throw new InviteError(404, 'Convite não encontrado.')
  if (!canAccessChurch(user, existing.community)) {
    throw new InviteError(403, 'Sem acesso a este convite.')
  }
  const blocks = blocksSchema.parse(input.blocks ?? [])
  await repo.replaceBlocks(id, blocks)
  return getForEditor(user, id)
}

export async function publish(user, id) {
  ensureCanManage(user)
  const existing = await repo.findById(id)
  if (!existing) throw new InviteError(404, 'Convite não encontrado.')
  if (!canAccessChurch(user, existing.community)) {
    throw new InviteError(403, 'Sem acesso a este convite.')
  }
  return repo.updateStatus(id, { status: 'publicado', touchPublished: true })
}

export async function setStatus(user, id, status) {
  ensureCanManage(user)
  if (!['rascunho', 'publicado', 'fechado'].includes(status)) {
    throw new InviteError(400, 'Estado inválido.')
  }
  const existing = await repo.findById(id)
  if (!existing) throw new InviteError(404, 'Convite não encontrado.')
  if (!canAccessChurch(user, existing.community)) {
    throw new InviteError(403, 'Sem acesso a este convite.')
  }
  return repo.updateStatus(id, { status, touchPublished: status === 'publicado' })
}

export async function remove(user, id) {
  ensureCanManage(user)
  const existing = await repo.findById(id)
  if (!existing) throw new InviteError(404, 'Convite não encontrado.')
  if (!canAccessChurch(user, existing.community)) {
    throw new InviteError(403, 'Sem acesso a este convite.')
  }
  await repo.remove(id)
}

export async function listGuests(user, id) {
  ensureCanManage(user)
  const existing = await repo.findById(id)
  if (!existing) throw new InviteError(404, 'Convite não encontrado.')
  if (!canAccessChurch(user, existing.community)) {
    throw new InviteError(403, 'Sem acesso a este convite.')
  }
  return repo.listGuests(id)
}

// Pré-visualização (organizador): mesma forma do payload público, sem exigir publicação.
export async function getPreview(user, id) {
  ensureCanManage(user)
  const invite = await repo.findById(id)
  if (!invite) throw new InviteError(404, 'Convite não encontrado.')
  if (!canAccessChurch(user, invite.community)) {
    throw new InviteError(403, 'Sem acesso a este convite.')
  }
  const blocks = await repo.listBlocks(id)
  const [tickets, bannerUrl] = await Promise.all([repo.listTicketsWithSold(id), resolveInviteBanner(invite)])
  return renderPayload(invite, blocks, null, { preview: true, bannerUrl, tickets })
}

// ── Leitura pública ──────────────────────────────────────────────

function buildMeta(invite, bannerUrl) {
  return {
    title: invite.metaTitle || invite.title,
    description: invite.metaDescription || null,
    image: invite.metaImageUrl || bannerUrl || null,
  }
}

// Estado do convidado (calculado, não persistido como bloco). `hasPayment` = o
// bilhete escolhido tem método de pagamento (→ reserva pendente de pagamento).
function guestStatusPayload(guest, hasPayment = false) {
  if (!guest) return null
  let nextAction = 'none'
  let message = ''
  if (guest.rsvpState === 'confirmed') {
    if (guest.paymentState === 'pending') {
      nextAction = 'pay'
      message = hasPayment
        ? 'A tua presença está reservada. Falta concluir o pagamento para poderes confirmar.'
        : 'A tua presença está confirmada. Falta concluir o pagamento.'
    } else if (guest.paymentState === 'awaiting_validation') {
      message = 'Inscrição confirmada. Aguardamos a validação do teu comprovativo.'
    } else if (guest.paymentState === 'paid') {
      message = 'Inscrição e pagamento confirmados. Até breve!'
    } else {
      message = 'A tua presença está confirmada. Até breve!'
    }
  } else if (guest.rsvpState === 'waitlisted') {
    message = 'Estás em lista de espera. Avisamos-te se abrir vaga.'
  } else if (guest.rsvpState === 'declined') {
    message = 'Registámos que não vais poder estar presente.'
  }
  return {
    rsvpState: guest.rsvpState,
    paymentState: guest.paymentState,
    nextAction,
    message,
  }
}

function renderPayload(invite, blocks, guest, { preview = false, bannerUrl = null, tickets = [], spotsLeft = null } = {}) {
  const banner = bannerUrl ?? invite.bannerUrl
  return {
    slug: invite.slug,
    status: invite.status,
    preview,
    invite: {
      title: invite.title,
      bannerUrl: banner,
      colorTheme: invite.colorTheme,
      // Datas do EVENTO.
      startDatetime: invite.startDatetime,
      endDatetime: invite.endDatetime,
      location: invite.location,
      mapUrl: invite.mapUrl,
      costType: invite.costType,
      costAmount: invite.costAmount,
      costCurrency: invite.costCurrency,
      paymentMethod: invite.paymentMethod,
      registrationMode: invite.registrationMode,
      registrationUrl: invite.registrationUrl,
      rsvpEnabled: invite.rsvpEnabled,
      // Datas de INSCRIÇÃO (janela).
      rsvpStartDatetime: invite.rsvpStartDatetime,
      rsvpDeadline: invite.rsvpDeadline,
      capacity: invite.capacity,
      spotsLeft,
    },
    meta: buildMeta(invite, banner),
    // Bilhetes ativos (só relevante para eventos pagos).
    tickets: (tickets || [])
      .filter((t) => t.active)
      .map((t) => ({
        id: t.id,
        name: t.name,
        kind: t.kind,
        price: t.price,
        currency: t.currency,
        groupSize: t.groupSize,
        description: t.description,
        paymentMethod: t.paymentMethod ?? null,
        soldOut: t.capacity != null && (t.sold ?? 0) >= t.capacity,
      })),
    blocks: blocks.filter((b) => b.visible).map((b) => ({ id: b.id, type: b.type, content: b.content })),
    guestStatus: guestStatusPayload(
      guest,
      !!(guest?.ticketId && (tickets || []).find((t) => t.id === guest.ticketId)?.paymentMethod)
    ),
  }
}

// Página pública por slug. Só devolve convites publicados. Se `guestToken`
// identificar um convidado deste convite, inclui o cartão de estado.
export async function getPublicBySlug(slug, { guestToken } = {}) {
  const invite = await repo.findBySlug(slug)
  if (!invite || invite.status === 'rascunho') {
    throw new InviteError(404, 'Convite não encontrado.')
  }
  const [blocks, tickets, bannerUrl] = await Promise.all([
    repo.listBlocks(invite.id),
    repo.listTicketsWithSold(invite.id),
    resolveInviteBanner(invite),
  ])
  let guest = null
  if (guestToken) {
    const g = await repo.findGuestByToken(guestToken)
    if (g && g.inviteId === invite.id) guest = g
  }
  let spotsLeft = null
  if (invite.capacity) {
    const taken = await repo.countConfirmedSeats(invite.id)
    spotsLeft = Math.max(0, invite.capacity - taken)
  }
  return { invite, payload: renderPayload(invite, blocks, guest, { bannerUrl, tickets, spotsLeft }) }
}

// Metadados Open Graph leves (para crawlers/pré-visualização de link).
export async function getMeta(slug) {
  const invite = await repo.findBySlug(slug)
  if (!invite || invite.status === 'rascunho') {
    throw new InviteError(404, 'Convite não encontrado.')
  }
  const bannerUrl = await resolveInviteBanner(invite)
  return { slug: invite.slug, ...buildMeta(invite, bannerUrl) }
}

export function recordView(inviteId, meta) {
  return repo.recordView(inviteId, meta).catch(() => {})
}

// Visibilidade condicional de um campo (espelha o frontend inviteFormFields.isVisible).
function fieldVisible(field, values) {
  const cond = field.visibleWhen
  if (!cond || !cond.field) return true
  return String(values[cond.field] ?? '') === String(cond.equals ?? '')
}

// Defesa no servidor: valida os campos OBRIGATÓRIOS visíveis (incl. consentimentos)
// contra o formulário configurado no bloco rsvp. É estritamente MAIS FRACA que a
// validação do frontend (só verifica presença, não formato) → nunca rejeita uma
// submissão válida feita pela UI; apenas trava POSTs diretos que saltam o formulário.
function assertSubmissionValid(fields, values) {
  let sectionVisible = true
  for (const f of fields) {
    if (f.type === 'section') {
      sectionVisible = fieldVisible(f, values)
      continue
    }
    if (!sectionVisible || !f.required || !fieldVisible(f, values)) continue
    const val = values[f.key]
    let empty
    if (f.type === 'checkbox') empty = !val
    else if (f.type === 'children' || f.type === 'multiselect') empty = !Array.isArray(val) || val.length === 0
    else empty = val == null || String(val).trim() === ''
    if (empty) {
      throw new InviteError(
        400,
        f.type === 'checkbox' ? `É necessário confirmar: "${f.label}".` : `O campo "${f.label}" é obrigatório.`
      )
    }
  }
}

// Envia (em background) a confirmação de inscrição ao convidado com o link pessoal.
function notifyGuestConfirmation(invite, guest, status) {
  if (!guest?.email) return
  const base = (config.appUrl || '').replace(/\/+$/, '')
  const link = `${base}/invite/${encodeURIComponent(invite.slug)}?g=${guest.token}`
  const p = sendRsvpConfirmationEmail(guest.email, {
    name: guest.name,
    eventTitle: invite.title,
    when: invite.startDatetime,
    statusMessage: status?.message ?? '',
    link,
  }).catch((err) => console.error('[invites] confirmação de inscrição:', err?.message ?? err))
  try {
    waitUntil(p)
  } catch {
    /* fora do runtime Vercel: o processo persistente conclui o envio */
  }
}

// ── RSVP (convidado, sem sessão) ─────────────────────────────────

export async function submitRsvp(slug, input) {
  const invite = await repo.findBySlug(slug)
  if (!invite || invite.status !== 'publicado') {
    throw new InviteError(404, 'Convite não encontrado.')
  }
  if (invite.registrationMode && invite.registrationMode !== 'internal') {
    throw new InviteError(409, 'Este convite não tem inscrições internas.')
  }
  if (!invite.rsvpEnabled) {
    throw new InviteError(409, 'As inscrições não estão abertas para este convite.')
  }
  if (invite.rsvpStartDatetime && Date.now() < Date.parse(invite.rsvpStartDatetime)) {
    throw new InviteError(409, 'As inscrições ainda não abriram.')
  }
  if (invite.rsvpDeadline && Date.now() > Date.parse(invite.rsvpDeadline)) {
    throw new InviteError(410, 'O prazo de inscrição terminou.')
  }
  const data = rsvpSchema.parse(input)

  // Validação server-side contra o formulário configurado (obrigatórios/consentimentos).
  // Só corre quando o bloco rsvp tem campos explícitos; fail-open na leitura dos blocos.
  let formFields
  try {
    const rsvpBlockForValidation = (await repo.listBlocks(invite.id)).find((b) => b.type === 'rsvp')
    formFields = rsvpBlockForValidation?.content?.fields
  } catch {
    formFields = null
  }
  if (Array.isArray(formFields) && formFields.length) {
    assertSubmissionValid(formFields, {
      ...(data.extra || {}),
      name: data.name,
      email: data.email,
      phone: data.phone,
    })
  }

  // Bilhete: valida que pertence ao convite e está ativo (grátis ou pago).
  let ticket = null
  if (data.ticketId) {
    ticket = await repo.findTicketById(data.ticketId)
    if (!ticket || ticket.inviteId !== invite.id || !ticket.active) {
      throw new InviteError(400, 'Bilhete inválido.')
    }
  }
  // Pagamento (a desenvolver): aplicável se o bilhete escolhido for pago, ou —
  // sem bilhete — se o convite tiver custo. Bilhetes grátis → não aplicável.
  const paymentState =
    (ticket ? !ticketIsFree(ticket) : invite.costType !== 'gratuito') ? 'pending' : 'not_applicable'

  // Capacidade: do bilhete escolhido (se houver) ou global do convite. Excedendo → lista de espera.
  let rsvpState = data.attend ? 'confirmed' : 'declined'
  if (rsvpState === 'confirmed') {
    if (ticket && ticket.capacity != null) {
      const sold = await repo.countTicketSold(ticket.id)
      if (sold + (data.guestsCount ?? 1) > ticket.capacity) rsvpState = 'waitlisted'
    } else if (invite.capacity) {
      const taken = await repo.countConfirmedSeats(invite.id)
      if (taken + (data.guestsCount ?? 1) > invite.capacity) rsvpState = 'waitlisted'
    }
  }

  // Idempotente por email: atualiza a resposta existente em vez de duplicar.
  const existing = data.email ? await repo.findGuestByEmail(invite.id, data.email) : null
  let guest
  if (existing) {
    guest = await repo.updateGuest(existing.id, {
      name: data.name,
      phone: data.phone ?? null,
      guestsCount: data.guestsCount ?? 1,
      rsvpState,
      paymentState: existing.paymentState === 'not_applicable' ? paymentState : existing.paymentState,
      ticketId: ticket?.id ?? null,
      extra: data.extra ?? null,
    })
  } else {
    guest = await repo.insertGuest(invite.id, {
      token: randomBytes(24).toString('hex'),
      name: data.name,
      email: data.email ?? null,
      phone: data.phone ?? null,
      guestsCount: data.guestsCount ?? 1,
      rsvpState,
      paymentState,
      ticketId: ticket?.id ?? null,
      extra: data.extra ?? null,
    })
  }
  const status = guestStatusPayload(guest, !!ticket?.paymentMethod)
  notifyGuestConfirmation(invite, guest, status)
  let spotsLeft = null
  if (invite.capacity) {
    const taken = await repo.countConfirmedSeats(invite.id)
    spotsLeft = Math.max(0, invite.capacity - taken)
  }
  return { token: guest.token, status, spotsLeft }
}

// ── Eventos associáveis + bilhetes (organizador) ─────────────────

// Eventos publicados e FUTUROS (hoje incluído) que o utilizador pode associar a
// um convite. Alimenta o seletor de evento no editor (obrigatório por regra de UI).
export async function listSelectableEvents(user) {
  ensureCanManage(user)
  const today = new Date().toISOString().slice(0, 10)
  const events = await eventsRepo.list({ status: 'publicado', from: today })
  return events
    .filter((e) => canAccessChurch(user, e.community))
    .map((e) => ({
      id: e.id,
      title: e.title,
      startDatetime: e.startDatetime,
      endDatetime: e.endDatetime,
      bannerUrl: e.bannerUrl ?? null,
      location: e.location ?? null,
      mapUrl: e.mapUrl ?? null,
      community: e.community,
    }))
}

export async function listTickets(user, id) {
  ensureCanManage(user)
  const invite = await repo.findById(id)
  if (!invite) throw new InviteError(404, 'Convite não encontrado.')
  if (!canAccessChurch(user, invite.community)) throw new InviteError(403, 'Sem acesso a este convite.')
  return repo.listTicketsWithSold(id)
}

export async function saveTickets(user, id, input) {
  ensureCanManage(user)
  const invite = await repo.findById(id)
  if (!invite) throw new InviteError(404, 'Convite não encontrado.')
  if (!canAccessChurch(user, invite.community)) throw new InviteError(403, 'Sem acesso a este convite.')
  const tickets = ticketsSchema.parse(input.tickets ?? [])
  return repo.replaceTickets(id, tickets)
}
