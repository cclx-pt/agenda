import { randomUUID } from 'node:crypto'
import { pool } from '../db/pool.js'

function toDateStr(value) {
  if (!value) return null
  if (typeof value === 'string') return value.slice(0, 10)
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return null
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function mapCampaign(row) {
  if (!row) return null
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    purpose: row.purpose,
    targetEur: Number(row.target_eur),
    deadline: toDateStr(row.deadline),
    configurations: row.configurations ?? [],
    visibilityMode: row.visibility_mode,
    phasePlan: row.phase_plan ?? null,
    status: row.status,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    totalReceived: Number(row.total_received ?? 0),
    donorCount: Number(row.donor_count ?? 0),
    donationCount: Number(row.donation_count ?? 0),
    pledgedTotal: Number(row.pledged_total ?? 0),
  }
}

function mapDonation(row) {
  if (!row) return null
  return {
    id: row.id,
    campaignId: row.campaign_id,
    receiptNo: row.receipt_no,
    date: toDateStr(row.donation_date),
    amountEur: Number(row.amount_eur),
    channel: row.channel,
    configId: row.config_id,
    donorName: row.donor_name ?? null,
    donorContact: row.donor_contact ?? null,
    pledgeRef: row.pledge_ref ?? null,
    proofRef: row.proof_ref,
    recordedBy: row.recorded_by,
    reconciled: !!row.reconciled,
    reconciledBy: row.reconciled_by ?? null,
    reconciledAt: row.reconciled_at ?? null,
    notes: row.notes ?? null,
    createdAt: row.created_at,
  }
}

function mapPledge(row) {
  if (!row) return null
  return {
    id: row.id,
    campaignId: row.campaign_id,
    donorName: row.donor_name,
    contact: row.contact ?? null,
    pledgedAmount: Number(row.pledged_amount),
    schedule: row.schedule,
    promisedDate: toDateStr(row.promised_date),
    receivedToDate: Number(row.received_to_date ?? 0),
    status: row.status,
    lastFollowUp: toDateStr(row.last_follow_up),
    consentRecorded: !!row.consent_recorded,
    accessGranted: !!row.access_granted,
    accessRevokedDate: toDateStr(row.access_revoked_date),
    createdAt: row.created_at,
  }
}

const CAMPAIGN_SELECT = `
  SELECT c.*,
    COALESCE(d.total_received, 0) AS total_received,
    COALESCE(d.donor_count, 0) AS donor_count,
    COALESCE(d.donation_count, 0) AS donation_count,
    COALESCE(p.pledged_total, 0) AS pledged_total
  FROM funding_campaigns c
  LEFT JOIN (
    SELECT campaign_id, SUM(amount_eur) AS total_received,
      COUNT(DISTINCT NULLIF(lower(donor_name), 'anonymous')) AS donor_count,
      COUNT(*) AS donation_count
    FROM funding_donations GROUP BY campaign_id
  ) d ON d.campaign_id = c.id
  LEFT JOIN (
    SELECT campaign_id, SUM(pledged_amount) AS pledged_total
    FROM funding_pledges GROUP BY campaign_id
  ) p ON p.campaign_id = c.id`

export async function listCampaigns() {
  const { rows } = await pool.query(`${CAMPAIGN_SELECT} ORDER BY c.created_at DESC`)
  return rows.map(mapCampaign)
}

export async function findCampaignById(id) {
  const { rows } = await pool.query(`${CAMPAIGN_SELECT} WHERE c.id = $1`, [id])
  return mapCampaign(rows[0])
}

export async function findCampaignBySlug(slug) {
  const { rows } = await pool.query(`${CAMPAIGN_SELECT} WHERE c.slug = $1`, [slug])
  return mapCampaign(rows[0])
}

export async function insertCampaign(data, actorId) {
  const id = randomUUID()
  await pool.query(
    `INSERT INTO funding_campaigns
      (id, slug, title, purpose, target_eur, deadline, configurations,
       visibility_mode, phase_plan, status, created_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
    [id, data.slug, data.title, data.purpose, data.targetEur, data.deadline,
      data.configurations, data.visibilityMode, data.phasePlan, data.status, actorId]
  )
  return findCampaignById(id)
}

export async function updateCampaign(id, data) {
  await pool.query(
    `UPDATE funding_campaigns SET title=$2, purpose=$3, target_eur=$4,
       deadline=$5, configurations=$6, visibility_mode=$7, phase_plan=$8,
       status=$9, updated_at=now() WHERE id=$1`,
    [id, data.title, data.purpose, data.targetEur, data.deadline,
      data.configurations, data.visibilityMode, data.phasePlan, data.status]
  )
  return findCampaignById(id)
}

export async function deleteEmptyCampaign(id) {
  const { rowCount } = await pool.query(
    `DELETE FROM funding_campaigns c
     WHERE c.id=$1
       AND NOT EXISTS (SELECT 1 FROM funding_donations d WHERE d.campaign_id=c.id)
       AND NOT EXISTS (SELECT 1 FROM funding_pledges p WHERE p.campaign_id=c.id)`,
    [id]
  )
  return rowCount > 0
}

export async function listDonations(campaignId) {
  const { rows } = await pool.query(
    'SELECT * FROM funding_donations WHERE campaign_id=$1 ORDER BY donation_date DESC, created_at DESC',
    [campaignId]
  )
  return rows.map(mapDonation)
}

export async function insertDonation(campaignId, data, actorId) {
  const id = randomUUID()
  await pool.query(
    `INSERT INTO funding_donations
      (id, campaign_id, receipt_no, donation_date, amount_eur, channel,
       config_id, donor_name, donor_contact, pledge_ref, proof_ref,
       recorded_by, notes)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
    [id, campaignId, data.receiptNo, data.date, data.amountEur, data.channel,
      data.configId, data.donorName, data.donorContact, data.pledgeRef,
      data.proofRef, actorId, data.notes]
  )
  const { rows } = await pool.query('SELECT * FROM funding_donations WHERE id=$1', [id])
  return mapDonation(rows[0])
}

export async function setDonationReconciled(campaignId, id, reconciled, actorId) {
  const { rows } = await pool.query(
    `UPDATE funding_donations SET reconciled=$2,
       reconciled_by=CASE WHEN $2 THEN $3 ELSE NULL END,
       reconciled_at=CASE WHEN $2 THEN now() ELSE NULL END
     WHERE id=$1 AND campaign_id=$4 RETURNING *`,
    [id, reconciled, actorId, campaignId]
  )
  return mapDonation(rows[0])
}

export async function listPledges(campaignId) {
  const { rows } = await pool.query(
    `SELECT p.*, COALESCE(SUM(d.amount_eur),0) AS received_to_date
     FROM funding_pledges p
     LEFT JOIN funding_donations d ON d.pledge_ref=p.id
     WHERE p.campaign_id=$1 GROUP BY p.id ORDER BY p.created_at DESC`,
    [campaignId]
  )
  return rows.map(mapPledge)
}

export async function pledgeBelongsToCampaign(id, campaignId) {
  const { rowCount } = await pool.query(
    'SELECT 1 FROM funding_pledges WHERE id=$1 AND campaign_id=$2',
    [id, campaignId]
  )
  return rowCount > 0
}

export async function insertPledge(campaignId, data) {
  const id = randomUUID()
  await pool.query(
    `INSERT INTO funding_pledges
      (id, campaign_id, donor_name, contact, pledged_amount, schedule,
       promised_date, consent_recorded, access_granted)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
    [id, campaignId, data.donorName, data.contact, data.pledgedAmount,
      data.schedule, data.promisedDate, data.consentRecorded, data.accessGranted]
  )
  const { rows } = await pool.query(
    'SELECT p.*, 0 AS received_to_date FROM funding_pledges p WHERE id=$1',
    [id]
  )
  return mapPledge(rows[0])
}