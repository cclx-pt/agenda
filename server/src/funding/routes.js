import { Router } from 'express'
import { z } from 'zod'
import { requireRole } from '../middleware/auth.js'
import * as service from './service.js'
import { FundingError } from './service.js'

function asyncHandler(fn) {
  return async (req, res, next) => {
    try {
      await fn(req, res)
    } catch (error) {
      if (error instanceof FundingError) return res.status(error.status).json({ error: error.message })
      if (error instanceof z.ZodError) return res.status(400).json({ error: error.issues[0]?.message ?? 'Dados inválidos.' })
      next(error)
    }
  }
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const uuidParam = (label) => (req, res, next, value) => {
  if (!UUID_RE.test(value)) return res.status(404).json({ error: `${label} não encontrado.` })
  next()
}

export const fundingRouter = Router()
fundingRouter.use(requireRole('admin'))
fundingRouter.param('id', uuidParam('Campanha'))
fundingRouter.param('donationId', uuidParam('Donativo'))

fundingRouter.get('/', asyncHandler(async (_req, res) => {
  res.json({ campaigns: await service.listCampaigns() })
}))

fundingRouter.post('/', asyncHandler(async (req, res) => {
  res.status(201).json({ campaign: await service.createCampaign(req.body, req.user.sub) })
}))

fundingRouter.put('/:id', asyncHandler(async (req, res) => {
  res.json({ campaign: await service.updateCampaign(req.params.id, req.body) })
}))

fundingRouter.get('/:id/ledger', asyncHandler(async (req, res) => {
  res.json(await service.getLedger(req.params.id))
}))

fundingRouter.get('/:id/portal', asyncHandler(async (req, res) => {
  res.json({ campaign: await service.getCampaignPortal(req.params.id) })
}))

fundingRouter.post('/:id/donations', asyncHandler(async (req, res) => {
  res.status(201).json({ donation: await service.addDonation(req.params.id, req.body, req.user.sub) })
}))

fundingRouter.patch('/:id/donations/:donationId/reconcile', asyncHandler(async (req, res) => {
  res.json({ donation: await service.reconcileDonation(
    req.params.id, req.params.donationId, req.body?.reconciled !== false, req.user.sub
  ) })
}))

fundingRouter.post('/:id/pledges', asyncHandler(async (req, res) => {
  res.status(201).json({ pledge: await service.addPledge(req.params.id, req.body) })
}))

export const publicFundingRouter = Router()
publicFundingRouter.get('/:slug', asyncHandler(async (req, res) => {
  res.json({ campaign: await service.getPublicCampaign(req.params.slug) })
}))