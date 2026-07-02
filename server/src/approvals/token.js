import jwt from 'jsonwebtoken'
import { config } from '../config.js'

// Finalidade fixada no token para que um token de sessão não sirva como token
// de ação (e vice-versa).
const PURPOSE = 'event-approval'

/**
 * Assina um token de ação de aprovação (aprovar/rejeitar um evento a partir do
 * email, sem sessão). Fica válido por `ttlDays` dias. É "single-use" na prática:
 * a ação revalida que o evento continua pendente, por isso um segundo uso após
 * a decisão não tem efeito.
 */
export function signApprovalToken({ eventId, approverId }, { ttlDays = 7 } = {}) {
  return jwt.sign({ purpose: PURPOSE, eventId, approverId }, config.jwt.secret, {
    expiresIn: `${ttlDays}d`,
  })
}

/** Verifica um token de ação. Devolve `{ eventId, approverId }` ou `null`. */
export function verifyApprovalToken(token) {
  try {
    const payload = jwt.verify(token, config.jwt.secret)
    if (payload?.purpose !== PURPOSE || !payload.eventId || !payload.approverId) return null
    return { eventId: payload.eventId, approverId: payload.approverId }
  } catch {
    return null
  }
}
