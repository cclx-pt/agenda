// Modelo de campos do formulário de inscrição (RSVP) — configurável por convite.
// Um formulário é uma lista ORDENADA de campos guardada em `rsvp.content.fields`.
// Sem componentes aqui (evita o aviso react-refresh nos ficheiros de UI).

// Campos "de sistema": ligam-se às colunas do convidado (invite_guests); os
// restantes vão para o JSONB `extra`. `name` é obrigatório e não removível.
export const SYSTEM_KEYS = ['name', 'email', 'phone']
export const isSystemKey = (k) => SYSTEM_KEYS.includes(k)

// Tipos de campo disponíveis no construtor.
export const FIELD_TYPES = [
  { type: 'section', label: 'Secção (título)' },
  { type: 'text', label: 'Texto' },
  { type: 'textarea', label: 'Texto longo' },
  { type: 'email', label: 'Email' },
  { type: 'tel', label: 'Telemóvel' },
  { type: 'number', label: 'Número' },
  { type: 'select', label: 'Lista suspensa' },
  { type: 'radio', label: 'Escolha única' },
  { type: 'checkbox', label: 'Confirmação / consentimento' },
  { type: 'children', label: 'Crianças (repetível)' },
]

export const hasOptions = (type) => type === 'select' || type === 'radio'

// Estrutura predefinida (usada em convites novos ou sem formulário configurado).
export const DEFAULT_RSVP_FIELDS = [
  { key: 'sec_dados', type: 'section', label: 'Dados pessoais' },
  { key: 'name', type: 'text', label: 'Nome completo', required: true },
  { key: 'email', type: 'email', label: 'Email', required: true },
  { key: 'phone', type: 'tel', label: 'Telemóvel', required: true },

  { key: 'sec_igreja', type: 'section', label: 'Igreja' },
  {
    key: 'comunidade',
    type: 'select',
    label: 'Comunidade CCLX',
    required: true,
    options: ['Sede', 'Açores', 'Almada', 'Barreiro', 'Caldas Da Rainha', 'Coruche', 'Moita', 'Porto', 'Outra igreja'],
  },
  {
    key: 'outra_igreja',
    type: 'text',
    label: 'Outra igreja',
    required: true,
    visibleWhen: { field: 'comunidade', equals: 'Outra igreja' },
  },

  { key: 'sec_participacao', type: 'section', label: 'Participação' },
  {
    key: 'dias',
    type: 'select',
    label: 'Em que dias vais participar?',
    required: true,
    options: ['Sexta', 'Sábado', 'Domingo', 'Todo o fim de semana'],
  },
  { key: 'tem_criancas', type: 'checkbox', label: 'Vais trazer crianças?' },
  {
    key: 'criancas',
    type: 'children',
    label: 'Crianças',
    visibleWhen: { field: 'tem_criancas', equals: true },
  },
  { key: 'acessibilidade', type: 'textarea', label: 'Tens alguma necessidade de acessibilidade?' },
  { key: 'donativo', type: 'number', label: 'Valor do donativo (caso seja variável)' },

  { key: 'sec_consentimentos', type: 'section', label: 'Consentimentos' },
  {
    key: 'consent_media',
    type: 'checkbox',
    required: true,
    label: 'Autorizo a utilização de fotografias e vídeo captados durante a conferência para comunicação da CCLX.',
  },
  {
    key: 'consent_privacy',
    type: 'checkbox',
    required: true,
    label: 'Aceito a Política de Privacidade e tratamento dos meus dados.',
  },
]

// Devolve os campos configurados de um bloco RSVP (ou a estrutura predefinida).
export function getFormFields(content) {
  const f = content?.fields
  return Array.isArray(f) && f.length ? f : DEFAULT_RSVP_FIELDS
}

// Gera uma chave estável e única a partir de um rótulo.
export function deriveKey(label, taken = []) {
  const base =
    String(label || 'campo')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 40) || 'campo'
  let key = base
  let i = 2
  while (taken.includes(key)) {
    key = `${base}_${i}`
    i += 1
  }
  return key
}

// Avalia a condição de visibilidade de um campo face aos valores atuais.
export function isVisible(field, values) {
  const cond = field.visibleWhen
  if (!cond || !cond.field) return true
  return String(values[cond.field] ?? '') === String(cond.equals ?? '')
}

// Estado inicial dos valores para uma lista de campos.
export function initialValues(fields) {
  const v = {}
  for (const f of fields) {
    if (f.type === 'section') continue
    if (f.type === 'checkbox') v[f.key] = false
    else if (f.type === 'children') v[f.key] = []
    else v[f.key] = ''
  }
  return v
}

// Valida os campos VISÍVEIS e obrigatórios. Devolve a 1ª mensagem de erro ou null.
export function validateForm(fields, values) {
  for (const f of fields) {
    if (f.type === 'section' || !isVisible(f, values)) continue
    if (!f.required) continue
    const val = values[f.key]
    if (f.type === 'checkbox') {
      if (!val) return `É necessário confirmar: “${f.label}”.`
    } else if (f.type === 'children') {
      if (!Array.isArray(val) || val.length === 0) return `${f.label}: adicione pelo menos uma criança.`
    } else if (val == null || String(val).trim() === '') {
      return `O campo “${f.label}” é obrigatório.`
    }
  }
  return null
}

// Reparte os valores em campos de sistema (name/email/phone) + `extra` (o resto),
// considerando apenas os campos VISÍVEIS.
export function buildSubmission(fields, values) {
  const extra = {}
  let name = ''
  let email = null
  let phone = null
  for (const f of fields) {
    if (f.type === 'section' || !isVisible(f, values)) continue
    const val = values[f.key]
    if (f.key === 'name') name = String(val ?? '').trim()
    else if (f.key === 'email') email = String(val ?? '').trim() || null
    else if (f.key === 'phone') phone = String(val ?? '').trim() || null
    else if (f.type === 'children') {
      const rows = (Array.isArray(val) ? val : []).filter((c) => c.nome || c.idade || c.alergias)
      if (rows.length) extra[f.key] = rows
    } else if (f.type === 'checkbox') {
      extra[f.key] = !!val
    } else if (val != null && String(val).trim() !== '') {
      extra[f.key] = val
    }
  }
  return { name, email, phone, extra }
}
