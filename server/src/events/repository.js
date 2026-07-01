import { randomUUID } from 'node:crypto'
import { pool } from '../db/pool.js'

// Converte um valor de data (ISO/Date) num objeto Date que o node-postgres
// grava em colunas TIMESTAMPTZ (instante normalizado em UTC).
const toDb = (v) => (v == null ? null : new Date(v))

// Mapeia a linha da BD para a forma usada pela aplicação (alinhada com apiService).
function mapRow(row) {
  if (!row) return null
  const start = new Date(row.start_datetime)
  const end = row.end_datetime ? new Date(row.end_datetime) : null
  const pad = (n) => String(n).padStart(2, '0')
  const dateKey = `${start.getFullYear()}-${pad(start.getMonth() + 1)}-${pad(start.getDate())}`
  const hhmm = (d) => (d ? `${pad(d.getHours())}:${pad(d.getMinutes())}` : null)
  const allDay = !!row.all_day
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    date: dateKey,
    startDatetime: row.start_datetime,
    endDatetime: row.end_datetime,
    timeStart: allDay ? null : hhmm(start),
    timeEnd: allDay ? null : hhmm(end),
    allDay,
    location: row.location,
    community: row.community,
    category: row.category,
    status: row.status,
    isPrivate: !!row.is_private,
    privacyTag: row.privacy_tag ?? null,
    bannerUrl: row.banner_url,
    organizerName: row.organizer_name ?? null,
    organizerContact: row.organizer_contact ?? null,
    registrationUrl: row.registration_url ?? null,
    attachmentUrl: row.attachment_url ?? null,
    attachmentName: row.attachment_name ?? null,
    mapUrl: row.map_url ?? null,
    mapLat: row.map_lat ?? null,
    mapLng: row.map_lng ?? null,
    seriesId: row.series_id ?? null,
    externalId: row.external_id,
    rejectionReason: row.rejection_reason,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    submittedAt: row.submitted_at,
    publishedAt: row.published_at,
  }
}

export async function findById(id) {
  const { rows } = await pool.query('SELECT * FROM events WHERE id = $1', [id])
  return mapRow(rows[0])
}

// Lista com filtros opcionais. `status` aceita string ou array de estados.
// `communities` restringe às igrejas indicadas (acesso por igreja).
// `from`/`to` filtram por data de início (YYYY-MM-DD, inclusivo).
// `allowedPrivacyTags` (só quando `includePrivate`): restringe os eventos
// privados às etiquetas indicadas (eventos sem etiqueta são sempre visíveis).
export async function list({ status, createdBy, includePrivate = true, allowedPrivacyTags, communities, from, to } = {}) {
  const where = []
  const params = []
  if (status) {
    const statuses = Array.isArray(status) ? status : [status]
    if (statuses.length > 0) {
      params.push(statuses)
      where.push(`status = ANY($${params.length})`)
    }
  }
  if (createdBy) {
    params.push(createdBy)
    where.push(`created_by = $${params.length}`)
  }
  if (Array.isArray(communities) && communities.length > 0) {
    params.push(communities)
    where.push(`community = ANY($${params.length})`)
  }
  if (from) {
    params.push(from)
    where.push(`start_datetime >= $${params.length}::date`)
  }
  if (to) {
    params.push(to)
    where.push(`start_datetime < ($${params.length}::date + INTERVAL '1 day')`)
  }
  if (!includePrivate) {
    where.push('is_private = FALSE')
  } else if (Array.isArray(allowedPrivacyTags) && allowedPrivacyTags.length > 0) {
    // Eventos públicos, ou privados sem etiqueta, ou privados cuja etiqueta
    // esteja na lista permitida do utilizador.
    params.push(allowedPrivacyTags)
    where.push(
      `(is_private = FALSE OR privacy_tag IS NULL OR privacy_tag = ANY($${params.length}))`
    )
  }
  const sql = `
    SELECT * FROM events
    ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
    ORDER BY start_datetime ASC
  `
  const { rows } = await pool.query(sql, params)
  return rows.map(mapRow)
}

export async function insert(data, actorId) {
  const id = randomUUID()
  await pool.query(
    `INSERT INTO events
      (id, title, description, start_datetime, end_datetime, all_day, location,
       community, category, is_private, privacy_tag, banner_url,
       organizer_name, organizer_contact, registration_url,
       attachment_url, attachment_name, map_url, map_lat, map_lng,
       series_id, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22)`,
    [
      id,
      data.title,
      data.description ?? null,
      toDb(data.startDatetime),
      toDb(data.endDatetime),
      data.allDay ?? false,
      data.location ?? null,
      data.community ?? 'Sede',
      data.category ?? 'evento',
      data.isPrivate ?? false,
      data.privacyTag ?? null,
      data.bannerUrl ?? null,
      data.organizerName ?? null,
      data.organizerContact ?? null,
      data.registrationUrl ?? null,
      data.attachmentUrl ?? null,
      data.attachmentName ?? null,
      data.mapUrl ?? null,
      data.mapLat ?? null,
      data.mapLng ?? null,
      data.seriesId ?? null,
      actorId ?? null,
    ]
  )
  return findById(id)
}

export async function update(id, data) {
  await pool.query(
    `UPDATE events SET
       title = $2,
       description = $3,
       start_datetime = $4,
       end_datetime = $5,
       all_day = $6,
       location = $7,
       community = $8,
       category = $9,
       is_private = $10,
       privacy_tag = $11,
       banner_url = $12,
       organizer_name = $13,
       organizer_contact = $14,
       registration_url = $15,
       attachment_url = $16,
       attachment_name = $17,
       map_url = $18,
       map_lat = $19,
       map_lng = $20,
       updated_at = now()
     WHERE id = $1`,
    [
      id,
      data.title,
      data.description ?? null,
      toDb(data.startDatetime),
      toDb(data.endDatetime),
      data.allDay ?? false,
      data.location ?? null,
      data.community ?? 'Sede',
      data.category ?? 'evento',
      data.isPrivate ?? false,
      data.privacyTag ?? null,
      data.bannerUrl ?? null,
      data.organizerName ?? null,
      data.organizerContact ?? null,
      data.registrationUrl ?? null,
      data.attachmentUrl ?? null,
      data.attachmentName ?? null,
      data.mapUrl ?? null,
      data.mapLat ?? null,
      data.mapLng ?? null,
    ]
  )
  return findById(id)
}

// Atualiza apenas o estado (transições do fluxo de aprovação).
export async function updateStatus(id, { status, rejectionReason = null, touchSubmitted = false, touchPublished = false }) {
  await pool.query(
    `UPDATE events SET
       status = $2,
       rejection_reason = $3,
       submitted_at = CASE WHEN $4 THEN now() ELSE submitted_at END,
       published_at = CASE WHEN $5 THEN now() ELSE published_at END,
       updated_at = now()
     WHERE id = $1`,
    [id, status, rejectionReason, touchSubmitted, touchPublished]
  )
  return findById(id)
}

export async function remove(id) {
  await pool.query('DELETE FROM events WHERE id = $1', [id])
}

// Elimina todas as ocorrências de uma série. Devolve o número de linhas.
export async function removeSeries(seriesId) {
  const { rowCount } = await pool.query('DELETE FROM events WHERE series_id = $1', [seriesId])
  return rowCount
}

// Aplica os campos partilhados (exceto datas) às restantes ocorrências da
// série, preservando a data/hora própria de cada ocorrência.
export async function updateSeriesShared(seriesId, data, exceptId) {
  await pool.query(
    `UPDATE events SET
       title = $2,
       description = $3,
       all_day = $4,
       location = $5,
       community = $6,
       category = $7,
       is_private = $8,
       privacy_tag = $9,
       banner_url = $10,
       organizer_name = $11,
       organizer_contact = $12,
       registration_url = $13,
       attachment_url = $14,
       attachment_name = $15,
       map_url = $16,
       map_lat = $17,
       map_lng = $18,
       updated_at = now()
     WHERE series_id = $1 AND id <> $19`,
    [
      seriesId,
      data.title,
      data.description ?? null,
      data.allDay ?? false,
      data.location ?? null,
      data.community ?? 'Sede',
      data.category ?? 'evento',
      data.isPrivate ?? false,
      data.privacyTag ?? null,
      data.bannerUrl ?? null,
      data.organizerName ?? null,
      data.organizerContact ?? null,
      data.registrationUrl ?? null,
      data.attachmentUrl ?? null,
      data.attachmentName ?? null,
      data.mapUrl ?? null,
      data.mapLat ?? null,
      data.mapLng ?? null,
      exceptId,
    ]
  )
}

// Guarda a referência externa (id na inChurch) após sincronização.
export async function setExternalId(id, externalId) {
  await pool.query(
    'UPDATE events SET external_id = $2, updated_at = now() WHERE id = $1',
    [id, externalId]
  )
}

export async function addHistory({ eventId, actorId, fromStatus, toStatus, comment = null }) {
  await pool.query(
    `INSERT INTO event_history (id, event_id, actor_id, from_status, to_status, comment)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [randomUUID(), eventId, actorId ?? null, fromStatus, toStatus, comment]
  )
}

export async function listHistory(eventId) {
  const { rows } = await pool.query(
    `SELECT h.*, u.email AS actor_email, u.name AS actor_name
     FROM event_history h
     LEFT JOIN users u ON u.id = h.actor_id
     WHERE h.event_id = $1
     ORDER BY h.created_at ASC`,
    [eventId]
  )
  return rows
}
