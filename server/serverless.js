import { app } from './src/app.js'

/**
 * serverless.js — ponto de entrada da função serverless do Vercel.
 *
 * O runtime do Vercel (@vercel/node) invoca a aplicação Express diretamente
 * como handler `(req, res)` — a app NÃO chama `listen()` (disso trata o Vercel).
 * As rotas /api, /auth, /data e /health são encaminhadas para esta função em
 * `vercel.json`; o frontend estático (`dist/`) é servido pela CDN do Vercel.
 *
 * As dependências são instaladas a partir de `server/package.json` (o Vercel
 * usa o package.json mais próximo do entry point), por isso o backend mantém o
 * seu próprio conjunto de dependências, isolado do frontend.
 */
export default app
