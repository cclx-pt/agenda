/**
 * record-demo.mjs
 *
 * Grava um vídeo (.webm) de um passeio guiado pela Agenda CCLX usando Playwright.
 * Não altera nada na app — apenas navega e regista o ecrã.
 *
 * Uso:
 *   node scripts/record-demo.mjs [url]
 *   DEMO_URL=http://localhost:5173 node scripts/record-demo.mjs
 *
 * Por omissão grava a agenda pública de produção (dados reais, sem login).
 * O vídeo fica em scripts/demo-videos/agenda-demo-<timestamp>.webm
 */
import { chromium } from 'playwright'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import fs from 'node:fs'

const TARGET = process.env.DEMO_URL || process.argv[2] || 'https://agenda.cclx.pt'
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const OUT_DIR = path.join(__dirname, 'demo-videos')
const SIZE = { width: 1280, height: 720 }

fs.mkdirSync(OUT_DIR, { recursive: true })

const pause = (page, ms) => page.waitForTimeout(ms)

/** Executa um passo sem rebentar o vídeo se um seletor não existir. */
async function step(label, fn) {
  try {
    await fn()
  } catch (err) {
    console.warn(`  · saltado (${label}): ${err.message.split('\n')[0]}`)
  }
}

async function main() {
  console.log(`▶ A gravar: ${TARGET}`)
  const browser = await chromium.launch()
  const context = await browser.newContext({
    viewport: SIZE,
    recordVideo: { dir: OUT_DIR, size: SIZE },
    colorScheme: 'light',
    locale: 'pt-PT',
  })
  const page = await context.newPage()
  const video = page.video()

  // ── Aterragem ──────────────────────────────────────────────
  await page.goto(TARGET, { waitUntil: 'domcontentloaded', timeout: 60_000 })
  await page.waitForSelector('nav[aria-label="Vista do calendário"]', { timeout: 30_000 })
  await pause(page, 2200) // deixa o mês atual assentar

  // ── Passeio por todas as vistas ────────────────────────────
  const views = page.locator('nav[aria-label="Vista do calendário"] button')
  const count = await views.count()
  console.log(`  · ${count} vistas encontradas`)
  for (let i = 0; i < count; i++) {
    await step(`vista ${i}`, async () => {
      await views.nth(i).click()
      await pause(page, 1700)
    })
  }

  // Voltar à vista mensal (índice 2: day, week, month, …)
  await step('voltar a mensal', async () => {
    await views.nth(2).click()
    await pause(page, 1200)
  })

  // ── Navegação temporal ─────────────────────────────────────
  const next = page.locator('button[aria-label="Próximo"]').first()
  const prev = page.locator('button[aria-label="Anterior"]').first()
  await step('mês seguinte', async () => { await next.click(); await pause(page, 1200) })
  await step('mês seguinte', async () => { await next.click(); await pause(page, 1200) })
  await step('mês anterior', async () => { await prev.click(); await pause(page, 1000) })
  await step('hoje', async () => {
    await page.getByRole('button', { name: 'Hoje' }).first().click()
    await pause(page, 1200)
  })

  // ── Modo noite / dia ───────────────────────────────────────
  await step('modo noite', async () => {
    await page.locator('button[aria-label="Mudar para modo noite"]').first().click()
    await pause(page, 1800)
  })
  await step('modo dia', async () => {
    await page.locator('button[aria-label="Mudar para modo dia"]').first().click()
    await pause(page, 1400)
  })

  // ── Pesquisa + abrir um evento real ────────────────────────
  await step('pesquisar', async () => {
    const search = page.getByPlaceholder(/Pesquisar eventos/i).first()
    await search.click()
    await search.pressSequentially('culto', { delay: 140 })
    await pause(page, 1600)
    const firstOption = page.locator('[role="option"]').first()
    if (await firstOption.count()) {
      await firstOption.click()
      await pause(page, 2400) // detalhe do evento aberto
      await page.keyboard.press('Escape')
      await pause(page, 800)
    }
    // limpar a pesquisa se ainda estiver preenchida
    await step('limpar pesquisa', async () => {
      await page.locator('button[aria-label="Limpar pesquisa"]').first().click()
      await pause(page, 600)
    })
  })

  await pause(page, 1000)

  // ── Finalizar (fechar contexto grava o vídeo) ──────────────
  await context.close()
  await browser.close()

  const rawPath = await video.path()
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')
  const finalPath = path.join(OUT_DIR, `agenda-demo-${stamp}.webm`)
  fs.renameSync(rawPath, finalPath)
  console.log(`✓ Vídeo gravado: ${finalPath}`)
}

main().catch((err) => {
  console.error('✗ Erro na gravação:', err)
  process.exit(1)
})
