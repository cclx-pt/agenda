-- Esquema base da Agenda CCLX (System of Record)
-- Incremento 1 da Fase 3: autenticação OTP por email + papéis.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS users (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email            TEXT UNIQUE NOT NULL,
  name             TEXT,
  role             TEXT NOT NULL DEFAULT 'editor'
                     CHECK (role IN ('admin', 'aprovador', 'editor', 'visitante')),
  is_active        BOOLEAN NOT NULL DEFAULT TRUE,
  can_view_private BOOLEAN NOT NULL DEFAULT FALSE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_login_at    TIMESTAMPTZ
);

-- Migração idempotente para bases já existentes.
ALTER TABLE users ADD COLUMN IF NOT EXISTS can_view_private BOOLEAN NOT NULL DEFAULT FALSE;

-- Acesso por igreja: NULL = todas as igrejas (sem restrição); array = igrejas
-- a que o utilizador tem acesso na gestão de eventos do SoR. Só é relevante
-- para utilizadores não-staff (editores).
ALTER TABLE users ADD COLUMN IF NOT EXISTS churches TEXT[];

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
-- aprovação (RA-01..RA-06).
CREATE TABLE IF NOT EXISTS events (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title            TEXT NOT NULL,
  description      TEXT,
  start_datetime   TIMESTAMPTZ NOT NULL,
  end_datetime     TIMESTAMPTZ,
  all_day          BOOLEAN NOT NULL DEFAULT FALSE,
  location         TEXT,
  community        TEXT NOT NULL DEFAULT 'Sede',
  category         TEXT NOT NULL DEFAULT 'evento'
                     CHECK (category IN ('culto', 'jovens', 'formacao', 'evento')),
  status           TEXT NOT NULL DEFAULT 'rascunho'
                     CHECK (status IN ('rascunho', 'pendente', 'publicado', 'rejeitado')),
  is_private       BOOLEAN NOT NULL DEFAULT FALSE,
  banner_url       TEXT,
  external_id      TEXT,
  rejection_reason TEXT,
  created_by       UUID REFERENCES users (id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  submitted_at     TIMESTAMPTZ,
  published_at     TIMESTAMPTZ,
  CONSTRAINT chk_event_dates CHECK (end_datetime IS NULL OR end_datetime >= start_datetime)
);

CREATE INDEX IF NOT EXISTS idx_events_status ON events (status);
CREATE INDEX IF NOT EXISTS idx_events_start ON events (start_datetime);
CREATE INDEX IF NOT EXISTS idx_events_created_by ON events (created_by);

-- Migração idempotente: igreja responsável por omissão passa a ser a Sede.
ALTER TABLE events ALTER COLUMN community SET DEFAULT 'Sede';

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
-- Fonte única da verdade das igrejas geridas no backoffice. Substitui a lista
-- fixa que existia no código. `external_id` é o ID da inChurch
-- (responsible_church.id) usado para ligar os eventos importados à igreja.
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
-- Fonte única da verdade das categorias geríveis no backoffice. Substitui a
-- lista fixa que existia no CHECK da tabela `events`. `slug` é o identificador
-- estável guardado em events.category; `color` é a cor de apresentação.
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

-- As categorias passam a ser geríveis (tabela `categories`): remove o CHECK
-- fixo de events.category. A validação passa a ser feita na camada de serviço.
ALTER TABLE events DROP CONSTRAINT IF EXISTS events_category_check;

-- ── Etiquetas de privacidade ────────────────────────────────────
-- Lista gerível no backoffice. Uma etiqueta agrupa eventos privados; cada
-- utilizador vê todos os eventos privados (privacy_tags = NULL) ou apenas os
-- das etiquetas que lhe foram atribuídas.
CREATE TABLE IF NOT EXISTS privacy_tags (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Etiqueta de privacidade do evento (obrigatória só quando is_private, validada
-- na camada de aplicação/formulário). NULL = sem etiqueta (visível a todos os
-- que veem privados).
ALTER TABLE events ADD COLUMN IF NOT EXISTS privacy_tag TEXT;

-- Etiquetas de privacidade que o utilizador pode ver: NULL = todas; array =
-- apenas eventos privados com uma destas etiquetas.
ALTER TABLE users ADD COLUMN IF NOT EXISTS privacy_tags TEXT[];

-- Recorrência: as ocorrências materializadas de uma série partilham o mesmo
-- series_id. NULL = evento único.
ALTER TABLE events ADD COLUMN IF NOT EXISTS series_id UUID;
CREATE INDEX IF NOT EXISTS idx_events_series ON events (series_id);
