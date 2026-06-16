import { pool } from '../db/pool.js'

// Relatórios agregados da agenda (System of Record). Apenas leitura.
export async function getSummary() {
  const [byStatus, byCommunity, byCategory, privacy, upcoming, recent] = await Promise.all([
    pool.query('SELECT status, COUNT(*) AS n FROM events GROUP BY status'),
    pool.query('SELECT community, COUNT(*) AS n FROM events GROUP BY community ORDER BY n DESC'),
    pool.query('SELECT category, COUNT(*) AS n FROM events GROUP BY category ORDER BY n DESC'),
    pool.query(
      `SELECT
         CAST(SUM(CASE WHEN is_private THEN 1 ELSE 0 END) AS UNSIGNED) AS private,
         CAST(SUM(CASE WHEN NOT is_private THEN 1 ELSE 0 END) AS UNSIGNED) AS public
       FROM events`
    ),
    pool.query(
      `SELECT id, title, start_datetime, community, category
       FROM events
       WHERE status = 'publicado' AND start_datetime >= now()
       ORDER BY start_datetime ASC
       LIMIT 8`
    ),
    pool.query(
      `SELECT h.from_status, h.to_status, h.created_at,
              e.title AS event_title,
              COALESCE(u.name, u.email) AS actor
       FROM event_history h
       LEFT JOIN events e ON e.id = h.event_id
       LEFT JOIN users u ON u.id = h.actor_id
       ORDER BY h.created_at DESC
       LIMIT 10`
    ),
  ])

  const statusMap = Object.fromEntries(byStatus.rows.map((r) => [r.status, r.n]))

  return {
    byStatus: {
      rascunho: statusMap.rascunho ?? 0,
      pendente: statusMap.pendente ?? 0,
      publicado: statusMap.publicado ?? 0,
      rejeitado: statusMap.rejeitado ?? 0,
    },
    total: byStatus.rows.reduce((sum, r) => sum + r.n, 0),
    byCommunity: byCommunity.rows.map((r) => ({ label: r.community, n: r.n })),
    byCategory: byCategory.rows.map((r) => ({ label: r.category, n: r.n })),
    privacy: { private: privacy.rows[0]?.private ?? 0, public: privacy.rows[0]?.public ?? 0 },
    upcoming: upcoming.rows.map((r) => ({
      id: r.id,
      title: r.title,
      startDatetime: r.start_datetime,
      community: r.community,
      category: r.category,
    })),
    recent: recent.rows.map((r) => ({
      fromStatus: r.from_status,
      toStatus: r.to_status,
      createdAt: r.created_at,
      eventTitle: r.event_title,
      actor: r.actor,
    })),
  }
}
