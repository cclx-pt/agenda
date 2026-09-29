import test from 'node:test'
import assert from 'node:assert/strict'
import { corsOptionsForRequest } from './cors.js'

test('registrations API accepts browser requests from external origins', () => {
  const options = corsOptionsForRequest(
    { path: '/data/public/invite/conferencia-2026/registrations' },
    'https://agenda.cclx.pt'
  )

  assert.equal(options.origin, '*')
  assert.equal(options.credentials, false)
  assert.deepEqual(options.methods, ['GET', 'OPTIONS'])
  assert.ok(options.allowedHeaders.includes('X-API-Key'))
})

test('other routes retain the configured application origin', () => {
  const options = corsOptionsForRequest(
    { path: '/data/invites' },
    'https://agenda.cclx.pt'
  )

  assert.equal(options.origin, 'https://agenda.cclx.pt')
  assert.equal(options.credentials, true)
})
