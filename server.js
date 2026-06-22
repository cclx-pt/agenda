/**
 * server.js — ponto de entrada de produção (raiz do repositório).
 *
 * Arranca o servidor Express combinado (API + frontend Vite/React servido a
 * partir de `dist/`). Existe na raiz para que plataformas que detetam
 * automaticamente um ficheiro de arranque (ex.: preset "Express" do Hostinger)
 * o encontrem sem configuração extra.
 *
 * O servidor real vive em server/src/index.js e auto-arranca ao ser importado
 * (faz `app.listen(process.env.PORT)`).
 */
import './server/src/index.js'
