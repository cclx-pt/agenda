import test from 'node:test'
import assert from 'node:assert/strict'

process.env.JWT_SECRET ||= 'test-secret'
process.env.OTP_PEPPER ||= 'test-pepper'

const {
  blocksSchema,
  createRegistrationsApiKey,
  isRegistrationOpen,
  registrationsApiPayload,
  verifyRegistrationsApiKey,
} = await import('./service.js')
const { createHash } = await import('node:crypto')

test('landing-page blocks accept the tickets type', () => {
  const blocks = [{ type: 'tickets', content: { title: 'Bilhetes' }, visible: true }]

  assert.deepEqual(blocksSchema.parse(blocks), blocks)
})

test('landing-page blocks accept the overview plus type', () => {
  const blocks = [{
    type: 'overview_plus',
    content: {
      title: 'Sobre o evento',
      body: '<p>Descrição</p>',
      imageUrl: 'https://example.com/event.jpg',
      buttons: [{ label: 'Saber mais', url: '/programa' }],
    },
    visible: true,
  }]

  assert.deepEqual(blocksSchema.parse(blocks), blocks)
})

test('registration closes when the invite reaches its capacity', () => {
  assert.equal(isRegistrationOpen({ rsvpEnabled: true }, 0), false)
  assert.equal(isRegistrationOpen({ rsvpEnabled: true }, 1), true)
  assert.equal(isRegistrationOpen({ rsvpEnabled: true }, null), true)
})

test('registration stays closed when it is disabled by the organizer', () => {
  assert.equal(isRegistrationOpen({ rsvpEnabled: false }, 10), false)
})

test('registration API keys are random and verified from their stored hash', () => {
  const apiKey = createRegistrationsApiKey()
  const hash = createHash('sha256').update(apiKey).digest('hex')

  assert.match(apiKey, /^cclx_[A-Za-z0-9_-]{43}$/)
  assert.equal(verifyRegistrationsApiKey(apiKey, hash), true)
  assert.equal(verifyRegistrationsApiKey(`${apiKey}x`, hash), false)
  assert.equal(verifyRegistrationsApiKey('', hash), false)
})

test('registration API payload excludes private guest access tokens', () => {
  const payload = registrationsApiPayload(
    { id: 'invite-1', slug: 'event', title: 'Event' },
    [{
      id: 'guest-1',
      token: 'must-not-leak',
      code: 'A1',
      name: 'Maria',
      guestsCount: 1,
      rsvpState: 'confirmed',
      paymentState: 'paid',
      ticketId: 'ticket-1',
    }],
    [{ id: 'ticket-1', name: 'General' }],
    '2026-09-29T22:00:00.000Z'
  )

  assert.equal(payload.total, 1)
  assert.equal(payload.registrations[0].ticket.name, 'General')
  assert.equal('token' in payload.registrations[0], false)
})