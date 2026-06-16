import { randomUUID } from 'node:crypto'
import { config } from '../config.js'
import { pool } from './pool.js'

async function seed() {
  const email = config.seed.adminEmail.toLowerCase().trim()
  const name = config.seed.adminName
  const id = randomUUID()

  await pool.query(
    `INSERT INTO users (id, email, name, role, is_active, can_view_private)
     VALUES ($1, $2, $3, 'admin', TRUE, TRUE)
     ON DUPLICATE KEY UPDATE role = 'admin', is_active = TRUE,
       can_view_private = TRUE, name = VALUES(name)`,
    [id, email, name]
  )

  const { rows } = await pool.query(
    'SELECT id, email, role FROM users WHERE email = $1',
    [email]
  )
  const user = rows[0]
  console.log(`[db] Administrador garantido: ${user.email} (${user.role})`)
}

seed()
  .catch((err) => {
    console.error('[db] Falha no seed:', err.message)
    process.exitCode = 1
  })
  .finally(() => pool.end())
