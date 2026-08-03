import test from 'node:test'
import assert from 'node:assert/strict'
import { normalizeLoop } from '../loop/config.js'

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