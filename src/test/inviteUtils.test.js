import { describe, expect, it } from 'vitest'
import {
  classifyGuestPeople,
  inviteHomeHref,
  inviteRsvpHref,
  isConfirmedRegistration,
  registrationTypeTotals,
  registrationChurch,
} from '../components/invite/inviteUtils'

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

  it('preserves private registration access while navigating the invite', () => {
    window.history.replaceState({}, '', '/invite/evento/inscricao?private=private-token-123456')

    expect(inviteRsvpHref('evento', 'ticket-1')).toBe(
      '/invite/evento/inscricao?private=private-token-123456&ticket=ticket-1'
    )
    expect(inviteHomeHref('evento')).toBe('/invite/evento?private=private-token-123456')
  })

  it('adds multiple unticketed rows to the registration total without treating them as tickets', () => {
    const guests = [
      { ticket: { id: 'ticket-1' }, rsvpState: 'confirmed', paymentState: 'paid' },
      {
        ticket: { id: 'ticket-1' },
        isPrivateRegistration: true,
        rsvpState: 'confirmed',
        paymentState: 'not_applicable',
        extra: { numCriancas: 1 },
      },
      { ticket: { id: 'ticket-1' }, rsvpState: 'declined', paymentState: 'not_applicable' },
    ]

    expect(registrationTypeTotals(guests, [{ spots: 3 }, { spots: 2 }])).toEqual({
      ticket: 1,
      privateTicket: 2,
      unticketed: 5,
      total: 8,
    })
  })
})