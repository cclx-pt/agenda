import { z } from 'zod'
import { config } from '../../config.js'
import { sendInviteCampaignEmail } from '../../auth/email.js'
import * as invitesRepo from '../repository.js'
import * as campaignsRepo from './repository.js'
import { InviteError } from '../service.js'

const urlSchema = z
  .string()
  .trim()
  .url()
  .refine((value) => /^https?:\/\//i.test(value), 'Link inválido.')

const blockSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('text'), text: z.string().trim().min(1).max(10000) }),
  z.object({
    type: z.literal('image'),
    url: urlSchema,
    alt: z.string().trim().max(200).optional().default(''),
  }),
  z.object({
    type: z.literal('video'),
    url: urlSchema,
    title: z.string().trim().max(200).optional().default(''),
  }),
  z.object({ type: z.literal('button'), url: urlSchema, label: z.string().trim().min(1).max(80) }),
  z.object({ type: z.literal('warning'), text: z.string().trim().min(1).max(3000) }),
  z.object({
    type: z.literal('workshops'),
    items: z
      .array(
        z.object({
          title: z.string().trim().min(1).max(200),
          description: z.string().trim().max(2000).optional().default(''),
        })
      )
      .max(30),
  }),
])

const audienceSchema = z.object({
  rsvpStates: z.array(z.string().trim().min(1).max(40)).max(20).optional().default([]),
  paymentStates: z.array(z.string().trim().min(1).max(40)).max(20).optional().default([]),
  ticketIds: z.array(z.string().uuid()).max(100).optional().default([]),
  checkedIn: z.boolean().nullable().optional().default(null),
})

const campaignSchema = z.object({
  type: z.enum(['update', 'warning', 'reminder', 'post_event']).default('update'),
  name: z.string().trim().min(1, 'O nome da comunicação é obrigatório.').max(200),
  subject: z.string().trim().min(1, 'O assunto é obrigatório.').max(200),
  preheader: z.string().trim().max(300).optional().default(''),
  blocks: z.array(blockSchema).min(1, 'Adicione conteúdo à comunicação.').max(50),
  audience: audienceSchema.optional().default({}),
})

const testSchema = z.object({
  email: z.string().trim().email('Email de teste inválido.'),
  name: z.string().trim().max(200).optional().default(''),
})

function canAccessChurch(user, community) {
  if (user?.role === 'admin' || !community) return true
  return (
    !Array.isArray(user?.churches) ||
    user.churches.length === 0 ||
    user.churches.includes(community)
  )
}

async function getInvite(user, inviteId) {
  if (!(user?.role === 'admin' || user?.canManageInvites)) {
    throw new InviteError(403, 'Sem permissão para gerir convites.')
  }
  const invite = await invitesRepo.findById(inviteId)
  if (!invite) throw new InviteError(404, 'Convite não encontrado.')
  if (!canAccessChurch(user, invite.community))
    throw new InviteError(403, 'Sem acesso a este convite.')
  return invite
}

async function getCampaign(user, inviteId, campaignId) {
  const invite = await getInvite(user, inviteId)
  const campaign = await campaignsRepo.findById(campaignId)
  if (!campaign || campaign.inviteId !== inviteId)
    throw new InviteError(404, 'Comunicação não encontrada.')
  return { invite, campaign }
}

export function resolveAudience(guests, audience = {}) {
  const rsvpStates = new Set(audience.rsvpStates ?? [])
  const paymentStates = new Set(audience.paymentStates ?? [])
  const ticketIds = new Set(audience.ticketIds ?? [])
  const byEmail = new Map()

  for (const guest of guests) {
    const email = String(guest.email ?? '')
      .trim()
      .toLowerCase()
    if (!email || !email.includes('@')) continue
    if (rsvpStates.size && !rsvpStates.has(guest.rsvpState)) continue
    if (paymentStates.size && !paymentStates.has(guest.paymentState)) continue
    if (ticketIds.size && !ticketIds.has(guest.ticketId)) continue
    if (audience.checkedIn === true && !guest.checkedInAt) continue
    if (audience.checkedIn === false && guest.checkedInAt) continue
    if (!byEmail.has(email)) {
      byEmail.set(email, {
        guestId: guest.id,
        guestToken: guest.token,
        name: guest.name ?? null,
        email,
      })
    }
  }
  return [...byEmail.values()]
}

async function audienceFor(inviteId, audience) {
  return resolveAudience(
    await invitesRepo.listGuests(inviteId),
    audienceSchema.parse(audience ?? {})
  )
}

export async function list(user, inviteId) {
  await getInvite(user, inviteId)
  return campaignsRepo.list(inviteId)
}

export async function find(user, inviteId, campaignId) {
  return (await getCampaign(user, inviteId, campaignId)).campaign
}

export async function create(user, inviteId, input) {
  await getInvite(user, inviteId)
  return campaignsRepo.insert(inviteId, campaignSchema.parse(input), user.id)
}

export async function update(user, inviteId, campaignId, input) {
  await getCampaign(user, inviteId, campaignId)
  const campaign = await campaignsRepo.updateDraft(campaignId, campaignSchema.parse(input))
  if (!campaign) throw new InviteError(409, 'Apenas rascunhos podem ser alterados.')
  return campaign
}

export async function remove(user, inviteId, campaignId) {
  await getCampaign(user, inviteId, campaignId)
  if (!(await campaignsRepo.removeDraft(campaignId))) {
    throw new InviteError(409, 'Apenas rascunhos podem ser eliminados.')
  }
}

export async function previewAudience(user, inviteId, input) {
  await getInvite(user, inviteId)
  const recipients = await audienceFor(inviteId, input)
  return { count: recipients.length }
}

function guestLink(invite, token) {
  const base = (config.appUrl || '').replace(/\/+$/, '')
  return `${base}/invite/${encodeURIComponent(invite.slug)}?g=${encodeURIComponent(token)}`
}

export async function sendTest(user, inviteId, campaignId, input) {
  const { invite, campaign } = await getCampaign(user, inviteId, campaignId)
  if (campaign.status !== 'draft')
    throw new InviteError(409, 'Apenas rascunhos podem ser testados.')
  const recipient = testSchema.parse(input)
  return sendInviteCampaignEmail(recipient.email, {
    recipientName: recipient.name,
    eventTitle: invite.title,
    subject: campaign.subject,
    preheader: campaign.preheader,
    blocks: campaign.blocks,
    eventLink: `${(config.appUrl || '').replace(/\/+$/, '')}/invite/${encodeURIComponent(invite.slug)}`,
  })
}

export async function send(user, inviteId, campaignId) {
  const { invite, campaign } = await getCampaign(user, inviteId, campaignId)
  if (campaign.status !== 'draft')
    throw new InviteError(409, 'Esta comunicação já foi ou está a ser enviada.')
  const audience = await audienceFor(inviteId, campaign.audience)
  if (audience.length === 0)
    throw new InviteError(400, 'A audiência não tem destinatários com email.')
  const claimed = await campaignsRepo.claimForSending(campaignId)
  if (!claimed) throw new InviteError(409, 'Esta comunicação já foi ou está a ser enviada.')

  const recipients = await campaignsRepo.insertRecipients(campaignId, audience)
  let sentCount = 0
  let failedCount = 0
  for (const recipient of recipients) {
    try {
      await sendInviteCampaignEmail(recipient.email, {
        recipientName: recipient.name,
        eventTitle: invite.title,
        subject: campaign.subject,
        preheader: campaign.preheader,
        blocks: campaign.blocks,
        eventLink: guestLink(invite, recipient.guestToken),
      })
      await campaignsRepo.markRecipient(recipient.id, 'sent')
      sentCount += 1
    } catch (error) {
      await campaignsRepo.markRecipient(
        recipient.id,
        'failed',
        String(error?.message ?? error).slice(0, 1000)
      )
      failedCount += 1
    }
  }
  return campaignsRepo.finish(campaignId, {
    recipientCount: recipients.length,
    sentCount,
    failedCount,
    skippedCount: 0,
  })
}
