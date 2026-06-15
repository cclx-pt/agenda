import crypto from 'node:crypto'
import { config } from '../config.js'
import { pool } from '../db/pool.js'

/** Gera um código numérico de 6 dígitos (criptograficamente seguro). */
export function generateCode() {
  // 0–999999, com padding para garantir 6 dígitos.
  const n = crypto.randomInt(0, 1_000_000)
  return String(n).padStart(6, '0')
}

/** Hash determinístico do código (HMAC-SHA256 com pepper) para guardar na BD. */
export function hashCode(code) {
  return crypto.createHmac('sha256', config.otp.pepper).update(code).digest('hex')
}

/** Comparação em tempo constante para evitar timing attacks. */
export function safeEqual(a, b) {
  const bufA = Buffer.from(a, 'hex')
  const bufB = Buffer.from(b, 'hex')
  if (bufA.length !== bufB.length) return false
  return crypto.timingSafeEqual(bufA, bufB)
}

/**
 * Cria um novo código OTP para o email indicado, invalidando os anteriores
 * ainda não consumidos. Devolve o código em claro (para envio por email).
 */
export async function issueCode(email) {
  const code = generateCode()
  const codeHash = hashCode(code)
  const expiresAt = new Date(Date.now() + config.otp.ttlMinutes * 60_000)

  // Invalida códigos anteriores não consumidos do mesmo email.
  await pool.query(
    `UPDATE otp_codes SET consumed_at = now()
     WHERE email = $1 AND consumed_at IS NULL`,
    [email]
  )

  await pool.query(
    `INSERT INTO otp_codes (email, code_hash, expires_at)
     VALUES ($1, $2, $3)`,
    [email, codeHash, expiresAt]
  )

  return code
}

/**
 * Verifica o código para o email. Devolve { ok, reason }.
 * Marca o código como consumido em caso de sucesso e incrementa tentativas
 * em caso de falha.
 */
export async function verifyCode(email, code) {
  // Atalho de desenvolvimento: código mestre fixo para facilitar testes locais.
  // config.otp.devMasterCode só existe quando NODE_ENV !== 'production'.
  if (config.otp.devMasterCode && safeEqual(hashCode(code), hashCode(config.otp.devMasterCode))) {
    return { ok: true }
  }

  const { rows } = await pool.query(
    `SELECT id, code_hash, expires_at, attempts
     FROM otp_codes
     WHERE email = $1 AND consumed_at IS NULL
     ORDER BY created_at DESC
     LIMIT 1`,
    [email]
  )

  const record = rows[0]
  if (!record) return { ok: false, reason: 'not_found' }

  if (new Date(record.expires_at).getTime() < Date.now()) {
    return { ok: false, reason: 'expired' }
  }

  if (record.attempts >= config.otp.maxAttempts) {
    await pool.query('UPDATE otp_codes SET consumed_at = now() WHERE id = $1', [record.id])
    return { ok: false, reason: 'too_many_attempts' }
  }

  const matches = safeEqual(hashCode(code), record.code_hash)
  if (!matches) {
    await pool.query('UPDATE otp_codes SET attempts = attempts + 1 WHERE id = $1', [record.id])
    return { ok: false, reason: 'mismatch' }
  }

  await pool.query('UPDATE otp_codes SET consumed_at = now() WHERE id = $1', [record.id])
  return { ok: true }
}
