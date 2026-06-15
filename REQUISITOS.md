# Requisitos — Agenda CCLX

Documento de requisitos a desenvolver para a Agenda interativa do site da CCLX
(Comunidade Cristã de Lisboa).

> **Estado:** rascunho inicial. Cada requisito está numerado para referência
> (ex.: `RG-01`) e marcado com prioridade: 🔴 Alta · 🟡 Média · 🟢 Baixa.

---

## 1. Requisitos Gerais

### 1.1 Visão

Pretende-se uma aplicação para uma **igreja (organização)** gerir a agenda geral e
a das suas **comunidades locais (igrejas)**. Deve ser uma solução **online**
composta por duas partes principais:

- **Parte de gestão/administração** — gestão de utilizadores, roles, acessos e
  igrejas/comunidades, bem como a gestão da agenda (criação de eventos, fluxos de
  aprovação, gestão por comunidade, etc.).
- **Parte pública** — a agenda em modo de visualização, com vários filtros
  (por comunidade, datas, tipo de evento, etc.).

### 1.2 Pilares da solução

| ID | Pilar | Descrição |
|------|-------|-----------|
| RG-P1 | **Gestão / Admin** | Backoffice para administração de utilizadores, roles, acessos, igrejas/comunidades e gestão completa da agenda. |
| RG-P2 | **Agenda privada** | Vista de agenda restrita: apenas alguns utilizadores veem determinadas datas/eventos (ex.: controlo por *tag*/comunidade). |
| RG-P3 | **Agenda pública** | Vista de agenda aberta a todos, apenas para visualização, com filtros. |

### 1.3 Requisitos

| ID | Requisito | Prioridade |
|------|-----------|:----------:|
| RG-01 | A aplicação deve ser uma agenda/calendário, consumindo exclusivamente o endpoint `/event/` da API inChurch. | 🔴 |
| RG-02 | Toda a comunicação com a API deve passar pelo proxy (`/api/*`), garantindo que as credenciais nunca chegam ao browser. | 🔴 |
| RG-03 | A interface deve ser totalmente responsiva (mobile, tablet, desktop). | 🔴 |
| RG-04 | A aplicação deve suportar tema claro e escuro, com preferência persistida. | 🟡 |
| RG-05 | O conteúdo deve estar em português (PT-PT) por omissão. | 🟡 |
| RG-06 | A aplicação deve tratar estados de carregamento, erro e ausência de eventos com feedback claro ao utilizador. | 🔴 |
| RG-07 | A paginação dos eventos deve ser feita via `limit` + `offset` (página de 200), de forma transparente. | 🟡 |
| RG-08 | A aplicação deve ter desempenho aceitável mesmo com o volume total de eventos (~2500). | 🟡 |
| RG-09 | Deve cumprir requisitos básicos de acessibilidade (contraste, navegação por teclado, ARIA). | 🟡 |
| RG-10 | Deve permitir exportar eventos para formato `.ics` (calendário). | 🟢 |
| RG-11 | Deve suportar uma organização com múltiplas igrejas/comunidades, permitindo gerir a agenda geral e a de cada comunidade. | 🔴 |
| RG-12 | Deve distinguir agenda pública (acesso a todos) de agenda privada (eventos/datas visíveis apenas a utilizadores autorizados, ex.: por *tag*/comunidade). | 🔴 |
| RG-13 | O acesso à parte de gestão/administração deve exigir autenticação e respeitar os roles/permissões. | 🔴 |

### 1.4 Integração e System of Record

Esta aplicação é o **System of Record (SoR)** da agenda: é sempre a fonte da
verdade dos eventos. A aplicação integra com a **API da inChurch** para também
criar/refletir os eventos na inChurch, mas os dados de referência mantêm-se sempre
nesta solução.

| ID | Requisito | Prioridade |
|------|-----------|:----------:|
| RG-14 | A aplicação é o **System of Record** da agenda — fonte da verdade de todos os eventos. | 🔴 |
| RG-15 | A aplicação deve integrar com a API da inChurch para criar/sincronizar eventos na inChurch a partir dos eventos criados aqui. | 🔴 |
| RG-16 | Cada evento deve manter a referência ao seu equivalente na inChurch (ex.: ID externo) para permitir sincronização e atualização. | 🟡 |
| RG-17 | Em caso de divergência ou conflito, prevalecem sempre os dados desta aplicação (SoR). | 🟡 |
| RG-18 | Falhas na integração com a inChurch não devem comprometer o registo do evento nesta aplicação; deve haver tratamento de erro e possibilidade de reenvio. | 🟡 |

---

## 2. Requisitos por Role

> Definição dos perfis de utilizador e respetivas permissões.

### 2.1 Visitante (público, não autenticado)
| ID | Requisito | Prioridade |
|------|-----------|:----------:|
| RR-01 | Pode visualizar a agenda pública e os detalhes de cada evento aprovado. | 🔴 |
| RR-02 | Pode pesquisar e filtrar eventos por comunidade/categoria e data. | 🔴 |
| RR-03 | Pode exportar eventos individuais para o seu calendário. | 🟢 |
| RR-04 | Não pode criar, editar ou aprovar entradas de agenda. | 🔴 |

### 2.2 Editor / Criador de conteúdo
| ID | Requisito | Prioridade |
|------|-----------|:----------:|
| RR-05 | Pode criar novas entradas de agenda (ficam em estado "pendente de aprovação"). | 🔴 |
| RR-06 | Pode editar as entradas que criou enquanto não estiverem aprovadas. | 🟡 |
| RR-07 | Pode submeter uma entrada para aprovação. | 🔴 |
| RR-08 | Pode consultar o estado das suas submissões (pendente / aprovado / rejeitado). | 🟡 |

### 2.3 Aprovador / Moderador
| ID | Requisito | Prioridade |
|------|-----------|:----------:|
| RR-09 | Pode rever, aprovar ou rejeitar entradas submetidas. | 🔴 |
| RR-10 | Pode devolver uma entrada ao editor com comentários/motivo. | 🟡 |
| RR-11 | Pode editar qualquer entrada, independentemente de quem a criou. | 🟡 |

### 2.4 Administrador
| ID | Requisito | Prioridade |
|------|-----------|:----------:|
| RR-12 | Tem acesso total: gestão de utilizadores, roles e configurações. | 🔴 |
| RR-13 | Pode gerir categorias, comunidades e tipos de entrada. | 🟡 |
| RR-14 | Pode gerir os recursos gráficos (banners) e regras associadas. | 🟡 |

---

## 3. Requisitos para a Página Pública

| ID | Requisito | Prioridade |
|------|-----------|:----------:|
| RP-01 | Mostrar uma vista de mês (calendário) com indicação dos dias que têm eventos. | 🔴 |
| RP-02 | Ao clicar num dia, mostrar a lista de eventos desse dia (popup/painel). | 🔴 |
| RP-03 | Cada evento deve ter um cartão com título, data/hora, local e categoria. | 🔴 |
| RP-04 | Permitir ver o detalhe completo de um evento (descrição, banner, etc.). | 🔴 |
| RP-05 | Barra de pesquisa por texto livre (título/descrição). | 🟡 |
| RP-06 | Filtro por comunidade/categoria (culto, jovens, formação, evento). | 🔴 |
| RP-07 | Mini-calendário de navegação rápida entre meses. | 🟡 |
| RP-08 | Apenas eventos aprovados e públicos são apresentados. | 🔴 |
| RP-09 | Botão de exportar evento (`.ics`) no detalhe. | 🟢 |
| RP-10 | A página deve ser indexável/partilhável (metadados adequados). | 🟢 |

---

## 4. Requisitos do Fluxo de Aprovação de Agenda

| ID | Requisito | Prioridade |
|------|-----------|:----------:|
| RA-01 | Toda a nova entrada de agenda inicia no estado **Rascunho**. | 🔴 |
| RA-02 | O editor submete a entrada, que passa a **Pendente de aprovação**. | 🔴 |
| RA-03 | O aprovador pode **Aprovar** (passa a Publicado) ou **Rejeitar** (passa a Rejeitado). | 🔴 |
| RA-04 | Ao rejeitar/devolver, é obrigatório indicar um motivo/comentário. | 🟡 |
| RA-05 | Entradas rejeitadas podem ser corrigidas e voltar a ser submetidas. | 🟡 |
| RA-06 | Apenas entradas no estado **Publicado** aparecem na página pública. | 🔴 |
| RA-07 | Cada transição de estado deve registar autor, data/hora e comentário (histórico/auditoria). | 🟡 |
| RA-08 | Notificar o editor quando a sua entrada é aprovada ou rejeitada. | 🟢 |
| RA-09 | Um aprovador não deve poder aprovar a sua própria entrada (separação de funções), salvo se for Administrador. | 🟢 |

**Estados:** `Rascunho → Pendente → Publicado` · `Pendente → Rejeitado → (Rascunho)`

---

## 5. Requisitos de Criação de Entrada de Agenda

| ID | Requisito | Prioridade |
|------|-----------|:----------:|
| RC-01 | Formulário com campos: título, descrição, data/hora de início e fim, local, comunidade/categoria, tipo de entrada. | 🔴 |
| RC-02 | Validação: título e data de início são obrigatórios; data de fim ≥ data de início. | 🔴 |
| RC-03 | Suporte a eventos de dia inteiro (sem hora). | 🟡 |
| RC-04 | Suporte a eventos recorrentes (diário/semanal/mensal) com data limite. | 🟢 |
| RC-05 | Possibilidade de associar um banner/imagem à entrada. | 🟡 |
| RC-06 | Pré-visualização da entrada antes de submeter para aprovação. | 🟡 |
| RC-07 | Guardar como rascunho sem submeter. | 🟡 |
| RC-08 | A categoria pode ser inferida automaticamente do nome do evento, com possibilidade de ajuste manual. | 🟢 |
| RC-09 | Impedir submissão de datas no passado (aviso, não bloqueio rígido). | 🟢 |

---

## 6. Requisitos de Tipos de Entradas de Agenda

> Tipologia de entradas e respetivo tratamento visual/funcional.

| ID | Tipo | Descrição | Origem da categoria |
|------|------|-----------|---------------------|
| RT-01 | **Culto** | Celebrações e cultos regulares. | Nome contém *Celebração*, *Culto* |
| RT-02 | **Jovens** | Eventos do ministério de jovens. | Nome contém *LOUD*, *Jovens* |
| RT-03 | **Formação** | Grupos, escolas, oficinas e cursos. | Nome contém *Grupo*, *Crescimento*, *GC*, *Formação*, *Escola*, *B1*, *Be One*, *Oficina* |
| RT-04 | **Evento** | Qualquer outra entrada (categoria por omissão). | Restantes |

| ID | Requisito | Prioridade |
|------|-----------|:----------:|
| RT-05 | Cada tipo deve ter cor/ícone próprio, consistente em toda a aplicação. | 🟡 |
| RT-06 | Os filtros da página pública devem refletir estes tipos. | 🔴 |
| RT-07 | A lista de tipos deve ser configurável pelo Administrador (futuro). | 🟢 |
| RT-08 | A inferência de categoria deve poder ser sobreposta manualmente na criação. | 🟡 |

---

## 7. Requisitos Gráficos para Banners

| ID | Requisito | Prioridade |
|------|-----------|:----------:|
| RB-01 | Cada entrada de agenda pode ter um banner associado (imagem destacada). | 🟡 |
| RB-02 | Definir dimensões e proporção (aspect ratio) recomendadas para o banner. | 🟡 |
| RB-03 | Validar formato (JPG/PNG/WebP) e tamanho máximo do ficheiro no upload. | 🟡 |
| RB-04 | Gerar/otimizar versões responsivas (thumbnail vs. detalhe). | 🟢 |
| RB-05 | Banner por omissão por tipo de entrada quando não houver imagem. | 🟡 |
| RB-06 | Texto alternativo (alt) obrigatório para acessibilidade. | 🟡 |
| RB-07 | Pré-visualização do banner no formulário de criação. | 🟢 |
| RB-08 | Garantir contraste/legibilidade quando há texto sobre o banner. | 🟢 |
| RB-09 | Banner deve adaptar-se ao tema claro/escuro sem perder legibilidade. | 🟢 |
