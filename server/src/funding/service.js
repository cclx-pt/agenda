import { z } from 'zod'
import * as repo from './repository.js'
import { campaignProgress, publicCampaignView } from './domain.js'

export class FundingError extends Error {
  constructor(status, message) {
    super(message)
    this.name = 'FundingError'
    this.status = status
  }
}

const CONFIG_IDS = ['C1', 'C2', 'C3', 'C4', 'C5']
const SCHEDULES = ['one_shot', 'monthly_12', 'annual', 'weekly', 'monthly_rolling']
const CHANNELS = ['cash', 'mbway', 'transfer', 'online', 'other']
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

const nullableText = (max) => z.string().trim().max(max).optional().nullable()

const campaignSchema = z.object({
  slug: z.string().trim().min(3).max(80).regex(/^[a-z0-9-]+$/, 'Identificador inválido.'),
  title: z.string().trim().min(3, 'Indique o nome da campanha.').max(160),
  purpose: z.string().trim().min(3, 'Indique o propósito da campanha.').max(2000),
  targetEur: z.coerce.number().positive('O objetivo deve ser superior a zero.').max(100000000),
  deadline: z.string().regex(DATE_RE, 'Data limite inválida.'),
  configurations: z.array(z.enum(CONFIG_IDS)).min(1, 'Escolha pelo menos uma configuração.').max(5),
  visibilityMode: z.enum(['V1', 'V2', 'V3']),
  phasePlan: nullableText(500),
  status: z.enum(['draft', 'active', 'closed']).default('draft'),
})

const donationSchema = z.object({
  receiptNo: z.string().trim().min(1, 'O número do recibo é obrigatório.').max(60),
  date: z.string().regex(DATE_RE, 'Data inválida.'),
  amountEur: z.coerce.number().positive('O valor deve ser superior a zero.').max(10000000),
  channel: z.enum(CHANNELS),
  configId: z.enum(CONFIG_IDS),
  donorName: nullableText(160).transform((value) => value || 'anonymous'),
  donorContact: nullableText(240),
  pledgeRef: z.string().uuid().optional().nullable(),
  proofRef: z.string().trim().min(1, 'A referência da prova é obrigatória.').max(500),
  notes: nullableText(1000),
})

const pledgeSchema = z.object({
  donorName: z.string().trim().min(2, 'Indique o nome do doador.').max(160),
  contact: nullableText(240),
  pledgedAmount: z.coerce.number().positive('O compromisso deve ser superior a zero.').max(10000000),
  schedule: z.enum(SCHEDULES),
  promisedDate: z.string().regex(DATE_RE).optional().nullable(),
  consentRecorded: z.boolean().default(false),
  accessGranted: z.boolean().default(false),
})

async function requireCampaign(id) {
  const campaign = await repo.findCampaignById(id)
  if (!campaign) throw new FundingError(404, 'Campanha não encontrada.')
  return campaign
}

export async function listCampaigns() {
  return (await repo.listCampaigns()).map(campaignProgress)
}

export async function createCampaign(input, actorId) {
  const data = campaignSchema.parse(input)
  if (await repo.findCampaignBySlug(data.slug)) {
    throw new FundingError(409, 'Já existe uma campanha com este identificador.')
  }
  return campaignProgress(await repo.insertCampaign(data, actorId))
}

export async function updateCampaign(id, input) {
  const current = await requireCampaign(id)
  const data = campaignSchema.parse({ ...input, slug: input.slug ?? current.slug })
  if (data.slug !== current.slug) throw new FundingError(400, 'O identificador não pode ser alterado.')
  return campaignProgress(await repo.updateCampaign(id, data))
}

export async function getLedger(id) {
  const campaign = campaignProgress(await requireCampaign(id))
  const [donations, pledges] = await Promise.all([repo.listDonations(id), repo.listPledges(id)])
  const reconciledTotal = donations.filter((item) => item.reconciled).reduce((sum, item) => sum + item.amountEur, 0)
  return { campaign, donations, pledges, reconciledTotal }
}

export async function getCampaignPortal(id) {
  return publicCampaignView(await requireCampaign(id))
}

export async function addDonation(campaignId, input, actorId) {
  const campaign = await requireCampaign(campaignId)
  const data = donationSchema.parse(input)
  if (!campaign.configurations.includes(data.configId)) {
    throw new FundingError(400, 'A configuração escolhida não pertence a esta campanha.')
  }
  if (data.pledgeRef && !(await repo.pledgeBelongsToCampaign(data.pledgeRef, campaignId))) {
    throw new FundingError(400, 'O compromisso indicado não pertence à campanha.')
  }
  try {
    return await repo.insertDonation(campaignId, data, actorId)
  } catch (error) {
    if (error?.code === '23505') throw new FundingError(409, 'Este número de recibo já foi utilizado.')
    if (error?.code === '23503') throw new FundingError(400, 'O compromisso indicado não pertence à campanha.')
    throw error
  }
}

export async function reconcileDonation(campaignId, donationId, reconciled, actorId) {
  await requireCampaign(campaignId)
  const donation = await repo.setDonationReconciled(campaignId, donationId, reconciled, actorId)
  if (!donation) throw new FundingError(404, 'Donativo não encontrado.')
  return donation
}

export async function addPledge(campaignId, input) {
  await requireCampaign(campaignId)
  return repo.insertPledge(campaignId, pledgeSchema.parse(input))
}

export async function getPublicCampaign(slug) {
  const campaign = await repo.findCampaignBySlug(slug)
  if (!campaign || campaign.status !== 'active') throw new FundingError(404, 'Campanha não encontrada.')
  if (campaign.visibilityMode !== 'V1') throw new FundingError(403, 'O progresso desta campanha é reservado.')
  return publicCampaignView(campaign)
}