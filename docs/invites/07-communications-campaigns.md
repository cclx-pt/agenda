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
5. Publicação: envio imediato e consulta do histórico/resultados.

## Fase 1 — comunicações operacionais

Escopo implementado inicialmente:

- campanhas exclusivamente ligadas a um convite;
- destinatários exclusivamente entre as inscrições que têm email;
- filtros por estado da inscrição, pagamento, bilhete e check-in;
- blocos email-safe: texto, imagem, vídeo/link, workshops, aviso e botão;
- rascunho, pré-visualização, envio de teste e envio imediato;
- snapshot dos destinatários e estado individual de cada envio;
- histórico com totais enviados, falhados e ignorados;
- link pessoal do convite incluído no email de cada inscrito.

Não fazem parte da Fase 1:

- importação de contactos externos;
- newsletters gerais desligadas de um convite;
- campanhas promocionais para pessoas sem inscrição;
- agendamento e automatizações;
- tracking de abertura/clique e webhooks de entrega;
- gestão de consentimentos de marketing e unsubscribe.

Os emails desta fase são operacionais e relativos a uma inscrição existente. Não
transformam automaticamente o inscrito num subscritor de marketing.

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

## Modelo de dados

### `invite_campaigns`

Guarda o rascunho e o snapshot do conteúdo: convite, tipo, nome interno, assunto,
preheader, blocos, filtro de audiência, estado, contagens, autor e timestamps.

### `invite_campaign_recipients`

Materializa a audiência no momento do envio: inscrição, nome/email/token em
snapshot, estado individual, erro e data de envio. Uma campanha já enviada nunca
é recalculada a partir da lista atual de inscrições.

## Entrega e segurança

- O transporte atual por Nodemailer é suficiente para a Fase 1 e volumes baixos,
  mas não deve ser tratado como plataforma de bulk marketing.
- O envio é idempotente: apenas uma campanha em rascunho pode transitar para
  `sending`; reenvios acidentais são rejeitados.
- Conteúdo livre é escapado no servidor. Vídeo é apresentado como link porque a
  maioria dos clientes de email não suporta reprodução incorporada.
- Antes da Fase 2 deve ser escolhido um fornecedor com agendamento, webhooks,
  bounce/suppression e boa entregabilidade (por exemplo Brevo, Mailgun, SendGrid
  ou Amazon SES).
- Aberturas não devem ser a métrica principal; cliques e inscrições atribuídas
  são mais fiáveis.

## Conformidade

Comunicações operacionais e marketing devem permanecer separados. A Fase 2 deve
registar a base/origem do consentimento, disponibilizar unsubscribe e respeitar
uma supressão global. Esta definição é técnica e não substitui validação jurídica
RGPD/ePrivacy.
