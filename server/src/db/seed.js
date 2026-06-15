import { config } from '../config.js'
import { pool } from './pool.js'

async function seed() {
  const email = config.seed.adminEmail.toLowerCase().trim()
  const name = config.seed.adminName

  const result = await pool.query(
    `INSERT INTO users (email, name, role, is_active, can_view_private)
     VALUES ($1, $2, 'admin', TRUE, TRUE)
     ON CONFLICT (email) DO UPDATE SET role = 'admin', is_active = TRUE,
       can_view_private = TRUE, name = EXCLUDED.name
     RETURNING id, email, role`,
    [email, name]
  )

  const user = result.rows[0]
  console.log(`[db] Administrador garantido: ${user.email} (${user.role})`)
}

seed()
  .catch((err) => {
    console.error('[db] Falha no seed:', err.message)
    process.exitCode = 1
  })
  .finally(() => pool.end())
