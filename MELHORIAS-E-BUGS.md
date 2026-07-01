# Melhorias e Bugs — Agenda CCLX

Registo de **melhorias sugeridas** e **bugs detetados**. Serve de backlog leve
para acompanhar o que falta corrigir ou pode ser melhorado.

## Como usar

- Adicione uma linha na tabela **Bugs** ou **Melhorias**.
- **IDs**: `B-00x` para bugs, `M-00x` para melhorias.
- **Estado**: `Aberto` · `Em curso` · `Resolvido`.
- **Prioridade**: `Alta` · `Média` · `Baixa`.
- **Data** no formato `AAAA-MM-DD`.
- Ao resolver, mude o estado para `Resolvido` e, se aplicável, indique o commit.

---

## Bugs

| #     | Data       | Descrição                                                                                                                                                   | Prioridade | Estado    | Notas |
| ----- | ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | --------- | ----- |
| B-001 | 2026-07-01 | O backend da purga de eventos da API não estava commitado — o botão "Purgar registos da API" teria sido publicado sem a rota `POST /data/integration/purge` (erro 404 em produção). | Alta       | Resolvido | Corrigido no commit `e923860`. |

---

## Melhorias

| #     | Data       | Descrição                                                                                                                               | Prioridade | Estado | Notas |
| ----- | ---------- | --------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ------ | ----- |
| M-001 | 2026-07-01 | Os testes de integração do backend escrevem na base de dados Supabase de produção. Criar uma BD de testes isolada (ou transações com rollback) para correr `npm test` no servidor com segurança. | Alta       | Aberto | Impede validação automática do fluxo de aprovações/delegações. |
| M-002 | 2026-07-01 | `listForApproval` carrega todos os eventos do estado e filtra em JS. Otimizar com SQL (JOIN/EXISTS sobre `approval_delegations`) se o volume crescer.       | Média      | Aberto | Aceitável para o volume atual. |
| M-003 | 2026-07-01 | A pesquisa de morada no mapa usa o Nominatim (OpenStreetMap), com limite de ~1 pedido/segundo. Adicionar *debounce* e, para uso intenso, um geocoder próprio. | Média      | Aberto | Respeitar a política de uso do OSM. |
| M-004 | 2026-07-01 | O `MapPicker` (Leaflet) acrescenta ~160 KB ao *bundle* inicial. Carregar de forma tardia (*lazy import*) apenas quando o formulário de evento abre.          | Média      | Aberto | Melhora o tempo de arranque do calendário. |
| M-005 | 2026-07-01 | A exportação "Excel" gera CSV (compatível com Excel). Se for preciso `.xlsx` nativo, adicionar uma biblioteca (ex.: SheetJS).                                | Baixa      | Aberto | O CSV com BOM abre corretamente no Excel. |
| M-006 | 2026-07-01 | Aviso ESLint pré-existente em `src/hooks/useAuth.jsx` (`react-refresh/only-export-components`). Mover constantes/funções para outro ficheiro para o eliminar. | Baixa      | Aberto | Não afeta o funcionamento. |
| M-007 | 2026-07-01 | O painel de aprovações não tem paginação. Adicionar paginação ou *scroll* infinito para listas grandes.                                                      | Baixa      | Aberto | — |
| M-008 | 2026-07-01 | Eventos criados antes da funcionalidade de mapa não têm coordenadas. Opcional: gerar o link do Google Maps a partir da morada existente.                     | Baixa      | Aberto | — |
