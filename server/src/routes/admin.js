import { Router } from 'express'
import { requireAuth, requireRole } from '../middleware/auth.js'

// Rotas protegidas de exemplo (esqueleto da Fase 3).
// Servem de base para o backoffice/gestão da agenda.
export const adminRouter = Router()

// Qualquer utilizador autenticado.
adminRouter.get('/whoami', requireAuth, (req, res) => {
  res.json({ user: { email: req.user.email, name: req.user.name, role: req.user.role } })
})

// Apenas administradores.
adminRouter.get('/admin/ping', requireRole('admin'), (_req, res) => {
  res.json({ ok: true, scope: 'admin' })
})

// Editores, aprovadores e admins (futuro: criar/aprovar eventos).
adminRouter.get('/gestao/ping', requireRole('admin', 'aprovador', 'editor'), (req, res) => {
  res.json({ ok: true, scope: 'gestao', role: req.user.role })
})
