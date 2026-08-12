import { describe, expect, it } from 'vitest'
import { eventDestination, selectRegistrationEvents } from '../utils/registrationPortal'

describe('registration portal events', () => {
  it('prefers the published landing page over an external registration URL', () => {
    expect(eventDestination({ inviteSlug: 'retiro-2026', registrationUrl: 'https://example.com/form' }))
      .toBe('/invite/retiro-2026')
  })

  it('hides past events and orders the remaining events chronologically', () => {
    const now = new Date('2026-03-10T12:00:00')
    const events = [
      { id: 3, date: '2026-03-12', includeInRegistrationPortal: true, registrationUrl: 'https://example.com/3' },
      { id: 1, date: '2026-03-09', includeInRegistrationPortal: true, registrationUrl: 'https://example.com/1' },
      { id: 2, date: '2026-03-11', includeInRegistrationPortal: true, registrationUrl: 'https://example.com/2' },
      { id: 4, endDatetime: '2026-03-10T11:59:59', startDatetime: '2026-03-10T10:00:00', includeInRegistrationPortal: true, registrationUrl: 'https://example.com/4' },
    ]

    expect(selectRegistrationEvents(events, now).map((event) => event.id)).toEqual([2, 3])
  })
})