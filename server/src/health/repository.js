import { query } from '../db/pool.js'

const APP_VERSION = process.env.npm_package_version ?? '1.0.0'

// Cria a tabela de registos de arranque se não existir (idempotente). Permite
// que a página /logs funcione mesmo sem correr a migração manualmente — útil
// num deploy gerido (Hostinger) onde não se corre `db:migrate` à mão.
let ensured = false
async function ensureTable() {
  if (ensured) return
  await query(`
    CREATE TABLE IF NOT EXISTS server_restarts (
      id         BIGSERIAL PRIMARY KEY,
      event      TEXT NOT NULL DEFAULT 'start',
      status     TEXT NOT NULL DEFAULT 'ok',
      node_env   TEXT,
      version    TEXT,
      pid        INTEGER,
      detail     TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS idx_server_restarts_created
      ON server_restarts (created_at DESC);
  `)
  ensured = true
}

// Regista um evento de arranque/paragem do servidor.
// Best-effort: nunca atira (não deve impedir o arranque se a BD falhar).
export async function recordRestart({ event = 'start', status = 'ok', detail = null } = {}) {
  try {
    await ensureTable()
    await query(
      `INSERT INTO server_restarts (event, status, node_env, version, pid, detail)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [event, status, process.env.NODE_ENV ?? null, APP_VERSION, process.pid, detail],
    )
  } catch (err) {
    console.error('[health] não foi possível registar o restart:', err.message)
  }
}

// Lista os arranques/paragens mais recentes (para a página /logs).
export async function listRestarts(limit = 50) {
  await ensureTable()
  const safeLimit = Math.min(Math.max(Number(limit) || 50, 1), 200)
  const { rows } = await query(
    `SELECT id, event, status, node_env, version, pid, detail, created_at
       FROM server_restarts
      ORDER BY created_at DESC
      LIMIT $1`,
    [safeLimit],
  )
  return rows
}

// Verifica a ligação à base de dados (SELECT 1).
export async function checkDb() {
  try {
    await query('SELECT 1')
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err.message }
  }
}
