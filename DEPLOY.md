# Deploy — Agenda CCLX (Vercel)

Guia de instalação em produção na **Vercel** (conta gratuita / Hobby), com:

- **Vercel CDN** — serve o front-end estático já compilado (`dist/`).
- **Vercel Serverless Function** — o backend Express (`server/serverless.js`)
  (auth OTP, papéis, gestão da agenda e proxy de leitura da API inRadar).
- **Supabase** — Postgres gerido (System of Record) + Storage (imagens de eventos).

A arquitetura:

```
Internet ──HTTPS──> Vercel
   ├── /                -> CDN (ficheiros estáticos: dist/)
   ├── /api/*           -> Função serverless (proxy de leitura inRadar)
   ├── /auth/*          -> Função serverless (OTP + sessão JWT)
   ├── /data/*          -> Função serverless (eventos / gestão)
   ├── /health*         -> Função serverless (estado dos serviços)
   └── (outras rotas)   -> CDN -> index.html (SPA)

Função serverless (Express) ──TLS──> Supabase (Postgres pooler :6543 + Storage)
```

O encaminhamento está em [`vercel.json`](./vercel.json): os prefixos `/api`,
`/auth`, `/data` e `/health` vão para a função; tudo o resto cai no `index.html`
(SPA). O front-end usa caminhos relativos, por isso funciona em same-origin sem
configurar URLs.

---

## 1. Pré-requisitos

- Conta na **[Vercel](https://vercel.com)** (plano gratuito chega).
- O repositório no **GitHub** (ou GitLab/Bitbucket) ligado à Vercel.
- Um projeto **Supabase** já criado (Postgres + Storage).
- **Node.js ≥ 20** local (para correr as migrações da base de dados).

## 2. Supabase (base de dados + Storage)

No painel do projeto Supabase:

1. **Database → Connection string**: copia DUAS strings (a senha é a mesma):
   - **"Transaction pooler"** (porta `6543`) — é esta que vai para o
     `DATABASE_URL` da Vercel (ideal para serverless: muitas ligações curtas):
     `postgresql://postgres.<ref>:<SENHA>@aws-0-<regiao>.pooler.supabase.com:6543/postgres`
   - **"Session pooler"** (porta `5432`) — usa-a só localmente para correr as
     migrações (passo 5), pois suporta melhor DDL multi-statement.
2. **Storage → New bucket**: cria um bucket **público** para as imagens dos
   eventos (ex.: `event-images`) — o nome vai para `SUPABASE_STORAGE_BUCKET`.
3. **Project Settings → API**: copia o **Project URL** (`SUPABASE_URL`) e a
   chave **`service_role`** (`SUPABASE_SERVICE_ROLE_KEY`, usada só no backend).

## 3. Importar o projeto na Vercel

1. Na Vercel: **Add New… → Project** e importa o repositório.
2. Em **Framework Preset** deixa **Other** — o [`vercel.json`](./vercel.json) já
   define o build (frontend `dist/`) e a função serverless (Express). **Não é
   preciso** preencher Build Command / Output Directory manualmente.
3. **Node.js Version:** 20.x (ou superior) — vem de `engines.node` no
   `package.json`.
4. Antes do primeiro deploy, define as variáveis de ambiente (passo 4).

## 4. Variáveis de ambiente (Vercel → Settings → Environment Variables)

Define-as para **Production** (e **Preview**, se quiseres testar branches).
Depois de alterar variáveis é preciso **re-deploy** para terem efeito.

| Variável | Valor |
|----------|-------|
| `NODE_ENV` | `production` |
| `CORS_ORIGIN` | URL público do site (`https://<projeto>.vercel.app` ou domínio próprio) |
| `DATABASE_URL` | string do **Transaction pooler** (porta `6543`, passo 2) |
| `DB_SSL` | `true` (TLS obrigatório no Supabase) |
| `DB_POOL_SIZE` | `1` (pool pequeno por instância serverless) |
| `SUPABASE_URL` | Project URL do Supabase (passo 2) |
| `SUPABASE_SERVICE_ROLE_KEY` | chave `service_role` (passo 2) — segredo, só backend |
| `SUPABASE_STORAGE_BUCKET` | nome do bucket público (ex.: `event-images`) |
| `JWT_SECRET` | `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"` |
| `OTP_PEPPER` | outra string longa e aleatória |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_SECURE` / `SMTP_USER` / `SMTP_PASS` / `MAIL_FROM` | credenciais de email para envio dos códigos OTP |
| `INCHURCH_API_KEY` / `INCHURCH_API_SECRET` | credenciais da API inRadar (eventos externos) |
| `SEED_ADMIN_EMAIL` / `SEED_ADMIN_NAME` | (opcional) admin inicial (omissão: `admin@cclx.pt`) |

> **Não definas `PORT`** — em serverless a porta é gerida pela Vercel.
> **Não definas `DEV_MASTER_OTP`** em produção — o código força-o a `undefined`
> quando `NODE_ENV=production`, mas não o configures de qualquer forma.

## 5. Migrar e popular a base de dados

As migrações correm-se **localmente** apontando ao Supabase (usa a string do
**Session pooler**, porta `5432`). A partir da raiz do repositório:

```powershell
# PowerShell (Windows)
cd server
$env:DATABASE_URL = "postgresql://postgres.<ref>:<SENHA>@aws-0-<regiao>.pooler.supabase.com:5432/postgres"
$env:DB_SSL = "true"; $env:JWT_SECRET = "x"; $env:OTP_PEPPER = "x"
npm install
npm run db:migrate
npm run db:seed
```

```bash
# bash (macOS/Linux)
cd server
export DATABASE_URL="postgresql://postgres.<ref>:<SENHA>@aws-0-<regiao>.pooler.supabase.com:5432/postgres"
export DB_SSL=true JWT_SECRET=x OTP_PEPPER=x
npm install
npm run db:migrate
npm run db:seed
```

> `JWT_SECRET`/`OTP_PEPPER` só são precisos para o `config.js` carregar — os
> scripts de migração/seed não os usam, por isso um valor `x` serve. O migrate
> cria as tabelas + 8 igrejas + 4 categorias; o seed garante o utilizador admin.
> Ambos são idempotentes.

## 6. Deploy

- **Deploy automático:** cada `git push` para a branch de produção (ex.: `main`)
  dispara um build na Vercel. O `vercel.json` compila o frontend e empacota a
  função serverless.
- **Verificação:** abre `https://<projeto>.vercel.app/health` → deve devolver
  `{"ok":true}`. O calendário público carrega em `/`.

## 7. Domínio personalizado (opcional)

Vercel → **Settings → Domains** → adiciona o domínio (ex.: `agenda.cclx.pt`) e
segue as instruções de DNS. Depois, atualiza `CORS_ORIGIN` para esse domínio e
faz re-deploy.

---

## Atualizações (novo deploy)

```bash
git push            # a Vercel reconstrói e publica automaticamente
```

Se houve **alterações ao schema** da base de dados, corre de novo as migrações
(passo 5) apontando ao Supabase.

---

## Desenvolvimento local

```bash
# Dependências (raiz = frontend; server = backend)
npm install
cd server && npm install && cd ..

# Variáveis do backend
cp server/.env.example server/.env   # preencher segredos (DATABASE_URL, etc.)

# Opção A — dois processos (hot reload):
cd server && npm run dev   # backend :4000 (node --watch)
npm run dev                # frontend :5173 (Vite faz proxy /auth /data /api → :4000)

# Opção B — um processo combinado (como em standalone):
npm run build && npm start # Express serve a API + dist/ em :4000
```

---

## Alternativa: deploy pela CLI

```bash
npm i -g vercel
vercel            # primeiro deploy (preview) — segue as perguntas
vercel --prod     # promove para produção
```

As variáveis de ambiente podem ser geridas com `vercel env add <NOME>` ou no
painel (passo 4).

---

## Notas (serverless)

- **Ligações à BD:** usa o **Transaction pooler** (porta `6543`) e mantém
  `DB_POOL_SIZE=1`. Cada instância da função reutiliza o pool entre invocações
  "quentes"; em "cold start" cria um novo (lazy, sem custo até ao 1.º pedido).
- **Cold starts:** o primeiro pedido após inatividade pode ser ligeiramente mais
  lento (arranque da função) — comportamento normal do plano gratuito.
- **Rate-limit** (`express-rate-limit`) é em memória, por isso é por instância.
  Continua a proteger, mas não é um contador global.
- **Página `/logs`** mostra o histórico de reinícios; em serverless há menos
  registos (não há um processo único sempre a correr). Não afeta funcionalidades.
- **Login OTP:** precisa de SMTP válido (`SMTP_*`, `MAIL_FROM`) e de um
  `SEED_ADMIN_EMAIL` que seja uma caixa de correio real, ou ninguém entra.
- **Cookies de sessão** são `secure` em produção (só viajam por HTTPS) — a Vercel
  serve sempre HTTPS, por isso o login funciona sem configuração extra.
