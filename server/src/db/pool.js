import pg from 'pg'
import { config } from '../config.js'

if (!config.db.connectionString) {
  throw new Error('DATABASE_URL não está definida. Configura o ficheiro .env do servidor.')
}

const { Pool, types } = pg

// COUNT()/SUM() devolvem BIGINT (OID 20). Por omissão o node-postgres entrega-os
// como string; convertemos para Number para que os agregados (relatórios e
// contagens) cheguem à aplicação já numéricos.
types.setTypeParser(20, (value) => (value === null ? null : Number(value)))

// Pool pequeno: uma única app Node atrás do Supavisor (modo sessão, porta 5432)
// não precisa de muitas ligações. O Supabase exige TLS (config.db.ssl).
const pgPool = new Pool({
  connectionString: config.db.connectionString,
  ssl: config.db.ssl,
  max: config.db.poolSize,
})

// O node-postgres já devolve { rows, rowCount } e aceita marcadores nativos
// $1, $2, …, por isso o SQL dos repositórios usa-se tal como está.
export async function query(text, params) {
  return pgPool.query(text, params)
}

// Fachada compatível com o código existente (pool.query / pool.end).
export const pool = {
  query,
  end: () => pgPool.end(),
}
