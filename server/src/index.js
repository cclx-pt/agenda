import { app } from './app.js'
import { config } from './config.js'
import { recordRestart } from './health/repository.js'
import { startSyncScheduler, stopSyncScheduler } from './integrations/inchurchSync.js'

/**
 * index.js — arranque local / standalone do backend.
 *
 * Importa a app Express já configurada (`app.js`) e põe-a à escuta num porto.
 * Usado em desenvolvimento (`npm run dev`) e para correr como UMA app Node
 * (API + frontend de `dist/`) fora do Vercel. No Vercel a app é importada por
 * `serverless.js` como função serverless e este ficheiro NÃO corre.
 */
const server = app.listen(config.port, () => {
  console.log(`[server] Agenda CCLX backend a correr na porta ${config.port}`)
  // Regista o arranque (best-effort) para aparecer em /logs.
  recordRestart({ event: 'start', status: 'ok' })
  // Agendador de sincronização inChurch (apenas standalone — no Vercel é o
  // Vercel Cron que aciona /data/integration/sync/cron). Desligar com
  // SYNC_SCHEDULER=off.
  if (process.env.SYNC_SCHEDULER !== 'off') {
    startSyncScheduler()
  }
})

// Encerramento gracioso: regista a paragem antes de sair.
for (const signal of ['SIGTERM', 'SIGINT']) {
  process.once(signal, async () => {
    console.log(`[server] Recebido ${signal} — a encerrar…`)
    stopSyncScheduler()
    await recordRestart({ event: 'stop', status: 'ok', detail: signal })
    server.close(() => process.exit(0))
    // Força a saída se as ligações não fecharem a tempo.
    setTimeout(() => process.exit(0), 5000).unref()
  })
}
