// auth.setup.js — projeto "setup": autentica o admin uma vez e guarda o estado
// (cookie de sessão) em e2e/.auth/admin.json. Os testes de admin reutilizam-no.
// Usa o OTP mestre de desenvolvimento (DEV_MASTER_OTP=000000) que o servidor E2E
// ativa; funciona para qualquer utilizador ativo real (admin@cclx.pt no staging).
import { test as setup, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
import { ADMIN_EMAIL, DEV_OTP, ADMIN_STATE } from './helpers/data.js'

setup('autenticar admin', async ({ playwright, baseURL }) => {
  const ctx = await playwright.request.newContext({ baseURL })
  const res = await ctx.post('/auth/verify', { data: { email: ADMIN_EMAIL, code: DEV_OTP } })
  expect(
    res.ok(),
    `Login do admin falhou (HTTP ${res.status()}). Confirma que "${ADMIN_EMAIL}" existe e está ativo no staging e que o servidor E2E corre com DEV_MASTER_OTP=000000.`
  ).toBeTruthy()

  fs.mkdirSync(path.dirname(ADMIN_STATE), { recursive: true })
  await ctx.storageState({ path: ADMIN_STATE })
  await ctx.dispose()
})
