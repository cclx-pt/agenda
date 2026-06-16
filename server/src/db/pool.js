import mysql from 'mysql2/promise'
import { config } from '../config.js'

if (!config.db.connectionString) {
  throw new Error('DATABASE_URL não está definida. Configura o ficheiro .env do servidor.')
}

// Converte COUNT/SUM (BIGINT) para número e preserva o resto do comportamento
// por omissão (JSON é desserializado; DATETIME é devolvido como Date em UTC).
function typeCast(field, next) {
  if (field.type === 'LONGLONG') {
    const v = field.string()
    return v === null ? null : Number(v)
  }
  return next()
}

const mysqlPool = mysql.createPool({
  uri: config.db.connectionString,
  ssl: config.db.ssl || undefined,
  // Guarda/lê DATETIME em UTC para round-trips consistentes com as datas ISO.
  timezone: 'Z',
  typeCast,
  waitForConnections: true,
  connectionLimit: config.db.poolSize,
})

// Traduz os marcadores estilo PostgreSQL ($1, $2, …) para os do MySQL (?),
// preservando a ordem e suportando a reutilização do mesmo marcador.
function translate(text, params) {
  if (!params || params.length === 0) return { sql: text, values: [] }
  const values = []
  const sql = text.replace(/\$(\d+)/g, (_, n) => {
    values.push(params[Number(n) - 1])
    return '?'
  })
  return { sql, values }
}

// Mantém a mesma interface do antigo cliente pg: devolve { rows, rowCount }.
export async function query(text, params) {
  const { sql, values } = translate(text, params)
  const [result] = await mysqlPool.query(sql, values)
  if (Array.isArray(result)) {
    return { rows: result, rowCount: result.length }
  }
  return { rows: [], rowCount: result?.affectedRows ?? 0 }
}

// Fachada compatível com o código existente (pool.query / pool.end).
export const pool = {
  query,
  end: () => mysqlPool.end(),
}
