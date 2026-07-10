import { randomUUID } from 'node:crypto'
import { pool } from '../db/pool.js'

// Converte data (ISO/Date) num Date para colunas TIMESTAMPTZ, ou null.
const toDb = (v) => (v == null || v === '' ? null : new Date(v))

// ── Mapeamento de linhas → forma da aplicação ────────────────────

function mapInvite(row) {
  if (!row) return null
  return {
    id: row.id,
    eventId: row.event_id ?? null,
    slug: row.slug,
    title: row.title,
    bannerUrl: row.banner_url ?? null,
    colorTheme: row.color_theme ?? null,
    startDatetime: row.start_datetime ?? null,
    endDatetime: row.end_datetime ?? null,
    location: row.location ?? null,
    metaTitle: row.meta_title ?? null,
    metaDescription: row.meta_description ?? null,
    metaImageUrl: row.meta_image_url ?? null,
    costType: row.cost_type,
    costAmount: row.cost_amount == null ? null : Number(row.cost_amount),
    costCurrency: row.cost_currency ?? 'EUR',
    paymentMethods: row.payment_methods ?? null,
    rsvpEnabled: !!row.rsvp_enabled,
    rsvpDeadline: row.rsvp_deadline ?? null,
    capacity: row.capacity ?? null,
    community: row.community ?? null,
    status: row.status,
    publishedAt: row.published_at ?? null,
    createdBy: row.created_by ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function mapBlock(row) {
  if (!row) return null
  return {
    id: row.id,
    inviteId: row.invite_id,
    type: row.type,
    order: row.ordering,
    content: row.content ?? {},
    visible: !!row.visible,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function mapGuest(row) {
  if (!row) return null
  return {
    id: row.id,
    inviteId: row.invite_id,
    token: row.token,
    name: row.name ?? null,
    email: row.email ?? null,
    phone: row.phone ?? null,
    guestsCount: row.guests_count ?? 1,
    rsvpState: row.rsvp_state,
    paymentState: row.payment_state,
    extra: row.extra ?? null,
    respondedAt: row.responded_at ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

// ── Convites ─────────────────────────────────────────────────────

export async function slugExists(slug) {
  const { rows } = await pool.query('SELECT 1 FROM invites WHERE slug = $1 LIMIT 1', [slug])
  return rows.length > 0
}

export async function insert(data, actorId) {
  const id = randomUUID()
  await pool.query(
    `INSERT INTO invites
      (id, event_id, slug, title, banner_url, color_theme, start_datetime, end_datetime,
       location, meta_title, meta_description, meta_image_url, cost_type, cost_amount,
       cost_currency, payment_methods, rsvp_enabled, rsvp_deadline, capacity, community,
       created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21)`,
    [
      id,
      data.eventId ?? null,
      data.slug,
      data.title,
      data.bannerUrl ?? null,
      data.colorTheme ?? null,
      toDb(data.startDatetime),
      toDb(data.endDatetime),
      data.location ?? null,
      data.metaTitle ?? null,
      data.metaDescription ?? null,
      data.metaImageUrl ?? null,
      data.costType ?? 'gratuito',
      data.costAmount ?? null,
      data.costCurrency ?? 'EUR',
      data.paymentMethods ? JSON.stringify(data.paymentMethods) : null,
      data.rsvpEnabled ?? true,
      toDb(data.rsvpDeadline),
      data.capacity ?? null,
      data.community ?? null,
      actorId ?? null,
    ]
  )
  return findById(id)
}

export async function findById(id) {
  const { rows } = await pool.query('SELECT * FROM invites WHERE id = $1', [id])
  return mapInvite(rows[0])
}

export async function findBySlug(slug) {
  const { rows } = await pool.query('SELECT * FROM invites WHERE slug = $1', [slug])
  return mapInvite(rows[0])
}

export async function list({ status, community, createdBy } = {}) {
  const where = []
  const params = []
  if (status) {
    const statuses = Array.isArray(status) ? status : [status]
    if (statuses.length > 0) {
      params.push(statuses)
      where.push(`status = ANY($${params.length})`)
    }
  }
  if (Array.isArray(community) && community.length > 0) {
    params.push(community)
    where.push(`community = ANY($${params.length})`)
  }
  if (createdBy) {
    params.push(createdBy)
    where.push(`created_by = $${params.length}`)
  }
  const { rows } = await pool.query(
    `SELECT * FROM invites ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY created_at DESC`,
    params
  )
  return rows.map(mapInvite)
}

// Atualiza os campos de página do convite (exceto slug/estado/created_by).
export async function update(id, data) {
  await pool.query(
    `UPDATE invites SET
       event_id = $2,
       title = $3,
       banner_url = $4,
       color_theme = $5,
       start_datetime = $6,
       end_datetime = $7,
       location = $8,
       meta_title = $9,
       meta_description = $10,
       meta_image_url = $11,
       cost_type = $12,
       cost_amount = $13,
       cost_currency = $14,
       payment_methods = $15,
       rsvp_enabled = $16,
       rsvp_deadline = $17,
       capacity = $18,
       community = $19,
       updated_at = now()
     WHERE id = $1`,
    [
      id,
      data.eventId ?? null,
      data.title,
      data.bannerUrl ?? null,
      data.colorTheme ?? null,
      toDb(data.startDatetime),
      toDb(data.endDatetime),
      data.location ?? null,
      data.metaTitle ?? null,
      data.metaDescription ?? null,
      data.metaImageUrl ?? null,
      data.costType ?? 'gratuito',
      data.costAmount ?? null,
      data.costCurrency ?? 'EUR',
      data.paymentMethods ? JSON.stringify(data.paymentMethods) : null,
      data.rsvpEnabled ?? true,
      toDb(data.rsvpDeadline),
      data.capacity ?? null,
      data.community ?? null,
    ]
  )
  return findById(id)
}

export async function updateStatus(id, { status, touchPublished = false }) {
  await pool.query(
    `UPDATE invites SET
       status = $2,
       published_at = CASE WHEN $3 THEN COALESCE(published_at, now()) ELSE published_at END,
       updated_at = now()
     WHERE id = $1`,
    [id, status, touchPublished]
  )
  return findById(id)
}

export async function remove(id) {
  await pool.query('DELETE FROM invites WHERE id = $1', [id])
}

// ── Blocos de conteúdo ───────────────────────────────────────────

export async function listBlocks(inviteId) {
  const { rows } = await pool.query(
    'SELECT * FROM invite_blocks WHERE invite_id = $1 ORDER BY ordering ASC, created_at ASC',
    [inviteId]
  )
  return rows.map(mapBlock)
}

// Substitui o conjunto completo de blocos de um convite (editor drag-and-drop
// que envia a lista inteira). Elimina os antigos e insere os novos por ordem.
export async function replaceBlocks(inviteId, blocks) {
  await pool.query('DELETE FROM invite_blocks WHERE invite_id = $1', [inviteId])
  let order = 0
  for (const block of blocks) {
    await pool.query(
      `INSERT INTO invite_blocks (id, invite_id, type, ordering, content, visible)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [
        randomUUID(),
        inviteId,
        block.type,
        order,
        JSON.stringify(block.content ?? {}),
        block.visible !== false,
      ]
    )
    order += 1
  }
  return listBlocks(inviteId)
}

// ── Convidados / RSVP ────────────────────────────────────────────

export async function insertGuest(inviteId, data) {
  const id = randomUUID()
  await pool.query(
    `INSERT INTO invite_guests
      (id, invite_id, token, name, email, phone, guests_count, rsvp_state, payment_state, extra, responded_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10, now())`,
    [
      id,
      inviteId,
      data.token,
      data.name ?? null,
      data.email ?? null,
      data.phone ?? null,
      data.guestsCount ?? 1,
      data.rsvpState ?? 'confirmed',
      data.paymentState ?? 'not_applicable',
      data.extra ? JSON.stringify(data.extra) : null,
    ]
  )
  return findGuestById(id)
}

export async function findGuestById(id) {
  const { rows } = await pool.query('SELECT * FROM invite_guests WHERE id = $1', [id])
  return mapGuest(rows[0])
}

export async function findGuestByToken(token) {
  const { rows } = await pool.query('SELECT * FROM invite_guests WHERE token = $1', [token])
  return mapGuest(rows[0])
}

export async function findGuestByEmail(inviteId, email) {
  const { rows } = await pool.query(
    'SELECT * FROM invite_guests WHERE invite_id = $1 AND lower(email) = lower($2) LIMIT 1',
    [inviteId, email]
  )
  return mapGuest(rows[0])
}

export async function listGuests(inviteId) {
  const { rows } = await pool.query(
    'SELECT * FROM invite_guests WHERE invite_id = $1 ORDER BY created_at DESC',
    [inviteId]
  )
  return rows.map(mapGuest)
}

export async function updateGuest(id, data) {
  await pool.query(
    `UPDATE invite_guests SET
       name = COALESCE($2, name),
       email = COALESCE($3, email),
       phone = COALESCE($4, phone),
       guests_count = COALESCE($5, guests_count),
       rsvp_state = COALESCE($6, rsvp_state),
       payment_state = COALESCE($7, payment_state),
       extra = COALESCE($8, extra),
       responded_at = now(),
       updated_at = now()
     WHERE id = $1`,
    [
      id,
      data.name ?? null,
      data.email ?? null,
      data.phone ?? null,
      data.guestsCount ?? null,
      data.rsvpState ?? null,
      data.paymentState ?? null,
      data.extra ? JSON.stringify(data.extra) : null,
    ]
  )
  return findGuestById(id)
}

// Soma de lugares confirmados (guests_count dos convidados 'confirmed'), para a
// verificação de capacidade.
export async function countConfirmedSeats(inviteId) {
  const { rows } = await pool.query(
    `SELECT COALESCE(SUM(guests_count), 0)::int AS seats
     FROM invite_guests WHERE invite_id = $1 AND rsvp_state = 'confirmed'`,
    [inviteId]
  )
  return rows[0]?.seats ?? 0
}

// ── Visualizações da página (métricas) ───────────────────────────

export async function recordView(inviteId, { referer, userAgent } = {}) {
  await pool.query(
    `INSERT INTO invite_page_views (id, invite_id, referer, user_agent)
     VALUES ($1, $2, $3, $4)`,
    [randomUUID(), inviteId, referer ?? null, userAgent ?? null]
  )
}

export async function countViews(inviteId) {
  const { rows } = await pool.query(
    'SELECT count(*)::int AS n FROM invite_page_views WHERE invite_id = $1',
    [inviteId]
  )
  return rows[0]?.n ?? 0
}
