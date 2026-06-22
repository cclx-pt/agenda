import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { pool } from './pool.js'

const __dirname = dirname(fileURLToPath(import.meta.url))

async function migrate() {
  const schema = await readFile(join(__dirname, 'schema.sql'), 'utf8')
  // O node-postgres executa várias instruções numa só chamada (protocolo
  // simples, sem parâmetros) e de forma atómica.
  await pool.query(schema)
  console.log('[db] Migração aplicada com sucesso.')
}

migrate()
  .catch((err) => {
    console.error('[db] Falha na migração:', err.message)
    process.exitCode = 1
  })
  .finally(() => pool.end())
