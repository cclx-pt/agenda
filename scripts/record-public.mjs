/**
 * record-public.mjs — vídeo guiado (com legendas pt-PT) da vista PÚBLICA da
 * Agenda CCLX: vistas do calendário, navegação, tema, filtros, cartão do
 * evento, exportação para calendário e subscrição (sincronização).
 *
 * Uso:
 *   node scripts/record-public.mjs [url]
 * Por omissão grava a agenda pública de produção (dados reais, sem login).
 */
import { createRecorder, finalize, say, step, pause, closeAllDialogs } from './demo-lib.mjs'

const TARGET = process.env.DEMO_URL || process.argv[2] || 'https://agenda.cclx.pt'

async function main() {
  console.log(`▶ A gravar vídeo público: ${TARGET}`)
  const rec = await createRecorder({ url: TARGET })
  const { page } = rec
  page.setDefaultTimeout(9000) // falha depressa: um passo saltado não congela o vídeo

  // ── Intro ──────────────────────────────────────────────────
  await say(page, { step: 'Agenda CCLX', title: 'A agenda pública das igrejas', sub: 'Todos os eventos num só calendário' })
  await pause(page, 2800)

  // ── Vistas do calendário ───────────────────────────────────
  const views = page.locator('nav[aria-label="Vista do calendário"] button')
  const viewNames = ['Vista diária', 'Vista semanal', 'Vista mensal', 'Vista trimestral', 'Vista semestral', 'Vista anual', 'Vista em lista']
  const count = await views.count()
  await say(page, { step: '1 · Vistas', title: 'Sete formas de ver a agenda', sub: 'Dia, semana, mês, trimestre, semestre, ano e lista' })
  await pause(page, 1400)
  for (let i = 0; i < count; i++) {
    await step(`vista ${i}`, async () => {
      await views.nth(i).click()
      await say(page, { step: '1 · Vistas', title: viewNames[i] || 'Vista', sub: 'Escolha a granularidade que precisa' })
      await pause(page, 1600)
    })
  }
  await step('voltar a mensal', async () => { await views.nth(2).click(); await pause(page, 1000) })

  // ── Navegação temporal ─────────────────────────────────────
  const next = page.locator('button[aria-label="Próximo"]').first()
  const prev = page.locator('button[aria-label="Anterior"]').first()
  await say(page, { step: '2 · Navegação', title: 'Avance e recue no tempo', sub: 'Setas para mudar de mês; “Hoje” para voltar' })
  await pause(page, 1200)
  await step('mês seguinte', async () => { await next.click(); await pause(page, 1200) })
  await step('mês seguinte', async () => { await next.click(); await pause(page, 1200) })
  await step('mês anterior', async () => { await prev.click(); await pause(page, 1100) })
  await step('hoje', async () => { await page.getByRole('button', { name: 'Hoje' }).first().click(); await pause(page, 1200) })

  // ── Tema claro / escuro ────────────────────────────────────
  await say(page, { step: '3 · Aparência', title: 'Modo noite e modo dia', sub: 'Alterne o tema com um clique' })
  await step('modo noite', async () => {
    await page.locator('button[aria-label="Mudar para modo noite"]').first().click()
    await pause(page, 1900)
  })
  await step('modo dia', async () => {
    await page.locator('button[aria-label="Mudar para modo dia"]').first().click()
    await pause(page, 1400)
  })

  // ── Filtro por igreja ──────────────────────────────────────
  const filters = page.locator('aside button[aria-haspopup="listbox"]')
  const asideOptions = page.locator('aside [role="listbox"] [role="option"]')
  await say(page, { step: '4 · Filtros', title: 'Filtrar por igreja', sub: 'Veja apenas os eventos de uma comunidade' })
  await step('filtrar por igreja', async () => {
    await filters.nth(0).click()
    await page.locator('aside [role="listbox"]').first().waitFor({ state: 'visible' })
    await pause(page, 1100)
    await asideOptions.nth(1).click()      // escolhe uma igreja (0 = “Todas”)
    await pause(page, 1900)
    await asideOptions.nth(0).click()      // repõe “Todas” (dropdown continua aberto)
    await pause(page, 900)
    await page.keyboard.press('Escape')
    await pause(page, 500)
  })

  // ── Filtro por categoria ───────────────────────────────────
  await say(page, { step: '4 · Filtros', title: 'Filtrar por categoria', sub: 'Culto, jovens, formação, eventos…' })
  await step('filtrar por categoria', async () => {
    await filters.nth(1).click()
    await page.locator('aside [role="listbox"]').first().waitFor({ state: 'visible' })
    await pause(page, 1100)
    await asideOptions.nth(1).click()
    await pause(page, 1900)
    await asideOptions.nth(0).click()
    await pause(page, 900)
    await page.keyboard.press('Escape')
    await pause(page, 500)
  })

  // ── Vista em lista (carrega o ano — garante eventos para pesquisar/abrir) ──
  await step('mudar para lista', async () => {
    await views.nth(6).click()
    await page.locator('section li button').first().waitFor({ state: 'visible' })
    await pause(page, 1200)
  })

  // ── Pesquisa ───────────────────────────────────────────────
  await say(page, { step: '5 · Pesquisa', title: 'Pesquise eventos', sub: 'Por nome, local ou categoria' })
  await step('pesquisar', async () => {
    const search = page.getByPlaceholder(/Pesquisar eventos/i).first()
    await search.click()
    await search.pressSequentially('culto', { delay: 120 })
    await pause(page, 1700)
  })

  // ── Abrir o cartão do evento ───────────────────────────────
  await say(page, { step: '6 · Evento', title: 'Abra o cartão do evento', sub: 'Data, hora, local, responsável e descrição' })
  await step('abrir cartão', async () => {
    const firstOption = page.locator('[role="option"]').first()
    if (await firstOption.count()) {
      await firstOption.click()             // abre a partir da pesquisa
    } else {
      await page.locator('section li button').first().click() // alternativa: linha da lista
    }
    await page.getByRole('dialog').first().waitFor({ state: 'visible' })
    await pause(page, 3000)
  })

  // ── Exportar para calendário (a partir do cartão) ──────────
  await say(page, { step: '7 · Exportar', title: 'Extrair para o seu calendário', sub: 'Google, Outlook, Apple ou ficheiro .ics' })
  await step('abrir exportação', async () => {
    await page.getByRole('dialog').last().getByRole('button', { name: /Guardar no calend/i }).click()
    await pause(page, 1800)
  })
  await step('destacar Outlook', async () => {
    await page.getByRole('button', { name: /Outlook/i }).first().hover()
    await pause(page, 1100)
  })
  await step('destacar Google', async () => {
    await page.getByRole('button', { name: /Google/i }).first().hover()
    await pause(page, 1100)
  })
  await step('descarregar .ics', async () => {
    await page.getByRole('button', { name: /\.ics/i }).first().click()
    await pause(page, 1400)
  })
  await closeAllDialogs(page)
  await pause(page, 700)

  // ── Subscrever (sincronização automática) ──────────────────
  await say(page, { step: '8 · Sincronizar', title: 'Sincronize com o Outlook', sub: 'Subscreva o feed — a agenda atualiza-se sozinha' })
  await step('abrir subscrição', async () => {
    await page.locator('button[aria-label="Subscrever calendário"]').first().click()
    await pause(page, 2200)
  })
  await step('copiar endereço', async () => {
    await page.getByRole('button', { name: /Copiar/i }).first().click()
    await pause(page, 1400)
  })
  await closeAllDialogs(page)
  await pause(page, 700)

  // ── Fecho ──────────────────────────────────────────────────
  await say(page, { step: 'Agenda CCLX', title: 'agenda.cclx.pt', sub: 'A agenda pública das igrejas CCLX' })
  await pause(page, 3000)

  const out = await finalize(rec, 'agenda-publico')
  console.log(`✓ Vídeo público gravado: ${out}`)
}

main().catch((err) => {
  console.error('✗ Erro na gravação pública:', err)
  process.exit(1)
})
