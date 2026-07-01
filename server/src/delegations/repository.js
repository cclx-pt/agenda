import { randomUUID } from 'node:crypto'
import { pool } from '../db/pool.js'

// Mapeia a linha da BD para a forma usada pela aplicação. As datas (DATE) vêm
// já como texto 'YYYY-MM-DD' (to_char) para evitar deslocações de fuso horário.
function mapRow(row) {
  if (!row) return null
  return {
    id: row.id,
    delegatorId: row.delegator_id,
    delegatorName: row.delegator_name ?? null,
    delegateId: row.delegate_id,
    delegateName: row.delegate_name ?? null,
    delegateEmail: row.delegate_email ?? null,
    church: row.church ?? null,
    category: row.category ?? null,
    startDate: row.start_date,
    endDate: row.end_date,
    active: !!row.active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

// SELECT base com os nomes do delegado/delegador para a UI e datas em texto.
const SELECT_FULL = `
  SELECT d.id, d.delegator_id, d.delegate_id, d.church, d.category,
         to_char(d.start_date, 'YYYY-MM-DD') AS start_date,
         to_char(d.end_date, 'YYYY-MM-DD') AS end_date,
         d.active, d.created_at, d.updated_at,
         du.name AS delegate_name, du.email AS delegate_email,
         gu.name AS delegator_name
  FROM approval_delegations d
  LEFT JOIN users du ON du.id = d.delegate_id
  LEFT JOIN users gu ON gu.id = d.delegator_id
`

export async function list() {
  const { rows } = await pool.query(`${SELECT_FULL} ORDER BY d.created_at DESC`)
  return rows.map(mapRow)
}

export async function listByDelegator(delegatorId) {
  const { rows } = await pool.query(
    `${SELECT_FULL} WHERE d.delegator_id = $1 ORDER BY d.created_at DESC`,
    [delegatorId]
  )
  return rows.map(mapRow)
}

// Delegações ativas de um delegado que cobrem a data de hoje (para decidir se
// o editor pode aprovar/rejeitar um dado evento).
export async function listActiveForDelegate(delegateId) {
  const { rows } = await pool.query(
    `SELECT id, delegate_id, church, category,
            to_char(start_date, 'YYYY-MM-DD') AS start_date,
            to_char(end_date, 'YYYY-MM-DD') AS end_date, active
       FROM approval_delegations
      WHERE delegate_id = $1 AND active = TRUE
        AND start_date <= CURRENT_DATE AND end_date >= CURRENT_DATE`,
    [delegateId]
  )
  return rows.map(mapRow)
}

export async function findById(id) {
  const { rows } = await pool.query(`${SELECT_FULL} WHERE d.id = $1`, [id])
  return mapRow(rows[0])
}

export async function insert(data, delegatorId) {
  const id = randomUUID()
  await pool.query(
    `INSERT INTO approval_delegations
      (id, delegator_id, delegate_id, church, category, start_date, end_date, active)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
    [
      id,
      delegatorId ?? null,
      data.delegateId,
      data.church ?? null,
      data.category ?? null,
      data.startDate,
      data.endDate,
      data.active ?? true,
    ]
  )
  return findById(id)
}

export async function update(id, data) {
  await pool.query(
    `UPDATE approval_delegations SET
       delegate_id = $2,
       church = $3,
       category = $4,
       start_date = $5,
       end_date = $6,
       active = $7,
       updated_at = now()
     WHERE id = $1`,
    [
      id,
      data.delegateId,
      data.church ?? null,
      data.category ?? null,
      data.startDate,
      data.endDate,
      data.active ?? true,
    ]
  )
  return findById(id)
}

export async function remove(id) {
  await pool.query('DELETE FROM approval_delegations WHERE id = $1', [id])
}

// Editores ativos — candidatos a delegado.
export async function listEditors() {
  const { rows } = await pool.query(
    `SELECT id, name, email, churches FROM users
      WHERE role = 'editor' AND is_active = TRUE
      ORDER BY name NULLS LAST, email`
  )
  return rows.map((r) => ({ id: r.id, name: r.name, email: r.email, churches: r.churches ?? null }))
}
