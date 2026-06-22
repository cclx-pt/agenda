/**
 * server.js — ponto de entrada de produção (raiz do repositório).
 *
 * Arranca o servidor Express combinado (API + frontend Vite/React de `dist/`).
 * Existe na raiz para que plataformas que detetam um ficheiro de arranque
 * (ex.: preset Express/Other do Hostinger) o encontrem sem configuração extra.
 *
 * Se o arranque falhar — tipicamente por faltar uma variável de ambiente — em
 * vez de o processo morrer (o que o host mostra como "503" sem pistas) sobe um
 * pequeno servidor de DIAGNÓSTICO que devolve a causa em JSON. Assim a causa
 * fica visível em https://<dominio>/health sem precisar dos logs do painel.
 * NÃO expõe valores de segredos: só a mensagem de erro e os NOMES das
 * variáveis em falta.
 */
const REQUIRED_ENV = [
  'JWT_SECRET',
  'OTP_PEPPER',
  'DATABASE_URL',
  'SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
]

try {
  await import('./server/src/index.js')
} catch (err) {
  const { createServer } = await import('node:http')
  const port = Number(process.env.PORT) || 4000
  const missingEnv = REQUIRED_ENV.filter((k) => !process.env[k])
  console.error('[server] FALHA NO ARRANQUE:', err)
  if (missingEnv.length) {
    console.error('[server] Variáveis de ambiente em falta:', missingEnv.join(', '))
  }
  createServer((_req, res) => {
    res.writeHead(500, { 'content-type': 'application/json; charset=utf-8' })
    res.end(
      JSON.stringify({
        error: 'startup_failed',
        message: String(err?.message || err),
        missingEnv,
        nodeEnv: process.env.NODE_ENV ?? null,
      }),
    )
  }).listen(port, '0.0.0.0', () => {
    console.error(`[server] modo diagnóstico a ouvir em 0.0.0.0:${port}`)
  })
}
