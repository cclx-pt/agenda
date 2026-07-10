import { config } from '../../config.js'

/**
 * CONECTOR DE PAGAMENTO — ponto de extensão.
 * ==========================================
 * Um conector liga o fluxo de pagamento dos convites a um fornecedor real
 * (MB WAY, Multibanco/ifthenpay, easypay, Stripe, …). Para adicionar um
 * fornecedor MAIS TARDE, cria-se UM módulo que implementa este contrato e
 * regista-se com `registerConnector(...)`; depois basta pôr `payment_provider`
 * do convite (ou PAYMENTS_PROVIDER) com o `name` do conector. Nada mais muda.
 *
 * Contrato de um conector:
 *   name: string                         // identificador único
 *   supportedMethods: string[]           // subconjunto de ['mbway','transferencia','referencia']
 *   async createCharge(ctx) → ChargeResult
 *       ctx = { invite, guest, payment, method, amount, currency }
 *       ChargeResult = {
 *         status: 'pending' | 'awaiting_validation',   // estado inicial do pagamento
 *         providerRef?: string,                        // id/referência do fornecedor
 *         providerPayload?: object,                    // dados crus do fornecedor
 *         instructions?: object,                       // o que mostrar ao convidado
 *       }
 *   async refreshStatus?(ctx) → { status, paidAt? }    // sondagem opcional
 *   verifyWebhook?(req) → boolean                       // valida assinatura/segredo do callback
 *   parseWebhook?(body) → { providerRef, status, paidAt? }  // mapeia callback → estado
 *
 * O conector 'manual' (default) NÃO fala com nenhum fornecedor:
 *   - transferencia → devolve as instruções (IBAN/beneficiário) e fica 'pending';
 *     o convidado carrega o comprovativo → 'awaiting_validation'; o organizador
 *     valida manualmente → 'paid'.
 *   - referencia → gera uma referência LOCAL de exemplo (um conector real geraria
 *     uma referência Multibanco válida via fornecedor); fica 'pending' até validação.
 *   - mbway → indisponível no conector manual (precisa de um fornecedor real).
 */

// ── Erro de conector (método/fornecedor indisponível) ────────────
export class ConnectorError extends Error {
  constructor(message, code = 'CONNECTOR_ERROR') {
    super(message)
    this.name = 'ConnectorError'
    this.code = code
  }
}

// ── Conector "manual" (por omissão) ──────────────────────────────
const manualConnector = {
  name: 'manual',
  supportedMethods: ['transferencia', 'referencia'],

  async createCharge({ method, amount, currency }) {
    if (method === 'transferencia') {
      return {
        status: 'pending',
        instructions: {
          type: 'transfer',
          iban: config.payments.iban,
          beneficiary: config.payments.beneficiary,
          amount,
          currency,
          note: 'Faça a transferência e depois carregue o comprovativo.',
        },
      }
    }
    if (method === 'referencia') {
      // Referência LOCAL de exemplo (9 dígitos). Um conector real substitui isto
      // por uma referência Multibanco emitida pelo fornecedor.
      const reference = String(Math.floor(100000000 + Math.random() * 900000000))
      const entity = config.payments.mbEntity
      return {
        status: 'pending',
        providerRef: reference,
        providerPayload: { entity, reference },
        instructions: { type: 'reference', entity, reference, amount, currency },
      }
    }
    throw new ConnectorError(
      'Método indisponível. Configure um conector de pagamento para MB WAY.',
      'METHOD_UNSUPPORTED'
    )
  },

  // O conector manual não confirma automaticamente (validação é do organizador).
  verifyWebhook() {
    return false
  },
}

// ── Registo de conectores ────────────────────────────────────────
const connectors = new Map()

export function registerConnector(connector) {
  if (!connector?.name) throw new Error('Conector sem "name".')
  connectors.set(connector.name, connector)
}

// Devolve o conector pedido, ou o 'manual' se não existir/for nulo.
export function getConnector(name) {
  return connectors.get(name) || connectors.get('manual')
}

export function listConnectors() {
  return [...connectors.keys()]
}

registerConnector(manualConnector)

// Provider por omissão (env). Um convite pode sobrepor via `payment_provider`.
export const DEFAULT_PROVIDER = config.payments.provider
