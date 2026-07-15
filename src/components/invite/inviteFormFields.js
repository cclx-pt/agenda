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
  { type: 'multiselect', label: 'Escolha múltipla' },
  { type: 'checkbox', label: 'Confirmação / consentimento' },
  { type: 'children', label: 'Crianças (repetível)' },
]

export const hasOptions = (type) => type === 'select' || type === 'radio' || type === 'multiselect'

// Validação leve no cliente (o backend revalida via zod).
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const digitsCount = (s) => (String(s).match(/\d/g) || []).length

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

  // Secção condicional: só aparece quando "Vais trazer crianças?" está marcado.
  // Os campos abaixo herdam a visibilidade desta secção (até à secção seguinte).
  {
    key: 'sec_criancas',
    type: 'section',
    label: 'Crianças',
    visibleWhen: { field: 'tem_criancas', equals: true },
  },
  { key: 'criancas', type: 'children', label: 'Dados de cada criança' },

  { key: 'sec_info', type: 'section', label: 'Informações adicionais' },
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

// Conjunto de chaves de campos VISÍVEIS considerando a HERANÇA DE SECÇÃO: uma
// secção pode ser condicional (visibleWhen) e os campos que a seguem (até à
// próxima secção) herdam a sua visibilidade. Um nível só — as secções não aninham.
export function visibleKeys(fields, values) {
  const set = new Set()
  let sectionVisible = true
  for (const f of fields) {
    if (f.type === 'section') {
      sectionVisible = isVisible(f, values)
      if (sectionVisible) set.add(f.key)
      continue
    }
    if (sectionVisible && isVisible(f, values)) set.add(f.key)
  }
  return set
}

// Estado inicial dos valores para uma lista de campos.
export function initialValues(fields) {
  const v = {}
  for (const f of fields) {
    if (f.type === 'section') continue
    if (f.type === 'checkbox') v[f.key] = false
    else if (f.type === 'children' || f.type === 'multiselect') v[f.key] = []
    else v[f.key] = ''
  }
  return v
}

// Valida os campos VISÍVEIS e obrigatórios (+ formato de email/telemóvel).
// Devolve a 1ª mensagem de erro ou null.
export function validateForm(fields, values) {
  const visible = visibleKeys(fields, values)
  for (const f of fields) {
    if (f.type === 'section' || !visible.has(f.key)) continue
    const val = values[f.key]
    const empty =
      f.type === 'checkbox'
        ? !val
        : f.type === 'children' || f.type === 'multiselect'
          ? !Array.isArray(val) || val.length === 0
          : val == null || String(val).trim() === ''
    if (f.required && empty) {
      if (f.type === 'checkbox') return `É necessário confirmar: “${f.label}”.`
      if (f.type === 'children') return `${f.label}: adicione pelo menos uma criança.`
      if (f.type === 'multiselect') return `Selecione pelo menos uma opção em “${f.label}”.`
      return `O campo “${f.label}” é obrigatório.`
    }
    if (!empty && f.type === 'email' && !EMAIL_RE.test(String(val).trim())) {
      return `Email inválido em “${f.label}”.`
    }
    if (!empty && f.type === 'tel' && digitsCount(val) < 9) {
      return `Telemóvel inválido em “${f.label}” (mín. 9 dígitos).`
    }
  }
  return null
}

// Como validateForm mas devolve um mapa { chave: mensagem } de TODOS os campos
// inválidos visíveis (para erros inline). Mensagens curtas.
export function validateFields(fields, values) {
  const visible = visibleKeys(fields, values)
  const errors = {}
  for (const f of fields) {
    if (f.type === 'section' || !visible.has(f.key)) continue
    const val = values[f.key]
    const empty =
      f.type === 'checkbox'
        ? !val
        : f.type === 'children' || f.type === 'multiselect'
          ? !Array.isArray(val) || val.length === 0
          : val == null || String(val).trim() === ''
    if (f.required && empty) {
      errors[f.key] =
        f.type === 'checkbox'
          ? 'É necessário confirmar.'
          : f.type === 'children'
            ? 'Adicione pelo menos uma criança.'
            : f.type === 'multiselect'
              ? 'Selecione pelo menos uma opção.'
              : 'Campo obrigatório.'
      continue
    }
    if (!empty && f.type === 'email' && !EMAIL_RE.test(String(val).trim())) {
      errors[f.key] = 'Email inválido.'
    } else if (!empty && f.type === 'tel' && digitsCount(val) < 9) {
      errors[f.key] = 'Telemóvel inválido (mín. 9 dígitos).'
    }
  }
  return errors
}

// Reparte os valores em campos de sistema (name/email/phone) + `extra` (o resto),
// considerando apenas os campos VISÍVEIS.
export function buildSubmission(fields, values) {
  const visible = visibleKeys(fields, values)
  const extra = {}
  let name = ''
  let email = null
  let phone = null
  for (const f of fields) {
    if (f.type === 'section' || !visible.has(f.key)) continue
    const val = values[f.key]
    if (f.key === 'name') name = String(val ?? '').trim()
    else if (f.key === 'email') email = String(val ?? '').trim() || null
    else if (f.key === 'phone') phone = String(val ?? '').trim() || null
    else if (f.type === 'children') {
      const rows = (Array.isArray(val) ? val : []).filter((c) => c.nome || c.idade || c.alergias)
      if (rows.length) extra[f.key] = rows
    } else if (f.type === 'multiselect') {
      const arr = Array.isArray(val) ? val : []
      if (arr.length) extra[f.key] = arr
    } else if (f.type === 'checkbox') {
      extra[f.key] = !!val
    } else if (val != null && String(val).trim() !== '') {
      extra[f.key] = val
    }
  }
  return { name, email, phone, extra }
}

// Nº de pessoas que a inscrição representa (1 = o próprio + crianças indicadas nos
// campos do tipo 'children' visíveis). Alimenta a contagem de capacidade.
export function countPeople(fields, values) {
  const visible = visibleKeys(fields, values)
  let n = 1
  for (const f of fields) {
    if (f.type !== 'children' || !visible.has(f.key)) continue
    const rows = Array.isArray(values[f.key]) ? values[f.key] : []
    n += rows.filter((c) => c && (c.nome || c.idade || c.alergias)).length
  }
  return n
}
