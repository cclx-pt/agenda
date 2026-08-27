import assert from 'node:assert/strict'
import test from 'node:test'
import { campaignProgress, publicCampaignView } from './domain.js'

test('campaignProgress calculates and caps aggregate progress', () => {
  assert.deepEqual(
    campaignProgress({ targetEur: 1000, totalReceived: 253 }),
    { targetEur: 1000, totalReceived: 253, percentage: 25.3, remainingEur: 747 }
  )
  assert.equal(campaignProgress({ targetEur: 100, totalReceived: 120 }).percentage, 100)
})

test('publicCampaignView excludes donor and internal campaign data', () => {
  const view = publicCampaignView({
    slug: 'obras', title: 'Obras', purpose: 'Telhado', targetEur: 1000,
    deadline: '2026-12-31', totalReceived: 250, donorCount: 4,
    configurations: ['C1'], visibilityMode: 'V1', createdBy: 'private-user',
    donorName: 'Private donor',
  })
  assert.equal(view.percentage, 25)
  assert.equal(view.remainingEur, 750)
  assert.equal('donorName' in view, false)
  assert.equal('createdBy' in view, false)
  assert.equal('visibilityMode' in view, false)
  assert.deepEqual(view.configurations, ['C1'])
})