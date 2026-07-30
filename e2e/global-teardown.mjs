// global-teardown — rede de segurança: apaga quaisquer convites/eventos de teste
// que tenham sobrado (título a começar por "E2E "). O servidor E2E ainda está de
// pé nesta fase. Nunca lança (falhas de limpeza não devem falhar a suite).
import { request } from '@playwright/test'
import { ADMIN_EMAIL, DEV_OTP, E2E_PREFIX } from './helpers/data.js'

const PORT = process.env.E2E_PORT || process.env.PORT || '4100'
const BASE = `http://127.0.0.1:${PORT}`

export default async function globalTeardown() {
  let ctx
  try {
    ctx = await request.newContext({ baseURL: BASE })
    const login = await ctx.post('/auth/verify', { data: { email: ADMIN_EMAIL, code: DEV_OTP } })
    if (!login.ok()) {
      console.warn(`[e2e] teardown: login falhou (HTTP ${login.status()}); limpeza saltada.`)
      return
    }

    const invRes = await ctx.get('/data/invites')
    if (invRes.ok()) {
      const { invites = [] } = await invRes.json()
      const leftovers = invites.filter((i) => (i.title || '').startsWith(`${E2E_PREFIX} `))
      for (const inv of leftovers) {
        await ctx.delete(`/data/invites/${inv.id}`).catch(() => {})
      }
      if (leftovers.length) console.log(`[e2e] teardown: ${leftovers.length} convite(s) E2E removido(s).`)
    }

    // Eventos de teste (regra 1:1) — best-effort.
    const evRes = await ctx.get('/data/events')
    if (evRes.ok()) {
      const payload = await evRes.json().catch(() => ({}))
      const events = payload.events || payload || []
      const leftovers = (Array.isArray(events) ? events : []).filter((e) => (e.title || '').startsWith(`${E2E_PREFIX} `))
      for (const ev of leftovers) {
        await ctx.delete(`/data/events/${ev.id}`).catch(() => {})
      }
      if (leftovers.length) console.log(`[e2e] teardown: ${leftovers.length} evento(s) E2E removido(s).`)
    }
  } catch (err) {
    console.warn('[e2e] teardown ignorado:', err?.message ?? err)
  } finally {
    await ctx?.dispose()
  }
}
