import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { fetchAllEvents, clearEventCache, ApiError } from '../services/apiService'

// O frontend lê UMA origem: a base de dados (/data/events). Os eventos externos
// (inChurch) já vêm combinados pelo servidor, mapeados e marcados com isApi:true
// e id prefixado `ic-`.
function mockFetch({ sor = { events: [] }, sorStatus = 200 } = {}) {
  global.fetch = vi.fn(() =>
    Promise.resolve({
      ok: sorStatus >= 200 && sorStatus < 300,
      status: sorStatus,
      statusText: sorStatus === 200 ? 'OK' : 'Error',
      json: async () => sor,
    })
  )
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

// Evento externo (inChurch) tal como o servidor o devolve (já mapeado).
const apiEvent = (over = {}) => ({
  id: 'ic-42',
  title: 'Culto de Domingo',
  description: 'Celebração',
  date: '2026-06-14',
  startDatetime: '2026-06-14T19:00:00.000Z',
  endDatetime: '2026-06-14T20:30:00.000Z',
  timeStart: '19:00',
  timeEnd: '20:30',
  allDay: false,
  location: 'Rua B, Lisboa',
  community: 'Sede',
  category: 'culto',
  status: 'publicado',
  isPrivate: false,
  privacyTag: null,
  bannerUrl: null,
  isApi: true,
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

  it('maps a SoR (managed) event to the app shape', async () => {
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
      isApi: false,
    })
    expect(evt.location).toContain('Rua A')
  })

  it('maps the banner URL to imageUrl', async () => {
    mockFetch({ sor: { events: [sorEvent({ bannerUrl: 'https://x/y.png' })] } })
    const [evt] = await fetchAllEvents()
    expect(evt.imageUrl).toBe('https://x/y.png')
    expect(evt.imageLabel).toBe('imagem do evento')
  })

  it('keeps an external (inChurch) event marked as API with its ic- id', async () => {
    mockFetch({ sor: { events: [apiEvent()] } })
    const [evt] = await fetchAllEvents()
    expect(evt).toMatchObject({
      id: 'ic-42',
      title: 'Culto de Domingo',
      category: 'culto',
      community: 'Sede',
      date: '2026-06-14',
      isApi: true,
    })
    expect(evt.location).toContain('Rua B')
  })

  it('sorts the combined events returned by the server', async () => {
    mockFetch({
      sor: {
        events: [apiEvent({ id: 'ic-7', date: '2026-07-01' }), sorEvent({ id: 'a', date: '2026-06-01' })],
      },
    })
    const events = await fetchAllEvents()
    expect(events.map((e) => e.id)).toEqual(['a', 'ic-7'])
  })

  it('returns an empty list when there are no events', async () => {
    mockFetch({})
    const events = await fetchAllEvents()
    expect(events).toHaveLength(0)
  })

  it('throws an ApiError when the source fails', async () => {
    mockFetch({ sorStatus: 503 })
    await expect(fetchAllEvents()).rejects.toBeInstanceOf(ApiError)
  })
})
