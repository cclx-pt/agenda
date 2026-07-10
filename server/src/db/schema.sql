-- Esquema base da Agenda CCLX (System of Record) — PostgreSQL (Supabase).
-- Os UUID são gerados na aplicação (crypto.randomUUID) ou pelo PostgreSQL
-- (gen_random_uuid, usado nos seeds). As datas são TIMESTAMPTZ (UTC) e os
-- arrays/objetos usam TEXT[]/JSONB nativos.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS users (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email            TEXT NOT NULL UNIQUE,
  name             TEXT,
  role             TEXT NOT NULL DEFAULT 'editor'
                     CHECK (role IN ('admin', 'aprovador', 'editor', 'visitante')),
  is_active        BOOLEAN NOT NULL DEFAULT TRUE,
  can_view_private BOOLEAN NOT NULL DEFAULT FALSE,
  -- Acesso por igreja: NULL = todas; array = igrejas permitidas.
  churches         TEXT[],
  -- Etiquetas de privacidade visíveis: NULL = todas; array = lista permitida.
  privacy_tags     TEXT[],
  -- Token secreto do feed pessoal de subscrição (iCal com eventos privados).
  calendar_token   TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_login_at    TIMESTAMPTZ
);
ALTER TABLE users ADD COLUMN IF NOT EXISTS calendar_token TEXT;

CREATE TABLE IF NOT EXISTS otp_codes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email       TEXT NOT NULL,
  code_hash   TEXT NOT NULL,
  expires_at  TIMESTAMPTZ NOT NULL,
  consumed_at TIMESTAMPTZ,
  attempts    INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_otp_email ON otp_codes (email);
CREATE INDEX IF NOT EXISTS idx_otp_expires ON otp_codes (expires_at);

-- ── Eventos (System of Record) ──────────────────────────────────
-- Fonte da verdade da agenda. external_id mantém a referência ao
-- evento equivalente na inChurch (RG-16). status segue o fluxo de
-- aprovação (RA-01..RA-06). A categoria é validada na camada de serviço.
CREATE TABLE IF NOT EXISTS events (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title            TEXT NOT NULL,
  description      TEXT,
  start_datetime   TIMESTAMPTZ NOT NULL,
  end_datetime     TIMESTAMPTZ,
  all_day          BOOLEAN NOT NULL DEFAULT FALSE,
  location         TEXT,
  community        TEXT NOT NULL DEFAULT 'Sede',
  category         TEXT NOT NULL DEFAULT 'evento',
  subcategory      TEXT,
  featured         BOOLEAN NOT NULL DEFAULT FALSE,
  loop             BOOLEAN NOT NULL DEFAULT FALSE,
  is_general       BOOLEAN NOT NULL DEFAULT FALSE,
  -- Evento "antecipado": aparece no Loop mesmo fora da janela de semanas.
  loop_early       BOOLEAN NOT NULL DEFAULT FALSE,
  status           TEXT NOT NULL DEFAULT 'rascunho'
                     CHECK (status IN ('rascunho', 'pendente', 'publicado', 'rejeitado')),
  is_private       BOOLEAN NOT NULL DEFAULT FALSE,
  -- Etiqueta de privacidade (obrigatória só quando is_private, validada na app).
  privacy_tag      TEXT,
  banner_url       TEXT,
  -- Cartazes dedicados ao Loop (TV) por formato: 16:9 (1920x1080) e 32:9 (3840x1080).
  loop_image_16x9  TEXT,
  loop_image_32x9  TEXT,
  -- Responsável do evento e inscrições (opcionais).
  organizer_name    TEXT,
  organizer_contact TEXT,
  organizer_phone   TEXT,
  organizer_email   TEXT,
  registration_url  TEXT,
  -- Anexo (PDF/imagem) e localização no mapa (opcionais).
  attachment_url    TEXT,
  attachment_name   TEXT,
  map_url           TEXT,
  map_lat           DOUBLE PRECISION,
  map_lng           DOUBLE PRECISION,
  external_id      TEXT,
  rejection_reason TEXT,
  created_by       UUID REFERENCES users (id) ON DELETE SET NULL,
  -- Recorrência: ocorrências materializadas partilham o mesmo series_id.
  series_id        UUID,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  submitted_at     TIMESTAMPTZ,
  published_at     TIMESTAMPTZ,
  CONSTRAINT chk_event_dates CHECK (end_datetime IS NULL OR end_datetime >= start_datetime)
);
CREATE INDEX IF NOT EXISTS idx_events_status ON events (status);
CREATE INDEX IF NOT EXISTS idx_events_start ON events (start_datetime);
CREATE INDEX IF NOT EXISTS idx_events_created_by ON events (created_by);
CREATE INDEX IF NOT EXISTS idx_events_series ON events (series_id);
-- Campos de responsável e inscrições (idempotente para BD existentes).
ALTER TABLE events ADD COLUMN IF NOT EXISTS organizer_name TEXT;
ALTER TABLE events ADD COLUMN IF NOT EXISTS organizer_contact TEXT;
ALTER TABLE events ADD COLUMN IF NOT EXISTS organizer_phone TEXT;
ALTER TABLE events ADD COLUMN IF NOT EXISTS organizer_email TEXT;
ALTER TABLE events ADD COLUMN IF NOT EXISTS registration_url TEXT;
-- Anexo e localização no mapa (idempotente para BD existentes).
ALTER TABLE events ADD COLUMN IF NOT EXISTS attachment_url TEXT;
ALTER TABLE events ADD COLUMN IF NOT EXISTS attachment_name TEXT;
ALTER TABLE events ADD COLUMN IF NOT EXISTS map_url TEXT;
ALTER TABLE events ADD COLUMN IF NOT EXISTS map_lat DOUBLE PRECISION;
ALTER TABLE events ADD COLUMN IF NOT EXISTS map_lng DOUBLE PRECISION;
ALTER TABLE events ADD COLUMN IF NOT EXISTS subcategory TEXT;
ALTER TABLE events ADD COLUMN IF NOT EXISTS featured BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE events ADD COLUMN IF NOT EXISTS loop BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE events ADD COLUMN IF NOT EXISTS is_general BOOLEAN NOT NULL DEFAULT FALSE;
-- Evento "antecipado" no Loop (idempotente para BD existentes).
ALTER TABLE events ADD COLUMN IF NOT EXISTS loop_early BOOLEAN NOT NULL DEFAULT FALSE;
-- Cartazes dedicados ao Loop (TV) por formato (idempotente para BD existentes).
ALTER TABLE events ADD COLUMN IF NOT EXISTS loop_image_16x9 TEXT;
ALTER TABLE events ADD COLUMN IF NOT EXISTS loop_image_32x9 TEXT;

-- Histórico/auditoria das transições de estado (RA-07).
CREATE TABLE IF NOT EXISTS event_history (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id    UUID NOT NULL REFERENCES events (id) ON DELETE CASCADE,
  actor_id    UUID REFERENCES users (id) ON DELETE SET NULL,
  from_status TEXT,
  to_status   TEXT NOT NULL,
  comment     TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_event_history_event ON event_history (event_id);

-- ── Pedidos de alteração a eventos publicados ───────────────────
-- Alterar a data/hora/recorrência de um evento JÁ APROVADO passa por este fluxo:
-- o evento continua publicado (visível) com a data atual até o pedido ser
-- aprovado. Admin/aprovador aplicam de imediato (auto-aprovado); os pedidos de
-- editores ficam pendentes até um moderador aprovar. `scope` = 'single' (só esta
-- ocorrência) ou 'series' (regenera as ocorrências futuras da série).
CREATE TABLE IF NOT EXISTS event_change_requests (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id         UUID NOT NULL REFERENCES events (id) ON DELETE CASCADE,
  series_id        UUID,
  scope            TEXT NOT NULL DEFAULT 'single'
                     CHECK (scope IN ('single', 'series')),
  start_datetime   TIMESTAMPTZ NOT NULL,
  end_datetime     TIMESTAMPTZ,
  all_day          BOOLEAN NOT NULL DEFAULT FALSE,
  recurrence       JSONB,
  reason           TEXT,
  status           TEXT NOT NULL DEFAULT 'pendente'
                     CHECK (status IN ('pendente', 'aprovado', 'rejeitado')),
  rejection_reason TEXT,
  requested_by     UUID REFERENCES users (id) ON DELETE SET NULL,
  resolved_by      UUID REFERENCES users (id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at      TIMESTAMPTZ,
  CONSTRAINT chk_change_dates CHECK (end_datetime IS NULL OR end_datetime >= start_datetime)
);
CREATE INDEX IF NOT EXISTS idx_change_requests_event ON event_change_requests (event_id);
CREATE INDEX IF NOT EXISTS idx_change_requests_status ON event_change_requests (status);

-- ── Delegações de aprovação ──────────────────────────────
-- Um aprovador/admin delega a aprovação de eventos a um editor, opcionalmente
-- restrita a uma igreja e/ou categoria, durante um intervalo de datas.
CREATE TABLE IF NOT EXISTS approval_delegations (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  delegator_id UUID REFERENCES users (id) ON DELETE SET NULL,
  delegate_id  UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  church       TEXT,
  category     TEXT,
  subcategory  TEXT,
  start_date   DATE NOT NULL,
  end_date     DATE NOT NULL,
  active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_delegations_delegate ON approval_delegations (delegate_id);
CREATE INDEX IF NOT EXISTS idx_delegations_delegator ON approval_delegations (delegator_id);
ALTER TABLE approval_delegations ADD COLUMN IF NOT EXISTS subcategory TEXT;

-- ── Âmbito dos aprovadores ──────────────────────────
-- Configuração (complementar ao acesso por igreja do perfil) que limita o que um
-- aprovador pode aprovar/receber, por igreja e/ou categoria. Sem linhas para um
-- aprovador = tudo (dentro das igrejas do seu perfil).
CREATE TABLE IF NOT EXISTS approver_scopes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  approver_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  church      TEXT,
  category    TEXT,
  subcategory TEXT,
  privacy_tag TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE approver_scopes ADD COLUMN IF NOT EXISTS privacy_tag TEXT;
ALTER TABLE approver_scopes ADD COLUMN IF NOT EXISTS subcategory TEXT;
CREATE INDEX IF NOT EXISTS idx_approver_scopes_approver ON approver_scopes (approver_id);

-- ── Eventos externos (espelho da inChurch / inRadar) ────────────
-- Preenchido pela sincronização periódica (server/src/integrations/inchurchSync.js).
-- O calendário lê SÓ da base de dados; a sincronização faz upsert (INSERT/UPDATE)
-- e remove (DELETE) as linhas que desaparecem da API. `external_id` é o id do
-- evento na inChurch (único) usado para a reconciliação; `content_hash` deteta
-- alterações de conteúdo entre sincronizações.
CREATE TABLE IF NOT EXISTS external_events (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  external_id    TEXT NOT NULL UNIQUE,
  title          TEXT NOT NULL,
  description    TEXT,
  start_datetime TIMESTAMPTZ NOT NULL,
  end_datetime   TIMESTAMPTZ,
  location       TEXT,
  community      TEXT NOT NULL DEFAULT 'Sede',
  category       TEXT NOT NULL DEFAULT 'evento',
  image_url      TEXT,
  content_hash   TEXT NOT NULL,
  synced_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_external_events_start ON external_events (start_datetime);

-- ── Definições da aplicação (key/value) ─────────────────────────
-- Configurações geríveis em runtime (ex.: integração de saída com a inChurch:
-- ativar sincronização, permitir PUT, permitir DELETE).
CREATE TABLE IF NOT EXISTS app_settings (
  key        TEXT PRIMARY KEY,
  value      JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES users (id) ON DELETE SET NULL
);

-- ── Igrejas / organizações ──────────────────────────────────────
-- Fonte única da verdade das igrejas geridas no backoffice. `external_id` é o
-- ID da inChurch (responsible_church.id) usado para ligar os eventos importados.
CREATE TABLE IF NOT EXISTS churches (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL UNIQUE,
  external_id INTEGER,
  address     TEXT,
  postal_code TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Semeia as 8 igrejas atuais (idempotente) com o respetivo ID da inChurch.
INSERT INTO churches (name, external_id) VALUES
  ('Sede', 33023),
  ('Açores', 34878),
  ('Almada', 33072),
  ('Barreiro', 33079),
  ('Caldas Da Rainha', 33077),
  ('Coruche', 33080),
  ('Moita', 33078),
  ('Porto', 33075)
ON CONFLICT (name) DO NOTHING;

-- ── Categorias de eventos ───────────────────────────────────────
-- Fonte única da verdade das categorias geríveis no backoffice. `slug` é o
-- identificador estável guardado em events.category; `color` é a cor.
CREATE TABLE IF NOT EXISTS categories (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug       TEXT NOT NULL UNIQUE,
  label      TEXT NOT NULL,
  color      TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Semeia as 4 categorias atuais (idempotente) com as cores em uso.
INSERT INTO categories (slug, label, color, sort_order) VALUES
  ('culto', 'Celebração', '#F5A800', 1),
  ('jovens', 'Jovens', '#6FA8FF', 2),
  ('formacao', 'Formação', '#5DB87A', 3),
  ('evento', 'Evento', '#B8C0D8', 4)
ON CONFLICT (slug) DO NOTHING;

-- Flag por categoria: exige subcategoria nos eventos desta categoria.
ALTER TABLE categories ADD COLUMN IF NOT EXISTS requires_subcategory BOOLEAN NOT NULL DEFAULT FALSE;

-- ── Subcategorias de eventos (lista global) ─────────────────
-- Lista única gerível no backoffice, aplicável a qualquer categoria. O evento
-- guarda o NOME da subcategoria (events.subcategory). A obrigatoriedade é
-- definida por categoria (categories.requires_subcategory).
CREATE TABLE IF NOT EXISTS subcategories (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL UNIQUE,
  color      TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE subcategories ADD COLUMN IF NOT EXISTS color TEXT;

-- Semeia as subcategorias iniciais (idempotente) com cores pastel suaves.
INSERT INTO subcategories (name, sort_order, color) VALUES
  ('B1', 1, '#FBCFE8'),
  ('GLAM', 2, '#DDD6FE'),
  ('Alateia', 3, '#BFDBFE'),
  ('Jump', 4, '#BBF7D0'),
  ('Base', 5, '#FED7AA'),
  ('Escola Dominical', 6, '#FEF08A'),
  ('Grupos de Crescimento', 7, '#A7F3D0')
ON CONFLICT (name) DO NOTHING;

-- Preenche as cores das subcategorias já existentes (sem cor definida).
UPDATE subcategories AS s SET color = v.color
FROM (VALUES
  ('B1', '#FBCFE8'),
  ('GLAM', '#DDD6FE'),
  ('Alateia', '#BFDBFE'),
  ('Jump', '#BBF7D0'),
  ('Base', '#FED7AA'),
  ('Escola Dominical', '#FEF08A'),
  ('Grupos de Crescimento', '#A7F3D0')
) AS v(name, color)
WHERE s.name = v.name AND s.color IS NULL;

-- ── Etiquetas de privacidade ────────────────────────────────────
-- Lista gerível no backoffice. Uma etiqueta agrupa eventos privados; cada
-- utilizador vê todos os privados (privacy_tags = NULL) ou apenas os das
-- etiquetas que lhe foram atribuídas.
CREATE TABLE IF NOT EXISTS privacy_tags (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Registo de reinícios do servidor (observabilidade) ──────────
-- Cada arranque/paragem com sucesso grava uma linha; a página pública /logs
-- mostra as mais recentes. Não contém dados sensíveis. A app também cria esta
-- tabela em runtime (ver server/src/health/repository.js), por isso funciona
-- mesmo sem correr esta migração manualmente.
CREATE TABLE IF NOT EXISTS server_restarts (
  id         BIGSERIAL PRIMARY KEY,
  event      TEXT NOT NULL DEFAULT 'start',
  status     TEXT NOT NULL DEFAULT 'ok',
  node_env   TEXT,
  version    TEXT,
  pid        INTEGER,
  detail     TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_server_restarts_created
  ON server_restarts (created_at DESC);

-- ════════════════════════════════════════════════════════════════
-- Inscrições & convites (páginas públicas de convite)
-- ════════════════════════════════════════════════════════════════
-- Módulo que gera, por cada convite, uma página pública partilhável
-- (landing page) em /convite/<slug> com os detalhes do evento, programa,
-- informação extra, RSVP (inscrição), custo/pagamento, localização e partilha.
-- Assenta sobre a tabela `events` existente (que NÃO é alterada): a ligação é
-- feita SÓ por `convites.evento_id`. Um convite "disponível" (por associar) tem
-- evento_id = NULL; o formulário do evento associa-o definindo evento_id, ou
-- cria um convite novo já com evento_id preenchido.

-- ── Convites (a "Inscrição & convite") ──────────────────────────
-- Entidade de topo com a configuração da página pública. As datas/meta/banner
-- caem para os valores do evento associado quando não forem definidas aqui.
CREATE TABLE IF NOT EXISTS convites (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Evento associado (opcional): NULL = convite disponível/modelo por associar.
  evento_id            UUID REFERENCES events (id) ON DELETE SET NULL,
  -- Nome interno da inscrição (ex.: "Retiro de Jovens 2026").
  titulo               TEXT NOT NULL,
  -- Segmento de URL amigável e único da página pública (ex.: retiro-jovens-2026-x7f2).
  landing_page_slug    TEXT NOT NULL UNIQUE,
  -- Open Graph (partilha): caem para o nome/banner/descrição do evento se vazios.
  meta_titulo          TEXT,
  meta_descricao       TEXT,
  meta_imagem_url      TEXT,
  -- Aparência da página.
  banner_url           TEXT,
  cor_tema             TEXT,
  -- Datas próprias da inscrição (caem para as do evento se NULL).
  data_inicio          TIMESTAMPTZ,
  data_fim             TIMESTAMPTZ,
  -- Configuração de RSVP (inscrição).
  rsvp_ativo           BOOLEAN NOT NULL DEFAULT TRUE,
  rsvp_prazo           TIMESTAMPTZ,
  capacidade           INTEGER,
  -- Campos adicionais do formulário de inscrição (ver 04-content-blocks: rsvp.extraFields).
  rsvp_campos_extra    JSONB NOT NULL DEFAULT '[]'::jsonb,
  -- Configuração de custo/pagamento — só DESCREVE (o fluxo real fica noutra fase).
  tipo_custo           TEXT NOT NULL DEFAULT 'gratuito'
                         CHECK (tipo_custo IN ('gratuito', 'pagamento', 'oferta_voluntaria')),
  valor_fixo           NUMERIC(10, 2),
  valor_sugerido       NUMERIC(10, 2),
  moeda                TEXT NOT NULL DEFAULT 'EUR',
  -- Métodos aceites: ['mbway','transferencia','referencia'].
  metodos_pagamento    JSONB NOT NULL DEFAULT '[]'::jsonb,
  prazo_pagamento_dias INTEGER,
  -- Publicação: NULL enquanto rascunho/pré-visualização; definido ao enviar o
  -- convite aos convidados (protege o estado "só rascunho", ver FR-1.2/AC).
  publicado_em         TIMESTAMPTZ,
  criado_por           UUID REFERENCES users (id) ON DELETE SET NULL,
  criado_em            TIMESTAMPTZ NOT NULL DEFAULT now(),
  atualizado_em        TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_convite_datas CHECK (data_fim IS NULL OR data_fim >= data_inicio)
);
CREATE INDEX IF NOT EXISTS idx_convites_evento ON convites (evento_id);

-- ── Blocos de conteúdo (cartões ordenáveis da página) ───────────
-- Lista ordenada de cartões. O conteúdo real de `agenda`/`info_extra` vive no
-- JSONB `conteudo`; os restantes tipos (banner/rsvp/pagamento/localizacao/
-- partilha) derivam a configuração de `convites`/`events`, mas mantêm aqui a
-- sua posição (`ordem`) e visibilidade (`visivel`) para o editor de cartões.
CREATE TABLE IF NOT EXISTS blocos_conteudo (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  convite_id    UUID NOT NULL REFERENCES convites (id) ON DELETE CASCADE,
  tipo          TEXT NOT NULL
                  CHECK (tipo IN ('banner', 'agenda', 'info_extra', 'rsvp', 'pagamento', 'localizacao', 'partilha')),
  ordem         INTEGER NOT NULL DEFAULT 0,
  conteudo      JSONB NOT NULL DEFAULT '{}'::jsonb,
  visivel       BOOLEAN NOT NULL DEFAULT TRUE,
  criado_em     TIMESTAMPTZ NOT NULL DEFAULT now(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_blocos_conteudo_convite ON blocos_conteudo (convite_id, ordem);

-- ── Convidados (inscritos) ──────────────────────────────────────
-- Cada convidado tem um token secreto próprio usado no link pessoal (?g=token)
-- para consultar/atualizar o seu RSVP e estado sem autenticação (FR-1.4).
CREATE TABLE IF NOT EXISTS convidados (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  convite_id    UUID NOT NULL REFERENCES convites (id) ON DELETE CASCADE,
  nome          TEXT,
  email         TEXT,
  telefone      TEXT,
  -- Token por convidado (link pessoal). Único em toda a tabela.
  token         TEXT NOT NULL UNIQUE,
  rsvp_estado   TEXT NOT NULL DEFAULT 'pendente'
                  CHECK (rsvp_estado IN ('pendente', 'confirmado', 'recusado', 'lista_espera')),
  acompanhantes INTEGER NOT NULL DEFAULT 0,
  -- Respostas aos campos extra configurados no RSVP (chave→valor).
  respostas     JSONB NOT NULL DEFAULT '{}'::jsonb,
  respondido_em TIMESTAMPTZ,
  criado_em     TIMESTAMPTZ NOT NULL DEFAULT now(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_convidados_convite ON convidados (convite_id);

-- ── Pagamentos (estrutura para a fase seguinte) ─────────────────
-- A página só MOSTRA o custo/métodos nesta fase; as transações reais (MB WAY /
-- transferência / referência) e a validação de comprovativos ficam para depois.
CREATE TABLE IF NOT EXISTS pagamentos (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  convidado_id     UUID NOT NULL REFERENCES convidados (id) ON DELETE CASCADE,
  metodo           TEXT NOT NULL CHECK (metodo IN ('mbway', 'transferencia', 'referencia')),
  valor            NUMERIC(10, 2),
  moeda            TEXT NOT NULL DEFAULT 'EUR',
  estado           TEXT NOT NULL DEFAULT 'pendente'
                     CHECK (estado IN ('pendente', 'em_validacao', 'pago', 'expirado')),
  -- Comprovativo carregado (transferência) e/ou referência multibanco gerada.
  comprovativo_url TEXT,
  referencia       TEXT,
  criado_em        TIMESTAMPTZ NOT NULL DEFAULT now(),
  atualizado_em    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_pagamentos_convidado ON pagamentos (convidado_id);

-- ── Visualizações da página (analítica simples, opcional) ───────
-- Alimenta métricas básicas de "vistas" no painel. Escrita fire-and-forget.
CREATE TABLE IF NOT EXISTS pagina_visualizacoes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  convite_id  UUID NOT NULL REFERENCES convites (id) ON DELETE CASCADE,
  visitado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  referer     TEXT,
  user_agent  TEXT
);
CREATE INDEX IF NOT EXISTS idx_pagina_visualizacoes_convite ON pagina_visualizacoes (convite_id);
