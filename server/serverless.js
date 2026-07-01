/**
 * serverless.js — ponto de entrada da função serverless do Vercel.
 *
 * O runtime do Vercel (@vercel/node) invoca a aplicação Express diretamente
 * como handler `(req, res)` — a app NÃO chama `listen()` (disso trata o Vercel).
 * As rotas /api, /auth, /data e /health são encaminhadas para esta função em
 * `vercel.json`; o frontend estático (`dist/`) é servido pela CDN do Vercel.
 *
 * A app é importada DINAMICAMENTE (no 1.º pedido) para que uma falha de arranque
 * — tipicamente uma variável de ambiente obrigatória em falta (ver `required()`
 * em config.js) — devolva um erro JSON legível em vez de um crash opaco do
 * Vercel (FUNCTION_INVOCATION_FAILED). Assim /health indica exatamente o que
 * está mal configurado.
 */
let appPromise

function loadApp() {
  if (!appPromise) {
    appPromise = import('./src/app.js').then((m) => m.app)
  }
  return appPromise
}

export default async function handler(req, res) {
  try {
    const app = await loadApp()
    return app(req, res)
  } catch (err) {
    const detail = err?.message ?? String(err)
    console.error('[serverless] Falha ao iniciar a app:', detail)
    // Permite nova tentativa num próximo pedido (após corrigir as variáveis).
    appPromise = undefined
    res.status(500).json({
      error: 'Servidor mal configurado. Verifique as variáveis de ambiente no Vercel.',
      detail,
    })
  }
}

