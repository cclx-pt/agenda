/**
 * record-promo.mjs — vídeo PROMOCIONAL 16:9 (1280×720, ~60 s) da vista PÚBLICA
 * da Agenda CCLX, alinhado com o guião de narração
 * (docs/guiao-narracao-video-publico.md). Grava com legendas pt-PT sobrepostas.
 * SEM voz — a locução é adicionada depois num editor.
 *
 * Uso:
 *   node scripts/record-promo.mjs [url]
 * Por omissão grava a agenda pública de produção (https://agenda.cclx.pt).
 */
import { createRecorder, finalize, say, step, pause, closeAllDialogs } from './demo-lib.mjs'

const TARGET = process.env.DEMO_URL || process.argv[2] || 'https://agenda.cclx.pt'

async function main() {
  console.log(`▶ A gravar vídeo promocional 16:9: ${TARGET}`)
  const rec = await createRecorder({ url: TARGET })
  const { page } = rec
  page.setDefaultTimeout(9000) // falha depressa: um passo saltado não congela o vídeo

  const views = page.locator('nav[aria-label="Vista do calendário"] button')
  const next = page.locator('button[aria-label="Próximo"]').first()
  const filters = page.locator('aside button[aria-haspopup="listbox"]')
  const asideOptions = page.locator('aside [role="listbox"] [role="option"]')

  // ── Cena 1 (0:00–0:06) ─────────────────────────────────────
  await say(page, { step: 'Agenda CCLX', title: 'Chegou a nova Agenda CCLX', sub: 'O portal que liga toda a nossa comunidade' })
  await pause(page, 5000)

  // ── Cena 2 (0:06–0:16) — todas as igrejas ligadas ─────────
  await say(page, { step: 'Comunidade', title: 'De Lisboa aos Açores, todas as igrejas ligadas', sub: 'Todos os eventos e atividades, num só lugar' })
  await pause(page, 1800)
  await step('mês seguinte', async () => { await next.click(); await pause(page, 2600) })
  await step('mês seguinte', async () => { await next.click(); await pause(page, 2600) })
  await step('hoje', async () => { await page.getByRole('button', { name: 'Hoje' }).first().click(); await pause(page, 2000) })

  // ── Cena 3 (0:16–0:23) — Celebrações, eventos, Oração ─────
  await say(page, { step: 'Eventos', title: 'Celebrações, eventos, Oração… em segundos', sub: 'Tudo o que acontece, à tua frente' })
  await pause(page, 2000)
  await step('vista lista', async () => {
    await views.nth(6).click()
    await page.locator('section li button').first().waitFor({ state: 'visible' })
    await pause(page, 3600)
  })

  // ── Cena 4 (0:23–0:33) — filtros ───────────────────────────
  await say(page, { step: 'Filtros', title: 'Filtra por igreja, categoria ou data', sub: 'Encontra o próximo momento para viveres em comunidade' })
  await pause(page, 1600)
  await step('voltar a mensal', async () => { await views.nth(2).click(); await pause(page, 1100) })
  await step('filtrar por igreja', async () => {
    await filters.nth(0).click()
    await page.locator('aside [role="listbox"]').first().waitFor({ state: 'visible' })
    await pause(page, 1300)
    await asideOptions.nth(1).click()
    await pause(page, 2200)
    await asideOptions.nth(0).click()
    await page.keyboard.press('Escape')
    await pause(page, 900)
  })

  // ── Cena 5 (0:33–0:43) — vistas + guardar no calendário ───
  await say(page, { step: 'Vistas', title: 'Vista mensal, semanal ou em lista', sub: 'E guarda os eventos no teu calendário pessoal' })
  await pause(page, 1300)
  await step('vista semanal', async () => { await views.nth(1).click(); await pause(page, 2300) })
  await step('vista lista', async () => { await views.nth(6).click(); await pause(page, 2000) })
  await step('voltar a mensal', async () => { await views.nth(2).click(); await pause(page, 1100) })
  await step('subscrever', async () => {
    await page.locator('button[aria-label="Subscrever calendário"]').first().click()
    await pause(page, 2600)
  })
  await closeAllDialogs(page)
  await pause(page, 700)

  // ── Cena 6 (0:43–0:52) — onde aceder ──────────────────────
  await say(page, { step: 'Acede', title: 'agenda.cclx.pt · aplicação · www.cclx.pt', sub: 'Acede onde estiveres' })
  await pause(page, 5600)

  // ── Cena 7 (0:52–0:57) — slogan ───────────────────────────
  await say(page, { step: 'Agenda CCLX', title: 'A nossa agenda. Uma igreja ligada.', sub: '' })
  await pause(page, 4400)

  // ── Cena 8 (0:57–1:00) — chamada à ação ───────────────────
  await say(page, { step: 'CCLX', title: 'CCLX — vem fazer parte', sub: 'agenda.cclx.pt · www.cclx.pt' })
  await pause(page, 4200)

  const out = await finalize(rec, 'agenda-promo-16x9')
  console.log(`✓ Vídeo promocional gravado: ${out}`)
}

main().catch((err) => {
  console.error('✗ Erro na gravação promocional:', err)
  process.exit(1)
})
