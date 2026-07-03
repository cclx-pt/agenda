<!--
  Modelo de Pull Request — Agenda CCLX.
  Fluxo: feature/fix  →  staging (QA)  →  production
  Ver BRANCHING.md para o detalhe da estratégia.
-->

## O que muda

<!-- Resumo curto e claro da alteração. -->

## Tipo

- [ ] `feat` — nova funcionalidade
- [ ] `fix` — correção de bug
- [ ] `chore` / `docs` / `refactor`

## Branch de destino

- [ ] `staging` (integração + QA)
- [ ] `production` (release — só a partir de `staging`)

## Checklist

- [ ] `npm run lint` sem erros
- [ ] `npm test` verde
- [ ] `npm run build` OK
- [ ] Migrações de BD aplicadas no ambiente-alvo, se aplicável (`npm run db:migrate`)
- [ ] Sem segredos (chaves/passwords) commitados
- [ ] Variáveis de ambiente novas documentadas em `DEPLOY.md`

## Como testar (QA)

<!-- Passos para validar. Inclui dados de exemplo se ajudar. -->
