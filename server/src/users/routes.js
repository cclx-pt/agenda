import { Router } from 'express'
import { z } from 'zod'
import { requireRole } from '../middleware/auth.js'
import * as service from './service.js'
import { UserError } from './service.js'

export const usersRouter = Router()

// Toda a gestão de utilizadores é exclusiva de administradores.
usersRouter.use(requireRole('admin'))

function asyncHandler(fn) {
  return async (req, res, next) => {
    try {
      await fn(req, res)
    } catch (err) {
      if (err instanceof UserError) {
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
usersRouter.param('id', (req, res, next, id) => {
  if (!UUID_RE.test(id)) {
    return res.status(404).json({ error: 'Utilizador não encontrado.' })
  }
  next()
})

usersRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    res.json({ users: await service.list() })
  })
)

usersRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    res.status(201).json({ user: await service.create(req.body) })
  })
)

usersRouter.put(
  '/:id',
  asyncHandler(async (req, res) => {
    res.json({ user: await service.update(req.user, req.params.id, req.body) })
  })
)

usersRouter.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    await service.remove(req.user, req.params.id)
    res.json({ ok: true })
  })
)
