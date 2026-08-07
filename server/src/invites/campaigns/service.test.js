import test from 'node:test'
import assert from 'node:assert/strict'
import { resolveAudience } from './service.js'
import { renderInviteCampaignEmail } from '../../auth/email.js'

const guests = [
  {
    id: '1',
    token: 'a',
    name: 'Ana',
    email: ' ANA@example.test ',
    rsvpState: 'confirmed',
    paymentState: 'paid',
    ticketId: 't1',
    checkedInAt: null,
  },
  {
    id: '2',
    token: 'b',
    name: 'Duplicado',
    email: 'ana@example.test',
    rsvpState: 'confirmed',
    paymentState: 'paid',
    ticketId: 't1',
    checkedInAt: new Date(),
  },
  {
    id: '3',
    token: 'c',
    name: 'Bruno',
    email: 'bruno@example.test',
    rsvpState: 'declined',
    paymentState: 'not_applicable',
    ticketId: null,
    checkedInAt: null,
  },
  {
    id: '4',
    token: 'd',
    name: 'Sem email',
    email: '',
    rsvpState: 'confirmed',
    paymentState: 'paid',
    ticketId: 't1',
    checkedInAt: null,
  },
]

test('resolveAudience filters guests and deduplicates email case-insensitively', () => {
  const audience = resolveAudience(guests, {
    rsvpStates: ['confirmed'],
    paymentStates: ['paid'],
    checkedIn: false,
  })
  assert.deepEqual(audience, [
    { guestId: '1', guestToken: 'a', name: 'Ana', email: 'ana@example.test' },
  ])
})

test('resolveAudience accepts all valid unique emails when filters are empty', () => {
  assert.equal(resolveAudience(guests, {}).length, 2)
})

test('renderInviteCampaignEmail escapes authored content', () => {
  const message = renderInviteCampaignEmail({
    recipientName: '<Admin>',
    eventTitle: 'Evento',
    subject: 'Aviso',
    preheader: '<script>alert(1)</script>',
    blocks: [{ type: 'text', text: '<img src=x onerror=alert(1)>' }],
    eventLink: 'https://example.test/invite/test',
  })
  assert.doesNotMatch(message.html, /<script>|<img src=x/)
  assert.match(message.html, /&lt;Admin&gt;/)
  assert.match(message.html, /&lt;img src=x onerror=alert\(1\)&gt;/)
})
