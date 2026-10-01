import { describe, expect, it } from 'vitest'
import { filterInviteSubmissions, publishedInvites } from '../components/invite/inviteSubmissionFilters'

const registrations = [
  {
    id: 'private-family',
    inviteId: 'conference-2026',
    name: 'Ana Silva',
    phone: '+351 912 345 678',
    email: 'ana@example.com',
    rsvpState: 'confirmed',
    paymentState: 'paid',
    isPrivateRegistration: true,
    ticket: { name: 'Família' },
    extra: { membros: [{ nome: 'Ana', idade: 35 }, { nome: 'Filho', idade: 8 }] },
  },
  {
    id: 'public-adult',
    inviteId: 'conference-2026',
    name: 'Bruno Costa',
    phone: '963 000 111',
    email: 'bruno@example.com',
    rsvpState: 'confirmed',
    paymentState: 'not_applicable',
    isPrivateRegistration: false,
    ticket: { name: 'Individual' },
    extra: {},
  },
]

const emptyFilters = {
  invite: '',
  church: '',
  ticket: '',
  situacao: '',
  payment: '',
  access: '',
  people: '',
  name: '',
  phone: '',
  email: '',
}

describe('registration management filters', () => {
  it('only exposes published invites to registration management', () => {
    const invites = [
      { id: 'published', status: 'publicado' },
      { id: 'draft', status: 'rascunho' },
      { id: 'closed', status: 'fechado' },
    ]

    expect(publishedInvites(invites).map((invite) => invite.id)).toEqual(['published'])
  })

  it('filters private registrations with children', () => {
    const result = filterInviteSubmissions(registrations, {
      ...emptyFilters,
      access: 'private',
      people: 'with-children',
    })

    expect(result.map((registration) => registration.id)).toEqual(['private-family'])
  })

  it('filters public registrations without children', () => {
    const result = filterInviteSubmissions(registrations, {
      ...emptyFilters,
      access: 'public',
      people: 'without-children',
    })

    expect(result.map((registration) => registration.id)).toEqual(['public-adult'])
  })

  it('combines name, mobile phone, status and ticket filters', () => {
    const result = filterInviteSubmissions(registrations, {
      ...emptyFilters,
      name: 'ana',
      phone: '912345',
      situacao: 'confirmada',
      ticket: 'Família',
    })

    expect(result.map((registration) => registration.id)).toEqual(['private-family'])
  })
})
