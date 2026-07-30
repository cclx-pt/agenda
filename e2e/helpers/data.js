// Constantes partilhadas + fábricas de dados para os testes E2E dos convites.
// Todos os títulos começam por E2E_PREFIX → o global-teardown limpa o que sobrar.

export const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL || 'admin@cclx.pt'
export const DEV_OTP = process.env.E2E_DEV_OTP || '000000'
export const ADMIN_STATE = 'e2e/.auth/admin.json'
export const E2E_PREFIX = 'E2E'

// Formulário RSVP mínimo e determinístico (só nome/email/telemóvel; nome
// obrigatório). Evita os consentimentos/condicionais da estrutura predefinida,
// tornando o preenchimento do formulário público simples e estável nos testes.
export const MINIMAL_FORM = [
  { key: 'name', type: 'text', label: 'Nome', required: true },
  { key: 'email', type: 'email', label: 'Email' },
  { key: 'phone', type: 'tel', label: 'Telemóvel' },
]

// Blocos que replicam a semente do backend, mas com o formulário RSVP injetado
// no bloco `rsvp` (via PUT /:id/blocks). Mantém banner/pagamento/partilha.
export function blocksWithForm(fields = MINIMAL_FORM, ctaLabel = 'Inscrever-me') {
  return [
    { type: 'banner', visible: true, content: {} },
    { type: 'rsvp', visible: true, content: { ctaLabel, fields } },
    { type: 'pagamento', visible: true, content: {} },
    { type: 'partilha', visible: true, content: {} },
  ]
}

let counter = 0
// Título único (e portanto slug único) por teste; prefixado para o teardown.
export function uniqueTitle(flow) {
  counter += 1
  const stamp = `${Date.now().toString(36)}-${counter}-${Math.random().toString(36).slice(2, 6)}`
  return `${E2E_PREFIX} ${flow} ${stamp}`
}

// Uma data ISO no futuro/passado (dias relativos a agora) para janelas de inscrição.
export function isoInDays(days, { hour = 12 } = {}) {
  const d = new Date()
  d.setDate(d.getDate() + days)
  d.setHours(hour, 0, 0, 0)
  return d.toISOString()
}
