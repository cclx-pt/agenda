import { Router } from 'express'
import rateLimit from 'express-rate-limit'
import { z } from 'zod'
import { waitUntil } from '@vercel/functions'
import { pool } from '../db/pool.js'
import { issueCode, verifyCode } from './otp.js'
import { sendOtpEmail } from './email.js'
import { signSession, cookieOptions, SESSION_COOKIE } from './jwt.js'
import { requireAuth } from '../middleware/auth.js'

export const authRouter = Router()

const emailSchema = z.object({
  email: z.string().email().transform((v) => v.toLowerCase().trim()),
})

const verifySchema = emailSchema.extend({
  code: z.string().regex(/^\d{6}$/, 'Código inválido.'),
})

// Limita pedidos de código por IP para mitigar abuso/enumeração.
const requestLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
})

async function findActiveUser(email) {
  const { rows } = await pool.query(
    'SELECT id, email, name, role, can_view_private, churches, privacy_tags FROM users WHERE email = $1 AND is_active = TRUE',
    [email]
  )
  return rows[0] ?? null
}

// POST /auth/request-code — gera e envia um código OTP (resposta sempre genérica).
authRouter.post('/request-code', requestLimiter, async (req, res, next) => {
  try {
    const parsed = emailSchema.safeParse(req.body)
    if (!parsed.success) {
      return res.status(400).json({ error: 'Email inválido.' })
    }
    const { email } = parsed.data

    // Só envia a utilizadores conhecidos e ativos, mas a resposta é sempre igual
    // para não revelar quais emails existem (anti-enumeração).
    const user = await findActiveUser(email)
    if (user) {
      const code = await issueCode(email)
      // Envia o email em segundo plano: a resposta NÃO espera pelo handshake SMTP
      // (lento). No Vercel, waitUntil mantém a função viva até o envio concluir;
      // localmente é no-op e o processo persistente conclui o envio na mesma.
      const sendPromise = sendOtpEmail(email, code).catch((mailErr) => {
        // O código já está na BD; uma falha de SMTP não bloqueia nem revela estado.
        console.error('[auth] Falha ao enviar email OTP:', mailErr?.message ?? mailErr)
      })
      try {
        waitUntil(sendPromise)
      } catch {
        /* fora do runtime Vercel: no-op; o envio conclui no processo persistente */
      }
    }

    res.json({ ok: true, message: 'Se o email estiver autorizado, enviámos um código.' })
  } catch (err) {
    next(err)
  }
})

// POST /auth/verify — valida o código e abre sessão (cookie httpOnly).
authRouter.post('/verify', requestLimiter, async (req, res, next) => {
  try {
    const parsed = verifySchema.safeParse(req.body)
    if (!parsed.success) {
      return res.status(400).json({ error: 'Dados inválidos.' })
    }
    const { email, code } = parsed.data

    const result = await verifyCode(email, code)
    if (!result.ok) {
      return res.status(401).json({ error: 'Código inválido ou expirado.' })
    }

    const user = await findActiveUser(email)
    if (!user) {
      return res.status(403).json({ error: 'Utilizador não autorizado.' })
    }

    await pool.query('UPDATE users SET last_login_at = now() WHERE id = $1', [user.id])

    const token = signSession(user)
    res.cookie(SESSION_COOKIE, token, cookieOptions())
    res.json({
      user: {
        email: user.email,
        name: user.name,
        role: user.role,
        canViewPrivate: !!user.can_view_private,
        churches: user.churches ?? null,
        privacyTags: user.privacy_tags ?? null,
      },
    })
  } catch (err) {
    next(err)
  }
})

// GET /auth/me — devolve o utilizador autenticado.
authRouter.get('/me', requireAuth, (req, res) => {
  res.json({
    user: {
      email: req.user.email,
      name: req.user.name,
      role: req.user.role,
      canViewPrivate: !!req.user.canViewPrivate,
      churches: req.user.churches ?? null,
      privacyTags: req.user.privacyTags ?? null,
    },
  })
})

// POST /auth/logout — termina a sessão.
authRouter.post('/logout', (req, res) => {
  res.clearCookie(SESSION_COOKIE, { path: '/' })
  res.json({ ok: true })
})
