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
  // Tipos que o conector manual trata (todos exceto o integrado mbway-contribuir).
  supportedMethods: ['mbway', 'transferencia', 'referencia-multibanco', 'numerario'],
  // Suporta qualquer TIPO exceto o integrado (mbway-contribuir → JotForm no frontend).
  supports(method, type) {
    return type !== 'mbway-contribuir'
  },

  // O comportamento é decidido pelo TIPO do método (não pela chave): assim podem
  // existir vários métodos do mesmo tipo com nomes diferentes.
  async createCharge({ method, type, amount, currency, paymentInfo, numbers, ticketEntity, ticketReference }) {
    // Dados de pagamento das Definições de convites; recurso a config (env).
    const iban = paymentInfo?.iban || config.payments.iban
    const beneficiary = paymentInfo?.beneficiary || config.payments.beneficiary
    const mbEntity = paymentInfo?.mbEntity || config.payments.mbEntity

    if (type === 'transferencia') {
      return {
        status: 'pending',
        instructions: {
          type: 'transfer',
          iban,
          beneficiary,
          amount,
          currency,
          note: 'Faça a transferência e depois carregue o comprovativo.',
        },
      }
    }
    if (type === 'referencia-multibanco') {
      // Entidade + referência DEFINIDAS NO BILHETE (recurso à entidade global).
      const entity = ticketEntity || mbEntity
      const reference = ticketReference || ''
      return {
        status: 'pending',
        providerRef: reference || null,
        providerPayload: { instrType: 'reference', entity, reference },
        instructions: {
          type: 'reference',
          entity,
          reference,
          amount,
          currency,
          note: 'Pague por referência Multibanco e depois carregue o comprovativo.',
        },
      }
    }
    if (type === 'mbway') {
      // MB WAY manual: enviar o valor para um dos números indicados + comprovativo.
      const nums = Array.isArray(numbers) ? numbers : []
      return {
        status: 'pending',
        providerPayload: { instrType: 'mbway', numbers: nums },
        instructions: {
          type: 'mbway',
          numbers: nums,
          amount,
          currency,
          note: 'Envie o valor por MB WAY para um dos números indicados e depois carregue o comprovativo.',
        },
      }
    }
    if (type === 'numerario') {
      return {
        status: 'pending',
        instructions: {
          type: 'cash',
          amount,
          currency,
          note: 'Pague em numerário junto de um líder, banca da igreja ou livraria, e depois carregue o comprovativo.',
        },
      }
    }
    if (type === 'mbway-contribuir') {
      throw new ConnectorError('Método com integração (JotForm). Use o fluxo dedicado.', 'METHOD_UNSUPPORTED')
    }
    // Tipo desconhecido (dados antigos) → pagamento manual genérico.
    return {
      status: 'pending',
      instructions: {
        type: 'custom',
        method,
        amount,
        currency,
        note: 'Siga as instruções do organizador para concluir o pagamento e depois carregue o comprovativo.',
      },
    }
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
