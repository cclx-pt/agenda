import { randomUUID } from 'node:crypto'
import { pool } from '../../db/pool.js'

function mapCampaign(row) {
  if (!row) return null
  return {
    id: row.id,
    inviteId: row.invite_id,
    type: row.type,
    name: row.name,
    subject: row.subject,
    preheader: row.preheader ?? '',
    blocks: row.blocks ?? [],
    audience: row.audience ?? {},
    status: row.status,
    recipientCount: Number(row.recipient_count ?? 0),
    sentCount: Number(row.sent_count ?? 0),
    failedCount: Number(row.failed_count ?? 0),
    skippedCount: Number(row.skipped_count ?? 0),
    createdBy: row.created_by ?? null,
    sentAt: row.sent_at ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function mapRecipient(row) {
  if (!row) return null
  return {
    id: row.id,
    campaignId: row.campaign_id,
    guestId: row.guest_id ?? null,
    name: row.name ?? null,
    email: row.email,
    status: row.status,
    error: row.error ?? null,
    sentAt: row.sent_at ?? null,
  }
}

export async function list(inviteId) {
  const { rows } = await pool.query(
    'SELECT * FROM invite_campaigns WHERE invite_id = $1 ORDER BY created_at DESC',
    [inviteId]
  )
  return rows.map(mapCampaign)
}

export async function findById(id) {
  const { rows } = await pool.query('SELECT * FROM invite_campaigns WHERE id = $1', [id])
  return mapCampaign(rows[0])
}

export async function insert(inviteId, data, actorId) {
  const id = randomUUID()
  await pool.query(
    `INSERT INTO invite_campaigns
      (id, invite_id, type, name, subject, preheader, blocks, audience, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
    [
      id,
      inviteId,
      data.type,
      data.name,
      data.subject,
      data.preheader || null,
      JSON.stringify(data.blocks),
      JSON.stringify(data.audience),
      actorId ?? null,
    ]
  )
  return findById(id)
}

export async function updateDraft(id, data) {
  const { rowCount } = await pool.query(
    `UPDATE invite_campaigns SET
       type = $2, name = $3, subject = $4, preheader = $5,
       blocks = $6, audience = $7, updated_at = now()
     WHERE id = $1 AND status = 'draft'`,
    [
      id,
      data.type,
      data.name,
      data.subject,
      data.preheader || null,
      JSON.stringify(data.blocks),
      JSON.stringify(data.audience),
    ]
  )
  return rowCount ? findById(id) : null
}

export async function removeDraft(id) {
  const { rowCount } = await pool.query(
    "DELETE FROM invite_campaigns WHERE id = $1 AND status = 'draft'",
    [id]
  )
  return rowCount > 0
}

export async function claimForSending(id) {
  const { rows } = await pool.query(
    `UPDATE invite_campaigns SET status = 'sending', updated_at = now()
     WHERE id = $1 AND status = 'draft' RETURNING *`,
    [id]
  )
  return mapCampaign(rows[0])
}

export async function insertRecipients(campaignId, recipients) {
  for (const recipient of recipients) {
    await pool.query(
      `INSERT INTO invite_campaign_recipients
        (id, campaign_id, guest_id, name, email, guest_token)
       VALUES ($1,$2,$3,$4,$5,$6)
       ON CONFLICT (campaign_id, email) DO NOTHING`,
      [
        randomUUID(),
        campaignId,
        recipient.guestId,
        recipient.name,
        recipient.email,
        recipient.guestToken,
      ]
    )
  }
  const { rows } = await pool.query(
    'SELECT * FROM invite_campaign_recipients WHERE campaign_id = $1 ORDER BY created_at',
    [campaignId]
  )
  return rows.map((row) => ({ ...mapRecipient(row), guestToken: row.guest_token ?? null }))
}

export async function markRecipient(id, status, error = null) {
  await pool.query(
    `UPDATE invite_campaign_recipients SET
       status = $2, error = $3, sent_at = CASE WHEN $2 = 'sent' THEN now() ELSE sent_at END
     WHERE id = $1`,
    [id, status, error]
  )
}

export async function finish(id, { recipientCount, sentCount, failedCount, skippedCount }) {
  const status = failedCount > 0 && sentCount === 0 ? 'failed' : 'sent'
  await pool.query(
    `UPDATE invite_campaigns SET
       status = $2, recipient_count = $3, sent_count = $4, failed_count = $5,
       skipped_count = $6, sent_at = now(), updated_at = now()
     WHERE id = $1`,
    [id, status, recipientCount, sentCount, failedCount, skippedCount]
  )
  return findById(id)
}
