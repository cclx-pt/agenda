import { randomUUID } from 'node:crypto'
import { pool } from '../../db/pool.js'

function mapPayment(row) {
  if (!row) return null
  return {
    id: row.id,
    inviteId: row.invite_id,
    guestId: row.guest_id,
    method: row.method,
    amount: row.amount == null ? null : Number(row.amount),
    currency: row.currency,
    status: row.status,
    provider: row.provider ?? null,
    providerRef: row.provider_ref ?? null,
    providerPayload: row.provider_payload ?? null,
    receiptUrl: row.receipt_url ?? null,
    paidAt: row.paid_at ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    // Campos do JOIN (contexto do convidado), quando pedidos.
    guestName: row.guest_name ?? null,
    guestEmail: row.guest_email ?? null,
  }
}

export async function insert(data) {
  const id = randomUUID()
  await pool.query(
    `INSERT INTO invite_payments
      (id, invite_id, guest_id, method, amount, currency, status, provider, provider_ref, provider_payload, receipt_url)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
    [
      id,
      data.inviteId,
      data.guestId,
      data.method,
      data.amount ?? null,
      data.currency ?? 'EUR',
      data.status ?? 'pending',
      data.provider ?? null,
      data.providerRef ?? null,
      data.providerPayload ? JSON.stringify(data.providerPayload) : null,
      data.receiptUrl ?? null,
    ]
  )
  return findById(id)
}

export async function findById(id) {
  const { rows } = await pool.query('SELECT * FROM invite_payments WHERE id = $1', [id])
  return mapPayment(rows[0])
}

// Pagamento mais recente de um convidado (o fluxo lida com um pagamento ativo por convidado).
export async function findLatestByGuest(guestId) {
  const { rows } = await pool.query(
    'SELECT * FROM invite_payments WHERE guest_id = $1 ORDER BY created_at DESC LIMIT 1',
    [guestId]
  )
  return mapPayment(rows[0])
}

export async function findByProviderRef(providerRef) {
  const { rows } = await pool.query(
    'SELECT * FROM invite_payments WHERE provider_ref = $1 ORDER BY created_at DESC LIMIT 1',
    [providerRef]
  )
  return mapPayment(rows[0])
}

export async function listByInvite(inviteId) {
  const { rows } = await pool.query(
    `SELECT p.*, g.name AS guest_name, g.email AS guest_email
     FROM invite_payments p
     LEFT JOIN invite_guests g ON g.id = p.guest_id
     WHERE p.invite_id = $1
     ORDER BY p.created_at DESC`,
    [inviteId]
  )
  return rows.map(mapPayment)
}

// Atualiza campos do pagamento (só os fornecidos; usa COALESCE). `paidAt` só é
// tocado quando `setPaidNow` é verdadeiro (marcação de pago).
export async function update(id, data, { setPaidNow = false } = {}) {
  await pool.query(
    `UPDATE invite_payments SET
       status = COALESCE($2, status),
       provider = COALESCE($3, provider),
       provider_ref = COALESCE($4, provider_ref),
       provider_payload = COALESCE($5, provider_payload),
       receipt_url = COALESCE($6, receipt_url),
       amount = COALESCE($7, amount),
       paid_at = CASE WHEN $8 THEN now() ELSE paid_at END,
       updated_at = now()
     WHERE id = $1`,
    [
      id,
      data.status ?? null,
      data.provider ?? null,
      data.providerRef ?? null,
      data.providerPayload ? JSON.stringify(data.providerPayload) : null,
      data.receiptUrl ?? null,
      data.amount ?? null,
      setPaidNow,
    ]
  )
  return findById(id)
}
