import { pool } from '../db/pool.js'

/** Lê o valor (JSON) de uma definição pela chave, ou null. */
export async function get(key) {
  const { rows } = await pool.query('SELECT value FROM app_settings WHERE `key` = $1', [key])
  return rows[0]?.value ?? null
}

/** Cria/atualiza uma definição (upsert). */
export async function set(key, value, actorId) {
  await pool.query(
    `INSERT INTO app_settings (\`key\`, value, updated_by)
     VALUES ($1, $2, $3)
     ON DUPLICATE KEY UPDATE
       value = VALUES(value),
       updated_by = VALUES(updated_by),
       updated_at = now()`,
    [key, JSON.stringify(value), actorId ?? null]
  )
}
