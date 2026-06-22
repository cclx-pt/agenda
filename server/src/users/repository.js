import { randomUUID } from 'node:crypto'
import { pool } from '../db/pool.js'

// Mapeia a linha da BD para a forma usada pela aplicação.
function mapRow(row) {
  if (!row) return null
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    role: row.role,
    isActive: !!row.is_active,
    canViewPrivate: !!row.can_view_private,
    churches: row.churches ?? null,
    privacyTags: row.privacy_tags ?? null,
    createdAt: row.created_at,
    lastLoginAt: row.last_login_at,
  }
}

export async function list() {
  const { rows } = await pool.query(
    `SELECT id, email, name, role, is_active, can_view_private, churches, privacy_tags, created_at, last_login_at
     FROM users
     ORDER BY role, email`
  )
  return rows.map(mapRow)
}

export async function findById(id) {
  const { rows } = await pool.query(
    `SELECT id, email, name, role, is_active, can_view_private, churches, privacy_tags, created_at, last_login_at
     FROM users WHERE id = $1`,
    [id]
  )
  return mapRow(rows[0])
}

export async function findByEmail(email) {
  const { rows } = await pool.query(
    `SELECT id, email, name, role, is_active, can_view_private, churches, privacy_tags, created_at, last_login_at
     FROM users WHERE email = $1`,
    [email]
  )
  return mapRow(rows[0])
}

export async function insert(data) {
  const id = randomUUID()
  await pool.query(
    `INSERT INTO users (id, email, name, role, is_active, can_view_private, churches, privacy_tags)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [
      id,
      data.email,
      data.name ?? null,
      data.role,
      data.isActive ?? true,
      data.canViewPrivate ?? false,
      data.churches ?? null,
      data.privacyTags ?? null,
    ]
  )
  return findById(id)
}

// Atualiza apenas os campos fornecidos (papel, estado, acesso a privados, nome).
export async function update(id, fields) {
  const sets = []
  const params = [id]
  for (const [col, val] of Object.entries(fields)) {
    // churches e privacy_tags são colunas TEXT[]: o node-postgres serializa o
    // array (ou null) diretamente, sem JSON.
    params.push(val)
    sets.push(`${col} = $${params.length}`)
  }
  if (sets.length === 0) return findById(id)
  await pool.query(`UPDATE users SET ${sets.join(', ')} WHERE id = $1`, params)
  return findById(id)
}

export async function remove(id) {
  await pool.query('DELETE FROM users WHERE id = $1', [id])
}

export async function countAdmins() {
  const { rows } = await pool.query(
    "SELECT COUNT(*) AS n FROM users WHERE role = 'admin' AND is_active = TRUE"
  )
  return rows[0].n
}
