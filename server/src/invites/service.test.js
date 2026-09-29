import test from 'node:test'
import assert from 'node:assert/strict'

process.env.JWT_SECRET ||= 'test-secret'
process.env.OTP_PEPPER ||= 'test-pepper'

const { blocksSchema, isRegistrationOpen } = await import('./service.js')

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

test('registration closes when the invite reaches its capacity', () => {
  assert.equal(isRegistrationOpen({ rsvpEnabled: true }, 0), false)
  assert.equal(isRegistrationOpen({ rsvpEnabled: true }, 1), true)
  assert.equal(isRegistrationOpen({ rsvpEnabled: true }, null), true)
})

test('registration stays closed when it is disabled by the organizer', () => {
  assert.equal(isRegistrationOpen({ rsvpEnabled: false }, 10), false)
})
})