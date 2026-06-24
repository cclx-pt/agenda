import nodemailer from 'nodemailer'
import { config } from '../config.js'

let transporter = null

function getTransporter() {
  if (transporter) return transporter

  if (!config.smtp.host) {
    // Sem SMTP configurado: cai no modo "consola" (ver sendOtpEmail).
    return null
  }

  transporter = nodemailer.createTransport({
    host: config.smtp.host,
    port: config.smtp.port,
    secure: config.smtp.secure,
    auth: config.smtp.user ? { user: config.smtp.user, pass: config.smtp.pass } : undefined,
    // Falha depressa se o servidor SMTP estiver inacessível, em vez de pendurar o pedido.
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 15_000,
  })
  return transporter
}

/** Envia o código OTP por email. Sem SMTP configurado, imprime na consola (dev). */
export async function sendOtpEmail(email, code) {
  const subject = 'O seu código de acesso — Agenda CCLX'
  const text = `O seu código de acesso é ${code}. Expira em ${config.otp.ttlMinutes} minutos.`
  const html = `
    <div style="font-family:Segoe UI,Arial,sans-serif;max-width:480px;margin:0 auto">
      <h2 style="color:#1f2937">Agenda CCLX</h2>
      <p>Use o seguinte código para entrar na gestão da agenda:</p>
      <p style="font-size:32px;font-weight:700;letter-spacing:6px;color:#111827">${code}</p>
      <p style="color:#6b7280">Expira em ${config.otp.ttlMinutes} minutos. Se não pediu este código, ignore este email.</p>
    </div>`

  const tx = getTransporter()
  if (!tx) {
    console.log(`\n[email:mock] Para: ${email}\n[email:mock] Código OTP: ${code}\n`)
    return { mocked: true }
  }

  // Recuperação de emergência (OTP_LOG_CODES=true): regista o código nos logs do
  // servidor para o operador o ler quando o email não chega. Escreve-se ANTES do
  // envio para funcionar mesmo que o SMTP falhe. Desligar depois de recuperar.
  if (config.otp.logCodes) {
    console.log(`[email:otp-log] Código OTP para ${email}: ${code}`)
  }

  await tx.sendMail({ from: config.smtp.from, to: email, subject, text, html })
  return { mocked: false }
}

/**
 * Verifica a ligação/credenciais SMTP (nodemailer transporter.verify()).
 * O resultado fica em cache curta (60s) para não abrir uma ligação SMTP a cada
 * sondagem do /health/full. Devolve { ok, configured, error }.
 */
let smtpCheck = { at: 0, result: null }
const SMTP_CHECK_TTL_MS = 60_000

export async function verifySmtp() {
  const now = Date.now()
  if (smtpCheck.result && now - smtpCheck.at < SMTP_CHECK_TTL_MS) {
    return smtpCheck.result
  }

  const tx = getTransporter()
  let result
  if (!tx) {
    result = { ok: false, configured: false, error: 'SMTP não configurado (modo consola).' }
  } else {
    try {
      await tx.verify()
      result = { ok: true, configured: true }
    } catch (err) {
      result = { ok: false, configured: true, error: err?.message ?? String(err) }
    }
  }

  smtpCheck = { at: now, result }
  return result
}
