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
    queuedAt: row.queued_at ?? null,
    processingStartedAt: row.processing_started_at ?? null,
    leaseExpiresAt: row.lease_expires_at ?? null,
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
    attemptCount: Number(row.attempt_count ?? 0),
    nextAttemptAt: row.next_attempt_at ?? null,
    lastAttemptAt: row.last_attempt_at ?? null,
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

export async function queueForSending(id) {
  const { rows } = await pool.query(
    `UPDATE invite_campaigns SET
       status = 'queued', queued_at = now(), processing_started_at = NULL,
       lease_expires_at = NULL, lease_token = NULL, updated_at = now()
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

export async function finish(id, { recipientCount, sentCount, failedCount, skippedCount }) {
  const status =
    failedCount === 0 ? 'sent' : sentCount === 0 ? 'failed' : 'sent_with_errors'
  await pool.query(
    `UPDATE invite_campaigns SET
       status = $2, recipient_count = $3, sent_count = $4, failed_count = $5,
       skipped_count = $6, sent_at = COALESCE(sent_at, now()),
       lease_expires_at = NULL, lease_token = NULL, updated_at = now()
     WHERE id = $1`,
    [id, status, recipientCount, sentCount, failedCount, skippedCount]
  )
  return findById(id)
}

export async function listRecipients(campaignId) {
  const { rows } = await pool.query(
    `SELECT * FROM invite_campaign_recipients
     WHERE campaign_id = $1
     ORDER BY status, created_at`,
    [campaignId]
  )
  return rows.map(mapRecipient)
}

export async function claimForRetry(id) {
  const { rows } = await pool.query(
    `UPDATE invite_campaigns SET
       status = 'queued', queued_at = now(), processing_started_at = NULL,
       lease_expires_at = NULL, lease_token = NULL, updated_at = now()
     WHERE id = $1
       AND status IN ('sent', 'sent_with_errors', 'failed')
       AND failed_count > 0
     RETURNING *`,
    [id]
  )
  return mapCampaign(rows[0])
}

export async function claimFailedRecipients(campaignId) {
  const { rows } = await pool.query(
    `UPDATE invite_campaign_recipients
     SET status = 'pending', error = NULL, next_attempt_at = now()
     WHERE campaign_id = $1 AND status = 'failed'
     RETURNING *`,
    [campaignId]
  )
  return rows.map((row) => ({ ...mapRecipient(row), guestToken: row.guest_token ?? null }))
}

export async function initializeQueuedDelivery(campaignId) {
  const { rowCount } = await pool.query(
    `UPDATE invite_campaigns SET
       recipient_count = counts.recipient_count,
       sent_count = counts.sent_count,
       failed_count = counts.failed_count,
       skipped_count = counts.skipped_count,
       updated_at = now()
     FROM (
       SELECT
         COUNT(*)::int AS recipient_count,
         COUNT(*) FILTER (WHERE status = 'sent')::int AS sent_count,
         COUNT(*) FILTER (WHERE status = 'failed')::int AS failed_count,
         COUNT(*) FILTER (WHERE status = 'skipped')::int AS skipped_count
       FROM invite_campaign_recipients
       WHERE campaign_id = $1
     ) counts
     WHERE invite_campaigns.id = $1`,
    [campaignId]
  )
  return rowCount > 0
}

export async function claimCampaignLease(id, leaseToken, leaseSeconds = 90) {
  const { rows } = await pool.query(
    `UPDATE invite_campaigns SET
       status = 'sending',
       processing_started_at = COALESCE(processing_started_at, now()),
       lease_expires_at = now() + ($2 * interval '1 second'),
       lease_token = $3,
       updated_at = now()
     WHERE id = $1
       AND (
         status = 'queued'
         OR (
           status = 'sending'
           AND (lease_expires_at IS NULL OR lease_expires_at < now())
         )
       )
     RETURNING *`,
    [id, leaseSeconds, leaseToken]
  )
  return mapCampaign(rows[0])
}

export async function extendCampaignLease(id, leaseToken, leaseSeconds = 90) {
  const { rowCount } = await pool.query(
    `UPDATE invite_campaigns SET
       lease_expires_at = now() + ($2 * interval '1 second'),
       updated_at = now()
     WHERE id = $1 AND status = 'sending' AND lease_token = $3`,
    [id, leaseSeconds, leaseToken]
  )
  return rowCount > 0
}

export async function claimRecipientBatch(campaignId, limit = 20) {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    await client.query(
      `UPDATE invite_campaign_recipients
       SET status = 'pending'
       WHERE campaign_id = $1 AND status = 'processing'`,
      [campaignId]
    )
    const { rows } = await client.query(
      `SELECT * FROM invite_campaign_recipients
       WHERE campaign_id = $1
         AND status = 'pending'
         AND next_attempt_at <= now()
       ORDER BY next_attempt_at, created_at
       FOR UPDATE SKIP LOCKED
       LIMIT $2`,
      [campaignId, limit]
    )
    if (rows.length) {
      await client.query(
        `UPDATE invite_campaign_recipients
         SET status = 'processing'
         WHERE id = ANY($1::uuid[])`,
        [rows.map((row) => row.id)]
      )
    }
    await client.query('COMMIT')
    return rows.map((row) => ({
      ...mapRecipient(row),
      status: 'processing',
      guestToken: row.guest_token ?? null,
    }))
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

export async function markRecipientAttempt(
  id,
  { status, error = null, nextAttemptAt = null }
) {
  await pool.query(
    `UPDATE invite_campaign_recipients SET
       status = $2,
       error = $3,
       attempt_count = attempt_count + 1,
       last_attempt_at = now(),
       next_attempt_at = COALESCE($4, next_attempt_at),
       sent_at = CASE WHEN $2 = 'sent' THEN now() ELSE sent_at END
     WHERE id = $1 AND status = 'processing'`,
    [id, status, error, nextAttemptAt]
  )
}

export async function getDeliverySummary(campaignId) {
  const { rows } = await pool.query(
    `SELECT
       COUNT(*)::int AS recipient_count,
       COUNT(*) FILTER (WHERE status = 'pending')::int AS pending_count,
       COUNT(*) FILTER (WHERE status = 'processing')::int AS processing_count,
       COUNT(*) FILTER (WHERE status = 'sent')::int AS sent_count,
       COUNT(*) FILTER (WHERE status = 'failed')::int AS failed_count,
       COUNT(*) FILTER (WHERE status = 'skipped')::int AS skipped_count,
       MIN(next_attempt_at) FILTER (WHERE status = 'pending') AS next_attempt_at
     FROM invite_campaign_recipients
     WHERE campaign_id = $1`,
    [campaignId]
  )
  const row = rows[0]
  return {
    recipientCount: Number(row.recipient_count),
    pendingCount: Number(row.pending_count),
    processingCount: Number(row.processing_count),
    sentCount: Number(row.sent_count),
    failedCount: Number(row.failed_count),
    skippedCount: Number(row.skipped_count),
    nextAttemptAt: row.next_attempt_at ?? null,
  }
}

export async function releaseToQueue(id, leaseToken, summary) {
  await pool.query(
    `UPDATE invite_campaigns SET
       status = 'queued',
       recipient_count = $2,
       sent_count = $3,
       failed_count = $4,
       skipped_count = $5,
       lease_expires_at = NULL,
       lease_token = NULL,
       updated_at = now()
     WHERE id = $1 AND status = 'sending' AND lease_token = $6`,
    [
      id,
      summary.recipientCount,
      summary.sentCount,
      summary.failedCount,
      summary.skippedCount,
      leaseToken,
    ]
  )
  return findById(id)
}

export async function finishLeased(id, leaseToken, summary) {
  const status =
    summary.failedCount === 0
      ? 'sent'
      : summary.sentCount === 0
        ? 'failed'
        : 'sent_with_errors'
  const { rowCount } = await pool.query(
    `UPDATE invite_campaigns SET
       status = $3,
       recipient_count = $4,
       sent_count = $5,
       failed_count = $6,
       skipped_count = $7,
       sent_at = COALESCE(sent_at, now()),
       lease_expires_at = NULL,
       lease_token = NULL,
       updated_at = now()
     WHERE id = $1 AND status = 'sending' AND lease_token = $2`,
    [
      id,
      leaseToken,
      status,
      summary.recipientCount,
      summary.sentCount,
      summary.failedCount,
      summary.skippedCount,
    ]
  )
  return rowCount ? findById(id) : null
}

export async function listDueCampaignIds(limit = 5) {
  const { rows } = await pool.query(
    `SELECT c.id
     FROM invite_campaigns c
     WHERE (
       c.status = 'queued'
       OR (
         c.status = 'sending'
         AND (c.lease_expires_at IS NULL OR c.lease_expires_at < now())
       )
     )
       AND EXISTS (
         SELECT 1
         FROM invite_campaign_recipients r
         WHERE r.campaign_id = c.id
           AND (
             (r.status = 'pending' AND r.next_attempt_at <= now())
             OR r.status = 'processing'
           )
       )
     ORDER BY c.queued_at, c.updated_at
     LIMIT $1`,
    [limit]
  )
  return rows.map((row) => row.id)
}

export async function finishFromRecipients(id) {
  const { rows } = await pool.query(
    `SELECT
       COUNT(*)::int AS recipient_count,
       COUNT(*) FILTER (WHERE status = 'sent')::int AS sent_count,
       COUNT(*) FILTER (WHERE status = 'failed')::int AS failed_count,
       COUNT(*) FILTER (WHERE status = 'skipped')::int AS skipped_count
     FROM invite_campaign_recipients
     WHERE campaign_id = $1`,
    [id]
  )
  return finish(id, {
    recipientCount: rows[0].recipient_count,
    sentCount: rows[0].sent_count,
    failedCount: rows[0].failed_count,
    skippedCount: rows[0].skipped_count,
  })
}
