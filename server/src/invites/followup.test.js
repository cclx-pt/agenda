import test from 'node:test'
import assert from 'node:assert/strict'
import { buildFollowupStats } from './followup.js'

test('buildFollowupStats counts registrations and confirmed people by church', () => {
  const tickets = [{ id: 'family', childMaxAge: 10, adultMinAge: 18 }]
  const guests = [
    {
      ticketId: 'family',
      rsvpState: 'confirmed',
      paymentState: 'paid',
      extra: {
        comunidade: 'Sede',
        membros: [{ idade: 35 }, { idade: 15 }, { idade: 8 }],
      },
    },
    {
      rsvpState: 'confirmed',
      paymentState: 'not_applicable',
      extra: { comunidade: 'Porto', numCriancas: 2 },
    },
    {
      rsvpState: 'cancelled',
      paymentState: 'not_applicable',
      extra: { comunidade: 'Sede' },
    },
    {
      rsvpState: 'confirmed',
      paymentState: 'pending',
      extra: { comunidade: 'Almada' },
    },
    {
      rsvpState: 'confirmed',
      paymentState: 'failed',
      extra: { comunidade: 'Sede' },
    },
  ]

  assert.deepEqual(buildFollowupStats(guests, tickets), {
    registrations: 5,
    confirmedRegistrations: 3,
    people: { adultos: 3, jovens: 1, criancas: 3, total: 7 },
    byChurch: [
      { name: 'Sede', registrations: 2, people: 4 },
      { name: 'Porto', registrations: 1, people: 3 },
    ],
  })
})