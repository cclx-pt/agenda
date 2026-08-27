import test from 'node:test'
import assert from 'node:assert/strict'

process.env.JWT_SECRET ||= 'test-secret'
process.env.OTP_PEPPER ||= 'test-pepper'

const { blocksSchema } = await import('./service.js')

test('landing-page blocks accept the tickets type', () => {
  const blocks = [{ type: 'tickets', content: { title: 'Bilhetes' }, visible: true }]

  assert.deepEqual(blocksSchema.parse(blocks), blocks)
})