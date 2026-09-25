# Comunicações e campanhas de email dos convites

## Objetivo

Adicionar ao convite um módulo de **Comunicações** para publicar por email notícias,
informações, avisos, lembretes, imagens, vídeos e workshops relacionados com o
evento. O conteúdo editorial pode aproveitar a informação da landing page, mas
cada envio fica guardado como um snapshot imutável para auditoria.

## Referências de mercado

- Eventbrite: campanhas ligadas ao evento, modelos preenchidos com os dados do
  evento, segmentação, agendamento e medição de conversão em inscrições.
- Mailchimp: audiências com consentimento, segmentos por condições, supressões e
  cancelamento de subscrição.
- Cvent: comunicações automatizadas durante todo o ciclo do evento.

O padrão comum separa quatro responsabilidades: conteúdo, audiência, envio e
resultados. A Agenda CCLX deve seguir essa separação sem tentar reproduzir de
imediato uma plataforma completa de marketing.

## Experiência proposta

Dentro do editor de cada convite é acrescentado o separador **Comunicações**:

`Definições → Bilhetes → Inscrição → Página → Comunicações → Check-in`

Uma campanha segue cinco passos conceptuais:

1. Tipo: atualização, aviso, lembrete ou pós-evento.
2. Destinatários: inscritos filtrados pelo estado da inscrição, pagamento,
   bilhete e check-in.
3. Conteúdo: texto, imagem, vídeo como link, workshops, aviso e botão.
4. Revisão: pré-visualização, contagem da audiência e envio de teste.
5. Publicação: envio imediato ou agendado e consulta do histórico/resultados.

## Fase 1 — comunicações operacionais

Escopo implementado inicialmente:

- campanhas exclusivamente ligadas a um convite;
- destinatários exclusivamente entre as inscrições que têm email;
- filtros por estado da inscrição, pagamento, bilhete e check-in;
- blocos email-safe: texto, imagem, vídeo/link, workshops, aviso e botão;
- edição visual do bloco de texto com negrito, itálico, sublinhado, listas,
  links, botões e imagens incorporadas;
- rascunho, pré-visualização, envio de teste e envio imediato;
- consulta de campanhas enviadas e cópia do conteúdo para um novo rascunho;
- snapshot dos destinatários e estado individual de cada envio;
- histórico com totais enviados, falhados e ignorados, detalhe por destinatário
  e repetição apenas dos envios falhados;
- filtros combináveis pelas respostas do formulário do convite;
- link pessoal do convite incluído no email de cada inscrito.
- banner efetivo do evento no topo e opção de cancelamento de futuras
  comunicações desse convite;

Não fazem parte da Fase 1:

- importação de contactos externos;
- newsletters gerais desligadas de um convite;
- campanhas promocionais para pessoas sem inscrição;
- tracking de abertura/clique e webhooks de entrega;
- gestão global de consentimentos de marketing e unsubscribe entre eventos.

Os emails desta fase são operacionais e relativos a uma inscrição existente. Não
transformam automaticamente o inscrito num subscritor de marketing.

## Segmentação pelas respostas do formulário

A audiência pode ser filtrada pelos campos configurados no formulário do
próprio convite. Cada condição guarda a chave estável do
campo e usa operadores adequados ao tipo de resposta: igualdade para escolha
única e checkbox, inclusão para escolha múltipla, comparação para números e
presença/ausência para texto. A campanha deve preservar estas condições no
snapshot da audiência.

## Fases seguintes

### Fase 2 — marketing consentido

- contactos importados ou sincronizados com origem e data do consentimento;
- segmentos guardados;
- unsubscribe global e lista de supressão;
- agendamento através de um fornecedor de email;
- métricas de entrega, bounce, clique e conversão em inscrição.

### Fase 3 — automatizações e newsletters

- lembretes automáticos antes do evento;
- pagamento pendente e alterações urgentes;
- agradecimento e follow-up pós-evento;
- módulo global de newsletters CCLX, reutilizando o mesmo motor.

## Plano recomendado

| Etapa | Entrega | Prioridade | Esforço estimado |
| --- | --- | --- | --- |
| 1 | Tornar explícita a criação e edição de rascunhos; permitir consultar uma campanha enviada e copiar o seu conteúdo e audiência para um novo rascunho, sem alterar o snapshot original | Concluída | 1–2 dias |
| 2 | Corrigir o falso sucesso quando o SMTP não está configurado, distinguir envios parciais e melhorar o histórico em modo de leitura | Concluída | 2–4 dias |
| 3 | Adicionar detalhes por destinatário, repetição apenas dos falhados e melhorias de validação e confirmação no editor | Concluída | 4–7 dias |
| 4 | Filtrar a audiência pelas respostas do formulário do convite, com operadores por tipo de campo, combinação AND/OR, contagem prévia e snapshot das condições | Concluída | 4–7 dias |
| 5 | Processar campanhas de forma assíncrona, em lotes, com tentativas, recuperação de envios interrompidos e progresso | Concluída | 5–10 dias |
| 6 | Adicionar modelos, segmentos guardados, agendamento e automatizações | Concluída | 5–10 dias |
| 7 | Abstrair o fornecedor mantendo SMTP ativo, persistir eventos e preparar métricas, webhooks e supressões | Concluída | Dependente do fornecedor |

Para a etapa 4, a primeira versão deve disponibilizar igualdade para campos de
escolha única e checkbox, inclusão para escolha múltipla, comparação para
números e presença/ausência para texto. Campos removidos do formulário atual
devem continuar legíveis através do `schema_snapshot`, mas só os campos atuais
devem estar disponíveis para criar novos filtros.

### Processamento assíncrono

O envio imediato coloca a campanha numa fila persistente no PostgreSQL e devolve
ao editor sem esperar por todos os emails. O worker processa destinatários em
lotes, usa um lease para impedir workers concorrentes e repete falhas transitórias
com backoff até ao limite de tentativas. A interface consulta o progresso enquanto
a campanha está em fila ou em envio; cada consulta também recupera trabalho cujo
lease tenha expirado.

No Vercel, o processamento iniciado pelo pedido usa `waitUntil`. O cron diário
existente também recupera campanhas pendentes como rede de segurança compatível
com o plano Hobby. Existe ainda uma execução administrativa manual do worker.

### Templates, segmentos e automatizações

O editor inclui sete templates operacionais, segmentos de audiência guardados
por convite e envio agendado em hora de Lisboa, persistido em UTC. Enquanto uma
campanha estiver agendada pode ser reagendada ou cancelada. As automatizações
suportam lembretes antes/depois do evento e pagamentos pendentes, reutilizam
templates e audiências, e guardam uma chave de execução para não duplicarem uma
campanha relativa à mesma data do evento.

O browser aberto consulta agendamentos e ativa trabalho vencido. O cron também
processa agendamentos e automatizações; no plano Vercel Hobby, em que o cron é
diário, a precisão sem uma sessão de gestão aberta fica limitada à frequência
permitida pelo plano.

### Fornecedor e métricas

O envio passa por uma interface de fornecedor configurada por
`CAMPAIGN_EMAIL_PROVIDER`; `smtp` é o adapter ativo e o valor por omissão. Cada
destinatário guarda fornecedor e identificador da mensagem, e cada tentativa
gera um evento normalizado. O painel mostra aceites, falhas e tentativas.

“Aceite pelo SMTP” não significa “entregue”. Como SMTP não disponibiliza
webhooks neste adapter, a interface mostra entrega confirmada como indisponível.
O modelo já admite eventos `delivered`, `bounced` e `complained`, assim como uma
tabela de supressões, para uma futura integração transacional com assinatura de
webhooks validada.

## Modelo de dados

### `invite_campaigns`

Guarda o rascunho e o snapshot do conteúdo: convite, tipo, nome interno, assunto,
preheader, blocos, filtro de audiência, agendamento, estado, contagens, autor e
timestamps.

### `invite_campaign_recipients`

Materializa a audiência no momento do envio: inscrição, nome/email/token em
snapshot, estado individual, erro e data de envio. Uma campanha já enviada nunca
é recalculada a partir da lista atual de inscrições.

Cada inscrição guarda `email_opted_out_at`. O cancelamento é confirmado numa
página pública autenticada pelo token pessoal e não cancela a inscrição no
evento. Novas audiências excluem estas inscrições e o worker volta a verificar
a preferência imediatamente antes da entrega, cobrindo campanhas já agendadas
ou em fila.

### `invite_campaign_segments`, `invite_campaign_automations` e eventos

Os segmentos preservam filtros reutilizáveis por convite. As automatizações
guardam trigger, intervalo, template, audiência e chave da última execução. Os
eventos de entrega são append-only e distinguem aceitação, entrega, bounce,
complaint e falha. `invite_email_suppressions` fica preparado para o adapter
transacional futuro, sem suprimir silenciosamente destinatários no SMTP atual.

## Entrega e segurança

- O adapter atual por Nodemailer/SMTP é suficiente para comunicações operacionais
  e volumes baixos, mas não deve ser tratado como plataforma de bulk marketing.
- O HTML das campanhas usa uma estrutura tabelada, estilos inline, documento
  UTF-8 completo e media query simples para manter o layout no Gmail Web,
  Gmail móvel e Outlook. A pré-visualização do editor segue a mesma hierarquia
  visual do email entregue e inclui o banner efetivo do convite/evento.
- O rodapé inclui um link de cancelamento por inscrição e as mensagens incluem
  os cabeçalhos `List-Unsubscribe` e `List-Unsubscribe-Post`. O `GET` abre apenas
  a confirmação para evitar cancelamentos por scanners; a alteração exige
  `POST`.
- O envio é idempotente: apenas uma campanha em rascunho pode transitar para
  `sending`; reenvios acidentais são rejeitados.
- Conteúdo livre é escapado no servidor. Vídeo é apresentado como link porque a
  maioria dos clientes de email não suporta reprodução incorporada.
- O HTML do editor visual é sanitizado no servidor com uma allowlist restrita;
  scripts, handlers, estilos arbitrários e protocolos diferentes de HTTP(S) são
  removidos. É sempre gerada uma alternativa de texto simples.
- Para métricas de entrega, bounce/complaint e supressão automática deve ser
  escolhido e implementado um adapter transacional (por exemplo Brevo, Mailgun,
  SendGrid ou Amazon SES).
- Aberturas não devem ser a métrica principal; cliques e inscrições atribuídas
  são mais fiáveis.

## Conformidade

Comunicações operacionais e marketing devem permanecer separados. A Fase 2 deve
registar a base/origem do consentimento, disponibilizar unsubscribe e respeitar
uma supressão global. Esta definição é técnica e não substitui validação jurídica
RGPD/ePrivacy.
