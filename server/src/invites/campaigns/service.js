import { z } from 'zod'
import { randomUUID } from 'node:crypto'
import { config } from '../../config.js'
import * as invitesRepo from '../repository.js'
import * as campaignsRepo from './repository.js'
import { InviteError, resolveInviteBanner } from '../service.js'
import {
  applyTemplate,
  campaignTemplates,
  findCampaignTemplate,
} from './templates.js'
import {
  getCampaignProvider,
  getCampaignProviderInfo,
} from './provider.js'
import {
  richTextToPlainText,
  sanitizeCampaignRichText,
} from './richText.js'

const urlSchema = z
  .string()
  .trim()
  .url()
  .refine((value) => /^https?:\/\//i.test(value), 'Link inválido.')

const blockSchema = z.union([
  z
    .object({
      type: z.literal('text'),
      text: z.string().max(10000).optional().default(''),
      html: z.string().max(30000).optional(),
    })
    .transform((block, context) => {
      const html = sanitizeCampaignRichText(
        block.html || block.text.replace(/\r?\n/g, '<br />')
      )
      const text = richTextToPlainText(html)
      if (!text) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'O bloco de texto não pode estar vazio.',
        })
        return z.NEVER
      }
      return { type: 'text', text, html }
    }),
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

const audienceSchema = z
  .object({
  rsvpStates: z.array(z.string().trim().min(1).max(40)).max(20).optional().default([]),
  paymentStates: z.array(z.string().trim().min(1).max(40)).max(20).optional().default([]),
  ticketIds: z.array(z.string().uuid()).max(100).optional().default([]),
  checkedIn: z.boolean().nullable().optional().default(null),
  formMatch: z.enum(['all', 'any']).optional().default('all'),
  formConditions: z
    .array(
      z.object({
        fieldKey: z.string().trim().min(1).max(80),
        operator: z.enum([
          'equals',
          'not_equals',
          'contains',
          'not_contains',
          'greater_than',
          'greater_or_equal',
          'less_than',
          'less_or_equal',
          'empty',
          'not_empty',
        ]),
        value: z.union([z.string().max(500), z.number(), z.boolean()]).optional(),
      })
    )
    .max(20)
    .optional()
    .default([]),
  })
  .superRefine((audience, context) => {
    for (const [index, condition] of audience.formConditions.entries()) {
      if (
        !['empty', 'not_empty'].includes(condition.operator) &&
        (condition.value === undefined || condition.value === '')
      ) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['formConditions', index, 'value'],
          message: 'Indique o valor do filtro do formulário.',
        })
      }
    }
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

const segmentSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(1, 'Indique o nome do segmento.').max(120),
  audience: audienceSchema,
})

const scheduleSchema = z.object({
  scheduledAt: z.coerce.date(),
})

const automationSchema = z.object({
  id: z.string().uuid().optional(),
  triggerType: z.enum(['before_event', 'after_event', 'payment_pending']),
  offsetMinutes: z.number().int().min(0).max(525_600),
  enabled: z.boolean().default(true),
  templateKey: z.string().trim().min(1).max(80),
  audience: audienceSchema.optional().default({}),
})

const DELIVERY_BATCH_SIZE = 20
const DELIVERY_MAX_ATTEMPTS = 3
const DELIVERY_LEASE_SECONDS = 90
const DELIVERY_WORKER_BUDGET_MS = 40_000

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
  const formConditions = audience.formConditions ?? []
  const byEmail = new Map()

  for (const guest of guests) {
    const email = String(guest.email ?? '')
      .trim()
      .toLowerCase()
    if (!email || !email.includes('@')) continue
    if (guest.emailOptedOutAt) continue
    if (rsvpStates.size && !rsvpStates.has(guest.rsvpState)) continue
    if (paymentStates.size && !paymentStates.has(guest.paymentState)) continue
    if (ticketIds.size && !ticketIds.has(guest.ticketId)) continue
    if (audience.checkedIn === true && !guest.checkedInAt) continue
    if (audience.checkedIn === false && guest.checkedInAt) continue
    if (formConditions.length) {
      const matches = formConditions.map((condition) =>
        matchesFormCondition(guest.extra?.[condition.fieldKey], condition)
      )
      if (audience.formMatch === 'any' ? !matches.some(Boolean) : !matches.every(Boolean)) continue
    }
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

function isEmptyAnswer(value) {
  return value == null || value === '' || (Array.isArray(value) && value.length === 0)
}

export function matchesFormCondition(answer, condition) {
  const expected = condition.value
  if (condition.operator === 'empty') return isEmptyAnswer(answer)
  if (condition.operator === 'not_empty') return !isEmptyAnswer(answer)

  const values = Array.isArray(answer) ? answer : [answer]
  const normalizedExpected = String(expected ?? '').trim().toLocaleLowerCase('pt-PT')
  const normalizedValues = values.map((value) =>
    String(value ?? '').trim().toLocaleLowerCase('pt-PT')
  )

  if (condition.operator === 'equals') return normalizedValues.includes(normalizedExpected)
  if (condition.operator === 'not_equals') return !normalizedValues.includes(normalizedExpected)
  if (condition.operator === 'contains') {
    return normalizedValues.some((value) => value.includes(normalizedExpected))
  }
  if (condition.operator === 'not_contains') {
    return normalizedValues.every((value) => !value.includes(normalizedExpected))
  }

  const actualNumber = Number(answer)
  const expectedNumber = Number(expected)
  if (!Number.isFinite(actualNumber) || !Number.isFinite(expectedNumber)) return false
  if (condition.operator === 'greater_than') return actualNumber > expectedNumber
  if (condition.operator === 'greater_or_equal') return actualNumber >= expectedNumber
  if (condition.operator === 'less_than') return actualNumber < expectedNumber
  if (condition.operator === 'less_or_equal') return actualNumber <= expectedNumber
  return false
}

async function audienceFor(inviteId, audience) {
  return resolveAudience(
    await invitesRepo.listGuests(inviteId),
    audienceSchema.parse(audience ?? {})
  )
}

async function assertCurrentFormFields(inviteId, audience) {
  if (!audience.formConditions.length) return
  const blocks = await invitesRepo.listBlocks(inviteId)
  const fields = blocks.find((block) => block.type === 'rsvp')?.content?.fields ?? []
  const availableKeys = new Set(
    fields
      .filter(
        (field) =>
          field?.key &&
          !['section', 'document', 'children'].includes(field.type) &&
          !['name', 'email', 'phone'].includes(field.key)
      )
      .map((field) => field.key)
  )
  const invalid = audience.formConditions.find(
    (condition) => !availableKeys.has(condition.fieldKey)
  )
  if (invalid) {
    throw new InviteError(
      400,
      'Um dos campos usados para filtrar a audiência já não existe no formulário.'
    )
  }
}

export async function list(user, inviteId) {
  await getInvite(user, inviteId)
  return campaignsRepo.list(inviteId)
}

export async function find(user, inviteId, campaignId) {
  return (await getCampaign(user, inviteId, campaignId)).campaign
}

export async function listRecipients(user, inviteId, campaignId) {
  await getCampaign(user, inviteId, campaignId)
  return campaignsRepo.listRecipients(campaignId)
}

export async function listTemplates(user, inviteId) {
  await getInvite(user, inviteId)
  return campaignTemplates
}

export async function createFromTemplate(user, inviteId, templateKey) {
  const invite = await getInvite(user, inviteId)
  const template = findCampaignTemplate(templateKey)
  if (!template) throw new InviteError(404, 'Template não encontrado.')
  const eventLink = `${(config.appUrl || '').replace(/\/+$/, '')}/invite/${encodeURIComponent(invite.slug)}`
  return campaignsRepo.insert(
    inviteId,
    campaignSchema.parse(applyTemplate(template, invite, eventLink)),
    user.sub
  )
}

export async function create(user, inviteId, input) {
  await getInvite(user, inviteId)
  const campaign = campaignSchema.parse(input)
  await assertCurrentFormFields(inviteId, campaign.audience)
  return campaignsRepo.insert(inviteId, campaign, user.sub)
}

export async function update(user, inviteId, campaignId, input) {
  await getCampaign(user, inviteId, campaignId)
  const inputCampaign = campaignSchema.parse(input)
  await assertCurrentFormFields(inviteId, inputCampaign.audience)
  const campaign = await campaignsRepo.updateDraft(campaignId, inputCampaign)
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
  const audience = audienceSchema.parse(input ?? {})
  await assertCurrentFormFields(inviteId, audience)
  const recipients = resolveAudience(await invitesRepo.listGuests(inviteId), audience)
  return { count: recipients.length }
}

export async function listSegments(user, inviteId) {
  await getInvite(user, inviteId)
  return campaignsRepo.listSegments(inviteId)
}

export async function saveSegment(user, inviteId, input) {
  await getInvite(user, inviteId)
  const segment = segmentSchema.parse(input)
  await assertCurrentFormFields(inviteId, segment.audience)
  const saved = await campaignsRepo.upsertSegment(
    inviteId,
    segment.id,
    segment.name,
    segment.audience,
    user.sub
  )
  if (!saved) throw new InviteError(404, 'Segmento não encontrado.')
  return saved
}

export async function deleteSegment(user, inviteId, segmentId) {
  await getInvite(user, inviteId)
  if (!(await campaignsRepo.removeSegment(inviteId, segmentId))) {
    throw new InviteError(404, 'Segmento não encontrado.')
  }
}

function guestLink(invite, token) {
  const base = (config.appUrl || '').replace(/\/+$/, '')
  return `${base}/invite/${encodeURIComponent(invite.slug)}?g=${encodeURIComponent(token)}`
}

function unsubscribeLinks(invite, token) {
  if (!token) return {}
  const base = (config.appUrl || '').replace(/\/+$/, '')
  const encodedSlug = encodeURIComponent(invite.slug)
  const encodedToken = encodeURIComponent(token)
  return {
    unsubscribeUrl: `${base}/invite/${encodedSlug}/unsubscribe?g=${encodedToken}`,
    oneClickUnsubscribeUrl: `${base}/data/public/invite/${encodedSlug}/unsubscribe?g=${encodedToken}`,
  }
}

export async function sendTest(user, inviteId, campaignId, input) {
  const { invite, campaign } = await getCampaign(user, inviteId, campaignId)
  if (campaign.status !== 'draft')
    throw new InviteError(409, 'Apenas rascunhos podem ser testados.')
  const recipient = testSchema.parse(input)
  return getCampaignProvider().send(recipient.email, {
    recipientName: recipient.name,
    eventTitle: invite.title,
    subject: campaign.subject,
    preheader: campaign.preheader,
    blocks: campaign.blocks,
    eventLink: `${(config.appUrl || '').replace(/\/+$/, '')}/invite/${encodeURIComponent(invite.slug)}`,
    bannerUrl: await resolveInviteBanner(invite),
  })
}

export async function schedule(user, inviteId, campaignId, input) {
  const { campaign } = await getCampaign(user, inviteId, campaignId)
  if (!['draft', 'scheduled'].includes(campaign.status))
    throw new InviteError(409, 'Esta comunicação já não pode ser agendada.')
  const { scheduledAt } = scheduleSchema.parse(input)
  if (scheduledAt.getTime() <= Date.now() + 60_000) {
    throw new InviteError(400, 'O envio deve ser agendado com pelo menos um minuto de antecedência.')
  }
  if (campaign.status === 'draft') {
    const audience = await audienceFor(inviteId, campaign.audience)
    if (audience.length === 0)
      throw new InviteError(400, 'A audiência não tem destinatários com email.')
    await campaignsRepo.insertRecipients(campaignId, audience)
  }
  const scheduled = await campaignsRepo.scheduleDraft(campaignId, scheduledAt)
  if (!scheduled) throw new InviteError(409, 'A comunicação já não pode ser agendada.')
  await campaignsRepo.initializeQueuedDelivery(campaignId)
  return campaignsRepo.findById(campaignId)
}

export async function cancelSchedule(user, inviteId, campaignId) {
  await getCampaign(user, inviteId, campaignId)
  const campaign = await campaignsRepo.cancelScheduled(campaignId)
  if (!campaign) throw new InviteError(409, 'A comunicação já não pode ser cancelada.')
  return campaign
}

export async function listAutomations(user, inviteId) {
  await getInvite(user, inviteId)
  return campaignsRepo.listAutomations(inviteId)
}

export async function saveAutomation(user, inviteId, input) {
  const invite = await getInvite(user, inviteId)
  const automation = automationSchema.parse(input)
  if (!findCampaignTemplate(automation.templateKey)) {
    throw new InviteError(400, 'Template de automatização inválido.')
  }
  if (!invite.startDatetime) {
    throw new InviteError(400, 'Defina a data do evento antes de criar automatizações.')
  }
  await assertCurrentFormFields(inviteId, automation.audience)
  const saved = await campaignsRepo.upsertAutomation(inviteId, automation, user.sub)
  if (!saved) throw new InviteError(404, 'Automatização não encontrada.')
  return saved
}

export async function deleteAutomation(user, inviteId, automationId) {
  await getInvite(user, inviteId)
  if (!(await campaignsRepo.removeAutomation(inviteId, automationId))) {
    throw new InviteError(404, 'Automatização não encontrada.')
  }
}

export async function campaignMetrics(user, inviteId, campaignId) {
  const { campaign } = await getCampaign(user, inviteId, campaignId)
  const metrics = await campaignsRepo.getMetrics(campaignId)
  const total = campaign.recipientCount
  return {
    provider: getCampaignProviderInfo(),
    recipients: {
      total: campaign.recipientCount,
      sent: campaign.sentCount,
      failed: campaign.failedCount,
      skipped: campaign.skippedCount,
    },
    events: metrics.events,
    attempts: metrics.attempts,
    rates: {
      accepted: total ? campaign.sentCount / total : 0,
      failed: total ? campaign.failedCount / total : 0,
      delivered: getCampaignProviderInfo().capabilities.deliveryWebhooks
        ? total
          ? (metrics.events.delivered ?? 0) / total
          : 0
        : null,
    },
  }
}

export async function send(user, inviteId, campaignId) {
  const { campaign } = await getCampaign(user, inviteId, campaignId)
  if (campaign.status !== 'draft')
    throw new InviteError(409, 'Esta comunicação já foi ou está a ser enviada.')
  const audience = await audienceFor(inviteId, campaign.audience)
  if (audience.length === 0)
    throw new InviteError(400, 'A audiência não tem destinatários com email.')
  await campaignsRepo.insertRecipients(campaignId, audience)
  const queued = await campaignsRepo.queueForSending(campaignId)
  if (!queued) throw new InviteError(409, 'Esta comunicação já foi ou está a ser enviada.')
  await campaignsRepo.initializeQueuedDelivery(campaignId)
  return campaignsRepo.findById(campaignId)
}

export function retryDelayMs(attemptNumber) {
  return attemptNumber <= 1 ? 2_000 : 10_000
}

function isPermanentDeliveryError(error) {
  return String(error?.message ?? error).includes('serviço de email não está configurado')
}

function sleep(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds))
}

async function deliverRecipient(invite, campaign, recipient, bannerUrl) {
  const attemptNumber = recipient.attemptCount + 1
  let delivery
  try {
    delivery = await getCampaignProvider().send(recipient.email, {
      recipientName: recipient.name,
      eventTitle: invite.title,
      subject: campaign.subject,
      preheader: campaign.preheader,
      blocks: campaign.blocks,
      eventLink: guestLink(invite, recipient.guestToken),
      bannerUrl,
      ...unsubscribeLinks(invite, recipient.guestToken),
    })
    if (!delivery.accepted) {
      throw new Error('O fornecedor de email não aceitou a mensagem.')
    }
  } catch (error) {
    const message = String(error?.message ?? error).slice(0, 1000)
    const canRetry =
      attemptNumber < DELIVERY_MAX_ATTEMPTS && !isPermanentDeliveryError(error)
    await campaignsRepo.markRecipientAttempt(recipient.id, {
      status: canRetry ? 'pending' : 'failed',
      error: message,
      nextAttemptAt: canRetry
        ? new Date(Date.now() + retryDelayMs(attemptNumber))
        : null,
    })
    try {
      await campaignsRepo.insertDeliveryEvent({
        campaignId: campaign.id,
        recipientId: recipient.id,
        provider: getCampaignProviderInfo().name,
        eventType: 'failed',
        detail: { message, retryable: canRetry },
      })
    } catch (eventError) {
      console.error(
        `[campaigns] Falha ao registar evento de erro do destinatário ${recipient.id}:`,
        eventError
      )
    }
    return
  }

  await campaignsRepo.markRecipientAttempt(recipient.id, {
    status: 'sent',
    provider: delivery.provider,
    providerMessageId: delivery.messageId,
  })
  try {
    await campaignsRepo.insertDeliveryEvent({
      campaignId: campaign.id,
      recipientId: recipient.id,
      provider: delivery.provider,
      eventType: 'accepted',
      providerEventId: delivery.messageId,
    })
  } catch (eventError) {
    console.error(
      `[campaigns] Falha ao registar aceitação do destinatário ${recipient.id}:`,
      eventError
    )
  }
}

export async function processCampaign(campaignId) {
  const startedAt = Date.now()
  const leaseToken = randomUUID()
  const claimed = await campaignsRepo.claimCampaignLease(
    campaignId,
    leaseToken,
    DELIVERY_LEASE_SECONDS
  )
  if (!claimed) return campaignsRepo.findById(campaignId)

  const invite = await invitesRepo.findById(claimed.inviteId)
  if (!invite) return null
  const bannerUrl = await resolveInviteBanner(invite)

  try {
    while (Date.now() - startedAt < DELIVERY_WORKER_BUDGET_MS) {
      const leaseExtended = await campaignsRepo.extendCampaignLease(
        campaignId,
        leaseToken,
        DELIVERY_LEASE_SECONDS
      )
      if (!leaseExtended) return campaignsRepo.findById(campaignId)
      const recipients = await campaignsRepo.claimRecipientBatch(
        campaignId,
        DELIVERY_BATCH_SIZE
      )
      if (recipients.length) {
        await Promise.all(
          recipients.map((recipient) =>
            deliverRecipient(invite, claimed, recipient, bannerUrl)
          )
        )
        continue
      }

      const summary = await campaignsRepo.getDeliverySummary(campaignId)
      if (summary.pendingCount === 0 && summary.processingCount === 0) {
        return campaignsRepo.finishLeased(campaignId, leaseToken, summary)
      }

      const waitMs = Math.max(
        0,
        new Date(summary.nextAttemptAt).getTime() - Date.now()
      )
      const remainingMs = DELIVERY_WORKER_BUDGET_MS - (Date.now() - startedAt)
      if (waitMs > remainingMs - 1_000) {
        return campaignsRepo.releaseToQueue(campaignId, leaseToken, summary)
      }
      await sleep(waitMs)
    }
  } catch (error) {
    console.error(`[campaigns] Falha no worker da campanha ${campaignId}:`, error)
  }

  const summary = await campaignsRepo.getDeliverySummary(campaignId)
  return campaignsRepo.releaseToQueue(campaignId, leaseToken, summary)
}

export async function processDueCampaigns(limit = 5) {
  const scheduled = await campaignsRepo.queueDueScheduled(limit)
  for (const campaign of scheduled) {
    await campaignsRepo.initializeQueuedDelivery(campaign.id)
  }
  await processDueAutomations(limit)
  const campaignIds = await campaignsRepo.listDueCampaignIds(limit)
  const results = []
  for (const campaignId of campaignIds) {
    try {
      results.push(await processCampaign(campaignId))
    } catch (error) {
      console.error(`[campaigns] Não foi possível recuperar a campanha ${campaignId}:`, error)
    }
  }
  return { processed: results.length, campaigns: results }
}

async function processDueAutomations(limit) {
  const due = await campaignsRepo.listDueAutomations(limit)
  for (const row of due) {
    const template = findCampaignTemplate(row.template_key)
    if (!template) continue
    const eventDatetime =
      row.trigger_type === 'after_event'
        ? row.end_datetime ?? row.start_datetime
        : row.start_datetime
    const runKey = `${row.id}:${new Date(eventDatetime).toISOString()}`
    if (!(await campaignsRepo.claimAutomationRun(row.id, runKey))) continue

    const eventLink = `${(config.appUrl || '').replace(/\/+$/, '')}/invite/${encodeURIComponent(row.slug)}`
    const data = applyTemplate(template, { title: row.title }, eventLink)
    data.name = `${data.name} (automática)`
    data.audience = {
      ...data.audience,
      ...(row.audience ?? {}),
      ...(row.trigger_type === 'payment_pending'
        ? { paymentStates: ['pending', 'awaiting_validation'] }
        : {}),
    }
    try {
      const campaign = await campaignsRepo.insert(
        row.invite_id,
        campaignSchema.parse(data),
        row.created_by
      )
      const audience = await audienceFor(row.invite_id, campaign.audience)
      if (audience.length === 0) {
        await campaignsRepo.removeDraft(campaign.id)
        continue
      }
      await campaignsRepo.insertRecipients(campaign.id, audience)
      await campaignsRepo.queueForSending(campaign.id)
      await campaignsRepo.initializeQueuedDelivery(campaign.id)
    } catch (error) {
      await campaignsRepo.releaseAutomationRun(row.id, runKey)
      throw error
    }
  }
}

export function providerInfo() {
  return getCampaignProviderInfo()
}

export async function retryFailed(user, inviteId, campaignId) {
  await getCampaign(user, inviteId, campaignId)
  const claimed = await campaignsRepo.claimForRetry(campaignId)
  if (!claimed) throw new InviteError(409, 'Esta comunicação não tem envios falhados para repetir.')
  const recipients = await campaignsRepo.claimFailedRecipients(campaignId)
  if (recipients.length === 0) {
    return campaignsRepo.finishFromRecipients(campaignId)
  }
  await campaignsRepo.initializeQueuedDelivery(campaignId)
  return campaignsRepo.findById(campaignId)
}
