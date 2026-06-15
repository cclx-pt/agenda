/**
 * PM2 — gestão do processo do backend da Agenda CCLX no VPS.
 *
 * Uso (a partir da raiz do projeto, no VPS):
 *   pm2 start ecosystem.config.cjs
 *   pm2 save && pm2 startup     # arranque automático no reboot
 *   pm2 logs cclx-agenda-api    # ver logs
 *   pm2 reload cclx-agenda-api  # recarregar após deploy
 *
 * As variáveis de ambiente são lidas de `server/.env` (via dotenv no código).
 */
module.exports = {
  apps: [
    {
      name: 'cclx-agenda-api',
      cwd: './server',
      script: 'src/index.js',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      max_memory_restart: '300M',
      env: {
        NODE_ENV: 'production',
      },
    },
  ],
}
