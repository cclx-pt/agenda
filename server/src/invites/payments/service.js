import { z } from 'zod'
import * as repo from './repository.js'
import * as invitesRepo from '../repository.js'
import { getConnector, DEFAULT_PROVIDER, ConnectorError } from './connector.js'
import { getInvitePaymentInfo, getActivePaymentMethods } from '../../settings/service.js'
import { config } from '../../config.js'

// Reutiliza o erro de domínio do módulo de convites para respostas HTTP coerentes.
import { InviteError } from '../service.js'

// ── Permissões (mesmo modelo dos convites/eventos) ───────────────
const isAdmin = (role) => role === 'admin'
const canManage = (user) => user?.role === 'admin' || !!user?.canManageInvites
function canAccessChurch(user, community) {
  if (isAdmin(user.role)) return true
  if (!community) return true
  const ch = Array.isArray(user?.churches) && user.churches.length ? user.churches : null
  return ch === null || ch.includes(community)
}

// Chave do método (slug): integrados + personalizados. O conector decide se o
// suporta (ver connector.supports / supportedMethods).
const initiateSchema = z.object({
  method: z
    .string()
    .trim()
    .regex(/^[a-z][a-z0-9-]*$/, 'Método de pagamento inválido.')
    .max(40),
})

// Mapeia o estado do PAGAMENTO para o estado do CONVIDADO (invite_guests.payment_state).
function guestStateFor(paymentStatus) {
  switch (paymentStatus) {
    case 'awaiting_validation':
      return 'awaiting_validation'
    case 'paid':
      return 'paid'
    case 'expired':
      return 'expired'
    case 'failed':
    case 'cancelled':
      return 'pending'
    default:
      return 'pending'
  }
}

// Forma "segura" do pagamento para o convidado (sem campos internos crus).
function safePayment(payment, instructions) {
  return {
    method: payment.method,
    status: payment.status,
    amount: payment.amount,
    currency: payment.currency,
    reference: payment.providerRef,
    receiptUrl: payment.receiptUrl,
    instructions: instructions ?? null,
  }
}

// Valor a cobrar: do bilhete escolhido pelo convidado (se houver) ou do custo do
// convite. Para eventos pagos com bilhetes, o preço vem sempre do bilhete.
async function chargeAmount(invite, guest) {
  if (invite.costType === 'gratuito') return null
  if (guest?.ticketId) {
    const ticket = await invitesRepo.findTicketById(guest.ticketId)
    if (ticket?.price != null) return Number(ticket.price)
  }
  return invite.costAmount ?? null
}

// ── Convidado (público, autenticado pelo token pessoal) ──────────

// Inicia um pagamento para o convidado (cria o registo e chama o conector).
export async function initiate(slug, guestToken, input) {
  const invite = await invitesRepo.findBySlug(slug)
  if (!invite || invite.status !== 'publicado') throw new InviteError(404, 'Convite não encontrado.')
  if (invite.costType === 'gratuito') throw new InviteError(409, 'Este convite é gratuito.')
  if (!guestToken) throw new InviteError(401, 'Ligação de convidado em falta.')
  const guest = await invitesRepo.findGuestByToken(guestToken)
  if (!guest || guest.inviteId !== invite.id) throw new InviteError(404, 'Inscrição não encontrada.')

  const { method } = initiateSchema.parse(input)

  // Resolve o TIPO do método (a partir da lista ativa) — decide o comportamento
  // (integração vs manual) e a config associada (números MB WAY, etc.).
  const activeMethods = await getActivePaymentMethods().catch(() => [])
  const methodDef = activeMethods.find((m) => m.key === method) || null
  const methodType = methodDef?.type || null
  let numbers = methodDef?.numbers || []

  const connector = getConnector(invite.paymentProvider || DEFAULT_PROVIDER)
  const supported =
    typeof connector.supports === 'function'
      ? connector.supports(method, methodType)
      : connector.supportedMethods.includes(method)
  if (!supported) {
    throw new InviteError(409, 'Método de pagamento indisponível de momento.')
  }
  const amount = await chargeAmount(invite, guest)
  const currency = invite.costCurrency || 'EUR'

  // Entidade + referência do BILHETE ('referencia-multibanco') e números MB WAY
  // definidos no bilhete ('mbway') — substituem os do método quando indicados.
  let ticketEntity = null
  let ticketReference = null
  if (guest.ticketId && (methodType === 'referencia-multibanco' || methodType === 'mbway')) {
    const ticket = await invitesRepo.findTicketById(guest.ticketId)
    if (methodType === 'referencia-multibanco') {
      ticketEntity = ticket?.mbEntity ?? null
      ticketReference = ticket?.mbReference ?? null
    } else if (Array.isArray(ticket?.mbNumbers) && ticket.mbNumbers.length) {
      numbers = ticket.mbNumbers
    }
  }

  // Cria o registo (pending) e pede a cobrança ao conector.
  const payment = await repo.insert({
    inviteId: invite.id,
    guestId: guest.id,
    method,
    amount,
    currency,
    status: 'pending',
    provider: connector.name,
  })

  // Dados de pagamento geridos na Administração de convites (recurso: env).
  const paymentInfo = await getInvitePaymentInfo().catch(() => null)
  let result
  try {
    result = await connector.createCharge({
      invite,
      guest,
      payment,
      method,
      type: methodType,
      amount,
      currency,
      paymentInfo,
      numbers,
      ticketEntity,
      ticketReference,
    })
  } catch (err) {
    await repo.update(payment.id, { status: 'failed' })
    if (err instanceof ConnectorError) throw new InviteError(409, err.message)
    throw err
  }

  const updated = await repo.update(payment.id, {
    status: result.status ?? 'pending',
    providerRef: result.providerRef ?? null,
    providerPayload: result.providerPayload ?? null,
  })
  await invitesRepo.updateGuest(guest.id, { paymentState: guestStateFor(updated.status) })
  return safePayment(updated, result.instructions)
}

// Regista o comprovativo (transferência): guarda o URL e fica "em validação".
export async function attachReceipt(slug, guestToken, receiptUrl) {
  const invite = await invitesRepo.findBySlug(slug)
  if (!invite || invite.status !== 'publicado') throw new InviteError(404, 'Convite não encontrado.')
  if (!guestToken) throw new InviteError(401, 'Ligação de convidado em falta.')
  const guest = await invitesRepo.findGuestByToken(guestToken)
  if (!guest || guest.inviteId !== invite.id) throw new InviteError(404, 'Inscrição não encontrada.')

  let payment = await repo.findLatestByGuest(guest.id)
  if (!payment) {
    // Sem pagamento iniciado ainda: cria um por transferência.
    payment = await repo.insert({
      inviteId: invite.id,
      guestId: guest.id,
      method: 'transferencia',
      amount: await chargeAmount(invite, guest),
      currency: invite.costCurrency || 'EUR',
      status: 'pending',
      provider: getConnector(invite.paymentProvider || DEFAULT_PROVIDER).name,
    })
  }
  const updated = await repo.update(payment.id, { status: 'awaiting_validation', receiptUrl })
  await invitesRepo.updateGuest(guest.id, { paymentState: 'awaiting_validation' })
  return safePayment(updated, null)
}

// Estado do pagamento do convidado (para o cartão de estado).
export async function getForGuest(slug, guestToken) {
  const invite = await invitesRepo.findBySlug(slug)
  if (!invite || invite.status === 'rascunho') throw new InviteError(404, 'Convite não encontrado.')
  if (!guestToken) return null
  const guest = await invitesRepo.findGuestByToken(guestToken)
  if (!guest || guest.inviteId !== invite.id) return null
  const payment = await repo.findLatestByGuest(guest.id)
  if (!payment) return null
  return safePayment(payment, payment.providerPayload ? { type: payment.providerPayload.instrType || 'transfer', ...payment.providerPayload } : null)
}

// ── Organizador (autenticado) ────────────────────────────────────

async function ensureCanManageInvite(user, inviteId) {
  if (!canManage(user)) throw new InviteError(403, 'Sem permissão.')
  const invite = await invitesRepo.findById(inviteId)
  if (!invite) throw new InviteError(404, 'Convite não encontrado.')
  if (!canAccessChurch(user, invite.community)) throw new InviteError(403, 'Sem acesso a este convite.')
  return invite
}

export async function listPayments(user, inviteId) {
  await ensureCanManageInvite(user, inviteId)
  return repo.listByInvite(inviteId)
}

async function ensureCanManagePayment(user, paymentId) {
  const payment = await repo.findById(paymentId)
  if (!payment) throw new InviteError(404, 'Pagamento não encontrado.')
  await ensureCanManageInvite(user, payment.inviteId)
  return payment
}

// Valida um pagamento (marca pago) — usado com transferência/referência manuais.
export async function validatePayment(user, paymentId) {
  const payment = await ensureCanManagePayment(user, paymentId)
  const updated = await repo.update(payment.id, { status: 'paid' }, { setPaidNow: true })
  await invitesRepo.updateGuest(payment.guestId, { paymentState: 'paid' })
  return updated
}

// Rejeita um pagamento (volta o convidado a "pendente" para poder repetir).
export async function rejectPayment(user, paymentId) {
  const payment = await ensureCanManagePayment(user, paymentId)
  const updated = await repo.update(payment.id, { status: 'failed' })
  await invitesRepo.updateGuest(payment.guestId, { paymentState: 'pending' })
  return updated
}

// ── Webhook (confirmação assíncrona de um conector real) ─────────
// Público; a autenticação é feita pelo próprio conector (verifyWebhook). O
// conector 'manual' não confirma por webhook (verifyWebhook devolve false).
export async function handleWebhook(providerName, req) {
  const connector = getConnector(providerName)
  if (typeof connector.verifyWebhook !== 'function' || !connector.verifyWebhook(req)) {
    throw new InviteError(401, 'Webhook não autorizado.')
  }
  const parsed = connector.parseWebhook ? connector.parseWebhook(req.body) : null
  if (!parsed?.providerRef) throw new InviteError(400, 'Callback inválido.')
  const payment = await repo.findByProviderRef(parsed.providerRef)
  if (!payment) throw new InviteError(404, 'Pagamento não encontrado.')
  const status = parsed.status ?? payment.status
  const updated = await repo.update(payment.id, { status }, { setPaidNow: status === 'paid' })
  await invitesRepo.updateGuest(payment.guestId, { paymentState: guestStateFor(status) })
  return { ok: true, status: updated.status }
}

// Exposto para o config (o webhook secret é lido pelos conectores reais).
export const webhookSecret = config.payments.webhookSecret
