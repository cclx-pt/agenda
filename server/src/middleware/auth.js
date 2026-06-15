import { SESSION_COOKIE, verifySession } from '../auth/jwt.js'

/** Lê o cookie de sessão e popula req.user. Não bloqueia (passa adiante). */
export function loadUser(req, _res, next) {
  const token = req.cookies?.[SESSION_COOKIE]
  if (token) {
    try {
      req.user = verifySession(token)
    } catch {
      req.user = null
    }
  }
  next()
}

/** Exige sessão válida. 401 caso contrário. */
export function requireAuth(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: 'Autenticação necessária.' })
  }
  next()
}

/** Exige que o utilizador tenha um dos papéis indicados. 403 caso contrário. */
export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Autenticação necessária.' })
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Sem permissão para esta ação.' })
    }
    next()
  }
}
