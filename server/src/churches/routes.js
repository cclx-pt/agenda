import { Router } from 'express'
import { z } from 'zod'
import { requireAuth, requireRole } from '../middleware/auth.js'
import * as service from './service.js'
import { ChurchError } from './service.js'

export const churchesRouter = Router()

function asyncHandler(fn) {
  return async (req, res, next) => {
    try {
      await fn(req, res)
    } catch (err) {
      if (err instanceof ChurchError) {
        return res.status(err.status).json({ error: err.message })
      }
      if (err instanceof z.ZodError) {
        return res.status(400).json({ error: err.issues[0]?.message ?? 'Dados inválidos.' })
      }
      next(err)
    }
  }
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
churchesRouter.param('id', (req, res, next, id) => {
  if (!UUID_RE.test(id)) {
    return res.status(404).json({ error: 'Igreja não encontrada.' })
  }
  next()
})

// Leitura: qualquer utilizador autenticado (alimenta seletores de igreja).
churchesRouter.get(
  '/',
  requireAuth,
  asyncHandler(async (_req, res) => {
    res.json({ churches: await service.list() })
  })
)

// Escrita: exclusiva de administradores.
const adminOnly = requireRole('admin')

churchesRouter.post(
  '/',
  adminOnly,
  asyncHandler(async (req, res) => {
    res.status(201).json({ church: await service.create(req.body) })
  })
)

churchesRouter.put(
  '/:id',
  adminOnly,
  asyncHandler(async (req, res) => {
    res.json({ church: await service.update(req.params.id, req.body) })
  })
)

churchesRouter.delete(
  '/:id',
  adminOnly,
  asyncHandler(async (req, res) => {
    await service.remove(req.params.id)
    res.json({ ok: true })
  })
)
