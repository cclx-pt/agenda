import { randomUUID } from 'node:crypto'
import { pool } from '../db/pool.js'

// Mapeia a linha da BD para a forma usada pela aplicação.
function mapRow(row) {
  if (!row) return null
  return {
    id: row.id,
    slug: row.slug,
    label: row.label,
    color: row.color ?? null,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

const COLUMNS = 'id, slug, label, color, sort_order, created_at, updated_at'

export async function list() {
  const { rows } = await pool.query(
    `SELECT ${COLUMNS} FROM categories ORDER BY sort_order, label`
  )
  return rows.map(mapRow)
}

/** Apenas os slugs (para validar a categoria dos eventos). */
export async function listSlugs() {
  const { rows } = await pool.query('SELECT slug FROM categories')
  return rows.map((r) => r.slug)
}

export async function findById(id) {
  const { rows } = await pool.query(
    `SELECT ${COLUMNS} FROM categories WHERE id = $1`,
    [id]
  )
  return mapRow(rows[0])
}

export async function findBySlug(slug) {
  const { rows } = await pool.query(
    `SELECT ${COLUMNS} FROM categories WHERE lower(slug) = lower($1)`,
    [slug]
  )
  return mapRow(rows[0])
}

export async function insert(data) {
  const id = randomUUID()
  await pool.query(
    `INSERT INTO categories (id, slug, label, color, sort_order)
     VALUES ($1, $2, $3, $4, $5)`,
    [id, data.slug, data.label, data.color ?? null, data.sortOrder ?? 0]
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
    `UPDATE categories SET ${sets.join(', ')} WHERE id = $1`,
    params
  )
  return findById(id)
}

/** Número de eventos que usam esta categoria (bloqueia a eliminação). */
export async function countEvents(slug) {
  const { rows } = await pool.query(
    'SELECT COUNT(*) AS n FROM events WHERE category = $1',
    [slug]
  )
  return rows[0].n
}

export async function remove(id) {
  await pool.query('DELETE FROM categories WHERE id = $1', [id])
}
