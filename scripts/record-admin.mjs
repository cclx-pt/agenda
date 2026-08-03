/**
 * record-admin.mjs — vídeo guiado (legendas pt-PT) da GESTÃO como ADMINISTRADOR.
 *
 * ⚠️ SÓ-LEITURA: liga-se à BD real (Supabase) através do backend local. O guião
 * apenas NAVEGA e ABRE ecrãs — NUNCA grava, elimina, aprova nem sincroniza.
 *
 * Pré-requisitos (já a correr nesta sessão):
 *   - backend:  cd server; npm run dev        (:4000, usa server/.env)
 *   - frontend: npm run dev                   (:5173, Vite)
 *
 * Login sem enviar email: POST /auth/verify {email, code:'000000'} (DEV_MASTER_OTP).
 *
 * Uso: node scripts/record-admin.mjs [url]
 */
import { createRecorder, finalize, say, step, pause, closeAllDialogs, installCaptions } from './demo-lib.mjs'

const TARGET = process.env.DEMO_URL || process.argv[2] || 'http://127.0.0.1:5173'
// Email real (apenas para o cookie de sessão via API — NÃO aparece no ecrã).
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin4cclx@gmail.com'

async function main() {
  console.log(`▶ A gravar vídeo de gestão (admin): ${TARGET}`)
  const rec = await createRecorder({ url: TARGET })
  const { page } = rec
  page.setDefaultTimeout(9000)

  // ── Intro ──────────────────────────────────────────────────
  await say(page, { step: 'Agenda CCLX', title: 'Gestão — Administrador', sub: 'Visão completa do backoffice da agenda' })
  await pause(page, 2600)

  // ── 1 · Autenticação (demonstra o modal, sem enviar email) ──
  await say(page, { step: '1 · Acesso', title: 'Autenticação por email + OTP', sub: 'Código de uso único — sem palavra-passe' })
  await step('abrir login', async () => {
    await page.getByRole('button', { name: 'Entrar' }).first().click()
    await pause(page, 1200)
    const email = page.locator('#login-email')
    await email.click()
    await email.pressSequentially('admin@cclx.pt', { delay: 90 }) // ilustrativo (não submetido)
    await pause(page, 1800)
  })
  await closeAllDialogs(page)

  // Login efetivo via API (não dispara email) + recarregar a app.
  await step('login por API (sem email)', async () => {
    await page.evaluate(async (email) => {
      await fetch('/auth/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, code: '000000' }),
      })
    }, ADMIN_EMAIL)
    await page.reload({ waitUntil: 'domcontentloaded' })
    await page.waitForSelector('nav[aria-label="Vista do calendário"]', { timeout: 30_000 })
    await installCaptions(page) // o reload apagou a faixa de legendas
  })

  await say(page, { step: '2 · Sessão', title: 'Sessão de administrador ativa', sub: 'Surgem as opções: Eventos, Aprovações e Admin' })
  await pause(page, 2600)

  // ── 3 · Cartão de evento com ações de gestão ───────────────
  await say(page, { step: '3 · Eventos', title: 'Editar ou eliminar diretamente', sub: 'No cartão do evento, como gestor' })
  await step('abrir cartão via lista', async () => {
    await page.locator('nav[aria-label="Vista do calendário"] button').nth(6).click() // lista
    await page.locator('section li button').first().waitFor({ state: 'visible' })
    await pause(page, 1000)
    await page.locator('section li button').first().click()
    await page.getByRole('dialog').first().waitFor({ state: 'visible' })
    await pause(page, 2600)
  })
  await closeAllDialogs(page)
  await pause(page, 600)

  // ── 4 · Painel de gestão (home) ────────────────────────────
  await say(page, { step: '4 · Gestão', title: 'Painel de gestão', sub: 'Tudo num só lugar' })
  await step('abrir painel admin', async () => {
    await page.getByRole('button', { name: 'Admin' }).first().click()
    await page.getByRole('dialog').first().waitFor({ state: 'visible' })
    await pause(page, 2200)
  })

  // ── 5 · Percurso por todas as secções ──────────────────────
  const sections = [
    { icon: 'ti-users',           title: 'Utilizadores e papéis',    sub: 'Admin · aprovador · editor · visitante (acesso por igreja)' },
    { icon: 'ti-building-church', title: 'Igrejas (comunidades)',    sub: 'Gerir as igrejas da agenda' },
    { icon: 'ti-tags',            title: 'Categorias',               sub: 'Nome, cor e ordem de apresentação' },
    { icon: 'ti-tag',             title: 'Subcategorias',            sub: 'Ex.: B1, GLAM, Jump, Base…' },
    { icon: 'ti-shield-lock',     title: 'Etiquetas de privacidade', sub: 'Controlam quem vê eventos privados' },
    { icon: 'ti-plug-connected',  title: 'Integração inChurch',      sub: 'Sincronização automática de eventos' },
    { icon: 'ti-chart-bar',       title: 'Relatórios',               sub: 'Estatísticas por estado, igreja e categoria' },
    { icon: 'ti-language',        title: 'Traduções',                sub: 'PT · EN · FR · ES' },
    { icon: 'ti-photo',           title: 'Aparência',                sub: 'Logótipo e marca' },
    { icon: 'ti-calendar-x',      title: 'Sobreposições',            sub: 'Política de conflitos de horário' },
    { icon: 'ti-device-tv',       title: 'Loop (TV)',                sub: 'Carrossel de ecrã por igreja' },
  ]
  for (let i = 0; i < sections.length; i++) {
    const s = sections[i]
    await step(`secção ${s.title}`, async () => {
      await say(page, { step: `5 · Secções (${i + 1}/${sections.length})`, title: s.title, sub: s.sub })
      await page.getByRole('dialog').last().locator(`button:has(i.${s.icon})`).first().click()
      await pause(page, 1900)
      await page.getByRole('button', { name: 'Voltar ao menu' }).first().click()
      await pause(page, 650)
    })
  }
  await closeAllDialogs(page)
  await pause(page, 600)

  // ── 6 · Gestão de eventos + formulário completo ────────────
  await say(page, { step: '6 · Eventos', title: 'Gestão de eventos', sub: 'Filtrar, criar, editar e aprovar' })
  await step('abrir gestão de eventos', async () => {
    await page.getByRole('button', { name: 'Eventos' }).first().click()
    await page.getByRole('dialog').first().waitFor({ state: 'visible' })
    await pause(page, 2200)
  })
  await say(page, { step: '6 · Eventos', title: 'Formulário completo de evento', sub: 'Imagem, datas, recorrência, mapa, privacidade, Loop' })
  await step('abrir novo evento', async () => {
    await page.getByRole('dialog').last().getByRole('button', { name: 'Novo evento' }).first().click()
    await pause(page, 3200)
  })
  await closeAllDialogs(page)
  await pause(page, 600)

  // ── 7 · Aprovações e delegações ────────────────────────────
  await say(page, { step: '7 · Aprovações', title: 'Aprovações e delegações', sub: 'Fluxo de submissão → aprovação por igreja' })
  await step('abrir aprovações', async () => {
    await page.getByRole('button', { name: 'Aprovações' }).first().click()
    await page.getByRole('dialog').first().waitFor({ state: 'visible' })
    await pause(page, 2800)
  })
  await closeAllDialogs(page)
  await pause(page, 700)

  // ── Fecho ──────────────────────────────────────────────────
  await say(page, { step: 'Agenda CCLX', title: 'Gestão completa da agenda', sub: 'agenda.cclx.pt · backoffice do administrador' })
  await pause(page, 3000)

  const out = await finalize(rec, 'agenda-admin')
  console.log(`✓ Vídeo de gestão gravado: ${out}`)
}

main().catch((err) => {
  console.error('✗ Erro na gravação de gestão:', err)
  process.exit(1)
})
