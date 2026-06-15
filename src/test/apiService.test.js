import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { fetchAllEvents, clearEventCache, ApiError } from '../services/apiService'

// Encaminha o fetch conforme a origem: inChurch (`/api/event`) ou SoR (`/data/events/public`).
function mockFetch({
  inchurch = { results: [], next: null },
  sor = { events: [] },
  inchurchStatus = 200,
  sorStatus = 200,
  integrationEnabled = true,
} = {}) {
  global.fetch = vi.fn((url) => {
    const str = String(url)
    if (str.includes('/data/integration/public')) {
      return Promise.resolve({
        ok: true,
        status: 200,
        statusText: 'OK',
        json: async () => ({ enabled: integrationEnabled }),
      })
    }
    const isInchurch = str.includes('/api/event')
    const status = isInchurch ? inchurchStatus : sorStatus
    const payload = isInchurch ? inchurch : sor
    return Promise.resolve({
      ok: status >= 200 && status < 300,
      status,
      statusText: status === 200 ? 'OK' : 'Error',
      json: async () => payload,
    })
  })
}

const sorEvent = (over = {}) => ({
  id: 'e1',
  title: 'Celebração de Domingo',
  description: 'Culto',
  date: '2026-06-14',
  startDatetime: '2026-06-14T10:30:00.000Z',
  endDatetime: '2026-06-14T12:00:00.000Z',
  timeStart: '10:30',
  timeEnd: '12:00',
  allDay: false,
  location: 'Rua A, Lisboa',
  community: 'CCLX',
  category: 'culto',
  status: 'publicado',
  isPrivate: false,
  bannerUrl: null,
  ...over,
})

const inchurchRaw = (over = {}) => ({
  id: 42,
  name: 'Culto de Domingo',
  description: 'Celebração',
  start_datetime: '2026-06-14T19:00:00',
  end_datetime: '2026-06-14T20:30:00',
  show_on_calendar: true,
  responsible_church: { name: 'Sede' },
  location: { address: 'Rua B', city: 'Lisboa' },
  image: null,
  ...over,
})

describe('ApiError', () => {
  it('maps known statuses to friendly PT messages', () => {
    expect(new ApiError(401).message).toMatch(/autoriza/i)
    expect(new ApiError(403).message).toMatch(/permiss/i)
    expect(new ApiError(429).message).toMatch(/demasiados/i)
    expect(new ApiError(500).message).toMatch(/servidor/i)
  })
  it('uses the network fallback for status 0', () => {
    expect(new ApiError(0).message).toMatch(/liga/i)
  })
  it('exposes the status code', () => {
    expect(new ApiError(404).status).toBe(404)
  })
})

describe('fetchAllEvents', () => {
  beforeEach(() => clearEventCache())
  afterEach(() => vi.restoreAllMocks())

  it('maps a SoR event to the app shape', async () => {
    mockFetch({ sor: { events: [sorEvent()] } })
    const events = await fetchAllEvents()
    const evt = events.find((e) => e.id === 'e1')
    expect(evt).toMatchObject({
      id: 'e1',
      title: 'Celebração de Domingo',
      category: 'culto',
      community: 'CCLX',
      date: '2026-06-14',
      timeStart: '10:30',
      timeEnd: '12:00',
    })
    expect(evt.location).toContain('Rua A')
  })

  it('maps the banner URL to imageUrl', async () => {
    mockFetch({ sor: { events: [sorEvent({ bannerUrl: 'https://x/y.png' })] } })
    const [evt] = await fetchAllEvents()
    expect(evt.imageUrl).toBe('https://x/y.png')
    expect(evt.imageLabel).toBe('imagem do evento')
  })

  it('maps an inChurch event and prefixes its id', async () => {
    mockFetch({ inchurch: { results: [inchurchRaw()], next: null } })
    const [evt] = await fetchAllEvents()
    expect(evt).toMatchObject({
      id: 'ic-42',
      title: 'Culto de Domingo',
      category: 'culto',
      community: 'Sede',
      date: '2026-06-14',
    })
    expect(evt.location).toContain('Rua B')
  })

  it('uses the inChurch responsible_church name directly', async () => {
    mockFetch({
      inchurch: { results: [inchurchRaw({ responsible_church: { name: 'Porto' } })], next: null },
    })
    const [evt] = await fetchAllEvents()
    expect(evt.community).toBe('Porto')
  })

  it('infers the church from the event name when responsible_church is null', async () => {
    mockFetch({
      inchurch: {
        results: [inchurchRaw({ responsible_church: null, name: 'Celebração Almada' })],
        next: null,
      },
    })
    const [evt] = await fetchAllEvents()
    expect(evt.community).toBe('Almada')
  })

  it('ignores inChurch events hidden from the calendar', async () => {
    mockFetch({ inchurch: { results: [inchurchRaw({ show_on_calendar: false })], next: null } })
    const events = await fetchAllEvents()
    expect(events).toHaveLength(0)
  })

  it('merges and sorts events from both sources', async () => {
    mockFetch({
      inchurch: { results: [inchurchRaw({ id: 7, start_datetime: '2026-07-01T19:00:00' })], next: null },
      sor: { events: [sorEvent({ id: 'a', date: '2026-06-01' })] },
    })
    const events = await fetchAllEvents()
    expect(events.map((e) => e.id)).toEqual(['a', 'ic-7'])
  })

  it('still returns SoR events when inChurch fails', async () => {
    mockFetch({ inchurchStatus: 500, sor: { events: [sorEvent()] } })
    const events = await fetchAllEvents()
    expect(events.map((e) => e.id)).toEqual(['e1'])
  })

  it('skips inChurch when the integration is disabled', async () => {
    mockFetch({
      integrationEnabled: false,
      inchurch: { results: [inchurchRaw()], next: null },
      sor: { events: [sorEvent()] },
    })
    const events = await fetchAllEvents()
    expect(events.map((e) => e.id)).toEqual(['e1'])
  })

  it('returns an empty list when there are no events', async () => {
    mockFetch({})
    const events = await fetchAllEvents()
    expect(events).toHaveLength(0)
  })

  it('throws an ApiError when both sources fail', async () => {
    mockFetch({ inchurchStatus: 503, sorStatus: 503 })
    await expect(fetchAllEvents()).rejects.toBeInstanceOf(ApiError)
  })
})
