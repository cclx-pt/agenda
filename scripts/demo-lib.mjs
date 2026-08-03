/**
 * demo-lib.mjs — utilitários partilhados para gravar vídeos guiados da Agenda CCLX
 * com Playwright, incluindo uma faixa de legendas (pt-PT) sobreposta ao ecrã.
 */
import { chromium } from 'playwright'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import fs from 'node:fs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
export const OUT_DIR = path.join(__dirname, 'demo-videos')
export const SIZE = { width: 1280, height: 720 }

/** Espera passiva (deixa o passo respirar no vídeo). */
export const pause = (page, ms) => page.waitForTimeout(ms)

/** Executa um passo sem rebentar a gravação se um seletor faltar. */
export async function step(label, fn) {
  try {
    await fn()
  } catch (err) {
    console.warn(`  · saltado (${label}): ${String(err.message).split('\n')[0]}`)
  }
}

/** Fecha todas as janelas modais abertas (carrega Escape até não restar nenhuma). */
export async function closeAllDialogs(page) {
  for (let i = 0; i < 5; i++) {
    if (!(await page.locator('[role="dialog"]').count())) return
    await page.keyboard.press('Escape')
    await page.waitForTimeout(350)
  }
}

/** Injeta a faixa de legendas (uma vez) no fim do ecrã. */
export async function installCaptions(page) {
  await page.evaluate(() => {
    if (document.getElementById('demo-caption')) return
    const style = document.createElement('style')
    style.textContent = `
      #demo-caption {
        position: fixed; left: 0; right: 0; bottom: 0; z-index: 2147483000;
        display: flex; flex-direction: column; gap: 3px; align-items: flex-start;
        padding: 16px 30px 18px; pointer-events: none;
        background: linear-gradient(to top, rgba(3,7,18,.94), rgba(3,7,18,.66) 55%, rgba(3,7,18,0));
        font-family: 'Segoe UI', system-ui, -apple-system, sans-serif; color: #fff;
        opacity: 0; transition: opacity .28s ease;
      }
      #demo-caption .demo-step { font-size: 11px; font-weight: 800; letter-spacing: .16em; text-transform: uppercase; color: #F5A800; }
      #demo-caption .demo-title { font-size: 23px; font-weight: 800; line-height: 1.2; text-shadow: 0 2px 10px rgba(0,0,0,.65); }
      #demo-caption .demo-sub { font-size: 15px; font-weight: 500; color: #d6def0; text-shadow: 0 1px 6px rgba(0,0,0,.6); }
    `
    document.head.appendChild(style)
    const box = document.createElement('div')
    box.id = 'demo-caption'
    box.innerHTML = '<div class="demo-step"></div><div class="demo-title"></div><div class="demo-sub"></div>'
    document.body.appendChild(box)
  })
}

/** Atualiza o texto da legenda (pt-PT). */
export async function say(page, { step: s = '', title = '', sub = '' } = {}) {
  await page.evaluate(({ s, title, sub }) => {
    const box = document.getElementById('demo-caption')
    if (!box) return
    box.querySelector('.demo-step').textContent = s
    box.querySelector('.demo-title').textContent = title
    box.querySelector('.demo-sub').textContent = sub
    box.style.opacity = '1'
  }, { s, title, sub })
}

/**
 * Arranca o browser + contexto com gravação de vídeo e abre o URL.
 * Fecha automaticamente separadores externos (window.open) e guarda downloads.
 */
export async function createRecorder({ url, colorScheme = 'light' }) {
  fs.mkdirSync(OUT_DIR, { recursive: true })
  const browser = await chromium.launch()
  const context = await browser.newContext({
    viewport: SIZE,
    recordVideo: { dir: OUT_DIR, size: SIZE },
    colorScheme,
    locale: 'pt-PT',
    acceptDownloads: true,
  })
  const page = await context.newPage()
  context.on('page', (p) => { if (p !== page) p.close().catch(() => {}) })
  page.on('download', async (d) => {
    try { await d.saveAs(path.join(OUT_DIR, d.suggestedFilename())) } catch { /* ignora */ }
  })
  const video = page.video()
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60_000 })
  await page.waitForSelector('nav[aria-label="Vista do calendário"]', { timeout: 30_000 })
  await installCaptions(page)
  return { browser, context, page, video }
}

/** Fecha a gravação e devolve o caminho final do vídeo (.webm). */
export async function finalize({ browser, context, video }, name) {
  await context.close()
  await browser.close()
  const raw = await video.path()
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')
  const finalPath = path.join(OUT_DIR, `${name}-${stamp}.webm`)
  fs.renameSync(raw, finalPath)
  return finalPath
}
