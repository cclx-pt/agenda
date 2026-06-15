import { Router } from 'express'
import { z } from 'zod'
import { requireAuth, requireRole } from '../middleware/auth.js'
import * as service from './service.js'
import { PrivacyTagError } from './service.js'

export const privacyTagsRouter = Router()

function asyncHandler(fn) {
  return async (req, res, next) => {
    try {
      await fn(req, res)
    } catch (err) {
      if (err instanceof PrivacyTagError) {
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
privacyTagsRouter.param('id', (req, res, next, id) => {
  if (!UUID_RE.test(id)) {
    return res.status(404).json({ error: 'Etiqueta não encontrada.' })
  }
  next()
})

// Leitura: qualquer utilizador autenticado (alimenta seletores de etiquetas).
privacyTagsRouter.get(
  '/',
  requireAuth,
  asyncHandler(async (_req, res) => {
    res.json({ privacyTags: await service.list() })
  })
)

// Escrita: exclusiva de administradores.
const adminOnly = requireRole('admin')

privacyTagsRouter.post(
  '/',
  adminOnly,
  asyncHandler(async (req, res) => {
    res.status(201).json({ privacyTag: await service.create(req.body) })
  })
)

privacyTagsRouter.delete(
  '/:id',
  adminOnly,
  asyncHandler(async (req, res) => {
    await service.remove(req.params.id)
    res.json({ ok: true })
  })
)
