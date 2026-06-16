import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { pool } from './pool.js'

const __dirname = dirname(fileURLToPath(import.meta.url))

async function migrate() {
  const schema = await readFile(join(__dirname, 'schema.sql'), 'utf8')
  // O driver MySQL executa uma instrução por chamada: divide o ficheiro pelos
  // pontos e vírgula no fim de linha (o esquema não usa ';' dentro de literais).
  const statements = schema
    .split(/;\s*$/m)
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
  for (const statement of statements) {
    await pool.query(statement)
  }
  console.log('[db] Migração aplicada com sucesso.')
}

migrate()
  .catch((err) => {
    console.error('[db] Falha na migração:', err.message)
    process.exitCode = 1
  })
  .finally(() => pool.end())
