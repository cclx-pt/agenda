import pg from 'pg'
import { config } from '../config.js'

const { Pool } = pg

if (!config.db.connectionString) {
  throw new Error('DATABASE_URL não está definida. Configura o ficheiro .env do servidor.')
}

export const pool = new Pool({
  connectionString: config.db.connectionString,
  ssl: config.db.ssl,
})

export function query(text, params) {
  return pool.query(text, params)
}
