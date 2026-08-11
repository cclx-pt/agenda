import test from 'node:test'
import assert from 'node:assert/strict'
import { normalizeLoop } from '../loop/config.js'
import { normalizeRegistrationPortalLinks } from './portalLinks.js'

test('normalizeLoop sanitizes fixed media slides and their durations', () => {
  const loop = normalizeLoop({
    name: 'Principal',
    fixedSlides: [
      { url: ' https://example.test/cartaz.jpg ', type: 'image', seconds: 8.6 },
      { url: 'https://example.test/video.mp4', type: 'video', seconds: 500 },
      { url: '', type: 'image', seconds: 10 },
      { url: 'https://example.test/file.pdf', type: 'document', seconds: 10 },
    ],
  })

  assert.deepEqual(loop.fixedSlides, [
    { url: 'https://example.test/cartaz.jpg', type: 'image', seconds: 9 },
    { url: 'https://example.test/video.mp4', type: 'video', seconds: 15 },
  ])
})

test('normalizeRegistrationPortalLinks trims and defaults fixed portal links', () => {
  assert.deepEqual(
    normalizeRegistrationPortalLinks([
      { title: ' YouTube CCLX ', url: ' https://youtube.com/@cclx ', platform: 'youtube' },
    ]),
    [
      {
        title: 'YouTube CCLX',
        url: 'https://youtube.com/@cclx',
        platform: 'youtube',
        description: '',
        active: true,
      },
    ]
  )
})

test('normalizeRegistrationPortalLinks rejects non-http destinations', () => {
  assert.throws(
    () => normalizeRegistrationPortalLinks([{ title: 'Email', url: 'mailto:info@example.com' }]),
    /Link inválido/
  )
})