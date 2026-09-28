import test from 'node:test'
import assert from 'node:assert/strict'
import {
  createBrevoProvider,
  nextBrevoDailyRetryAt,
} from './provider.js'

const message = {
  recipientName: 'Ana',
  recipientEmail: 'ana@example.test',
  eventTitle: 'Conferência',
  subject: 'Informações',
  preheader: '',
  blocks: [{ type: 'text', text: '<p>Olá.</p>' }],
}

test('Brevo provider sends rendered campaign email with the configured sender', async () => {
  let request
  const provider = createBrevoProvider({
    apiKey: 'test-key',
    from: 'Agenda CCLX <no-reply@cclx.pt>',
    fetchImpl: async (url, options) => {
      request = { url, options }
      return {
        ok: true,
        status: 201,
        json: async () => ({ messageId: '<brevo-1>' }),
      }
    },
  })

  const result = await provider.send('ana@example.test', message)
  const body = JSON.parse(request.options.body)

  assert.equal(request.url, 'https://api.brevo.com/v3/smtp/email')
  assert.equal(request.options.headers['api-key'], 'test-key')
  assert.deepEqual(body.sender, {
    name: 'Agenda CCLX',
    email: 'no-reply@cclx.pt',
  })
  assert.deepEqual(body.to, [
    { email: 'ana@example.test', name: 'Ana' },
  ])
  assert.match(body.htmlContent, /Olá\./)
  assert.deepEqual(result, {
    provider: 'brevo',
    messageId: '<brevo-1>',
    accepted: true,
  })
})

test('Brevo daily quota errors are deferred until the following day', async () => {
  const provider = createBrevoProvider({
    apiKey: 'test-key',
    from: 'no-reply@cclx.pt',
    fetchImpl: async () => ({
      ok: false,
      status: 402,
      json: async () => ({
        code: 'not_enough_credits',
        message: 'Not enough credits',
      }),
    }),
  })

  await assert.rejects(
    provider.send('ana@example.test', message),
    (error) =>
      error.code === 'daily_quota' &&
      error.status === 402 &&
      error.retryAt instanceof Date
  )
  assert.equal(
    nextBrevoDailyRetryAt(new Date('2026-09-28T23:59:00Z')).toISOString(),
    '2026-09-29T00:05:00.000Z'
  )
})

test('Brevo requires a configured API key', async () => {
  const provider = createBrevoProvider({
    from: 'no-reply@cclx.pt',
  })

  await assert.rejects(
    provider.send('ana@example.test', message),
    (error) => error.permanent === true
  )
})
