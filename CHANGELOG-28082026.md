# Correções 28/08/2026

Registo das alterações realizadas no lote de correções iniciado em 28/08/2026.

## Convenção

- Identificador sequencial: `CH-0001`, `CH-0002`, `CH-0003`, etc.
- Estado: `Reportado`, `Em curso`, `Corrigido` ou `Validado`.
- Cada alteração deve indicar os ficheiros modificados e a validação executada.

---

## CH-0001 - Upload de MP4 no bloco Media

- **Data:** 2026-08-28
- **Tipo:** Bug
- **Estado:** Validado
- **Descrição:** O carregamento de um vídeo MP4 no bloco Media podia ser rejeitado antes do envio.
- **Causa:** Alguns browsers no Windows fornecem o ficheiro `.mp4` sem MIME type; a validação aceitava apenas `video/mp4`.
- **Alteração:** Aceitar a extensão `.mp4` quando o MIME type estiver vazio e enviar sempre o tipo canónico `video/mp4` ao pedir o upload assinado.
- **Ficheiros:** `src/components/invite/InviteBlockEditors.jsx`, `src/services/eventsService.js`, `src/test/InviteBlockEditors.test.jsx`.
- **Validação:** Teste focado 10/10; upload assinado real contra o Storage de staging HTTP 200; lint sem erros; build de produção concluído. O ficheiro de teste no Storage foi removido.
- **Commit:** `b1bb5a3`.
- **Deploy:** Staging e produção concluídos via PR #3.

---

## CH-0002 - Gravação do bloco Tickets na landing page

- **Data:** 2026-08-28
- **Tipo:** Bug
- **Estado:** Validado
- **Descrição:** Depois do upload de vídeo, a gravação da landing page falhava quando existia um bloco `tickets`.
- **Causa:** O frontend permitia criar o bloco `tickets`, mas o tipo não constava da allowlist Zod do backend. O cartão existente também não estava registado no mapa de renderização pública.
- **Alteração:** Adicionar `tickets` ao contrato de blocos aceite pelo backend e associar o tipo ao `TicketsCard` na landing page pública.
- **Ficheiros:** `server/src/invites/service.js`, `server/src/invites/service.test.js`, `src/components/invite/InvitePage.jsx`.
- **Validação:** Teste focado do schema 1/1; testes frontend 82/82; lint sem erros; build de produção concluído. A suite backend completa mantém falhas não relacionadas nos testes de eventos/subcategorias.
- **Commit:** Pendente.
- **Deploy:** Pendente.
