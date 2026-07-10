import { z } from 'zod'
import { randomBytes, randomUUID } from 'node:crypto'
import * as repo from './repository.js'

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
  rsvpEnabled: z.boolean().optional(),
  rsvpDeadline: isoDate,
  capacity: z.number().int().min(1).max(1000000).optional().nullable(),
  community: z.string().trim().max(120).optional().nullable(),
})

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
  extra: z.record(z.any()).optional().nullable(),
})

// ── Escrita (organizador) ────────────────────────────────────────

export async function create(user, input) {
  ensureCanManage(user)
  const data = inviteInputSchema.parse(input)
  if (!canAccessChurch(user, data.community)) {
    throw new InviteError(403, 'Sem acesso a esta igreja.')
  }
  data.slug = await generateUniqueSlug(data.title)
  const invite = await repo.insert(data, user.sub)
  // Semeia um bloco banner mínimo para a página não nascer vazia.
  await repo.replaceBlocks(invite.id, [
    { type: 'banner', visible: true, content: {} },
    { type: 'rsvp', visible: true, content: { ctaLabel: 'Confirmar Presença' } },
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
  const [blocks, views] = await Promise.all([repo.listBlocks(id), repo.countViews(id)])
  return { ...invite, blocks, views }
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
  return renderPayload(invite, blocks, null, { preview: true })
}

// ── Leitura pública ──────────────────────────────────────────────

function buildMeta(invite) {
  return {
    title: invite.metaTitle || invite.title,
    description: invite.metaDescription || null,
    image: invite.metaImageUrl || invite.bannerUrl || null,
  }
}

// Estado do convidado (calculado, não persistido como bloco).
function guestStatusPayload(guest) {
  if (!guest) return null
  let nextAction = 'none'
  let message = ''
  if (guest.rsvpState === 'confirmed') {
    if (guest.paymentState === 'pending') {
      nextAction = 'pay'
      message = 'A tua presença está confirmada. Falta concluir o pagamento.'
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

function renderPayload(invite, blocks, guest, { preview = false } = {}) {
  return {
    slug: invite.slug,
    status: invite.status,
    preview,
    invite: {
      title: invite.title,
      bannerUrl: invite.bannerUrl,
      colorTheme: invite.colorTheme,
      startDatetime: invite.startDatetime,
      endDatetime: invite.endDatetime,
      location: invite.location,
      costType: invite.costType,
      costAmount: invite.costAmount,
      costCurrency: invite.costCurrency,
      paymentMethods: invite.paymentMethods,
      rsvpEnabled: invite.rsvpEnabled,
      rsvpDeadline: invite.rsvpDeadline,
      capacity: invite.capacity,
    },
    meta: buildMeta(invite),
    blocks: blocks.filter((b) => b.visible).map((b) => ({ id: b.id, type: b.type, content: b.content })),
    guestStatus: guestStatusPayload(guest),
  }
}

// Página pública por slug. Só devolve convites publicados. Se `guestToken`
// identificar um convidado deste convite, inclui o cartão de estado.
export async function getPublicBySlug(slug, { guestToken } = {}) {
  const invite = await repo.findBySlug(slug)
  if (!invite || invite.status === 'rascunho') {
    throw new InviteError(404, 'Convite não encontrado.')
  }
  const blocks = await repo.listBlocks(invite.id)
  let guest = null
  if (guestToken) {
    const g = await repo.findGuestByToken(guestToken)
    if (g && g.inviteId === invite.id) guest = g
  }
  return { invite, payload: renderPayload(invite, blocks, guest) }
}

// Metadados Open Graph leves (para crawlers/pré-visualização de link).
export async function getMeta(slug) {
  const invite = await repo.findBySlug(slug)
  if (!invite || invite.status === 'rascunho') {
    throw new InviteError(404, 'Convite não encontrado.')
  }
  return { slug: invite.slug, ...buildMeta(invite) }
}

export function recordView(inviteId, meta) {
  return repo.recordView(inviteId, meta).catch(() => {})
}

// ── RSVP (convidado, sem sessão) ─────────────────────────────────

export async function submitRsvp(slug, input) {
  const invite = await repo.findBySlug(slug)
  if (!invite || invite.status !== 'publicado') {
    throw new InviteError(404, 'Convite não encontrado.')
  }
  if (!invite.rsvpEnabled) {
    throw new InviteError(409, 'As inscrições não estão abertas para este convite.')
  }
  if (invite.rsvpDeadline && Date.now() > Date.parse(invite.rsvpDeadline)) {
    throw new InviteError(410, 'O prazo de inscrição terminou.')
  }
  const data = rsvpSchema.parse(input)
  const paymentState = invite.costType === 'gratuito' ? 'not_applicable' : 'pending'

  // Capacidade: se exceder, entra em lista de espera.
  let rsvpState = data.attend ? 'confirmed' : 'declined'
  if (rsvpState === 'confirmed' && invite.capacity) {
    const taken = await repo.countConfirmedSeats(invite.id)
    if (taken + (data.guestsCount ?? 1) > invite.capacity) rsvpState = 'waitlisted'
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
      extra: data.extra ?? null,
    })
  }
  return { token: guest.token, status: guestStatusPayload(guest) }
}
