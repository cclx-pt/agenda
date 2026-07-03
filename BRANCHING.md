# Estratégia de branches e ambientes — Agenda CCLX

Fluxo **staging (QA) → production** sobre GitHub + Vercel (Hobby) + Supabase.
Este documento descreve os branches, o fluxo de promoção e a configuração da
Vercel e do Supabase por ambiente.

> Deploy detalhado (variáveis, Supabase, migrações): ver [`DEPLOY.md`](./DEPLOY.md).

---

## 1. Branches

| Branch | Ambiente | Deploy Vercel | Base de dados | Domínio sugerido |
|--------|----------|---------------|---------------|------------------|
| `production` | Produção | **Production** | Supabase _prod_ | `agenda.cclx.pt` |
| `staging` | QA / integração | Preview (URL estável) | Supabase _staging_ | `qa.cclx.pt` (opcional) |

- `production` é o único branch de produção (protegido).
- `staging` é o branch de longa duração para integração e QA, sempre em _preview_.
- Trabalho novo vive em branches curtos `feat/*` ou `fix/*` que dão merge em `staging`.

## 2. Fluxo de trabalho

```mermaid
flowchart LR
  F[feat/* · fix/*] -->|PR| S[staging · QA]
  S -->|PR| P[production]
  P -. hotfix .-> H[fix/hotfix-*]
  H -->|PR| P
  H -.->|back-merge| S
```

1. **Funcionalidade nova** — cria `feat/xyz` a partir de `staging`:
   ```bash
   git switch staging && git pull
   git switch -c feat/xyz
   # ... trabalho + commits ...
   git push -u origin feat/xyz          # abre PR para staging
   ```
2. **QA** — merge em `staging`. A Vercel publica o preview de staging; validar aí.
3. **Release** — PR de `staging` → `production`. Merge = deploy de produção.
4. **Hotfix urgente** — `fix/hotfix-*` a partir de `production`, PR para
   `production`, depois _back-merge_ para `staging` para não perder a correção.

Regra de ouro: **nunca** fazer merge direto para `production` a não ser a partir
de `staging` (ou de um hotfix).

## 3. Configuração na Vercel (plano Hobby)

O plano Hobby não tem _Custom Environments_, mas dá deploys de _preview_ com URL
estável por branch e variáveis de ambiente por branch.

1. **Production Branch**: Settings → Git → _Production Branch_ = `production`.
2. **Preview**: qualquer branch diferente de `production` gera um deploy de
   preview. `staging` fica com um URL estável, do tipo
   `agenda-git-staging-<scope>.vercel.app`.
3. **Variáveis de ambiente** (Settings → Environment Variables) — usar o âmbito
   certo para cada valor:
   - **Production** → valores de produção (aplicam-se a `production`).
   - **Preview**, com _Git Branch_ = `staging` → valores de QA/staging.
4. **Domínios (opcional)**: Settings → Domains → adicionar `qa.cclx.pt` e ligar
   ao branch `staging`.
5. **Cron (nota do plano Hobby)**: o `vercel.json` corre o cron
   `/data/integration/sync/cron` **1×/dia** (`0 5 * * *`) — o Hobby só permite
   crons diários. O cron corre apenas em produção.

## 4. Bases de dados (Supabase) por ambiente

Cada ambiente tem o **seu próprio projeto Supabase** para que o staging/QA nunca
toque nos dados de produção. Dois projetos cabem no plano gratuito (limite ~2
projetos ativos por organização).

1. Criar 2 projetos: `agenda-prod` e `agenda-staging`.
2. Em cada um, criar o bucket público de imagens (ex.: `event-images`) — ou
   deixar a app criá-lo no primeiro upload.
3. Provisionar o staging num só comando (a partir de `server/`, com o ficheiro
   gitignored `server/.env.staging` preenchido — pooler **session 5432**):
   ```bash
   npm run setup:staging   # bucket + migrate + seed no projeto de staging
   ```
   Produção usa o fluxo manual habitual do `DEPLOY.md`.
   > Sempre que houver alterações de schema, correr as migrações **em cada
   > ambiente** antes do deploy (`npm run setup:staging` para staging).

## 5. Matriz de variáveis de ambiente

Mesmos nomes de variáveis, valores diferentes por ambiente (ver `DEPLOY.md`
para a lista completa). As sensíveis vivem só na Vercel, nunca no repositório.

| Variável | production | staging |
|----------|-----------|---------|
| `DATABASE_URL` | pooler _prod_ (6543) | pooler _staging_ (6543) |
| `SUPABASE_URL` | proj. _prod_ | proj. _staging_ |
| `SUPABASE_SERVICE_ROLE_KEY` | _prod_ | _staging_ |
| `SUPABASE_STORAGE_BUCKET` | `event-images` | `event-images` |
| `APP_URL` / `CORS_ORIGIN` | URL de produção | URL de staging |
| `JWT_SECRET` / `OTP_PEPPER` | únicos _prod_ | únicos _staging_ |
| `SMTP_*` / `MAIL_FROM` | conta real | real ou de teste |
| `NODE_ENV` | `production` | `production` |

> Gera segredos (`JWT_SECRET`, `OTP_PEPPER`) **diferentes** por ambiente.

## 6. Crachá de ambiente

A app mostra um crachá no canto inferior direito em **todos os ambientes exceto
produção** (`STAGING · QA`, `LOCAL` ou o nome do branch de preview). É
derivado das variáveis `VERCEL_ENV` / `VERCEL_GIT_COMMIT_REF` injetadas no build
(ver `vite.config.js`). Em `production` fica escondido.

## 7. Integração contínua (GitHub Actions)

[`.github/workflows/ci.yml`](./.github/workflows/ci.yml) corre em pushes e PRs
para `staging` e `production`: `npm ci` → `lint` → `test` → `build`. Os testes de
backend não correm no CI (escrevem numa BD real).

Recomendado: proteger `production` e `staging` (Settings → Branches → _Branch
protection rules_): exigir PR + CI verde antes de merge.

## 8. Migração inicial `main` → `production` (uma só vez)

O repositório nasceu com `main` como branch de produção. Passos para adotar
`production` sem partir o deploy atual:

1. Os branches `production` e `staging` já foram criados a partir do estado
   atual (idênticos).
2. Vercel → Settings → Git → **Production Branch**: mudar `main` → `production`.
3. GitHub → Settings → **Default branch**: mudar `main` → `production`.
4. Fazer um _redeploy_ de `production` e confirmar que o site de produção está OK.
5. Só depois, apagar `main` (já não é necessário):
   ```bash
   git push origin --delete main
   git branch -D main
   ```
