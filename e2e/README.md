# Testes E2E — Convites & Inscrições

Testes end-to-end (Playwright) que cobrem o processo completo dos convites e
inscrições da Agenda CCLX:

| Ficheiro | Cobertura |
|---|---|
| `tests/01-admin-invite.spec.js` | Admin: criar, configurar e **publicar** um convite pela UI + proteção de rascunho |
| `tests/02-registration.spec.js` | Inscrição pública: convite grátis, bilhete Pago, Grupo e Doação |
| `tests/03-payments.spec.js` | Pagamento por transferência: comprovativo → validação/rejeição do organizador |
| `tests/04-confirmation.spec.js` | Cartão de confirmação, código do bilhete, QR, dados e convidado que regressa |
| `tests/05-edge-cases.spec.js` | Capacidade/lista de espera, prazos, modos de inscrição, 1 evento ↔ 1 convite, permissões, 404 |

## Como funciona

- O `webServer` do Playwright arranca a **mesma app Express** de produção
  ([`server/src/app.js`](../server/src/app.js)) via [`e2e/server.mjs`](server.mjs),
  apontada à **base de dados Supabase de _staging_** (`server/.env.staging`),
  a servir a SPA compilada (`dist/`) e a API na mesma origem (`http://127.0.0.1:4100`).
- O servidor corre em `NODE_ENV=development` com `DEV_MASTER_OTP=000000`, o que
  permite o login de testes sem SMTP.
- O login de admin é feito uma vez ([`auth.setup.js`](auth.setup.js)) e o estado de
  sessão é guardado em `e2e/.auth/admin.json`.
- Os dados são **semeados e limpos por HTTP** (endpoints reais). Todos os convites/
  eventos de teste têm título a começar por `E2E ` e são removidos no fim (fixtures
  + `global-teardown`).

> Os testes **escrevem na BD de staging** (criam convites/inscrições/pagamentos) e
> limpam-nos no fim. Não corram contra produção.

## Pré-requisitos

1. `server/.env.staging` preenchido (BD Supabase de staging, `SUPABASE_*`,
   `JWT_SECRET`, `OTP_PEPPER`). Ver [`server/.env.example`](../server/.env.example).
   O esquema tem de estar migrado no staging: `npm --prefix server run setup:staging`.
2. O utilizador admin do staging (`admin@cclx.pt`) tem de existir e estar ativo
   (o `setup:staging` semeia-o). Podes trocar o email com `E2E_ADMIN_EMAIL`.
3. Browser do Playwright instalado: `npx playwright install chromium`.

## Correr

```powershell
# Suite completa (compila o dist/ se faltar, arranca o servidor, corre tudo)
npm run test:e2e

# Modo interativo (UI do Playwright)
npm run test:e2e:ui

# Com o browser visível
npm run test:e2e:headed

# Um único ficheiro
npx playwright test e2e/tests/02-registration.spec.js

# Relatório HTML do último run
npx playwright show-report
```

### Variáveis úteis

| Variável | Predefinição | Uso |
|---|---|---|
| `E2E_PORT` | `4100` | Porta do servidor E2E |
| `E2E_ADMIN_EMAIL` | `admin@cclx.pt` | Utilizador admin do staging |
| `E2E_DEV_OTP` | `000000` | OTP mestre de desenvolvimento |
| `E2E_BUILD` | _(auto)_ | `force` recompila sempre o `dist/`; `skip` nunca compila |

## Notas

- Após alterar o **frontend**, recompila (`npm run build`) ou usa `E2E_BUILD=force`
  para o servidor E2E servir o build atual (o `test:e2e` já compila antes de correr).
- A execução é **em série** (`workers: 1`) por partilharem a BD de staging.
- Artefactos (`playwright-report/`, `test-results/`, `e2e/.auth/`) estão no
  `.gitignore`.
