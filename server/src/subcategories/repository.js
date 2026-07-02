import { randomUUID } from 'node:crypto'
import { pool } from '../db/pool.js'

// Mapeia a linha da BD para a forma usada pela aplicação.
function mapRow(row) {
  if (!row) return null
  return {
    id: row.id,
    name: row.name,
    color: row.color ?? null,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

const COLUMNS = 'id, name, color, sort_order, created_at, updated_at'

export async function list() {
  const { rows } = await pool.query(
    `SELECT ${COLUMNS} FROM subcategories ORDER BY sort_order, name`
  )
  return rows.map(mapRow)
}

/** Apenas os nomes (para validar a subcategoria dos eventos). */
export async function listNames() {
  const { rows } = await pool.query('SELECT name FROM subcategories ORDER BY sort_order, name')
  return rows.map((r) => r.name)
}

export async function findById(id) {
  const { rows } = await pool.query(`SELECT ${COLUMNS} FROM subcategories WHERE id = $1`, [id])
  return mapRow(rows[0])
}

export async function findByName(name) {
  const { rows } = await pool.query(
    `SELECT ${COLUMNS} FROM subcategories WHERE lower(name) = lower($1)`,
    [name]
  )
  return mapRow(rows[0])
}

export async function insert(data) {
  const id = randomUUID()
  await pool.query(
    `INSERT INTO subcategories (id, name, color, sort_order) VALUES ($1, $2, $3, $4)`,
    [id, data.name, data.color ?? null, data.sortOrder ?? 0]
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
  await pool.query(`UPDATE subcategories SET ${sets.join(', ')} WHERE id = $1`, params)
  return findById(id)
}

/** Número de eventos que usam esta subcategoria (bloqueia a eliminação). */
export async function countEvents(name) {
  const { rows } = await pool.query(
    'SELECT COUNT(*) AS n FROM events WHERE subcategory = $1',
    [name]
  )
  return rows[0].n
}

/** Propaga o novo nome aos eventos que usavam o nome antigo (evita órfãos). */
export async function renameInEvents(oldName, newName) {
  await pool.query(
    'UPDATE events SET subcategory = $2, updated_at = now() WHERE subcategory = $1',
    [oldName, newName]
  )
}

export async function remove(id) {
  await pool.query('DELETE FROM subcategories WHERE id = $1', [id])
}
