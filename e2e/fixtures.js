// Fixtures E2E: expõem clientes HTTP prontos a usar em cada teste.
//   admin → AdminApi autenticada (semeia convites/eventos e limpa no fim).
//   pub   → PublicApi anónima (inscrições/pagamentos como um convidado).
// O `page` continua anónimo por omissão; os testes de admin fazem
// `test.use({ storageState: ADMIN_STATE })` no bloco describe.
import { test as base, expect } from '@playwright/test'
import { AdminApi, PublicApi } from './helpers/api.js'
import { ADMIN_STATE } from './helpers/data.js'

export const test = base.extend({
  admin: async ({ playwright, baseURL }, use) => {
    const ctx = await playwright.request.newContext({ baseURL, storageState: ADMIN_STATE })
    const api = new AdminApi(ctx)
    await use(api)
    await api.cleanup()
    await ctx.dispose()
  },

  pub: async ({ playwright, baseURL }, use) => {
    const ctx = await playwright.request.newContext({ baseURL })
    await use(new PublicApi(ctx))
    await ctx.dispose()
  },
})

export { expect }
