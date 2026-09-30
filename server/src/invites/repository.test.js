import test from 'node:test'
import assert from 'node:assert/strict'

process.env.DATABASE_URL ||= 'postgresql://test:test@localhost:5432/test'
process.env.JWT_SECRET ||= 'test-secret'
process.env.OTP_PEPPER ||= 'test-pepper'

const { pool } = await import('../db/pool.js')
const {
  deleteUnticketedRegistration,
  insertGuestWithCapacity,
  insertUnticketedRegistration,
  updateUnticketedRegistration,
} = await import('./repository.js')

test('an exhausted private registration link rejects the insert atomically', async () => {
  const queries = []
  let released = false
  const client = {
    async query(sql) {
      queries.push(sql)
      if (sql.includes('SELECT capacity, waitlist_enabled')) {
        return { rows: [{ capacity: null, waitlist_enabled: false }] }
      }
      if (sql.includes('FROM invite_registration_links')) {
        return { rows: [{ id: 'link-1', max_registrations: 1, is_active: true }] }
      }
      if (sql.includes('COUNT(*)::int AS registrations_count')) {
        return { rows: [{ registrations_count: 1 }] }
      }
      return { rows: [] }
    },
    release() {
      released = true
    },
  }
  const originalConnect = pool.connect
  pool.connect = async () => client

  try {
    const result = await insertGuestWithCapacity(
      'invite-1',
      { rsvpState: 'confirmed', guestsCount: 1 },
      { registrationLinkToken: 'private-token-123456' }
    )

    assert.deepEqual(result, { reason: 'registration_link_full', guest: null })
    assert.equal(queries.some((sql) => sql.includes('INSERT INTO invite_guests')), false)
    assert.equal(queries.at(-1), 'ROLLBACK')
    assert.equal(released, true)
  } finally {
    pool.connect = originalConnect
    await pool.end()
  }
})

test('a private registration extends a full invite capacity atomically', async () => {
  const queries = []
  const client = {
    async query(sql, params) {
      queries.push({ sql, params })
      if (sql.includes('SELECT capacity, waitlist_enabled')) {
        return { rows: [{ capacity: 2, waitlist_enabled: false }] }
      }
      if (sql.includes('FROM invite_registration_links')) {
        return { rows: [{ id: 'link-1', max_registrations: 5, is_active: true }] }
      }
      if (sql.includes('COUNT(*)::int AS registrations_count')) {
        return { rows: [{ registrations_count: 0 }] }
      }
      if (sql.includes('COALESCE(SUM(guests_count)')) {
        return { rows: [{ sold: 2 }] }
      }
      if (sql.includes('UPDATE invites')) {
        return { rows: [{ capacity: 4 }] }
      }
      if (sql.startsWith('SELECT * FROM invite_guests')) {
        return {
          rows: [{
            id: 'guest-1',
            invite_id: 'invite-1',
            registration_link_id: 'link-1',
            guests_count: 2,
            rsvp_state: 'confirmed',
            payment_state: 'not_applicable',
          }],
        }
      }
      return { rows: [] }
    },
    release() {},
  }
  const originalConnect = pool.connect
  pool.connect = async () => client

  try {
    const result = await insertGuestWithCapacity(
      'invite-1',
      { rsvpState: 'confirmed', guestsCount: 2 },
      { registrationLinkToken: 'private-token-123456' }
    )

    assert.equal(result.reason, null)
    assert.equal(result.guest.rsvpState, 'confirmed')
    assert.equal(result.inviteCapacity, 4)
    const capacityUpdate = queries.find(({ sql }) => sql.includes('UPDATE invites'))
    assert.deepEqual(capacityUpdate.params, ['invite-1', 2])
    assert.equal(queries.at(-1).sql, 'COMMIT')
  } finally {
    pool.connect = originalConnect
  }
})

test('a private registration extends full invite and ticket capacities atomically', async () => {
  const queries = []
  const client = {
    async query(sql, params) {
      queries.push({ sql, params })
      if (sql.includes('SELECT capacity, waitlist_enabled')) {
        return { rows: [{ capacity: 10, waitlist_enabled: false }] }
      }
      if (sql.includes('FROM invite_registration_links')) {
        return { rows: [{ id: 'link-1', max_registrations: 5, is_active: true }] }
      }
      if (sql.includes('COUNT(*)::int AS registrations_count')) {
        return { rows: [{ registrations_count: 0 }] }
      }
      if (sql.includes('FROM invite_tickets')) {
        return { rows: [{ capacity: 1 }] }
      }
      if (sql.includes('COALESCE(SUM(guests_count)')) {
        return { rows: [{ sold: 1 }] }
      }
      if (sql.includes('UPDATE invite_tickets')) {
        return { rows: [{ capacity: 3 }] }
      }
      if (sql.includes('UPDATE invites')) {
        return { rows: [{ capacity: 12 }] }
      }
      if (sql.startsWith('SELECT * FROM invite_guests')) {
        return {
          rows: [{
            id: 'guest-2',
            invite_id: 'invite-1',
            ticket_id: 'ticket-1',
            registration_link_id: 'link-1',
            guests_count: 2,
            rsvp_state: 'confirmed',
            payment_state: 'not_applicable',
          }],
        }
      }
      return { rows: [] }
    },
    release() {},
  }
  const originalConnect = pool.connect
  pool.connect = async () => client

  try {
    const result = await insertGuestWithCapacity(
      'invite-1',
      { rsvpState: 'confirmed', guestsCount: 2, ticketId: 'ticket-1' },
      { registrationLinkToken: 'private-token-123456' }
    )

    assert.equal(result.reason, null)
    assert.equal(result.guest.rsvpState, 'confirmed')
    assert.equal(result.inviteCapacity, 12)
    assert.equal(result.ticketCapacity, 3)
    assert.deepEqual(
      queries.find(({ sql }) => sql.includes('UPDATE invites')).params,
      ['invite-1', 2]
    )
    assert.deepEqual(
      queries.find(({ sql }) => sql.includes('UPDATE invite_tickets')).params,
      ['ticket-1', 2]
    )
    assert.equal(queries.at(-1).sql, 'COMMIT')
  } finally {
    pool.connect = originalConnect
  }
})

test('an unticketed registration never reads or updates invite and ticket capacity', async () => {
  const queries = []
  const originalQuery = pool.query
  pool.query = async (sql, params) => {
    queries.push({ sql, params })
    if (sql.includes('INSERT INTO invite_unticketed_registrations')) {
      return {
        rows: [{
          id: params[0],
          invite_id: params[1],
          spots: params[2],
          reason: params[3],
          created_at: '2026-04-01T10:00:00.000Z',
          updated_at: '2026-04-01T10:00:00.000Z',
        }],
      }
    }
    if (sql.includes('UPDATE invite_unticketed_registrations')) {
      return {
        rows: [{
          id: params[0],
          invite_id: params[1],
          spots: params[2],
          reason: params[3],
          created_at: '2026-04-01T10:00:00.000Z',
          updated_at: '2026-04-01T10:05:00.000Z',
        }],
      }
    }
    return { rowCount: 1, rows: [] }
  }

  try {
    const registration = await insertUnticketedRegistration('invite-1', {
      spots: 4,
      reason: 'Equipa técnica',
    })
    const updated = await updateUnticketedRegistration('invite-1', registration.id, {
      spots: 5,
      reason: 'Equipa técnica e produção',
    })
    const removed = await deleteUnticketedRegistration('invite-1', updated.id)

    assert.equal(registration.spots, 4)
    assert.equal(updated.spots, 5)
    assert.equal(removed, true)
    assert.equal(queries.every(({ sql }) => sql.includes('invite_unticketed_registrations')), true)
    assert.equal(queries.some(({ sql }) => /invite_guests|invite_tickets|UPDATE invites/.test(sql)), false)
  } finally {
    pool.query = originalQuery
  }
})