import { z } from 'zod'
import { randomBytes, randomUUID } from 'node:crypto'
import { waitUntil } from '@vercel/functions'
import * as repo from './repository.js'
import * as eventsRepo from '../events/repository.js'
import { config } from '../config.js'
import { sendRsvpConfirmationEmail } from '../auth/email.js'
import { getActivePaymentMethods, getInvitePaymentInfo } from '../settings/service.js'

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
// Chave de método de pagamento (slug): os 3 integrados + os personalizados
// criados na Administração de convites. Validamos o FORMATO; a existência é
// garantida pela lista gerida em Definições e pela UI (só oferece métodos ativos).
const paymentMethodKeySchema = z
  .string()
  .trim()
  .regex(/^[a-z][a-z0-9-]*$/, 'Método de pagamento inválido.')
  .max(40)

// Opções da comunidade no formulário JotForm do MB WAY (o conjunto do JotForm, que
// não é 1:1 com as igrejas: Moita+Barreiro juntas, "Outra" como fallback).
const JOTFORM_COMMUNITIES = ['Sede', 'Açores', 'Almada', 'Moita & Barreiro', 'Caldas da Rainha', 'Coruche', 'Porto', 'Outra']
const CHURCH_TO_JOTFORM = {
  Sede: 'Sede',
  Açores: 'Açores',
  Almada: 'Almada',
  Barreiro: 'Moita & Barreiro',
  Moita: 'Moita & Barreiro',
  'Caldas Da Rainha': 'Caldas da Rainha',
  Coruche: 'Coruche',
  Porto: 'Porto',
}
// Igreja/comunidade → valor do JotForm. Vazio → null (cai para o próximo);
// conhecido → mapeado; desconhecido não-vazio → 'Outra'.
function churchToJotform(value) {
  if (!value) return null
  return CHURCH_TO_JOTFORM[value] || 'Outra'
}
// Comunidade final para o JotForm: override do convite → resposta do inscrito no
// formulário (campo `comunidade`) → igreja do evento → 'Outra'.
function resolveJotformCommunity(invite, guest, community) {
  if (invite.jotformCommunity) return invite.jotformCommunity
  return churchToJotform(guest?.extra?.comunidade) || churchToJotform(community) || 'Outra'
}

// URL do formulário JotForm do MB WAY (espelha o frontend). eventid = id do bilhete (único).
const JOTFORM_MBWAY_URL = 'https://form.jotform.com/240093000783346'
function buildJotformUrl({ local, mobile, eventId, ticketId }) {
  const p = new URLSearchParams()
  p.set('local', local || 'Porto')
  p.set('tipoDe77', 'Eventos')
  p.set('telemovelassociado', mobile || '')
  p.set('refdataid', eventId || '')
  p.set('eventid', ticketId || '')
  return `${JOTFORM_MBWAY_URL}?${p.toString()}`
}

// Tipos de bloco conhecidos (allowlist; o conteúdo é JSONB flexível por tipo).
const BLOCK_TYPES = [
  'cabecalho',
  'banner',
  'overview',
  'info_extra',
  'convite_narrativo',
  'good_to_know',
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
  paymentMethods: z.array(paymentMethodKeySchema).optional().nullable(),
  // Método de pagamento ÚNICO (substitui a lista). Mantemos payment_methods
  // sincronizado internamente para o conector.
  paymentMethod: paymentMethodKeySchema.optional().nullable(),
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
  waitlistEnabled: z.boolean().optional(),
  spotsOnLanding: z.boolean().optional(),
  spotsOnRegistration: z.boolean().optional(),
  community: z.string().trim().max(120).optional().nullable(),
  jotformCommunity: z.enum(JOTFORM_COMMUNITIES).nullable().optional(),
})

// Bilhete (tipo) de um convite. Tipos: individual/pago (com valor), grátis (0€),
// doação (valor à escolha do doador) e grupo (abre secção de inscrição do grupo).
const ticketSchema = z.object({
  id: z.string().uuid().optional().nullable(),
  name: z.string().trim().min(1, 'Indique o nome do bilhete.').max(120),
  kind: z.enum(['individual', 'gratis', 'voluntaria', 'grupo']).optional().default('individual'),
  price: z.number().min(0).max(1000000).optional().nullable(),
  currency: z.string().trim().max(8).optional(),
  capacity: z.number().int().min(1).max(1000000).optional().nullable(),
  groupSize: z.number().int().min(1).max(1000).optional().nullable(),
  partyType: z.enum(['single', 'group']).optional().default('single'),
  description: z.string().trim().max(500).optional().nullable(),
  paymentMethod: paymentMethodKeySchema.optional().nullable(),
  paymentMethods: z.array(paymentMethodKeySchema).max(10).optional().nullable(),
  // Entidade + referência Multibanco (tipo 'referencia-multibanco') definidas no bilhete.
  mbEntity: z.string().trim().max(10).optional().nullable(),
  mbReference: z.string().trim().max(30).optional().nullable(),
  // Números MB WAY definidos no bilhete (tipo 'mbway'); vazio usa os do método.
  mbNumbers: z.array(z.string().trim().max(20)).max(4).optional().nullable(),
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
  // Confirma a entrada em lista de espera quando a lotação está esgotada.
  acceptWaitlist: z.boolean().optional(),
})

// ── Auxiliares de evento associado e pagamento ───────────────────

// Valida que o evento associado existe (se indicado) e que ainda não está ligado a
// outro convite (regra 1 evento ↔ 1 convite). `exceptId` exclui o próprio convite
// nas atualizações. A herança de título/datas é feita no frontend; o banner resolve-se
// na leitura (resolveInviteBanner).
async function assertEventOk(eventId, exceptId = null) {
  if (!eventId) return
  const ev = await eventsRepo.findById(eventId)
  if (!ev) throw new InviteError(400, 'Evento associado não encontrado.')
  const taken = await repo.findByEventId(eventId, exceptId)
  if (taken) throw new InviteError(409, 'Este evento já tem um convite associado.')
}

// Método único → mantém payment_methods coerente (lista de 1) para o conector/payload.
function normalizePayment(data) {
  data.paymentMethods = data.paymentMethod ? [data.paymentMethod] : null
}

// Um bilhete EXIGE pagamento (comprovativo) só quando é "Pago" com preço > 0.
// Código curto e legível do bilhete (para o convidado / QR / validação à entrada).
const GUEST_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
function genGuestCode() {
  const b = randomBytes(8)
  let s = ''
  for (let i = 0; i < 8; i += 1) s += GUEST_CODE_ALPHABET[b[i] % GUEST_CODE_ALPHABET.length]
  return `${s.slice(0, 4)}-${s.slice(4)}`
}

// Grátis e Doação confirmam automaticamente a inscrição (a doação regista o
// valor mas não bloqueia a inscrição num pagamento).
function ticketNeedsPayment(t) {
  return !!t && t.kind === 'individual' && Number(t.price) > 0
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
  // Só (re)valida o evento quando muda — não bloqueia gravar um convite já ligado.
  if ((existing.eventId ?? null) !== (data.eventId ?? null)) {
    await assertEventOk(data.eventId, id)
  }
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

// Estados possíveis de uma inscrição (CHECK invite_guests.rsvp_state).
const GUEST_RSVP_STATES = ['pending', 'confirmed', 'declined', 'waitlisted']

const guestUpdateSchema = z.object({
  name: z.string().trim().min(1, 'Indique o nome.').max(160).optional(),
  email: z.union([z.string().trim().email('Email inválido.').max(200), z.literal('')]).optional(),
  phone: z.string().trim().max(40).optional(),
  rsvpState: z.enum(GUEST_RSVP_STATES).optional(),
})

// Carrega a inscrição garantindo permissão de gestão + acesso ao convite.
async function loadGuestForManage(user, inviteId, guestId) {
  ensureCanManage(user)
  const invite = await repo.findById(inviteId)
  if (!invite) throw new InviteError(404, 'Convite não encontrado.')
  if (!canAccessChurch(user, invite.community)) throw new InviteError(403, 'Sem acesso a este convite.')
  const guest = await repo.findGuestById(guestId)
  if (!guest || guest.inviteId !== inviteId) throw new InviteError(404, 'Inscrição não encontrada.')
  return { invite, guest }
}

// Edita os dados de uma inscrição (organizador).
export async function updateGuest(user, inviteId, guestId, input) {
  const { guest } = await loadGuestForManage(user, inviteId, guestId)
  const data = guestUpdateSchema.parse(input ?? {})
  await repo.updateGuestDetails(guest.id, data)
  return repo.findGuestById(guest.id)
}

// Cancela uma inscrição (estado 'declined' → deixa de contar como confirmada).
export async function cancelGuest(user, inviteId, guestId) {
  const { guest } = await loadGuestForManage(user, inviteId, guestId)
  await repo.updateGuestDetails(guest.id, { rsvpState: 'declined' })
  return repo.findGuestById(guest.id)
}

// Elimina definitivamente uma inscrição.
export async function removeGuest(user, inviteId, guestId) {
  const { guest } = await loadGuestForManage(user, inviteId, guestId)
  await repo.deleteGuest(guest.id)
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
  const [tickets, bannerUrl, activeMethods] = await Promise.all([
    repo.listTicketsWithSold(id),
    resolveInviteBanner(invite),
    getActivePaymentMethods().catch(() => []),
  ])
  const paymentMethodLabels = Object.fromEntries(activeMethods.map((m) => [m.key, m.label]))
  const paymentMethodReceipt = Object.fromEntries(activeMethods.map((m) => [m.key, m.requireReceipt !== false]))
  const paymentMethodType = Object.fromEntries(activeMethods.map((m) => [m.key, m.type]))
  const paymentMethodNumbers = Object.fromEntries(activeMethods.filter((m) => m.type === 'mbway').map((m) => [m.key, m.numbers || []]))
  return renderPayload(invite, blocks, null, {
    preview: true,
    bannerUrl,
    tickets,
    paymentMethodLabels,
    paymentMethodReceipt,
    paymentMethodType,
    paymentMethodNumbers,
  })
}

// ── Leitura pública ──────────────────────────────────────────────

function buildMeta(invite, bannerUrl) {
  return {
    title: invite.metaTitle || invite.title,
    description: invite.metaDescription || null,
    image: invite.metaImageUrl || bannerUrl || null,
  }
}

// Métodos de pagamento oferecidos por um bilhete (vários; retrocompat com o único).
function ticketMethods(ticket) {
  if (!ticket) return []
  if (Array.isArray(ticket.paymentMethods) && ticket.paymentMethods.length) return ticket.paymentMethods
  return ticket.paymentMethod ? [ticket.paymentMethod] : []
}
// Método efetivo do convidado: o que escolheu (extra.paymentMethod), se for
// oferecido pelo bilhete; senão o primeiro método do bilhete.
function resolveGuestMethod(guest, ticket) {
  const offered = ticketMethods(ticket)
  const chosen = guest?.extra?.paymentMethod
  if (chosen && offered.includes(chosen)) return chosen
  return offered[0] ?? null
}

// Estado do convidado (calculado, não persistido como bloco). `paymentMethod` = o
// método do bilhete escolhido (mbway/transferencia/referencia); null se grátis.
function guestStatusPayload(guest, paymentMethod = null) {
  if (!guest) return null
  const hasPayment = !!paymentMethod
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
    paymentMethod: paymentMethod ?? null,
    phone: guest.phone ?? null,
    ticketId: guest.ticketId ?? null,
    code: guest.code ?? null,
    nextAction,
    message,
  }
}

function renderPayload(
  invite,
  blocks,
  guest,
  {
    preview = false,
    bannerUrl = null,
    tickets = [],
    spotsLeft = null,
    community = null,
    paymentMethodLabels = {},
    paymentMethodReceipt = {},
    paymentMethodType = {},
    paymentMethodNumbers = {},
  } = {}
) {
  const banner = bannerUrl ?? invite.bannerUrl
  const guestTicket = guest?.ticketId ? (tickets || []).find((t) => t.id === guest.ticketId) : null
  const guestStatus = guestStatusPayload(guest, resolveGuestMethod(guest, guestTicket))
  if (guestStatus) guestStatus.jotformCommunity = resolveJotformCommunity(invite, guest, community)
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
      // Rótulos públicos dos métodos de pagamento ativos (chave → nome), para
      // mostrar os métodos personalizados com o nome escolhido no Admin.
      paymentMethodLabels,
      // Se cada método exige comprovativo (chave → bool). Falso = comprovativo opcional.
      paymentMethodReceipt,
      // Tipo de cada método ativo (chave → tipo) — decide o fluxo (JotForm vs manual).
      paymentMethodType,
      // Números MB WAY (chave → [números]) dos métodos do tipo 'mbway' (manual).
      paymentMethodNumbers,
      // Igreja + evento associado (para o fluxo de pagamento MB WAY / JotForm).
      community: community ?? invite.community ?? null,
      eventId: invite.eventId ?? null,
      registrationMode: invite.registrationMode,
      registrationUrl: invite.registrationUrl,
      rsvpEnabled: invite.rsvpEnabled,
      // Datas de INSCRIÇÃO (janela).
      rsvpStartDatetime: invite.rsvpStartDatetime,
      rsvpDeadline: invite.rsvpDeadline,
      capacity: invite.capacity,
      spotsLeft,
      waitlistEnabled: invite.waitlistEnabled,
      spotsOnLanding: invite.spotsOnLanding,
      spotsOnRegistration: invite.spotsOnRegistration,
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
        partyType: t.partyType ?? 'single',
        description: t.description,
        paymentMethod: t.paymentMethod ?? null,
        paymentMethods: ticketMethods(t),
        mbEntity: t.mbEntity ?? null,
        mbReference: t.mbReference ?? null,
        mbNumbers: t.mbNumbers ?? [],
        soldOut: t.capacity != null && (t.sold ?? 0) >= t.capacity,
      })),
    blocks: blocks.filter((b) => b.visible).map((b) => ({ id: b.id, type: b.type, content: b.content })),
    guestStatus,
  }
}

// Página pública por slug. Só devolve convites publicados. Se `guestToken`
// identificar um convidado deste convite, inclui o cartão de estado.
export async function getPublicBySlug(slug, { guestToken } = {}) {
  const invite = await repo.findBySlug(slug)
  if (!invite || invite.status === 'rascunho') {
    throw new InviteError(404, 'Convite não encontrado.')
  }
  const [blocks, tickets, connectedEvent] = await Promise.all([
    repo.listBlocks(invite.id),
    repo.listTicketsWithSold(invite.id),
    invite.eventId ? eventsRepo.findById(invite.eventId).catch(() => null) : Promise.resolve(null),
  ])
  const bannerUrl =
    invite.useEventBanner && connectedEvent?.bannerUrl ? connectedEvent.bannerUrl : invite.bannerUrl
  const community = invite.community || connectedEvent?.community || null
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
  const activeMethods = await getActivePaymentMethods().catch(() => [])
  const paymentMethodLabels = Object.fromEntries(activeMethods.map((m) => [m.key, m.label]))
  const paymentMethodReceipt = Object.fromEntries(activeMethods.map((m) => [m.key, m.requireReceipt !== false]))
  const paymentMethodType = Object.fromEntries(activeMethods.map((m) => [m.key, m.type]))
  const paymentMethodNumbers = Object.fromEntries(activeMethods.filter((m) => m.type === 'mbway').map((m) => [m.key, m.numbers || []]))
  return {
    invite,
    payload: renderPayload(invite, blocks, guest, {
      bannerUrl,
      tickets,
      spotsLeft,
      community,
      paymentMethodLabels,
      paymentMethodReceipt,
      paymentMethodType,
      paymentMethodNumbers,
    }),
  }
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

// Bilhetes em que o campo aparece (espelha inviteFormFields.fieldAllowedForTicket).
// Nome/email/telemóvel são de sistema → aparecem sempre.
const RSVP_SYSTEM_KEYS = ['name', 'email', 'phone']
function fieldAllowedForTicket(field, ticketId) {
  if (RSVP_SYSTEM_KEYS.includes(field.key)) return true
  const list = Array.isArray(field.tickets) ? field.tickets : []
  if (!list.length) return true
  return !!ticketId && list.includes(ticketId)
}

// Defesa no servidor: valida os campos OBRIGATÓRIOS visíveis (incl. consentimentos)
// contra o formulário configurado no bloco rsvp. É estritamente MAIS FRACA que a
// validação do frontend (só verifica presença, não formato) → nunca rejeita uma
// submissão válida feita pela UI; apenas trava POSTs diretos que saltam o formulário.
function assertSubmissionValid(fields, values, ticketId) {
  let sectionVisible = true
  for (const f of fields) {
    if (f.type === 'section') {
      sectionVisible = fieldVisible(f, values) && fieldAllowedForTicket(f, ticketId)
      continue
    }
    if (f.type === 'document' || !sectionVisible || !f.required || !fieldVisible(f, values) || !fieldAllowedForTicket(f, ticketId)) continue
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
// Dados de pagamento do bilhete para o email de confirmação (todos exceto o
// grátis). Doação → sem valor; Pago → valor calculado; métodos com as suas
// modalidades configuradas (IBAN, números MB WAY, entidade/referência).
function buildTicketPaymentEmail(invite, guest, ticket, activeMethods, paymentInfo, { uniqueLink, methodType }) {
  if (!ticket) return null
  const isDonation = ticket.kind === 'voluntaria'
  const isPaid = ticketNeedsPayment(ticket)
  const isFree = !isDonation && !isPaid
  const currency = ticket.currency || invite.costCurrency || 'EUR'
  const valueText = isPaid && ticket.price != null ? `${Number(ticket.price).toFixed(2)} ${currency}` : null
  const byKey = new Map((activeMethods || []).map((m) => [m.key, m]))
  const methods = []
  if (!isFree) {
    for (const key of ticketMethods(ticket)) {
      const def = byKey.get(key)
      if (!def) continue
      let detail = ''
      if (def.type === 'transferencia') {
        const iban = paymentInfo?.iban || ''
        const benef = paymentInfo?.beneficiary || ''
        detail = [iban ? `IBAN: ${iban}` : '', benef ? `Beneficiário: ${benef}` : ''].filter(Boolean).join(' · ')
      } else if (def.type === 'mbway') {
        const nums = Array.isArray(ticket.mbNumbers) && ticket.mbNumbers.length ? ticket.mbNumbers : def.numbers || []
        detail = nums.length ? `MB WAY: ${nums.join(' · ')}` : ''
      } else if (def.type === 'referencia-multibanco') {
        detail = [ticket.mbEntity ? `Entidade: ${ticket.mbEntity}` : '', ticket.mbReference ? `Referência: ${ticket.mbReference}` : '']
          .filter(Boolean)
          .join(' · ')
      } else if (def.type === 'mbway-contribuir') {
        detail = 'Pagamento MB WAY — usa o botão na página da inscrição.'
      } else if (def.type === 'numerario') {
        detail = 'Pagamento em numerário, presencialmente.'
      }
      methods.push({ label: def.label || key, detail })
    }
  }
  const payUrl =
    methodType === 'mbway-contribuir'
      ? buildJotformUrl({
          local: resolveJotformCommunity(invite, guest, invite.community),
          mobile: guest.phone,
          eventId: invite.eventId || invite.slug,
          ticketId: guest.ticketId,
        })
      : uniqueLink
  return { name: ticket.name ?? null, isFree, isDonation, isPaid, valueText, methods, payUrl }
}

function notifyGuestConfirmation(invite, guest, status, methodType) {
  if (!guest?.email) return
  const base = (config.appUrl || '').replace(/\/+$/, '')
  // Link ÚNICO desta inscrição (abre o bilhete/estado) — no email e dentro do QR.
  const uniqueLink = `${base}/invite/${encodeURIComponent(invite.slug)}/inscricao?g=${guest.token}`
  const link = `${base}/invite/${encodeURIComponent(invite.slug)}?g=${guest.token}`
  const p = (async () => {
    const [ticket, activeMethods, paymentInfo, banner] = await Promise.all([
      guest.ticketId ? repo.findTicketById(guest.ticketId).catch(() => null) : Promise.resolve(null),
      getActivePaymentMethods().catch(() => []),
      getInvitePaymentInfo().catch(() => null),
      resolveInviteBanner(invite).catch(() => invite.bannerUrl ?? null),
    ])
    const ticketInfo = buildTicketPaymentEmail(invite, guest, ticket, activeMethods, paymentInfo, {
      uniqueLink,
      methodType,
    })
    // QR com o LINK único da inscrição (abre o bilhete ao ler).
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&margin=8&data=${encodeURIComponent(uniqueLink)}`
    await sendRsvpConfirmationEmail(guest.email, {
      name: guest.name,
      eventTitle: invite.title,
      when: invite.startDatetime,
      location: invite.location ?? null,
      statusMessage: status?.message ?? '',
      link,
      uniqueLink,
      code: guest.code ?? null,
      bannerUrl: banner ?? null,
      qrUrl,
      ticket: ticketInfo,
      paymentPending: status?.paymentState === 'pending',
    })
  })().catch((err) => console.error('[invites] confirmação de inscrição:', err?.message ?? err))
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
    assertSubmissionValid(
      formFields,
      {
        ...(data.extra || {}),
        name: data.name,
        email: data.email,
        phone: data.phone,
      },
      data.ticketId
    )
  }

  // Bilhete: valida que pertence ao convite e está ativo (grátis ou pago).
  let ticket = null
  if (data.ticketId) {
    ticket = await repo.findTicketById(data.ticketId)
    if (!ticket || ticket.inviteId !== invite.id || !ticket.active) {
      throw new InviteError(400, 'Bilhete inválido.')
    }
  }
  // Pagamento (a desenvolver): aplicável só se o bilhete for "Pago" (preço > 0),
  // ou — sem bilhete — se o convite tiver custo. Grátis/Doação → confirma logo.
  const paymentState =
    (ticket ? ticketNeedsPayment(ticket) : invite.costType !== 'gratuito') ? 'pending' : 'not_applicable'

  // Capacidade: do bilhete escolhido (se houver) ou global do convite.
  let rsvpState = data.attend ? 'confirmed' : 'declined'
  if (rsvpState === 'confirmed') {
    let wouldExceed = false
    if (ticket && ticket.capacity != null) {
      const sold = await repo.countTicketSold(ticket.id)
      if (sold + (data.guestsCount ?? 1) > ticket.capacity) wouldExceed = true
    } else if (invite.capacity) {
      const taken = await repo.countConfirmedSeats(invite.id)
      if (taken + (data.guestsCount ?? 1) > invite.capacity) wouldExceed = true
    }
    if (wouldExceed) {
      // Lotação esgotada: com lista de espera ativa → lista de espera; senão, bloqueia.
      if (!invite.waitlistEnabled) {
        throw new InviteError(409, 'A lotação está esgotada. As inscrições estão completas.')
      }
      rsvpState = 'waitlisted'
    }
  }

  // Cada inscrição é Única (não idempotente): cria sempre um novo registo, com o seu
  // próprio token pessoal e código de bilhete.
  const guest = await repo.insertGuest(invite.id, {
    token: randomBytes(24).toString('hex'),
    code: genGuestCode(),
    name: data.name,
    email: data.email ?? null,
    phone: data.phone ?? null,
    guestsCount: data.guestsCount ?? 1,
    rsvpState,
    paymentState,
    ticketId: ticket?.id ?? null,
    extra: data.extra ?? null,
  })
  const status = guestStatusPayload(guest, resolveGuestMethod(guest, ticket))
  let methodType = null
  if (status?.paymentMethod) {
    const activeMethods = await getActivePaymentMethods().catch(() => [])
    methodType = activeMethods.find((m) => m.key === status.paymentMethod)?.type ?? null
  }
  notifyGuestConfirmation(invite, guest, status, methodType)
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
  const [events, linkedEventIds] = await Promise.all([
    eventsRepo.list({ status: 'publicado', from: today }),
    repo.listLinkedEventIds(),
  ])
  // 1 evento ↔ 1 convite: esconde eventos já associados a um convite. O evento do
  // convite em edição é re-incluído no frontend (a partir de `invite.event`).
  const linked = new Set(linkedEventIds)
  return events
    .filter((e) => !linked.has(e.id) && canAccessChurch(user, e.community))
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
