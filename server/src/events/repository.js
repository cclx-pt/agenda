import { randomUUID } from 'node:crypto'
import { pool } from '../db/pool.js'

// Converte um valor de data (ISO/Date) num objeto Date que o node-postgres
// grava em colunas TIMESTAMPTZ (instante normalizado em UTC).
const toDb = (v) => (v == null ? null : new Date(v))

// Fuso horário da igreja. As datas/horas dos eventos são "de parede" neste fuso
// (Lisboa), independentemente do fuso do servidor. O Vercel corre em UTC, pelo
// que extrair a hora com getHours() mostrava menos 1h no verão (WEST) do que a
// hora introduzida no formulário (que corre no browser, em horário de Lisboa).
// O Intl trata do horário de verão automaticamente.
const EVENT_TIME_ZONE = 'Europe/Lisbon'
const zonedPartsFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: EVENT_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
})

// Devolve { dateKey: 'YYYY-MM-DD', time: 'HH:MM' } no fuso da igreja, ou null.
function zonedParts(value) {
  if (value == null) return null
  const d = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(d.getTime())) return null
  const parts = {}
  for (const part of zonedPartsFormatter.formatToParts(d)) {
    if (part.type !== 'literal') parts[part.type] = part.value
  }
  return { dateKey: `${parts.year}-${parts.month}-${parts.day}`, time: `${parts.hour}:${parts.minute}` }
}

// Mapeia a linha da BD para a forma usada pela aplicação (alinhada com apiService).
function mapRow(row) {
  if (!row) return null
  const startParts = zonedParts(row.start_datetime)
  const endParts = zonedParts(row.end_datetime)
  const allDay = !!row.all_day
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    date: startParts?.dateKey ?? null,
    endDate: endParts?.dateKey ?? null,
    startDatetime: row.start_datetime,
    endDatetime: row.end_datetime,
    timeStart: allDay ? null : (startParts?.time ?? null),
    timeEnd: allDay ? null : (endParts?.time ?? null),
    allDay,
    location: row.location,
    community: row.community,
    category: row.category,
    subcategory: row.subcategory ?? null,
    featured: !!row.featured,
    loop: !!row.loop,
    isGeneral: !!row.is_general,
    status: row.status,
    isPrivate: !!row.is_private,
    privacyTag: row.privacy_tag ?? null,
    bannerUrl: row.banner_url,
    loopImage16x9: row.loop_image_16x9 ?? null,
    loopImage32x9: row.loop_image_32x9 ?? null,
    organizerName: row.organizer_name ?? null,
    organizerContact: row.organizer_contact ?? null,
    organizerPhone: row.organizer_phone ?? null,
    organizerEmail: row.organizer_email ?? null,
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

// Eventos cujo horário se cruza com [start, end). Considera o dia inteiro dos
// eventos all_day. `statuses` limita os estados. Exclui, se pedido, um id e/ou
// uma série (para editar sem colidir consigo próprio).
export async function findOverlaps({ start, end, excludeId, excludeSeriesId, statuses = ['publicado', 'pendente'] }) {
  const params = [start, end, statuses]
  const where = [
    'status = ANY($3)',
    "(CASE WHEN all_day THEN date_trunc('day', start_datetime) ELSE start_datetime END) < $2",
    "(CASE WHEN all_day THEN date_trunc('day', start_datetime) + interval '1 day' ELSE COALESCE(end_datetime, start_datetime + interval '1 hour') END) > $1",
  ]
  let i = 4
  if (excludeId) {
    where.push(`id <> $${i}`)
    params.push(excludeId)
    i += 1
  }
  if (excludeSeriesId) {
    where.push(`(series_id IS NULL OR series_id <> $${i})`)
    params.push(excludeSeriesId)
  }
  const { rows } = await pool.query(
    `SELECT * FROM events WHERE ${where.join(' AND ')} ORDER BY start_datetime LIMIT 50`,
    params
  )
  return rows.map(mapRow)
}

// Lista com filtros opcionais. `status` aceita string ou array de estados.
// `communities` restringe às igrejas indicadas (acesso por igreja).
// `from`/`to` (YYYY-MM-DD) devolvem eventos cujo intervalo se cruza com o
// período visível — inclui eventos de vários dias que começam antes de `from`
// mas ainda decorrem.
// `allowedPrivacyTags` (só quando `includePrivate`): restringe os eventos
// privados às etiquetas indicadas (eventos sem etiqueta são sempre visíveis).
export async function list({ status, createdBy, includePrivate = true, allowedPrivacyTags, communities, subcategories, from, to } = {}) {
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
  if (Array.isArray(subcategories) && subcategories.length > 0) {
    params.push(subcategories)
    where.push(`subcategory = ANY($${params.length})`)
  }
  // Interseção com o intervalo visível: inclui eventos de vários dias que
  // começam antes de `from` mas ainda decorrem, e que começam até `to`.
  if (from) {
    params.push(from)
    where.push(`COALESCE(end_datetime, start_datetime) >= $${params.length}::date`)
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

// Categorias distintas em uso por qualquer evento (independentemente do estado).
export async function distinctCategories() {
  const { rows } = await pool.query(
    'SELECT DISTINCT category FROM events WHERE category IS NOT NULL'
  )
  return rows.map((r) => r.category).filter(Boolean)
}

// Subcategorias distintas em uso por qualquer evento (independentemente do estado).
export async function distinctSubcategories() {
  const { rows } = await pool.query(
    'SELECT DISTINCT subcategory FROM events WHERE subcategory IS NOT NULL'
  )
  return rows.map((r) => r.subcategory).filter(Boolean)
}

// Eventos publicados marcados para o Loop (carrossel TV) de uma igreja: os da
// própria comunidade + (opcional) os "gerais", dentro do intervalo de datas.
export async function listForLoop({ church, includeGeneral = true, from, to } = {}) {
  const where = ["status = 'publicado'", 'loop = TRUE']
  const params = []
  if (from) {
    params.push(from)
    where.push(`start_datetime >= $${params.length}::date`)
  }
  if (to) {
    params.push(to)
    where.push(`start_datetime < ($${params.length}::date + INTERVAL '1 day')`)
  }
  params.push(church)
  where.push(
    includeGeneral
      ? `(lower(community) = lower($${params.length}) OR is_general = TRUE)`
      : `lower(community) = lower($${params.length})`
  )
  const { rows } = await pool.query(
    `SELECT * FROM events WHERE ${where.join(' AND ')} ORDER BY start_datetime ASC`,
    params
  )
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
       series_id, created_by, organizer_phone, organizer_email, subcategory, featured, loop, is_general,
       loop_image_16x9, loop_image_32x9)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30)`,
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
      data.organizerPhone ?? null,
      data.organizerEmail ?? null,
      data.subcategory ?? null,
      data.featured ?? false,
      data.loop ?? false,
      data.isGeneral ?? false,
      data.loopImage16x9 ?? null,
      data.loopImage32x9 ?? null,
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
       organizer_phone = $21,
       organizer_email = $22,
       subcategory = $23,
       featured = $24,
       loop = $25,
       is_general = $26,
       loop_image_16x9 = $27,
       loop_image_32x9 = $28,
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
      data.organizerPhone ?? null,
      data.organizerEmail ?? null,
      data.subcategory ?? null,
      data.featured ?? false,
      data.loop ?? false,
      data.isGeneral ?? false,
      data.loopImage16x9 ?? null,
      data.loopImage32x9 ?? null,
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
       organizer_phone = $19,
       organizer_email = $20,
       subcategory = $21,
       featured = $22,
       loop = $23,
       is_general = $24,
       loop_image_16x9 = $25,
       loop_image_32x9 = $26,
       updated_at = now()
     WHERE series_id = $1 AND id <> $27`,
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
      data.organizerPhone ?? null,
      data.organizerEmail ?? null,
      data.subcategory ?? null,
      data.featured ?? false,
      data.loop ?? false,
      data.isGeneral ?? false,
      data.loopImage16x9 ?? null,
      data.loopImage32x9 ?? null,
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

// Atualiza APENAS a data/hora de um evento (aplicação de um pedido de alteração
// a um evento publicado). Não toca nos restantes campos.
export async function updateDateTime(id, { startDatetime, endDatetime, allDay }) {
  await pool.query(
    `UPDATE events SET
       start_datetime = $2,
       end_datetime = $3,
       all_day = $4,
       updated_at = now()
     WHERE id = $1`,
    [id, toDb(startDatetime), toDb(endDatetime), allDay ?? false]
  )
  return findById(id)
}

// Elimina as ocorrências de uma série a partir de um instante (inclusive),
// opcionalmente excluindo um id (a ocorrência âncora, que é reaproveitada). Usado
// ao regenerar as ocorrências FUTURAS de uma série numa alteração de recorrência.
export async function removeSeriesFrom(seriesId, fromInstant, exceptId = null) {
  const params = [seriesId, toDb(fromInstant)]
  let sql = 'DELETE FROM events WHERE series_id = $1 AND start_datetime >= $2'
  if (exceptId) {
    params.push(exceptId)
    sql += ` AND id <> $${params.length}`
  }
  const { rowCount } = await pool.query(sql, params)
  return rowCount
}

// Associa um evento a uma série (ao converter um evento único em recorrente).
export async function setSeriesId(id, seriesId) {
  await pool.query('UPDATE events SET series_id = $2, updated_at = now() WHERE id = $1', [id, seriesId])
}

// ── Pedidos de alteração (data/hora/recorrência) a eventos publicados ─────────

function mapChangeRequest(row) {
  if (!row) return null
  const startParts = zonedParts(row.start_datetime)
  const endParts = zonedParts(row.end_datetime)
  const allDay = !!row.all_day
  return {
    id: row.id,
    eventId: row.event_id,
    seriesId: row.series_id ?? null,
    scope: row.scope,
    startDatetime: row.start_datetime,
    endDatetime: row.end_datetime,
    date: startParts?.dateKey ?? null,
    endDate: endParts?.dateKey ?? null,
    timeStart: allDay ? null : (startParts?.time ?? null),
    timeEnd: allDay ? null : (endParts?.time ?? null),
    allDay,
    recurrence: row.recurrence ?? null,
    reason: row.reason ?? null,
    status: row.status,
    rejectionReason: row.rejection_reason ?? null,
    requestedBy: row.requested_by ?? null,
    resolvedBy: row.resolved_by ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    resolvedAt: row.resolved_at ?? null,
    // Campos vindos do JOIN (contexto do evento e do requerente), quando pedidos.
    requesterName: row.requester_name ?? null,
    requesterEmail: row.requester_email ?? null,
    eventTitle: row.event_title ?? null,
    eventCommunity: row.event_community ?? null,
    eventCategory: row.event_category ?? null,
    eventSubcategory: row.event_subcategory ?? null,
    eventPrivacyTag: row.event_privacy_tag ?? null,
    eventStatus: row.event_status ?? null,
    // Data/hora ATUAL do evento (para mostrar "de → para").
    eventStartDatetime: row.event_start_datetime ?? null,
    eventEndDatetime: row.event_end_datetime ?? null,
    eventDate: zonedParts(row.event_start_datetime)?.dateKey ?? null,
    eventTimeStart: row.event_all_day ? null : (zonedParts(row.event_start_datetime)?.time ?? null),
    eventAllDay: row.event_all_day == null ? null : !!row.event_all_day,
  }
}

// SELECT com o contexto do evento e do requerente, partilhado pelas leituras.
const CHANGE_SELECT = `
  SELECT c.*,
         ru.name  AS requester_name,
         ru.email AS requester_email,
         e.title          AS event_title,
         e.community      AS event_community,
         e.category       AS event_category,
         e.subcategory    AS event_subcategory,
         e.privacy_tag    AS event_privacy_tag,
         e.status         AS event_status,
         e.start_datetime AS event_start_datetime,
         e.end_datetime   AS event_end_datetime,
         e.all_day        AS event_all_day
  FROM event_change_requests c
  LEFT JOIN users ru ON ru.id = c.requested_by
  LEFT JOIN events e ON e.id = c.event_id
`

export async function insertChangeRequest(data) {
  const id = randomUUID()
  await pool.query(
    `INSERT INTO event_change_requests
      (id, event_id, series_id, scope, start_datetime, end_datetime, all_day,
       recurrence, reason, requested_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
    [
      id,
      data.eventId,
      data.seriesId ?? null,
      data.scope ?? 'single',
      toDb(data.startDatetime),
      toDb(data.endDatetime),
      data.allDay ?? false,
      data.recurrence ? JSON.stringify(data.recurrence) : null,
      data.reason ?? null,
      data.requestedBy ?? null,
    ]
  )
  return findChangeRequestById(id)
}

export async function findChangeRequestById(id) {
  const { rows } = await pool.query(`${CHANGE_SELECT} WHERE c.id = $1`, [id])
  return mapChangeRequest(rows[0])
}

// Lista pedidos de alteração por estado (string ou array). Mais recentes primeiro.
export async function listChangeRequests({ status } = {}) {
  const params = []
  let where = ''
  if (status) {
    const statuses = Array.isArray(status) ? status : [status]
    if (statuses.length > 0) {
      params.push(statuses)
      where = `WHERE c.status = ANY($${params.length})`
    }
  }
  const { rows } = await pool.query(
    `${CHANGE_SELECT} ${where} ORDER BY c.created_at DESC`,
    params
  )
  return rows.map(mapChangeRequest)
}

export async function updateChangeRequestStatus(id, { status, rejectionReason = null, resolvedBy = null }) {
  await pool.query(
    `UPDATE event_change_requests SET
       status = $2,
       rejection_reason = $3,
       resolved_by = $4,
       resolved_at = now(),
       updated_at = now()
     WHERE id = $1`,
    [id, status, rejectionReason, resolvedBy]
  )
  return findChangeRequestById(id)
}

// Remove um pedido de alteração (usado como rollback quando a aplicação imediata
// falha após o registo do pedido).
export async function deleteChangeRequest(id) {
  await pool.query('DELETE FROM event_change_requests WHERE id = $1', [id])
}
