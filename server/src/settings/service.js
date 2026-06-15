import { z } from 'zod'
import { config } from '../config.js'
import * as repo from './repository.js'

// Chave da definição da integração com a inChurch.
const KEY = 'inchurch_integration'

const DEFAULTS = { enabled: true }

export const integrationSchema = z.object({
  enabled: z.boolean(),
})

/** Definição em bruto (apenas o interruptor), com o valor por omissão. */
export async function getRawIntegration() {
  const stored = await repo.get(KEY)
  // Compatibilidade com o formato antigo (syncEnabled) — assume ativo se ausente.
  const enabled =
    typeof stored?.enabled === 'boolean'
      ? stored.enabled
      : typeof stored?.syncEnabled === 'boolean'
        ? stored.syncEnabled
        : DEFAULTS.enabled
  return { enabled }
}

/**
 * Definição para a UI: interruptor + contexto só de leitura (base URL e se as
 * credenciais estão configuradas). As credenciais nunca são expostas.
 */
export async function getIntegration() {
  const settings = await getRawIntegration()
  return {
    ...settings,
    baseUrl: config.inradar.baseUrl,
    credentialsConfigured: Boolean(config.inradar.apiKey && config.inradar.apiSecret),
  }
}

/** Valida e persiste o interruptor; devolve a definição completa para a UI. */
export async function updateIntegration(input, actorId) {
  const data = integrationSchema.parse(input)
  await repo.set(KEY, data, actorId)
  return getIntegration()
}
