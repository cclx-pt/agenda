import { config } from '../../config.js'
import { sendInviteCampaignEmail } from '../../auth/email.js'

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
