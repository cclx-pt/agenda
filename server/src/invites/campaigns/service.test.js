import test from 'node:test'
import assert from 'node:assert/strict'
import { matchesFormCondition, resolveAudience, retryDelayMs } from './service.js'
import { renderInviteCampaignEmail } from '../../auth/email.js'
import { applyTemplate, campaignTemplates } from './templates.js'

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
    extra: { comunidade: 'Sede', dias: ['Sexta', 'Sábado'], donativo: 25, consent: true },
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
    extra: { comunidade: 'Sede', dias: ['Domingo'], donativo: 10, consent: false },
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
    extra: { comunidade: 'Porto', dias: [], donativo: null, consent: true },
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

test('resolveAudience combines form conditions with all and any matching', () => {
  assert.deepEqual(
    resolveAudience(guests, {
      formMatch: 'all',
      formConditions: [
        { fieldKey: 'comunidade', operator: 'equals', value: 'sede' },
        { fieldKey: 'dias', operator: 'contains', value: 'Sábado' },
      ],
    }).map((recipient) => recipient.guestId),
    ['1']
  )
  assert.deepEqual(
    resolveAudience(guests, {
      formMatch: 'any',
      formConditions: [
        { fieldKey: 'comunidade', operator: 'equals', value: 'Porto' },
        { fieldKey: 'donativo', operator: 'greater_than', value: 20 },
      ],
    }).map((recipient) => recipient.guestId),
    ['1', '3']
  )
})

test('matchesFormCondition supports booleans, numbers and empty answers', () => {
  assert.equal(matchesFormCondition(true, { operator: 'equals', value: true }), true)
  assert.equal(matchesFormCondition(25, { operator: 'greater_or_equal', value: 25 }), true)
  assert.equal(matchesFormCondition([], { operator: 'empty' }), true)
  assert.equal(matchesFormCondition('Lisboa', { operator: 'not_contains', value: 'porto' }), true)
})

test('retryDelayMs applies increasing backoff between delivery attempts', () => {
  assert.equal(retryDelayMs(1), 2_000)
  assert.equal(retryDelayMs(2), 10_000)
})

test('campaign templates provide all reusable stage 6 messages', () => {
  assert.equal(campaignTemplates.length, 7)
  assert.deepEqual(
    campaignTemplates.map((template) => template.key),
    [
      'access_information',
      'event_reminder',
      'payment_pending',
      'urgent_change',
      'cancellation_or_time_change',
      'post_event_thanks',
      'post_event_follow_up',
    ]
  )
  const draft = applyTemplate(
    campaignTemplates[0],
    { title: 'Conferência' },
    'https://example.test/invite/conferencia'
  )
  assert.equal(draft.subject, 'Informações de acesso — Conferência')
  assert.equal(draft.blocks[1].url, 'https://example.test/invite/conferencia')
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

test('renderInviteCampaignEmail uses a responsive table layout for email clients', () => {
  const message = renderInviteCampaignEmail({
    recipientName: 'Ana',
    eventTitle: 'Conferência',
    subject: 'Informações',
    preheader: 'Resumo da mensagem',
    blocks: [
      { type: 'text', text: 'Primeira linha\nSegunda linha' },
      { type: 'warning', text: 'Chegar cedo.' },
      { type: 'button', label: 'Abrir inscrição', url: 'https://example.test/register' },
    ],
    eventLink: 'https://example.test/invite',
  })

  assert.match(message.html, /^<!doctype html>/)
  assert.match(message.html, /<meta charset="utf-8"/)
  assert.match(message.html, /role="presentation"/)
  assert.match(message.html, /width="600"/)
  assert.match(message.html, /class="email-content"/)
  assert.match(message.html, /Primeira linha<br \/>Segunda linha/)
  assert.match(message.html, /mso-table-lspace:0pt/)
  assert.doesNotMatch(message.html, /white-space:pre-line/)
})
