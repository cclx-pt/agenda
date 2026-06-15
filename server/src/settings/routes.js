import { Router } from 'express'
import { z } from 'zod'
import { requireRole } from '../middleware/auth.js'
import * as service from './service.js'

export const integrationRouter = Router()

const adminOnly = requireRole('admin')

// Estado público da integração (sem autenticação): o calendário usa-o para
// decidir se carrega os eventos da inChurch.
integrationRouter.get('/public', async (_req, res, next) => {
  try {
    const { enabled } = await service.getRawIntegration()
    res.json({ enabled })
  } catch (err) {
    next(err)
  }
})

integrationRouter.get('/', adminOnly, async (_req, res, next) => {
  try {
    res.json({ integration: await service.getIntegration() })
  } catch (err) {
    next(err)
  }
})

integrationRouter.put('/', adminOnly, async (req, res, next) => {
  try {
    const integration = await service.updateIntegration(req.body, req.user.sub)
    res.json({ integration })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: err.issues[0]?.message ?? 'Dados inválidos.' })
    }
    next(err)
  }
})
