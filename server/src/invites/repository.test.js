import test from 'node:test'
import assert from 'node:assert/strict'

process.env.DATABASE_URL ||= 'postgresql://test:test@localhost:5432/test'
process.env.JWT_SECRET ||= 'test-secret'
process.env.OTP_PEPPER ||= 'test-pepper'

const { pool } = await import('../db/pool.js')
const { insertGuestWithCapacity } = await import('./repository.js')

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