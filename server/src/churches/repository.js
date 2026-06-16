import { randomUUID } from 'node:crypto'
import { pool } from '../db/pool.js'

// Mapeia a linha da BD para a forma usada pela aplicação.
function mapRow(row) {
  if (!row) return null
  return {
    id: row.id,
    name: row.name,
    externalId: row.external_id ?? null,
    address: row.address ?? null,
    postalCode: row.postal_code ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

const COLUMNS =
  'id, name, external_id, address, postal_code, created_at, updated_at'

export async function list() {
  const { rows } = await pool.query(
    `SELECT ${COLUMNS} FROM churches ORDER BY name`
  )
  return rows.map(mapRow)
}

/** Apenas os nomes (para validar o acesso por igreja dos utilizadores). */
export async function listNames() {
  const { rows } = await pool.query('SELECT name FROM churches ORDER BY name')
  return rows.map((r) => r.name)
}

export async function findById(id) {
  const { rows } = await pool.query(
    `SELECT ${COLUMNS} FROM churches WHERE id = $1`,
    [id]
  )
  return mapRow(rows[0])
}

export async function findByName(name) {
  const { rows } = await pool.query(
    `SELECT ${COLUMNS} FROM churches WHERE lower(name) = lower($1)`,
    [name]
  )
  return mapRow(rows[0])
}

export async function insert(data) {
  const id = randomUUID()
  await pool.query(
    `INSERT INTO churches (id, name, external_id, address, postal_code)
     VALUES ($1, $2, $3, $4, $5)`,
    [id, data.name, data.externalId ?? null, data.address ?? null, data.postalCode ?? null]
  )
  return findById(id)
}

export async function update(id, fields) {
  const sets = ['updated_at = now()']
  const params = [id]
  for (const [col, val] of Object.entries(fields)) {
    params.push(val)
    sets.push(`${col} = $${params.length}`)
  }
  await pool.query(
    `UPDATE churches SET ${sets.join(', ')} WHERE id = $1`,
    params
  )
  return findById(id)
}

export async function remove(id) {
  await pool.query('DELETE FROM churches WHERE id = $1', [id])
}
