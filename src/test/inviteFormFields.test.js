import { describe, it, expect } from 'vitest'
import {
  DEFAULT_RSVP_FIELDS,
  getFormFields,
  mergeFormSchemas,
  fieldLabel,
  deriveKey,
  isVisible,
  visibleKeys,
  initialValues,
  validateForm,
  validateFields,
  buildSubmission,
  countPeople,
  countChildren,
  hasOptions,
  SYSTEM_KEYS,
} from '../components/invite/inviteFormFields'

describe('inviteFormFields', () => {
  it('getFormFields devolve DEFAULT quando não há campos configurados', () => {
    expect(getFormFields({})).toBe(DEFAULT_RSVP_FIELDS)
    expect(getFormFields({ fields: [] })).toBe(DEFAULT_RSVP_FIELDS)
    const custom = [{ key: 'name', type: 'text', label: 'Nome' }]
    expect(getFormFields({ fields: custom })).toBe(custom)
  })

  it('mergeFormSchemas junta o schema atual com snapshots (sem duplicar keys)', () => {
    const current = [
      { key: 'name', type: 'text', label: 'Nome' },
      { key: 'idade', type: 'number', label: 'Idade' },
    ]
    // Snapshot de uma inscrição antiga: 'idade' com rótulo diferente + campo removido 'antigo'.
    const snap = [
      { key: 'name', type: 'text', label: 'Nome completo' },
      { key: 'idade', type: 'number', label: 'A tua idade' },
      { key: 'antigo', type: 'text', label: 'Campo antigo' },
    ]
    const merged = mergeFormSchemas(current, [snap, null, undefined])
    // Schema atual primeiro (o seu rótulo vence); campos órfãos do snapshot a seguir.
    expect(merged.map((f) => f.key)).toEqual(['name', 'idade', 'antigo'])
    expect(merged.find((f) => f.key === 'idade').label).toBe('Idade')
    expect(merged.find((f) => f.key === 'antigo').label).toBe('Campo antigo')
  })

  it('mergeFormSchemas é robusto a entradas inválidas', () => {
    expect(mergeFormSchemas()).toEqual([])
    expect(mergeFormSchemas(null, null)).toEqual([])
    expect(mergeFormSchemas([{ type: 'section' }], [])).toEqual([]) // sem key → ignorado
  })

  it('fieldLabel devolve o rótulo do snapshot ou a própria chave', () => {
    const snap = [{ key: 'profissao', type: 'text', label: 'Profissão' }]
    expect(fieldLabel(snap, 'profissao')).toBe('Profissão')
    expect(fieldLabel(snap, 'inexistente')).toBe('inexistente')
    expect(fieldLabel(null, 'x')).toBe('x')
  })

  it('deriveKey normaliza acentos e garante unicidade', () => {
    expect(deriveKey('Nome Completo')).toBe('nome_completo')
    expect(deriveKey('Ação!')).toBe('acao')
    expect(deriveKey('Nome', ['nome'])).toBe('nome_2')
    expect(deriveKey('Nome', ['nome', 'nome_2'])).toBe('nome_3')
    expect(deriveKey('', [])).toBe('campo')
  })

  it('isVisible respeita visibleWhen (checkbox booleano e select)', () => {
    const kids = { key: 'kids', type: 'children', visibleWhen: { field: 'tem', equals: true } }
    expect(isVisible(kids, { tem: true })).toBe(true)
    expect(isVisible(kids, { tem: false })).toBe(false)
    const outra = { key: 'outra', type: 'text', visibleWhen: { field: 'com', equals: 'Outra igreja' } }
    expect(isVisible(outra, { com: 'Outra igreja' })).toBe(true)
    expect(isVisible(outra, { com: 'Sede' })).toBe(false)
    expect(isVisible({ key: 'z', type: 'text' }, {})).toBe(true)
  })

  it('visibleKeys aplica herança de secção (um nível)', () => {
    const fields = [
      { key: 'tem', type: 'checkbox' },
      { key: 'sec', type: 'section', visibleWhen: { field: 'tem', equals: true } },
      { key: 'nome', type: 'text' },
      { key: 'sec2', type: 'section' },
      { key: 'fora', type: 'text' },
    ]
    const off = visibleKeys(fields, { tem: false })
    expect(off.has('sec')).toBe(false)
    expect(off.has('nome')).toBe(false) // herda a secção oculta
    expect(off.has('fora')).toBe(true) // após nova secção → visível
    const on = visibleKeys(fields, { tem: true })
    expect(on.has('sec')).toBe(true)
    expect(on.has('nome')).toBe(true)
    expect(on.has('fora')).toBe(true)
  })

  it('initialValues gera defaults por tipo (section ignorada)', () => {
    const v = initialValues([
      { key: 'sec', type: 'section' },
      { key: 'n', type: 'text' },
      { key: 'ok', type: 'checkbox' },
      { key: 'kids', type: 'children' },
      { key: 'ms', type: 'multiselect' },
    ])
    expect(v).toEqual({ n: '', ok: false, kids: [], ms: [] })
    expect('sec' in v).toBe(false)
  })

  it('validateForm exige campos obrigatórios visíveis', () => {
    const fields = [
      { key: 'name', type: 'text', label: 'Nome', required: true },
      { key: 'ok', type: 'checkbox', label: 'Aceito', required: true },
    ]
    expect(validateForm(fields, { name: '', ok: false })).toMatch(/Nome/)
    expect(validateForm(fields, { name: 'Ana', ok: false })).toMatch(/Aceito/)
    expect(validateForm(fields, { name: 'Ana', ok: true })).toBeNull()
  })

  it('validateForm ignora campos ocultos por condição', () => {
    const fields = [
      { key: 'tem', type: 'checkbox', label: 'Tem?' },
      { key: 'quantos', type: 'number', label: 'Quantos', required: true, visibleWhen: { field: 'tem', equals: true } },
    ]
    expect(validateForm(fields, { tem: false, quantos: '' })).toBeNull()
    expect(validateForm(fields, { tem: true, quantos: '' })).toMatch(/Quantos/)
  })

  it('validateForm valida formato de email e telemóvel', () => {
    const fields = [
      { key: 'email', type: 'email', label: 'Email' },
      { key: 'phone', type: 'tel', label: 'Telemóvel' },
    ]
    expect(validateForm(fields, { email: 'invalido', phone: '' })).toMatch(/Email/)
    expect(validateForm(fields, { email: 'a@b.pt', phone: '123' })).toMatch(/Telemóvel/)
    expect(validateForm(fields, { email: 'a@b.pt', phone: '912 345 678' })).toBeNull()
  })

  it('validateForm exige multiselect e children obrigatórios', () => {
    const fields = [
      { key: 'dias', type: 'multiselect', label: 'Dias', required: true, options: ['Sex', 'Sáb'] },
      { key: 'kids', type: 'children', label: 'Crianças', required: true },
    ]
    expect(validateForm(fields, { dias: [], kids: [] })).toMatch(/Dias/)
    expect(validateForm(fields, { dias: ['Sex'], kids: [] })).toMatch(/Crianças/)
    expect(validateForm(fields, { dias: ['Sex'], kids: [{ nome: 'A' }] })).toBeNull()
  })

  it('buildSubmission separa campos de sistema de extra e ignora ocultos', () => {
    const fields = [
      { key: 'name', type: 'text' },
      { key: 'email', type: 'email' },
      { key: 'phone', type: 'tel' },
      { key: 'comunidade', type: 'select', options: ['Sede', 'Outra'] },
      { key: 'outra', type: 'text', visibleWhen: { field: 'comunidade', equals: 'Outra' } },
      { key: 'dias', type: 'multiselect' },
      { key: 'ok', type: 'checkbox' },
      { key: 'kids', type: 'children' },
    ]
    const values = {
      name: ' Ana ',
      email: 'ana@x.pt',
      phone: '912345678',
      comunidade: 'Sede',
      outra: 'Escondida',
      dias: ['Sex', 'Sáb'],
      ok: true,
      kids: [
        { nome: 'Zé', idade: '5', alergias: '' },
        { nome: '', idade: '', alergias: '' },
      ],
    }
    const out = buildSubmission(fields, values)
    expect(out.name).toBe('Ana')
    expect(out.email).toBe('ana@x.pt')
    expect(out.phone).toBe('912345678')
    expect(out.extra.comunidade).toBe('Sede')
    expect(out.extra.outra).toBeUndefined() // oculto → não submetido
    expect(out.extra.dias).toEqual(['Sex', 'Sáb'])
    expect(out.extra.ok).toBe(true)
    expect(out.extra.kids).toEqual([{ nome: 'Zé', idade: '5', alergias: '' }])
  })

  it('validateFields devolve um mapa de erros por campo (para erros inline)', () => {
    const fields = [
      { key: 'name', type: 'text', label: 'Nome', required: true },
      { key: 'email', type: 'email', label: 'Email' },
      { key: 'ok', type: 'checkbox', label: 'Aceito', required: true },
      { key: 'dias', type: 'multiselect', label: 'Dias', required: true, options: ['Sex'] },
    ]
    const errs = validateFields(fields, { name: '', email: 'mau', ok: false, dias: [] })
    expect(errs.name).toBe('Campo obrigatório.')
    expect(errs.email).toBe('Email inválido.')
    expect(errs.ok).toMatch(/confirmar/)
    expect(errs.dias).toMatch(/Selecione/)
    expect(validateFields(fields, { name: 'Ana', email: 'a@b.pt', ok: true, dias: ['Sex'] })).toEqual({})
  })

  it('hasOptions cobre select/radio/multiselect', () => {
    expect(hasOptions('select')).toBe(true)
    expect(hasOptions('radio')).toBe(true)
    expect(hasOptions('multiselect')).toBe(true)
    expect(hasOptions('text')).toBe(false)
  })

  it('countPeople conta só o próprio — as crianças não contam para a assistência', () => {
    const fields = [
      { key: 'tem', type: 'checkbox' },
      { key: 'kids', type: 'children', visibleWhen: { field: 'tem', equals: true } },
    ]
    expect(countPeople(fields, { tem: false, kids: [] })).toBe(1)
    expect(countPeople(fields, { tem: true, kids: [{ nome: 'A' }, { nome: 'B' }] })).toBe(1)
  })

  it('countChildren conta as crianças visíveis (não vazias)', () => {
    const fields = [
      { key: 'tem', type: 'checkbox' },
      { key: 'kids', type: 'children', visibleWhen: { field: 'tem', equals: true } },
    ]
    expect(countChildren(fields, { tem: true, kids: [{ nome: 'A' }, { nome: 'B' }] })).toBe(2)
    // crianças ocultas (tem=false) não contam mesmo que existam linhas
    expect(countChildren(fields, { tem: false, kids: [{ nome: 'A' }] })).toBe(0)
    // linhas vazias não contam
    expect(countChildren(fields, { tem: true, kids: [{ nome: '', idade: '', alergias: '' }] })).toBe(0)
  })

  it('DEFAULT_RSVP_FIELDS inclui campos de sistema e consentimentos obrigatórios', () => {
    const keys = DEFAULT_RSVP_FIELDS.map((f) => f.key)
    for (const k of SYSTEM_KEYS) expect(keys).toContain(k)
    expect(keys).toContain('consent_privacy')
    expect(DEFAULT_RSVP_FIELDS.find((f) => f.key === 'consent_privacy').required).toBe(true)
    expect(DEFAULT_RSVP_FIELDS.find((f) => f.key === 'consent_media').required).toBe(true)
  })
})
