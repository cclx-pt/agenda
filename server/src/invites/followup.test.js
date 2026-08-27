import test from 'node:test'
import assert from 'node:assert/strict'
import { buildFollowupStats } from './followup.js'

test('buildFollowupStats counts registrations and confirmed people by church', () => {
  const tickets = [
    { id: 'family', name: 'Família', kind: 'grupo', childMaxAge: 10, adultMinAge: 18 },
    { id: 'paid', name: 'Pago', kind: 'individual', price: 20 },
  ]
  const guests = [
    {
      ticketId: 'family',
      rsvpState: 'confirmed',
      paymentState: 'paid',
      createdAt: '2026-08-26T23:30:00.000Z',
      extra: {
        comunidade: 'Sede',
        membros: [{ idade: 35 }, { idade: 15 }, { idade: 8 }],
      },
    },
    {
      rsvpState: 'confirmed',
      paymentState: 'not_applicable',
      createdAt: '2026-08-27T10:00:00.000Z',
      extra: { comunidade: 'Porto', numCriancas: 2 },
    },
    {
      rsvpState: 'cancelled',
      paymentState: 'not_applicable',
      extra: { comunidade: 'Sede' },
    },
    {
      ticketId: 'paid',
      rsvpState: 'confirmed',
      paymentState: 'pending',
      extra: { comunidade: 'Almada' },
    },
    {
      rsvpState: 'confirmed',
      paymentState: 'failed',
      createdAt: '2026-08-27T12:00:00.000Z',
      extra: { comunidade: 'Sede' },
    },
  ]

  assert.deepEqual(buildFollowupStats(guests, tickets), {
    registrations: 5,
    confirmedRegistrations: 3,
    situations: {
      confirmada: 3,
      comprovativo: 1,
      validacao: 0,
      espera: 0,
      cancelada: 1,
      reembolso: 0,
      reembolsado: 0,
      expirada: 0,
      pendente: 0,
    },
    people: { adultos: 3, jovens: 1, criancas: 3, total: 7 },
    byChurch: [
      { name: 'Sede', registrations: 2, people: 4, adultos: 2, jovens: 1, criancas: 1 },
      { name: 'Porto', registrations: 1, people: 3, adultos: 1, jovens: 0, criancas: 2 },
    ],
    byTicket: [
      { name: 'Sem bilhete', registrations: 2, people: 4, adultos: 2, jovens: 0, criancas: 2 },
      { name: 'Família', registrations: 1, people: 3, adultos: 1, jovens: 1, criancas: 1 },
    ],
    byDay: [
      { date: '2026-08-27', registrations: 3, people: 7, adultos: 3, jovens: 1, criancas: 3 },
    ],
  })
})

test('buildFollowupStats uses payment statuses only for paid tickets', () => {
  const tickets = [
    { id: 'paid', name: 'Pago', kind: 'individual', price: 20 },
    { id: 'free', name: 'Grátis', kind: 'gratis', price: 0 },
    { id: 'donation', name: 'Doação', kind: 'voluntaria', price: 5 },
  ]
  const guests = [
    { ticketId: 'paid', rsvpState: 'confirmed', paymentState: 'pending', extra: {} },
    { ticketId: 'free', rsvpState: 'confirmed', paymentState: 'pending', extra: {} },
    { ticketId: 'donation', rsvpState: 'confirmed', paymentState: 'awaiting_validation', extra: {} },
    { ticketId: 'donation', rsvpState: 'cancelled', paymentState: 'not_applicable', extra: {} },
  ]

  const stats = buildFollowupStats(guests, tickets)

  assert.equal(stats.situations.comprovativo, 1)
  assert.equal(stats.situations.validacao, 0)
  assert.equal(stats.situations.confirmada, 2)
  assert.equal(stats.situations.cancelada, 1)
  assert.equal(stats.confirmedRegistrations, 2)
  assert.equal(stats.people.total, 2)
})