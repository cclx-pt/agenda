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
  -- Pode criar e gerir convites (os admins podem sempre, independentemente da flag).
  can_manage_invites BOOLEAN NOT NULL DEFAULT FALSE,
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
ALTER TABLE users ADD COLUMN IF NOT EXISTS can_manage_invites BOOLEAN NOT NULL DEFAULT FALSE;

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

-- ── Convites / páginas públicas de convite ──────────────────────
-- Um convite gera uma página pública (landing) partilhável, composta por blocos
-- de conteúdo reordenáveis. RSVP e pagamento ligam-se a este convite. Pode estar
-- associado a um evento existente (event_id) ou ser autónomo.
CREATE TABLE IF NOT EXISTS invites (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id         UUID REFERENCES events (id) ON DELETE SET NULL,
  slug             TEXT NOT NULL UNIQUE,
  title            TEXT NOT NULL,
  banner_url       TEXT,
  color_theme      TEXT,
  start_datetime   TIMESTAMPTZ,
  end_datetime     TIMESTAMPTZ,
  location         TEXT,
  -- Open Graph (fallback ao título/banner/descrição quando não definidos).
  meta_title       TEXT,
  meta_description  TEXT,
  meta_image_url   TEXT,
  -- Custo/pagamento (apenas descreve a configuração; o fluxo de pagamento é à parte).
  cost_type        TEXT NOT NULL DEFAULT 'gratuito'
                     CHECK (cost_type IN ('gratuito', 'pago', 'voluntario')),
  cost_amount      NUMERIC(10, 2),
  cost_currency    TEXT NOT NULL DEFAULT 'EUR',
  payment_methods  JSONB,
  -- RSVP.
  rsvp_enabled     BOOLEAN NOT NULL DEFAULT TRUE,
  rsvp_deadline    TIMESTAMPTZ,
  capacity         INTEGER,
  waitlist_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  spots_on_landing BOOLEAN NOT NULL DEFAULT FALSE,
  spots_on_registration BOOLEAN NOT NULL DEFAULT FALSE,
  community        TEXT,
  jotform_community TEXT,
  status           TEXT NOT NULL DEFAULT 'rascunho'
                     CHECK (status IN ('rascunho', 'publicado', 'fechado')),
  published_at     TIMESTAMPTZ,
  created_by       UUID REFERENCES users (id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_invites_event ON invites (event_id);
CREATE INDEX IF NOT EXISTS idx_invites_status ON invites (status);

-- Blocos de conteúdo ordenados que compõem o corpo da página (banner, agenda,
-- oradores, info_extra, etc.). `content` é JSONB com a forma própria de cada tipo.
CREATE TABLE IF NOT EXISTS invite_blocks (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invite_id    UUID NOT NULL REFERENCES invites (id) ON DELETE CASCADE,
  type         TEXT NOT NULL,
  ordering     INTEGER NOT NULL DEFAULT 0,
  content      JSONB NOT NULL DEFAULT '{}'::jsonb,
  visible      BOOLEAN NOT NULL DEFAULT TRUE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_invite_blocks_invite ON invite_blocks (invite_id, ordering);

-- Convidados/RSVP. Cada convidado tem um token único (link pessoal) que permite
-- consultar o estado sem sessão. payment_state é o estado do pagamento do convidado.
CREATE TABLE IF NOT EXISTS invite_guests (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invite_id     UUID NOT NULL REFERENCES invites (id) ON DELETE CASCADE,
  token         TEXT NOT NULL UNIQUE,
  name          TEXT,
  email         TEXT,
  phone         TEXT,
  guests_count  INTEGER NOT NULL DEFAULT 1,
  rsvp_state    TEXT NOT NULL DEFAULT 'pending'
                  CHECK (rsvp_state IN ('pending', 'confirmed', 'declined', 'waitlisted')),
  payment_state TEXT NOT NULL DEFAULT 'not_applicable'
                  CHECK (payment_state IN ('not_applicable', 'pending', 'awaiting_validation', 'paid', 'expired')),
  extra         JSONB,
  responded_at  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_invite_guests_invite ON invite_guests (invite_id);

-- Visualizações da página (métricas simples; fire-and-forget no pedido público).
CREATE TABLE IF NOT EXISTS invite_page_views (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invite_id   UUID NOT NULL REFERENCES invites (id) ON DELETE CASCADE,
  viewed_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  referer     TEXT,
  user_agent  TEXT
);
CREATE INDEX IF NOT EXISTS idx_invite_page_views_invite ON invite_page_views (invite_id);

-- Conector de pagamento por convite ('manual' por omissão; conectores reais
-- ligam-se depois — ver server/src/invites/payments/connector.js).
ALTER TABLE invites ADD COLUMN IF NOT EXISTS payment_provider TEXT;

-- Pagamentos dos convidados. Estrutura pronta para ligar a um CONECTOR de
-- pagamento (MB WAY / Multibanco / transferência). O conector "manual" (default)
-- gera instruções/referência locais e a validação é feita pelo organizador;
-- conectores reais preenchem provider_ref/provider_payload e confirmam por webhook.
CREATE TABLE IF NOT EXISTS invite_payments (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invite_id        UUID NOT NULL REFERENCES invites (id) ON DELETE CASCADE,
  guest_id         UUID NOT NULL REFERENCES invite_guests (id) ON DELETE CASCADE,
  method           TEXT NOT NULL CHECK (method IN ('mbway', 'transferencia', 'referencia')),
  amount           NUMERIC(10, 2),
  currency         TEXT NOT NULL DEFAULT 'EUR',
  status           TEXT NOT NULL DEFAULT 'pending'
                     CHECK (status IN ('pending', 'awaiting_validation', 'paid', 'failed', 'expired', 'cancelled')),
  provider         TEXT,
  provider_ref     TEXT,
  provider_payload JSONB,
  receipt_url      TEXT,
  paid_at          TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_invite_payments_invite ON invite_payments (invite_id);
CREATE INDEX IF NOT EXISTS idx_invite_payments_guest ON invite_payments (guest_id);

-- Melhorias aos convites: datas de inscrição próprias (start_datetime/end_datetime
-- passam a ser as datas do EVENTO; rsvp_start_datetime..rsvp_deadline = janela de
-- inscrição), origem do banner (evento vs próprio) e método de pagamento único.
ALTER TABLE invites ADD COLUMN IF NOT EXISTS rsvp_start_datetime TIMESTAMPTZ;
ALTER TABLE invites ADD COLUMN IF NOT EXISTS use_event_banner BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE invites ADD COLUMN IF NOT EXISTS payment_method TEXT;
ALTER TABLE invites ADD COLUMN IF NOT EXISTS map_url TEXT;
-- Modo de inscrição: 'none' (só página), 'external' (link) ou 'internal' (bilhetes + formulário aqui).
ALTER TABLE invites ADD COLUMN IF NOT EXISTS registration_mode TEXT NOT NULL DEFAULT 'internal';
ALTER TABLE invites ADD COLUMN IF NOT EXISTS registration_url TEXT;
-- Comunidade enviada ao JotForm do MB WAY (conjunto do JotForm; NULL = automático).
ALTER TABLE invites ADD COLUMN IF NOT EXISTS jotform_community TEXT;
-- Lista de espera (opt-in) + onde mostrar o contador de vagas (landing / inscrição).
ALTER TABLE invites ADD COLUMN IF NOT EXISTS waitlist_enabled BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE invites ADD COLUMN IF NOT EXISTS spots_on_landing BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE invites ADD COLUMN IF NOT EXISTS spots_on_registration BOOLEAN NOT NULL DEFAULT FALSE;

-- Bilhetes (tipos) de um convite. Tipos: individual/pago (com valor), grátis
-- (0€), doação (valor à escolha) ou grupo. Cada tipo tem preço, capacidade
-- (NULL = ilimitado), nº de pessoas por grupo e método de pagamento.
CREATE TABLE IF NOT EXISTS invite_tickets (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invite_id   UUID NOT NULL REFERENCES invites (id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  kind        TEXT NOT NULL DEFAULT 'individual'
                CHECK (kind IN ('individual', 'gratis', 'voluntaria', 'grupo', 'campanha')),
  price       NUMERIC(10, 2),
  currency    TEXT NOT NULL DEFAULT 'EUR',
  capacity    INTEGER,
  group_size  INTEGER,
  party_type  TEXT NOT NULL DEFAULT 'single',
  description TEXT,
  payment_method TEXT,
  payment_methods JSONB,
  mb_entity   TEXT,
  mb_reference TEXT,
  mb_numbers  JSONB,
  active      BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_invite_tickets_invite ON invite_tickets (invite_id);
-- Migrações idempotentes (BDs já criadas): novos tipos de bilhete + método por bilhete.
ALTER TABLE invite_tickets ADD COLUMN IF NOT EXISTS payment_method TEXT;
-- Vários métodos de pagamento por bilhete (o convidado escolhe um). payment_method
-- mantém-se sincronizado com o primeiro elemento (retrocompatibilidade).
ALTER TABLE invite_tickets ADD COLUMN IF NOT EXISTS payment_methods JSONB;
ALTER TABLE invite_tickets DROP CONSTRAINT IF EXISTS invite_tickets_kind_check;
ALTER TABLE invite_tickets ADD CONSTRAINT invite_tickets_kind_check
  CHECK (kind IN ('individual', 'gratis', 'voluntaria', 'grupo', 'campanha'));
-- Composição do bilhete: 'single' (individual), 'family' (família) ou 'group' (grupo).
-- Family/group abrem a lista de membros (nome, idade, observações se < 11) no formulário.
ALTER TABLE invite_tickets ADD COLUMN IF NOT EXISTS party_type TEXT NOT NULL DEFAULT 'single';
-- Entidade + referência Multibanco definidas no bilhete (método 'referencia-multibanco').
ALTER TABLE invite_tickets ADD COLUMN IF NOT EXISTS mb_entity TEXT;
ALTER TABLE invite_tickets ADD COLUMN IF NOT EXISTS mb_reference TEXT;
-- Números MB WAY definidos no bilhete (método 'mbway'); vazio usa os do método.
ALTER TABLE invite_tickets ADD COLUMN IF NOT EXISTS mb_numbers JSONB;

-- Bilhete escolhido por cada convidado (NULL = sem bilhete / evento gratuito).
ALTER TABLE invite_guests ADD COLUMN IF NOT EXISTS ticket_id UUID REFERENCES invite_tickets (id) ON DELETE SET NULL;
-- Código curto único do bilhete (mostrado ao convidado / QR / validação à entrada).
ALTER TABLE invite_guests ADD COLUMN IF NOT EXISTS code TEXT;
-- Data/hora do check-in (validação à entrada); NULL = ainda não fez check-in.
ALTER TABLE invite_guests ADD COLUMN IF NOT EXISTS checked_in_at TIMESTAMPTZ;
