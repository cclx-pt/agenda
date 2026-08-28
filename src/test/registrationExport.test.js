import { describe, expect, it } from 'vitest'
import { buildRegistrationKit, inviteFormColumns, inviteExportSlug } from '../components/invite/registrationExport'

const invite = { id: 'inv1', slug: 'conf-2026', title: 'Conferência CCLX 2026', community: 'Porto', status: 'publicado' }
const guests = [
  {
    id: 'g1',
    code: 'AB12-CD34',
    name: 'Maria',
    email: 'maria@example.pt',
    phone: '912345678',
    rsvpState: 'confirmed',
    paymentState: 'not_applicable',
    guestsCount: 1,
    ticket: { name: 'Adulto', kind: 'individual', price: 0 },
    respondedAt: '2026-09-01T10:00:00Z',
    createdAt: '2026-09-01T10:00:00Z',
    schemaSnapshot: [
      { key: 'sec', type: 'section', label: 'Dados' },
      { key: 'name', type: 'text', label: 'Nome' },
      { key: 'comunidade', type: 'select', label: 'Comunidade CCLX', options: ['Porto', 'Sede'] },
      { key: 'dias', type: 'radio', label: 'Dias', options: ['Sábado', 'Domingo'] },
    ],
    extra: { comunidade: 'Porto', dias: 'Sábado' },
  },
]

describe('registration export kit', () => {
  it('derives per-invite fields from the form snapshot (no system/section fields)', () => {
    const fields = inviteFormColumns(guests)
    expect(fields.map((f) => f.key)).toEqual(['comunidade', 'dias'])
  })

  it('names the files after the invite slug', () => {
    const kit = buildRegistrationKit(invite, guests)
    expect(kit.dataFile).toBe('conf-2026-inscricoes.json')
    expect(kit.schemaFile).toBe('conf-2026-schema.json')
    expect(kit.mdFile).toBe('conf-2026-dashboard-instrucoes.md')
  })

  it('builds a dataset with standard columns and the invite-specific answers', () => {
    const kit = buildRegistrationKit(invite, guests)
    const row = kit.data[0]
    expect(row.nome).toBe('Maria')
    expect(row.igreja).toBe('Porto')
    expect(row.totalPessoas).toBe(1)
    expect(row.respostas).toEqual({ comunidade: 'Porto', dias: 'Sábado' })
  })

  it('builds a JSON schema whose respostas reflect this invite fields', () => {
    const kit = buildRegistrationKit(invite, guests)
    const props = kit.schema.items.properties.respostas.properties
    expect(Object.keys(props)).toEqual(['comunidade', 'dias'])
    expect(props.comunidade.enum).toContain('Porto')
  })

  it('produces markdown with the field label, filenames and the AI prompt', () => {
    const kit = buildRegistrationKit(invite, guests)
    expect(kit.markdown).toContain('Comunidade CCLX')
    expect(kit.markdown).toContain('conf-2026-inscricoes.json')
    expect(kit.markdown).toContain('conf-2026-schema.json')
    expect(kit.markdown).toContain('Dashboard de gestão de inscrições — Conferência CCLX 2026')
  })

  it('falls back to a slug derived from the title when there is no slug', () => {
    expect(inviteExportSlug({ title: 'Acampamento Jovem 2026' })).toBe('acampamento-jovem-2026')
  })
})
