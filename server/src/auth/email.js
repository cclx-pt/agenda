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

export function renderTicketPaymentMethods(ticket) {
  const methods = ticket && !ticket.isFree ? ticket.methods || [] : []
  if (!methods.length) return { text: '', html: '' }
  const title = ticket.isDonation ? 'Métodos de Doação' : 'Métodos de Pagamento'
  return {
    text: `${title}:\n${methods.map((method) => `- ${method.label}${method.detail ? `: ${method.detail}` : ''}`).join('\n')}`,
    html: `<div style="margin:12px 0;padding:12px;background:#f8fafc;border:1px solid #e5e7eb;border-radius:8px">
        <p style="margin:0 0 6px;font-weight:700;color:#111827">${title}</p>
        ${methods
          .map(
            (method) =>
              `<p style="margin:0 0 4px;color:#374151;font-size:14px"><strong>${escapeHtml(method.label)}</strong>${
                method.detail ? ` — ${escapeHtml(method.detail)}` : ''
              }</p>`
          )
          .join('')}
      </div>`,
  }
}

function campaignBlockHtml(block) {
  if (block.type === 'text') {
    return `<p style="margin:0 0 16px;color:#374151;line-height:1.65;white-space:pre-line">${escapeHtml(block.text)}</p>`
  }
  if (block.type === 'image') {
    return `<img src="${escapeHtml(block.url)}" alt="${escapeHtml(block.alt)}" style="display:block;width:100%;max-width:560px;height:auto;margin:0 0 18px;border-radius:8px" />`
  }
  if (block.type === 'video') {
    return `<p style="margin:0 0 18px"><a href="${escapeHtml(block.url)}" style="color:#1f3864;font-weight:700">Ver vídeo: ${escapeHtml(block.title || block.url)}</a></p>`
  }
  if (block.type === 'button') {
    return `<p style="margin:20px 0"><a href="${escapeHtml(block.url)}" style="display:inline-block;background:#1f3864;color:#fff;text-decoration:none;padding:11px 20px;border-radius:8px;font-weight:700">${escapeHtml(block.label)}</a></p>`
  }
  if (block.type === 'warning') {
    return `<div style="margin:0 0 18px;padding:14px;background:#fef3c7;border-left:4px solid #d97706;color:#78350f"><strong>Aviso</strong><br />${escapeHtml(block.text)}</div>`
  }
  if (block.type === 'workshops') {
    return `<div style="margin:0 0 18px"><h3 style="margin:0 0 10px;color:#1f2937">Workshops</h3>${block.items
      .map((item) => `<div style="padding:10px 0;border-top:1px solid #e5e7eb"><strong>${escapeHtml(item.title)}</strong>${item.description ? `<p style="margin:4px 0 0;color:#4b5563">${escapeHtml(item.description)}</p>` : ''}</div>`)
      .join('')}</div>`
  }
  return ''
}

export function renderInviteCampaignEmail({ recipientName, eventTitle, subject, preheader, blocks, eventLink }) {
  const greeting = recipientName ? `Olá ${recipientName},` : 'Olá,'
  const content = Array.isArray(blocks) ? blocks : []
  const textBlocks = content.map((block) => {
    if (block.type === 'text' || block.type === 'warning') return block.text
    if (block.type === 'image') return block.alt ? `${block.alt}: ${block.url}` : block.url
    if (block.type === 'video') return `${block.title || 'Ver vídeo'}: ${block.url}`
    if (block.type === 'button') return `${block.label}: ${block.url}`
    if (block.type === 'workshops') return `Workshops:\n${block.items.map((item) => `- ${item.title}${item.description ? `: ${item.description}` : ''}`).join('\n')}`
    return ''
  }).filter(Boolean)
  const text = `${greeting}\n\n${textBlocks.join('\n\n')}\n\nVer convite: ${eventLink}\n\nAgenda CCLX`
  const html = `
    <div style="font-family:Segoe UI,Arial,sans-serif;max-width:560px;margin:0 auto;color:#111827">
      ${preheader ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0">${escapeHtml(preheader)}</div>` : ''}
      <p style="margin:0 0 16px">${escapeHtml(greeting)}</p>
      ${content.map(campaignBlockHtml).join('')}
      <p style="margin:24px 0 8px"><a href="${escapeHtml(eventLink)}" style="color:#1f3864;font-weight:700">Ver ${escapeHtml(eventTitle || 'convite')}</a></p>
      <p style="margin:16px 0 0;color:#9ca3af;font-size:12px">Comunicação operacional relativa à sua inscrição · Agenda CCLX</p>
    </div>`
  return { subject, text, html }
}

export async function sendInviteCampaignEmail(to, data) {
  const message = renderInviteCampaignEmail(data)
  const tx = getTransporter()
  if (!tx) {
    console.log(`\n[email:mock] Comunicação de convite para: ${to}\n[email:mock] Assunto: ${message.subject}\n`)
    return { mocked: true }
  }
  await tx.sendMail({ from: config.smtp.from, to, ...message })
  return { mocked: false }
}

export function formatInviteDateRange(start, end) {
  if (!start) return ''
  const startDate = new Date(start)
  if (Number.isNaN(startDate.getTime())) return ''
  const options = { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Lisbon' }
  const startText = startDate.toLocaleDateString('pt-PT', options)
  if (!end) return startText
  const endDate = new Date(end)
  if (Number.isNaN(endDate.getTime())) return startText
  const dayKey = (date) =>
    new Intl.DateTimeFormat('en-CA', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      timeZone: 'Europe/Lisbon',
    }).format(date)
  if (dayKey(startDate) === dayKey(endDate)) return startText
  return `${startText} – ${endDate.toLocaleDateString('pt-PT', options)}`
}

// Confirmação de inscrição enviada ao convidado, com o link pessoal (?g=) para
// consultar/atualizar o estado. Sem SMTP configurado, imprime na consola (dev).
export async function sendRsvpConfirmationEmail(
  to,
  { name, eventTitle, when, whenEnd, location, statusMessage, link, uniqueLink, code, bannerUrl, qrUrl, ticket, data, manage }
) {
  const title = eventTitle || 'Evento'
  const subject = `Inscrição registada — ${title}`
  const appBase = (config.appUrl || '').replace(/\/+$/, '')
  const bilheteLink = uniqueLink || link
  const bannerSrc = bannerUrl ? (bannerUrl.startsWith('http') ? bannerUrl : `${appBase}${bannerUrl}`) : ''
  const whenText = formatInviteDateRange(when, whenEnd)
  // Linha de valor do bilhete: Pago → valor; Doação → sem valor; Grátis → grátis.
  const valueLine = ticket
    ? ticket.isPaid && ticket.valueText
      ? `Valor: ${ticket.valueText}`
      : ticket.isDonation
        ? 'Doação (valor à tua escolha)'
        : ticket.isFree
          ? 'Grátis'
          : ''
    : ''
  const methodsSection = renderTicketPaymentMethods(ticket)

  const text =
    `${name ? `Olá ${name},` : 'Olá,'}\n\nRecebemos a tua inscrição em ${title}.` +
    (whenText ? `\nQuando: ${whenText}` : '') +
    (location ? `\nLocal: ${location}` : '') +
    (statusMessage ? `\n\n${statusMessage}` : '') +
    (ticket?.name ? `\n\nBilhete: ${ticket.name}` : '') +
    (valueLine ? `\n${valueLine}` : '') +
    (code ? `\nCódigo do bilhete: ${code}` : '') +
    (methodsSection.text ? `\n\n${methodsSection.text}` : '') +
    (ticket?.requireReceipt ? `\n\nAnexa o comprovativo do pagamento aqui:\n${bilheteLink}` : '') +
    (Array.isArray(data) && data.length
      ? `\n\nDados da inscrição:\n${data.map((d) => `- ${d.label}: ${d.value}`).join('\n')}`
      : '') +
    `\n\nO teu bilhete (link único):\n${bilheteLink}` +
    (manage
      ? `\n\nGerir a tua inscrição (cancelar / pedir reembolso):\nCódigo de reserva: ${manage.code}\nSenha: ${manage.password}\n${manage.url}`
      : '') +
    `\n\nVerifica este email — tem os dados do teu bilhete.\n\nAgenda CCLX`

  const ticketHtml = ticket
    ? `<div style="margin:16px 0;padding:14px;border:1px solid #e5e7eb;border-radius:10px">
        <p style="margin:0 0 4px;color:#6b7280;font-size:12px;text-transform:uppercase;letter-spacing:.05em">Bilhete</p>
        <p style="margin:0 0 4px;font-weight:700;color:#111827">${escapeHtml(ticket.name || '')}</p>
        ${valueLine ? `<p style="margin:0 0 4px;color:#374151">${escapeHtml(valueLine)}</p>` : ''}
        ${code ? `<p style="margin:6px 0 0;color:#111827">Código: <strong style="font-family:monospace;font-size:15px">${escapeHtml(code)}</strong></p>` : ''}
      </div>`
    : ''

  const dataHtml =
    Array.isArray(data) && data.length
      ? `<div style="margin:12px 0;padding:12px;border:1px solid #e5e7eb;border-radius:8px">
        <p style="margin:0 0 6px;font-weight:700;color:#111827">Dados da inscrição</p>
        ${data
          .map(
            (d) =>
              `<p style="margin:0 0 3px;color:#374151;font-size:14px"><strong>${escapeHtml(d.label)}:</strong> ${escapeHtml(String(d.value))}</p>`
          )
          .join('')}
      </div>`
      : ''

  const manageHtml = manage
    ? `<div style="margin:16px 0;padding:14px;border:1px dashed #cbd5e1;border-radius:10px;background:#f8fafc">
        <p style="margin:0 0 6px;font-weight:700;color:#111827">Gerir a tua inscrição</p>
        <p style="margin:0 0 8px;color:#374151;font-size:14px">Podes cancelar a tua inscrição (ou pedir reembolso, quando aplicável) com estes dados:</p>
        <p style="margin:0 0 3px;color:#111827;font-size:14px">Código de reserva: <strong style="font-family:monospace">${escapeHtml(manage.code)}</strong></p>
        <p style="margin:0 0 10px;color:#111827;font-size:14px">Senha: <strong style="font-family:monospace">${escapeHtml(manage.password)}</strong></p>
        <a href="${escapeHtml(manage.url)}" style="display:inline-block;background:#1f3864;color:#fff;text-decoration:none;padding:10px 18px;border-radius:8px;font-weight:600">Gerir inscrição</a>
        <p style="margin:8px 0 0;color:#6b7280;font-size:12px">Guarda a senha — é pedida para gerires a tua inscrição.</p>
      </div>`
    : ''

  const html = `
    <div style="font-family:Segoe UI,Arial,sans-serif;max-width:560px;margin:0 auto;color:#111827">
      ${bannerSrc ? `<img src="${escapeHtml(bannerSrc)}" alt="${escapeHtml(title)}" style="width:100%;max-width:560px;border-radius:12px;margin:0 0 16px" />` : ''}
      <h2 style="color:#1f3864;margin:0 0 12px">Inscrição registada</h2>
      <p style="margin:0 0 8px">${name ? `Olá ${escapeHtml(name)},` : 'Olá,'}</p>
      <p style="margin:0 0 8px">Recebemos a tua inscrição em <strong>${escapeHtml(title)}</strong>.</p>
      ${whenText ? `<p style="margin:0 0 4px;color:#6b7280"><strong>Quando:</strong> ${escapeHtml(whenText)}</p>` : ''}
      ${location ? `<p style="margin:0 0 8px;color:#6b7280"><strong>Local:</strong> ${escapeHtml(location)}</p>` : ''}
      ${statusMessage ? `<p style="margin:12px 0;padding:12px;background:#f3f4f6;border-radius:8px">${escapeHtml(statusMessage)}</p>` : ''}
      ${ticketHtml}
      ${dataHtml}
      ${methodsSection.html}
      ${
        ticket?.isDonation
          ? `<div style="margin:16px 0;padding:14px;background:#ecfdf5;border:1px solid #10b981;border-radius:8px">
        <p style="margin:0 0 6px;font-weight:700;color:#065f46">Contribuição voluntária</p>
        <p style="margin:0 0 10px;color:#065f46;font-size:14px">A tua inscrição está confirmada. Se quiseres contribuir, usa o método abaixo e, se quiseres, anexa o comprovativo.</p>
        <a href="${escapeHtml(ticket.payUrl || bilheteLink)}" style="display:inline-block;background:#047857;color:#fff;text-decoration:none;padding:10px 18px;border-radius:8px;font-weight:600;margin:0 8px 8px 0">Contribuir</a>
        <a href="${escapeHtml(bilheteLink)}" style="display:inline-block;background:#1f3864;color:#fff;text-decoration:none;padding:10px 18px;border-radius:8px;font-weight:600">Anexar comprovativo</a>
      </div>`
          : ticket?.showPay
          ? `<div style="margin:16px 0;padding:14px;background:#fef3c7;border:1px solid #f59e0b;border-radius:8px">
        <p style="margin:0 0 6px;font-weight:700;color:#92400e">Falta concluir o pagamento</p>
        <p style="margin:0 0 10px;color:#92400e;font-size:14px">Paga${ticket.requireReceipt ? ' e depois anexa o comprovativo (<strong>obrigatório</strong>)' : ''} para confirmarmos a tua inscrição.</p>
        <a href="${escapeHtml(ticket.payUrl || bilheteLink)}" style="display:inline-block;background:#b45309;color:#fff;text-decoration:none;padding:10px 18px;border-radius:8px;font-weight:600;margin:0 8px 8px 0">Pagar</a>
        ${ticket.requireReceipt ? `<a href="${escapeHtml(bilheteLink)}" style="display:inline-block;background:#1f3864;color:#fff;text-decoration:none;padding:10px 18px;border-radius:8px;font-weight:600">Anexar comprovativo</a>` : ''}
      </div>`
          : ''
      }
      <div style="margin:20px 0;text-align:center">
        ${qrUrl ? `<img src="${escapeHtml(qrUrl)}" alt="QR do bilhete" width="200" height="200" style="border:1px solid #e5e7eb;border-radius:12px" />` : ''}
        <p style="margin:8px 0 0;color:#6b7280;font-size:13px">Lê o QR ou abre o teu bilhete:</p>
        <p style="margin:4px 0 0"><a href="${escapeHtml(bilheteLink)}" style="color:#1f3864;font-weight:600">${escapeHtml(bilheteLink)}</a></p>
      </div>
      ${manageHtml}
      <p style="margin:8px 0;color:#6b7280;font-size:13px">Guarda este email — tem os dados do teu bilhete. O link é pessoal e único desta inscrição.</p>
      <p style="margin:16px 0 0;color:#9ca3af;font-size:12px">Agenda CCLX</p>
    </div>`

  const tx = getTransporter()
  if (!tx) {
    console.log(`\n[email:mock] Confirmação de inscrição para: ${to}\n[email:mock] Link: ${bilheteLink}\n`)
    return { mocked: true }
  }
  await tx.sendMail({ from: config.smtp.from, to, subject, text, html })
  return { mocked: false }
}

// Notifica o organizador de um pedido de reembolso (self-service do convidado).
export async function sendRefundRequestEmail(
  to,
  { organizerName, eventTitle, guestName, guestEmail, code, ticketName, amount, link }
) {
  const title = eventTitle || 'Evento'
  const subject = `Pedido de reembolso — ${title}`
  const text =
    `${organizerName ? `Olá ${organizerName},` : 'Olá,'}\n\n` +
    `Foi pedido um reembolso numa inscrição de ${title}.` +
    (guestName ? `\nNome: ${guestName}` : '') +
    (guestEmail ? `\nEmail: ${guestEmail}` : '') +
    (code ? `\nCódigo de reserva: ${code}` : '') +
    (ticketName ? `\nBilhete: ${ticketName}` : '') +
    (amount ? `\nValor: ${amount}` : '') +
    `\n\nA inscrição foi cancelada e o pagamento marcado como "reembolso pedido". ` +
    `Processa o reembolso e marca-o como concluído no painel de convites.` +
    (link ? `\n\n${link}` : '') +
    `\n\nAgenda CCLX`
  const html = `
    <div style="font-family:Segoe UI,Arial,sans-serif;max-width:560px;margin:0 auto;color:#111827">
      <h2 style="color:#b45309;margin:0 0 12px">Pedido de reembolso</h2>
      <p style="margin:0 0 8px">${organizerName ? `Olá ${escapeHtml(organizerName)},` : 'Olá,'}</p>
      <p style="margin:0 0 8px">Foi pedido um reembolso numa inscrição de <strong>${escapeHtml(title)}</strong>.</p>
      <div style="margin:12px 0;padding:12px;border:1px solid #e5e7eb;border-radius:8px">
        ${guestName ? `<p style="margin:0 0 3px;color:#374151;font-size:14px"><strong>Nome:</strong> ${escapeHtml(guestName)}</p>` : ''}
        ${guestEmail ? `<p style="margin:0 0 3px;color:#374151;font-size:14px"><strong>Email:</strong> ${escapeHtml(guestEmail)}</p>` : ''}
        ${code ? `<p style="margin:0 0 3px;color:#374151;font-size:14px"><strong>Código:</strong> <span style="font-family:monospace">${escapeHtml(code)}</span></p>` : ''}
        ${ticketName ? `<p style="margin:0 0 3px;color:#374151;font-size:14px"><strong>Bilhete:</strong> ${escapeHtml(ticketName)}</p>` : ''}
        ${amount ? `<p style="margin:0;color:#374151;font-size:14px"><strong>Valor:</strong> ${escapeHtml(amount)}</p>` : ''}
      </div>
      <p style="margin:0 0 12px;color:#374151">A inscrição foi cancelada e o pagamento marcado como <strong>reembolso pedido</strong>. Processa o reembolso e marca-o como concluído no painel de convites.</p>
      ${link ? `<a href="${escapeHtml(link)}" style="display:inline-block;background:#1f3864;color:#fff;text-decoration:none;padding:10px 18px;border-radius:8px;font-weight:600">Abrir a agenda</a>` : ''}
      <p style="margin:16px 0 0;color:#9ca3af;font-size:12px">Agenda CCLX</p>
    </div>`
  const tx = getTransporter()
  if (!tx) {
    console.log(`\n[email:mock] Pedido de reembolso (${title}) para: ${to}\n`)
    return { mocked: true }
  }
  await tx.sendMail({ from: config.smtp.from, to, subject, text, html })
  return { mocked: false }
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
 * Constrói o assunto e o corpo (texto + HTML) do email de boas-vindas.
 * Separado do envio para permitir pré-visualização e testes.
 */
export function renderWelcomeEmail({ name, link } = {}) {
  const subject = 'Bem-vindo(a) à Agenda CCLX'
  const greeting = name ? `Olá ${name},` : 'Olá,'
  const url = link || 'https://agenda.cclx.pt'

  const text =
    `${greeting}\n\nFoi criada uma conta para si na Agenda CCLX. Seja bem-vindo(a)!` +
    `\n\nJá pode consultar e acompanhar a agenda da igreja em:\n${url}` +
    `\n\nPara entrar, use o seu email — receberá um código de acesso temporário.` +
    `\n\nAgenda CCLX`

  const html = `
    <div style="font-family:Segoe UI,Arial,sans-serif;max-width:480px;margin:0 auto">
      <h2 style="color:#1f2937">Agenda CCLX</h2>
      <p style="margin:0 0 8px">${escapeHtml(greeting)}</p>
      <p style="margin:8px 0;color:#374151">Foi criada uma conta para si na <strong>Agenda CCLX</strong>. Seja bem-vindo(a)!</p>
      <p style="margin:8px 0;color:#374151">Já pode consultar e acompanhar a agenda da igreja:</p>
      <div style="margin:22px 0">
        <a href="${escapeHtml(url)}" style="display:inline-block;padding:10px 22px;border-radius:8px;background:#2563eb;color:#fff;font-weight:700;text-decoration:none">Abrir a agenda</a>
      </div>
      <p style="margin:8px 0;color:#6b7280">Ou copie esta ligação: <a href="${escapeHtml(url)}" style="color:#2563eb">${escapeHtml(url)}</a></p>
      <p style="margin:8px 0;color:#6b7280">Para entrar, use o seu email — receberá um código de acesso temporário.</p>
      <hr style="border:none;border-top:1px solid #e5e7eb;margin:16px 0" />
      <p style="color:#9ca3af;font-size:12px">Mensagem automática da Agenda CCLX.</p>
    </div>`

  return { subject, text, html }
}

/**
 * Envia um email de boas-vindas a um utilizador recém-criado, com uma ligação
 * para a agenda. Sem SMTP configurado, imprime na consola (dev).
 */
export async function sendWelcomeEmail(to, { name, link } = {}) {
  const { subject, text, html } = renderWelcomeEmail({ name, link })

  const tx = getTransporter()
  if (!tx) {
    console.log(
      `\n[email:mock] Para: ${to}\n[email:mock] Boas-vindas à Agenda CCLX\n${link || 'https://agenda.cclx.pt'}\n`
    )
    return { mocked: true }
  }
  await tx.sendMail({ from: config.smtp.from, to, subject, text, html })
  return { mocked: false }
}

/**
 * Pede a um aprovador que aprove/rejeite um evento submetido. Inclui dois botões
 * (Aprovar/Rejeitar) que abrem a página de confirmação /acao com o token.
 */
export async function sendApprovalRequestEmail(to, { name, eventTitle, eventDate, eventTime, community, link }) {
  const title = eventTitle || 'Evento'
  const subject = `Agenda CCLX — Aprovação pendente: ${title}`
  const greeting = name ? `Olá ${name},` : 'Olá,'
  const approveLink = `${link}&a=aprovar`
  const rejectLink = `${link}&a=rejeitar`

  const whenParts = []
  if (eventDate) {
    const [y, m, d] = String(eventDate).split('-')
    if (y && m && d) whenParts.push(`${d}/${m}/${y}`)
  }
  if (eventTime) whenParts.push(eventTime)
  const whenText = whenParts.join(' às ')

  const text =
    `${greeting}\n\nFoi submetido um evento para aprovação.\n\nEvento: ${title}` +
    (whenText ? `\nData: ${whenText}` : '') +
    (community ? `\nComunidade: ${community}` : '') +
    `\n\nAprovar: ${approveLink}\nRejeitar: ${rejectLink}\n\nAgenda CCLX`

  const whenHtml = whenText ? `<p style="margin:6px 0;color:#6b7280">${escapeHtml(whenText)}</p>` : ''
  const communityHtml = community
    ? `<p style="margin:2px 0;color:#6b7280">Comunidade: ${escapeHtml(community)}</p>`
    : ''

  const html = `
    <div style="font-family:Segoe UI,Arial,sans-serif;max-width:480px;margin:0 auto">
      <h2 style="color:#1f2937">Agenda CCLX</h2>
      <p style="margin:0 0 8px">${escapeHtml(greeting)}</p>
      <p style="margin:8px 0;color:#374151">Foi submetido um evento para aprovação:</p>
      <p style="margin:14px 0 2px;font-size:18px;font-weight:700;color:#111827">${escapeHtml(title)}</p>
      ${whenHtml}
      ${communityHtml}
      <div style="margin:22px 0">
        <a href="${approveLink}" style="display:inline-block;margin-right:8px;padding:10px 22px;border-radius:8px;background:#16a34a;color:#fff;font-weight:700;text-decoration:none">Aprovar</a>
        <a href="${rejectLink}" style="display:inline-block;padding:10px 22px;border-radius:8px;background:#dc2626;color:#fff;font-weight:700;text-decoration:none">Rejeitar</a>
      </div>
      <p style="color:#9ca3af;font-size:12px">Abre uma página de confirmação. Ligação válida por 7 dias.</p>
    </div>`

  const tx = getTransporter()
  if (!tx) {
    console.log(`\n[email:mock] Para: ${to}\n[email:mock] Aprovação pendente: ${title}\n${approveLink}\n`)
    return { mocked: true }
  }
  await tx.sendMail({ from: config.smtp.from, to, subject, text, html })
  return { mocked: false }
}

/**
 * Notifica um moderador de que há um pedido de alteração de data/hora a um evento
 * publicado, à espera de aprovação. Liga ao painel de aprovações (sem ação de um
 * clique — a aprovação é feita no painel, revalidando permissões e estado).
 */
export async function sendChangeRequestEmail(to, { name, eventTitle, requesterName, currentWhen, proposedWhen, scope, link }) {
  const title = eventTitle || 'Evento'
  const subject = `Agenda CCLX — Alteração de data pendente: ${title}`
  const greeting = name ? `Olá ${name},` : 'Olá,'
  const scopeText = scope === 'series' ? 'toda a série' : 'apenas esta ocorrência'

  const text =
    `${greeting}\n\nFoi pedida uma alteração de data/hora a um evento publicado.\n\nEvento: ${title}` +
    (requesterName ? `\nPedido por: ${requesterName}` : '') +
    (currentWhen ? `\nData atual: ${currentWhen}` : '') +
    (proposedWhen ? `\nNova data: ${proposedWhen}` : '') +
    `\nÂmbito: ${scopeText}` +
    `\n\nRever e aprovar: ${link}\n\nAgenda CCLX`

  const row = (label, value) =>
    value ? `<p style="margin:2px 0;color:#6b7280">${escapeHtml(label)}: ${escapeHtml(value)}</p>` : ''

  const html = `
    <div style="font-family:Segoe UI,Arial,sans-serif;max-width:480px;margin:0 auto">
      <h2 style="color:#1f2937">Agenda CCLX</h2>
      <p style="margin:0 0 8px">${escapeHtml(greeting)}</p>
      <p style="margin:8px 0;color:#374151">Foi pedida uma alteração de data/hora a um evento publicado:</p>
      <p style="margin:14px 0 2px;font-size:18px;font-weight:700;color:#111827">${escapeHtml(title)}</p>
      ${row('Pedido por', requesterName)}
      ${row('Data atual', currentWhen)}
      ${row('Nova data', proposedWhen)}
      ${row('Âmbito', scopeText)}
      <div style="margin:22px 0">
        <a href="${link}" style="display:inline-block;padding:10px 22px;border-radius:8px;background:#2563eb;color:#fff;font-weight:700;text-decoration:none">Rever no painel de aprovações</a>
      </div>
      <p style="color:#9ca3af;font-size:12px">O evento continua visível com a data atual até a alteração ser aprovada.</p>
    </div>`

  const tx = getTransporter()
  if (!tx) {
    console.log(`\n[email:mock] Para: ${to}\n[email:mock] Alteração pendente: ${title}\n${link}\n`)
    return { mocked: true }
  }
  await tx.sendMail({ from: config.smtp.from, to, subject, text, html })
  return { mocked: false }
}

/**
 * Notifica um editor de que lhe foi atribuída uma delegação de aprovação, com o
 * âmbito (igreja/categoria/período) e um link para o painel de aprovações.
 */
export async function sendDelegationEmail(to, { name, delegatorName, church, category, startDate, endDate, link }) {
  const fmt = (d) => {
    const [y, m, day] = String(d ?? '').split('-')
    return y && m && day ? `${day}/${m}/${y}` : String(d ?? '')
  }
  const subject = 'Agenda CCLX — Nova delegação de aprovação'
  const greeting = name ? `Olá ${name},` : 'Olá,'
  const scopeChurch = church || 'Todas as igrejas'
  const scopeCategory = category || 'Todas as categorias'
  const period = startDate && endDate ? `${fmt(startDate)} a ${fmt(endDate)}` : ''
  const by = delegatorName ? ` por ${delegatorName}` : ''

  const text =
    `${greeting}\n\nFoi-lhe atribuída uma delegação de aprovação${by}.` +
    `\n\nIgreja: ${scopeChurch}\nCategoria: ${scopeCategory}` +
    (period ? `\nPeríodo: ${period}` : '') +
    `\n\nPode aprovar/rejeitar eventos no painel de aprovações:\n${link}\n\nAgenda CCLX`

  const html = `
    <div style="font-family:Segoe UI,Arial,sans-serif;max-width:480px;margin:0 auto">
      <h2 style="color:#1f2937">Agenda CCLX</h2>
      <p style="margin:0 0 8px">${escapeHtml(greeting)}</p>
      <p style="margin:8px 0;color:#374151">Foi-lhe atribuída uma <strong>delegação de aprovação</strong>${escapeHtml(by)}. Passa a poder aprovar/rejeitar eventos no âmbito:</p>
      <ul style="margin:8px 0;color:#374151;padding-left:18px">
        <li>Igreja: <strong>${escapeHtml(scopeChurch)}</strong></li>
        <li>Categoria: <strong>${escapeHtml(scopeCategory)}</strong></li>
        ${period ? `<li>Período: <strong>${escapeHtml(period)}</strong></li>` : ''}
      </ul>
      <div style="margin:22px 0">
        <a href="${link}" style="display:inline-block;padding:10px 22px;border-radius:8px;background:#2563eb;color:#fff;font-weight:700;text-decoration:none">Ir para as aprovações</a>
      </div>
      <p style="color:#9ca3af;font-size:12px">Mensagem automática da Agenda CCLX.</p>
    </div>`

  const tx = getTransporter()
  if (!tx) {
    console.log(`\n[email:mock] Para: ${to}\n[email:mock] Nova delegação de aprovação\n${link}\n`)
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
