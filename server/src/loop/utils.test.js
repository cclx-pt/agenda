import test from 'node:test'
import assert from 'node:assert/strict'
import { uniqueLoopEvents } from './utils.js'

test('uniqueLoopEvents keeps one slide per recurring series', () => {
  const events = [
    { id: 'occurrence-1', seriesId: 'series-1' },
    { id: 'occurrence-2', seriesId: 'series-1' },
    { id: 'single-1', seriesId: null },
  ]

  assert.deepEqual(uniqueLoopEvents(events), [events[0], events[2]])
})