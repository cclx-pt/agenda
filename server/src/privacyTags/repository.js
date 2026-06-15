import { pool } from '../db/pool.js'

// Mapeia a linha da BD para a forma usada pela aplicação.
function mapRow(row) {
  if (!row) return null
  return {
    id: row.id,
    name: row.name,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

const COLUMNS = 'id, name, created_at, updated_at'

export async function list() {
  const { rows } = await pool.query(
    `SELECT ${COLUMNS} FROM privacy_tags ORDER BY name`
  )
  return rows.map(mapRow)
}

/** Apenas os nomes (para validar as etiquetas de eventos e utilizadores). */
export async function listNames() {
  const { rows } = await pool.query('SELECT name FROM privacy_tags ORDER BY name')
  return rows.map((r) => r.name)
}

export async function findById(id) {
  const { rows } = await pool.query(
    `SELECT ${COLUMNS} FROM privacy_tags WHERE id = $1`,
    [id]
  )
  return mapRow(rows[0])
}

export async function findByName(name) {
  const { rows } = await pool.query(
    `SELECT ${COLUMNS} FROM privacy_tags WHERE lower(name) = lower($1)`,
    [name]
  )
  return mapRow(rows[0])
}

export async function insert(data) {
  const { rows } = await pool.query(
    `INSERT INTO privacy_tags (name)
     VALUES ($1)
     RETURNING ${COLUMNS}`,
    [data.name]
  )
  return mapRow(rows[0])
}

/** Número de eventos que usam esta etiqueta (bloqueia a eliminação). */
export async function countEvents(name) {
  const { rows } = await pool.query(
    'SELECT COUNT(*)::int AS n FROM events WHERE privacy_tag = $1',
    [name]
  )
  return rows[0].n
}

/** Remove a etiqueta das listas de acesso dos utilizadores (limpeza). */
export async function removeFromUsers(name) {
  await pool.query(
    'UPDATE users SET privacy_tags = array_remove(privacy_tags, $1) WHERE $1 = ANY(privacy_tags)',
    [name]
  )
}

export async function remove(id) {
  await pool.query('DELETE FROM privacy_tags WHERE id = $1', [id])
}
