import { randomUUID } from 'node:crypto'
import { pool } from '../db/pool.js'

// Igreja por omissão (espelha src/utils/churches.js / server churches).
const DEFAULT_CHURCH = 'Sede'

// Converte um valor de data (ISO/Date) num objeto Date para colunas TIMESTAMPTZ.
const toDb = (v) => (v == null ? null : new Date(v))

// Mapeia a linha da BD para a MESMA forma JSON que o frontend consome do SoR
// (ver mapSorEvent em src/services/apiService.js). Os eventos externos são
// sempre públicos/publicados e marcados com `isApi: true`; o id leva o prefixo
// `ic-` para o frontend os distinguir dos eventos geridos (não editáveis aqui).
function mapRow(row) {
  if (!row) return null
  const start = new Date(row.start_datetime)
  const end = row.end_datetime ? new Date(row.end_datetime) : null
  const pad = (n) => String(n).padStart(2, '0')
  const dateKey = `${start.getFullYear()}-${pad(start.getMonth() + 1)}-${pad(start.getDate())}`
  const hhmm = (d) => (d ? `${pad(d.getHours())}:${pad(d.getMinutes())}` : null)
  return {
    id: `ic-${row.external_id}`,
    title: row.title,
    description: row.description ?? '',
    date: dateKey,
    startDatetime: row.start_datetime,
    endDatetime: row.end_datetime,
    timeStart: hhmm(start),
    timeEnd: hhmm(end),
    allDay: false,
    location: row.location ?? '',
    community: row.community,
    category: row.category,
    status: 'publicado',
    isPrivate: false,
    privacyTag: null,
    bannerUrl: row.image_url ?? null,
    isApi: true,
  }
}

/**
 * Lista os eventos externos, opcionalmente restritos a um intervalo de datas
 * (YYYY-MM-DD, inclusivo no início), ordenados por data de início.
 */
export async function list({ from, to } = {}) {
  const where = []
  const params = []
  if (from) {
    params.push(from)
    where.push(`start_datetime >= $${params.length}::date`)
  }
  if (to) {
    params.push(to)
    where.push(`start_datetime < ($${params.length}::date + INTERVAL '1 day')`)
  }
  const sql = `
    SELECT * FROM external_events
    ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
    ORDER BY start_datetime ASC
  `
  const { rows } = await pool.query(sql, params)
  return rows.map(mapRow)
}

/** Devolve apenas as chaves de reconciliação (id externo + hash de conteúdo). */
export async function listKeys() {
  const { rows } = await pool.query('SELECT external_id, content_hash FROM external_events')
  return rows
}

/** Número de eventos externos guardados. */
export async function count() {
  const { rows } = await pool.query('SELECT COUNT(*)::int AS n FROM external_events')
  return rows[0]?.n ?? 0
}

/** Categorias distintas em uso pelos eventos externos. */
export async function distinctCategories() {
  const { rows } = await pool.query(
    'SELECT DISTINCT category FROM external_events WHERE category IS NOT NULL'
  )
  return rows.map((r) => r.category).filter(Boolean)
}

const COLS = [
  'id',
  'external_id',
  'title',
  'description',
  'start_datetime',
  'end_datetime',
  'location',
  'community',
  'category',
  'image_url',
  'content_hash',
]

/**
 * Insere/atualiza em lote (ON CONFLICT external_id). Os eventos chegam na forma
 * mapeada da sincronização ({ externalId, title, ... , contentHash }). Devolve o
 * número de linhas afetadas. Faz chunking para não exceder o limite de
 * parâmetros do PostgreSQL.
 */
export async function bulkUpsert(events) {
  if (!events.length) return 0
  const CHUNK = 400
  let affected = 0
  for (let i = 0; i < events.length; i += CHUNK) {
    const chunk = events.slice(i, i + CHUNK)
    const tuples = []
    const params = []
    chunk.forEach((ev, idx) => {
      const base = idx * COLS.length
      tuples.push(`(${COLS.map((_, c) => `$${base + c + 1}`).join(',')})`)
      params.push(
        randomUUID(),
        ev.externalId,
        ev.title,
        ev.description ?? null,
        toDb(ev.startDatetime),
        toDb(ev.endDatetime),
        ev.location ?? null,
        ev.community ?? DEFAULT_CHURCH,
        ev.category ?? 'evento',
        ev.imageUrl ?? null,
        ev.contentHash
      )
    })
    const sql = `
      INSERT INTO external_events (${COLS.join(', ')})
      VALUES ${tuples.join(', ')}
      ON CONFLICT (external_id) DO UPDATE SET
        title = EXCLUDED.title,
        description = EXCLUDED.description,
        start_datetime = EXCLUDED.start_datetime,
        end_datetime = EXCLUDED.end_datetime,
        location = EXCLUDED.location,
        community = EXCLUDED.community,
        category = EXCLUDED.category,
        image_url = EXCLUDED.image_url,
        content_hash = EXCLUDED.content_hash,
        synced_at = now(),
        updated_at = now()
    `
    const { rowCount } = await pool.query(sql, params)
    affected += rowCount
  }
  return affected
}

/**
 * Remove as linhas cujo `external_id` NÃO consta da lista atual da API (eventos
 * eliminados a montante). Devolve o número de linhas removidas. Por segurança,
 * com uma lista vazia não remove nada (evita apagar a tabela toda).
 */
export async function pruneNotIn(externalIds) {
  if (!externalIds.length) return 0
  const { rowCount } = await pool.query(
    'DELETE FROM external_events WHERE external_id <> ALL($1::text[])',
    [externalIds]
  )
  return rowCount
}

/**
 * Purga TOTAL: remove todos os eventos externos guardados. Usado pela ação
 * manual de limpeza no painel de gestão. Devolve o número de linhas removidas.
 */
export async function purge() {
  const { rowCount } = await pool.query('DELETE FROM external_events')
  return rowCount
}
