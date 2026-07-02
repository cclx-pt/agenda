import { randomUUID } from 'node:crypto'
import { pool } from '../db/pool.js'

// Mapeia a linha da BD para a forma usada pela aplicação.
function mapRow(row) {
  if (!row) return null
  return {
    id: row.id,
    approverId: row.approver_id,
    approverName: row.approver_name ?? null,
    approverEmail: row.approver_email ?? null,
    church: row.church ?? null,
    category: row.category ?? null,
    createdAt: row.created_at,
  }
}

const SELECT_FULL = `
  SELECT s.id, s.approver_id, s.church, s.category, s.created_at,
         u.name AS approver_name, u.email AS approver_email
  FROM approver_scopes s
  LEFT JOIN users u ON u.id = s.approver_id
`

export async function list() {
  const { rows } = await pool.query(`${SELECT_FULL} ORDER BY u.name NULLS LAST, s.created_at`)
  return rows.map(mapRow)
}

// Regras de um aprovador (usado pela lógica de moderação/notificação).
export async function listByApprover(approverId) {
  const { rows } = await pool.query(
    'SELECT id, approver_id, church, category, created_at FROM approver_scopes WHERE approver_id = $1',
    [approverId]
  )
  return rows.map(mapRow)
}

export async function findById(id) {
  const { rows } = await pool.query(`${SELECT_FULL} WHERE s.id = $1`, [id])
  return mapRow(rows[0])
}

export async function insert({ approverId, church, category }) {
  const id = randomUUID()
  await pool.query(
    'INSERT INTO approver_scopes (id, approver_id, church, category) VALUES ($1, $2, $3, $4)',
    [id, approverId, church ?? null, category ?? null]
  )
  return findById(id)
}

export async function remove(id) {
  await pool.query('DELETE FROM approver_scopes WHERE id = $1', [id])
}

// Aprovadores ativos — candidatos a configurar.
export async function listApprovers() {
  const { rows } = await pool.query(
    `SELECT id, name, email, churches FROM users
      WHERE role = 'aprovador' AND is_active = TRUE
      ORDER BY name NULLS LAST, email`
  )
  return rows.map((r) => ({ id: r.id, name: r.name, email: r.email, churches: r.churches ?? null }))
}
