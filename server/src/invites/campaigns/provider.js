import { config } from '../../config.js'
import {
  renderInviteCampaignEmail,
  sendInviteCampaignEmail,
} from '../../auth/email.js'

function parseSender(value) {
  const match = String(value).match(/^\s*(.*?)\s*<([^<>]+)>\s*$/)
  if (match) {
    return {
      name: match[1].replace(/^["']|["']$/g, '').trim() || undefined,
      email: match[2].trim(),
    }
  }
  return { email: String(value).trim() }
}

export function nextBrevoDailyRetryAt(now = new Date()) {
  return new Date(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate() + 1,
    0,
    5
  ))
}

function providerError(message, properties = {}) {
  return Object.assign(new Error(message), properties)
}

function brevoErrorMessage(status, detail) {
  const message = detail?.message || detail?.code || `HTTP ${status}`
  return `Brevo recusou a mensagem: ${message}`
}

export function createBrevoProvider({
  apiKey,
  from,
  fetchImpl = fetch,
} = {}) {
  return {
    name: 'brevo',
    capabilities: {
      deliveryWebhooks: false,
      bounceWebhooks: false,
      complaints: false,
      clickTracking: false,
    },
    async send(to, data) {
      if (!apiKey) {
        throw providerError('O fornecedor Brevo não está configurado.', {
          permanent: true,
        })
      }
      const message = renderInviteCampaignEmail(data)
      const response = await fetchImpl('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
          accept: 'application/json',
          'api-key': apiKey,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          sender: parseSender(from),
          to: [{ email: to, name: data.recipientName || undefined }],
          subject: message.subject,
          htmlContent: message.html,
          textContent: message.text,
          headers: message.headers,
        }),
      })
      const detail = await response.json().catch(() => null)
      if (!response.ok) {
        const quotaLimited =
          response.status === 429 ||
          (response.status === 402 &&
            /credit|quota|limit/i.test(
              `${detail?.code ?? ''} ${detail?.message ?? ''}`
            ))
        throw providerError(brevoErrorMessage(response.status, detail), {
          status: response.status,
          code: quotaLimited ? 'daily_quota' : detail?.code,
          retryAt: quotaLimited ? nextBrevoDailyRetryAt() : undefined,
          permanent: response.status === 401 || response.status === 403,
        })
      }
      if (!detail?.messageId) {
        throw new Error('Brevo aceitou o pedido sem devolver o identificador da mensagem.')
      }
      return {
        provider: 'brevo',
        messageId: detail.messageId,
        accepted: true,
      }
    },
  }
}

const providers = {
  smtp: {
    name: 'smtp',
    capabilities: {
      deliveryWebhooks: false,
      bounceWebhooks: false,
      complaints: false,
      clickTracking: false,
    },
    async send(to, data) {
      const result = await sendInviteCampaignEmail(to, data)
      return {
        provider: 'smtp',
        messageId: result.messageId ?? null,
        accepted: true,
      }
    },
  },
  brevo: createBrevoProvider({
    apiKey: config.campaignEmail.brevoApiKey,
    from: config.campaignEmail.from,
  }),
}

export function getCampaignProvider() {
  const provider = providers[config.campaignEmail.provider]
  if (!provider) {
    throw new Error(`Fornecedor de campanhas não suportado: ${config.campaignEmail.provider}`)
  }
  return provider
}

export function getCampaignProviderInfo() {
  const provider = getCampaignProvider()
  return { name: provider.name, capabilities: provider.capabilities }
}
