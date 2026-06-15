import jwt from 'jsonwebtoken'
import { config } from '../config.js'

export const SESSION_COOKIE = 'cclx_session'

export function signSession(user) {
  return jwt.sign(
    {
      sub: user.id,
      email: user.email,
      role: user.role,
      name: user.name,
      canViewPrivate: !!user.can_view_private,
      churches: user.churches ?? null,
      privacyTags: user.privacy_tags ?? null,
    },
    config.jwt.secret,
    { expiresIn: `${config.jwt.sessionHours}h` }
  )
}

export function verifySession(token) {
  return jwt.verify(token, config.jwt.secret)
}

export function cookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: config.isProd,
    maxAge: config.jwt.sessionHours * 60 * 60 * 1000,
    path: '/',
  }
}
