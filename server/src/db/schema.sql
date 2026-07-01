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
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_login_at    TIMESTAMPTZ
);

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
  status           TEXT NOT NULL DEFAULT 'rascunho'
                     CHECK (status IN ('rascunho', 'pendente', 'publicado', 'rejeitado')),
  is_private       BOOLEAN NOT NULL DEFAULT FALSE,
  -- Etiqueta de privacidade (obrigatória só quando is_private, validada na app).
  privacy_tag      TEXT,
  banner_url       TEXT,
  -- Responsável do evento e inscrições (opcionais).
  organizer_name    TEXT,
  organizer_contact TEXT,
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
ALTER TABLE events ADD COLUMN IF NOT EXISTS registration_url TEXT;
-- Anexo e localização no mapa (idempotente para BD existentes).
ALTER TABLE events ADD COLUMN IF NOT EXISTS attachment_url TEXT;
ALTER TABLE events ADD COLUMN IF NOT EXISTS attachment_name TEXT;
ALTER TABLE events ADD COLUMN IF NOT EXISTS map_url TEXT;
ALTER TABLE events ADD COLUMN IF NOT EXISTS map_lat DOUBLE PRECISION;
ALTER TABLE events ADD COLUMN IF NOT EXISTS map_lng DOUBLE PRECISION;

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
