import { describe, expect, it } from 'vitest'
import { classifyGuestPeople, isConfirmedRegistration, registrationChurch } from '../components/invite/inviteUtils'

describe('invite management helpers', () => {
  it('counts entries from the children field as children, including age 11', () => {
    const guest = {
      extra: {
        criancas: [{ nome: 'Criança', idade: '11' }],
        numCriancas: 1,
      },
    }

    expect(classifyGuestPeople(guest)).toEqual({ adultos: 1, jovens: 0, criancas: 1, total: 2 })
  })

  it('does not count group children again through numCriancas', () => {
    const guest = {
      extra: {
        membros: [
          { nome: 'Adulto', idade: '35' },
          { nome: 'Criança', idade: '8' },
        ],
        numCriancas: 1,
      },
    }

    expect(classifyGuestPeople(guest)).toEqual({ adultos: 1, jovens: 0, criancas: 1, total: 2 })
  })

  it('only includes registrations with a fully confirmed combined status in people KPIs', () => {
    expect(isConfirmedRegistration({ rsvpState: 'confirmed', paymentState: 'not_applicable' })).toBe(true)
    expect(isConfirmedRegistration({ rsvpState: 'confirmed', paymentState: 'pending' })).toBe(false)
  })

  it('uses the registration answer labelled CCLX community as its church', () => {
    const guest = {
      extra: { comunidade: 'CCLX', outra_igreja: 'Almada' },
      schemaSnapshot: [{ key: 'outra_igreja', label: 'CCLX - comunidade' }],
    }

    expect(registrationChurch(guest)).toBe('Almada')
  })
})