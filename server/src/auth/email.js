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
    // Pooling: mantém a ligação SMTP aberta e reutiliza-a entre envios (nas
    // invocações "quentes" da função serverless), poupando o handshake TLS/auth.
    pool: true,
    maxConnections: 1,
    maxMessages: 100,
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

// Escapa HTML para evitar injeção no corpo do email (título/motivo do evento
// são texto do utilizador).
function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

// Texto por estado do evento (aprovado/rejeitado/eliminado).
const EVENT_STATUS_COPY = {
  aprovado: {
    heading: 'Evento aprovado',
    color: '#16a34a',
    intro: 'O seu evento foi aprovado e já está publicado na agenda.',
  },
  rejeitado: {
    heading: 'Evento rejeitado',
    color: '#dc2626',
    intro: 'O seu evento foi rejeitado. Pode corrigi-lo e voltar a submeter.',
  },
  eliminado: {
    heading: 'Evento eliminado',
    color: '#6b7280',
    intro: 'O seu evento foi eliminado da agenda.',
  },
}

/**
 * Notifica o criador de um evento sobre uma mudança de estado
 * (aprovado/rejeitado/eliminado). Sem SMTP configurado, imprime na consola (dev).
 */
export async function sendEventStatusEmail(to, { name, eventTitle, status, reason, eventDate, eventTime }) {
  const copy = EVENT_STATUS_COPY[status]
  if (!copy) return { skipped: true }

  const title = eventTitle || 'Evento'
  const subject = `Agenda CCLX — ${copy.heading}: ${title}`
  const greeting = name ? `Olá ${name},` : 'Olá,'

  const whenParts = []
  if (eventDate) {
    const [y, m, d] = String(eventDate).split('-')
    if (y && m && d) whenParts.push(`${d}/${m}/${y}`)
  }
  if (eventTime) whenParts.push(eventTime)
  const whenText = whenParts.join(' às ')

  const text =
    `${greeting}\n\n${copy.intro}\n\nEvento: ${title}` +
    (whenText ? `\nData: ${whenText}` : '') +
    (status === 'rejeitado' && reason ? `\nMotivo: ${reason}` : '') +
    `\n\nAgenda CCLX`

  const whenHtml = whenText
    ? `<p style="margin:6px 0;color:#6b7280">${escapeHtml(whenText)}</p>`
    : ''
  const reasonHtml =
    status === 'rejeitado' && reason
      ? `<p style="margin:10px 0;color:#374151"><strong>Motivo:</strong> ${escapeHtml(reason)}</p>`
      : ''

  const html = `
    <div style="font-family:Segoe UI,Arial,sans-serif;max-width:480px;margin:0 auto">
      <h2 style="color:#1f2937">Agenda CCLX</h2>
      <p style="margin:0 0 8px">${escapeHtml(greeting)}</p>
      <p style="display:inline-block;margin:6px 0;padding:4px 12px;border-radius:6px;background:${copy.color};color:#fff;font-weight:700">${copy.heading}</p>
      <p style="margin:8px 0;color:#374151">${copy.intro}</p>
      <p style="margin:14px 0 2px;font-size:18px;font-weight:700;color:#111827">${escapeHtml(title)}</p>
      ${whenHtml}
      ${reasonHtml}
      <hr style="border:none;border-top:1px solid #e5e7eb;margin:16px 0" />
      <p style="color:#9ca3af;font-size:12px">Mensagem automática da Agenda CCLX.</p>
    </div>`

  const tx = getTransporter()
  if (!tx) {
    console.log(`\n[email:mock] Para: ${to}\n[email:mock] ${copy.heading}: ${title}\n`)
    return { mocked: true }
  }
  await tx.sendMail({ from: config.smtp.from, to, subject, text, html })
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
