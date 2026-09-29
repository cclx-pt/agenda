import { describe, expect, it } from 'vitest'
import {
  DEFAULT_INVITE_STATUS_FILTERS,
  filterAdminInvites,
  inviteHasOpenRegistration,
} from '../components/invite/inviteAdminFilters'

const invites = [
  { id: 'active', status: 'publicado', registrationMode: 'internal', rsvpEnabled: true, community: 'CCLX' },
  { id: 'draft', status: 'rascunho', registrationMode: 'internal', rsvpEnabled: true, community: 'CCLX' },
  { id: 'closed', status: 'fechado', registrationMode: 'internal', rsvpEnabled: false, community: 'Almada' },
  { id: 'external', status: 'publicado', registrationMode: 'external', rsvpEnabled: true, community: null },
]

describe('invite admin filters', () => {
  it('shows active and draft invites by default', () => {
    const result = filterAdminInvites(invites, {
      statuses: DEFAULT_INVITE_STATUS_FILTERS,
      registration: 'all',
      community: 'all',
    })

    expect(result.map((invite) => invite.id)).toEqual(['active', 'draft', 'external'])
  })

  it('only treats published internal RSVP invites as open for registration', () => {
    expect(inviteHasOpenRegistration(invites[0])).toBe(true)
    expect(inviteHasOpenRegistration(invites[1])).toBe(false)
    expect(inviteHasOpenRegistration(invites[3])).toBe(false)
  })

  it('combines registration and community filters', () => {
    const result = filterAdminInvites(invites, {
      statuses: ['publicado', 'rascunho', 'fechado'],
      registration: 'closed',
      community: 'CCLX',
    })

    expect(result.map((invite) => invite.id)).toEqual(['draft'])
  })

  it('can filter invites without a community', () => {
    const result = filterAdminInvites(invites, {
      statuses: ['publicado'],
      registration: 'all',
      community: 'none',
    })

    expect(result.map((invite) => invite.id)).toEqual(['external'])
  })
})
