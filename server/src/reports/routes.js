import { Router } from 'express'
import { requireRole } from '../middleware/auth.js'
import * as service from './service.js'

export const reportsRouter = Router()

// Relatórios disponíveis para quem gere eventos (admin, aprovador e editor).
reportsRouter.get('/summary', requireRole('admin', 'aprovador', 'editor'), async (_req, res, next) => {
  try {
    res.json({ summary: await service.getSummary() })
  } catch (err) {
    next(err)
  }
})
