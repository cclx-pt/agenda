// server.mjs — arranca a app Express para os testes E2E.
//
//   1. Carrega server/.env.staging (override) → BD/Storage/JWT de STAGING.
//   2. Força NODE_ENV=development + DEV_MASTER_OTP=000000 + PORT (cookies http,
//      OTP de dev para o login sem email).
//   3. Compila o frontend (dist/) se faltar — o app.js só serve dist/ se existir.
//   4. Importa server/src/app.js e põe-no à escuta em 127.0.0.1:PORT.
//
// Corre a MESMA app que produção (serverless.js/index.js importam o mesmo app.js),
// apontada à BD de staging, servindo a SPA compilada + a API na mesma origem.
import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { fileURLToPath, pathToFileURL } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(here, '..')

// Leitor de .env minimalista e auto-contido (o `dotenv` só existe no server/,
// não na raiz). Não trunca valores em `#` no meio (ex.: passwords), ao contrário
// da configuração por omissão do dotenv.
function loadEnvFile(file, { override = false } = {}) {
  for (const raw of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const line = raw.trim()
    if (!line || line.startsWith('#')) continue
    const eq = line.indexOf('=')
    if (eq === -1) continue
    let key = line.slice(0, eq).trim()
    if (key.startsWith('export ')) key = key.slice(7).trim()
    let val = line.slice(eq + 1).trim()
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1)
    }
    if (override || process.env[key] === undefined) process.env[key] = val
  }
}

// 1. Ambiente de staging (tem de vencer o server/.env que o config.js carrega
//    depois, sem override).
const stagingEnv = path.join(repoRoot, 'server', '.env.staging')
if (!fs.existsSync(stagingEnv)) {
  console.error(
    `[e2e] Falta ${stagingEnv}.\n` +
      '      Cria-o a partir de server/.env.example com as credenciais do projeto Supabase de staging\n' +
      '      (DATABASE_URL sessão :5432, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, JWT_SECRET, OTP_PEPPER).'
  )
  process.exit(1)
}
loadEnvFile(stagingEnv, { override: true })

// 2. Modo desenvolvimento + OTP mestre (login de testes sem SMTP).
process.env.NODE_ENV = 'development'
process.env.DEV_MASTER_OTP = process.env.DEV_MASTER_OTP || '000000'
const PORT = process.env.E2E_PORT || process.env.PORT || '4100'
process.env.PORT = PORT

// Segredos exigidos pelo config.js. O server/.env.staging pode não os ter (o
// setup:staging só precisa da BD) → gera efémeros que apenas assinam a sessão
// de teste desta execução (não têm valor fora dela).
if (!process.env.JWT_SECRET) process.env.JWT_SECRET = randomBytes(48).toString('hex')
if (!process.env.OTP_PEPPER) process.env.OTP_PEPPER = randomBytes(24).toString('hex')

// 3. Garantir o build do frontend.
const distIndex = path.join(repoRoot, 'dist', 'index.html')
if (!fs.existsSync(distIndex) || process.env.E2E_BUILD === 'force') {
  console.log('[e2e] A compilar o frontend (dist/)… (define E2E_BUILD=skip para saltar)')
  if (process.env.E2E_BUILD !== 'skip') {
    const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm'
    const built = spawnSync(npm, ['run', 'build'], { cwd: repoRoot, stdio: 'inherit' })
    if (built.status !== 0) {
      console.error('[e2e] O build do frontend falhou.')
      process.exit(1)
    }
  }
}

// 4. Arrancar a app (import dinâmico → o .env.staging já está aplicado).
const appUrl = pathToFileURL(path.join(repoRoot, 'server', 'src', 'app.js')).href
const { app } = await import(appUrl)

app.listen(Number(PORT), '127.0.0.1', () => {
  console.log(`[e2e] Pronto em http://127.0.0.1:${PORT} — BD de staging, OTP de dev ativo.`)
})
