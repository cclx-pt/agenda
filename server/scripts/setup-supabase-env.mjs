// Provisiona um ambiente Supabase da Agenda CCLX num só comando:
//   1) garante o bucket público de imagens (event-images),
//   2) corre as migrações (schema),
//   3) corre o seed (utilizador admin).
//
// Uso (a partir de server/):
//   npm run setup:staging
//   node scripts/setup-supabase-env.mjs .env.staging
//
// O ficheiro de ambiente indicado (ex.: server/.env.staging) tem de conter, no
// mínimo, DATABASE_URL (pooler de sessão :5432), SUPABASE_URL e
// SUPABASE_SERVICE_ROLE_KEY do projeto-alvo. Esses ficheiros estão gitignored
// (.env.*), por isso os segredos nunca vão para o repositório.
//
// SEGURANÇA: antes de escrever, o script imprime o host da BD e o projeto
// Supabase (sem segredos) para confirmar que não é produção por engano.
import { fileURLToPath } from 'node:url'
import { dirname, join, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import dotenv from 'dotenv'
import { createClient } from '@supabase/supabase-js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const serverRoot = resolve(__dirname, '..')

const fileArg = process.argv[2]
if (!fileArg) {
  console.error('Uso: node scripts/setup-supabase-env.mjs <ficheiro-env>   (ex.: .env.staging)')
  process.exit(1)
}

const envPath = resolve(serverRoot, fileArg)
if (!existsSync(envPath)) {
  console.error(`Ficheiro de ambiente não encontrado: ${envPath}`)
  process.exit(1)
}

// Carrega o ficheiro-alvo SOBREPONDO qualquer valor herdado do shell/.env,
// para garantir que apontamos exatamente ao projeto pretendido.
dotenv.config({ path: envPath, override: true })

const { DATABASE_URL, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env
const bucket = process.env.SUPABASE_STORAGE_BUCKET || 'event-images'

const missing = ['DATABASE_URL', 'SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'].filter(
  (k) => !process.env[k]
)
if (missing.length) {
  console.error(`Faltam variáveis em ${fileArg}: ${missing.join(', ')}`)
  process.exit(1)
}

// config.js exige JWT_SECRET/OTP_PEPPER ao carregar; para migrate/seed são
// irrelevantes, por isso preenchemos com um valor descartável se faltarem.
process.env.JWT_SECRET ||= 'x'
process.env.OTP_PEPPER ||= 'x'

const safeHost = (url) => {
  try {
    return new URL(url).host
  } catch {
    return '(inválido)'
  }
}
const pgTarget = (conn) => {
  try {
    const u = new URL(conn)
    return `${u.host}${u.pathname}`
  } catch {
    return '(inválido)'
  }
}

console.log('──────────────────────────────────────────────')
console.log(`Ambiente:       ${fileArg}`)
console.log(`Base de dados:  ${pgTarget(DATABASE_URL)}`)
console.log(`Supabase:       ${safeHost(SUPABASE_URL)}`)
console.log(`Bucket:         ${bucket}`)
console.log('──────────────────────────────────────────────')

async function ensureBucket() {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { data } = await supabase.storage.getBucket(bucket)
  if (data) {
    console.log(`[storage] bucket "${bucket}" já existe.`)
    return
  }
  const { error } = await supabase.storage.createBucket(bucket, { public: true })
  if (error && !/already exists|resource_already_exists/i.test(error.message || '')) {
    throw new Error(`createBucket falhou: ${error.message}`)
  }
  console.log(`[storage] bucket "${bucket}" criado (público).`)
}

function run(script) {
  console.log(`\n[db] a correr ${script}…`)
  const res = spawnSync(process.execPath, [join('src', 'db', script)], {
    cwd: serverRoot,
    env: process.env,
    stdio: 'inherit',
  })
  if (res.status !== 0) {
    throw new Error(`${script} terminou com código ${res.status}`)
  }
}

try {
  await ensureBucket()
  run('migrate.js')
  run('seed.js')
  console.log('\nAmbiente provisionado com sucesso.')
} catch (err) {
  console.error(`\nFalha: ${err.message}`)
  process.exit(1)
}
