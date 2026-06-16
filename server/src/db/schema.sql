-- Esquema base da Agenda CCLX (System of Record) — MariaDB / MySQL.
-- Os UUID são gerados na aplicação (crypto.randomUUID) e guardados em CHAR(36).
-- As datas são guardadas em DATETIME (UTC) e os arrays/objetos em JSON.

CREATE TABLE IF NOT EXISTS users (
  id               CHAR(36) PRIMARY KEY,
  email            VARCHAR(255) NOT NULL UNIQUE,
  name             VARCHAR(255),
  role             VARCHAR(20) NOT NULL DEFAULT 'editor'
                     CHECK (role IN ('admin', 'aprovador', 'editor', 'visitante')),
  is_active        BOOLEAN NOT NULL DEFAULT TRUE,
  can_view_private BOOLEAN NOT NULL DEFAULT FALSE,
  -- Acesso por igreja: NULL = todas; array JSON = igrejas permitidas.
  churches         JSON,
  -- Etiquetas de privacidade visíveis: NULL = todas; array JSON = lista permitida.
  privacy_tags     JSON,
  created_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_login_at    DATETIME
);

CREATE TABLE IF NOT EXISTS otp_codes (
  id          CHAR(36) PRIMARY KEY,
  email       VARCHAR(255) NOT NULL,
  code_hash   VARCHAR(128) NOT NULL,
  expires_at  DATETIME NOT NULL,
  consumed_at DATETIME,
  attempts    INT NOT NULL DEFAULT 0,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_otp_email (email),
  KEY idx_otp_expires (expires_at)
);

-- ── Eventos (System of Record) ──────────────────────────────────
-- Fonte da verdade da agenda. external_id mantém a referência ao
-- evento equivalente na inChurch (RG-16). status segue o fluxo de
-- aprovação (RA-01..RA-06). A categoria é validada na camada de serviço.
CREATE TABLE IF NOT EXISTS events (
  id               CHAR(36) PRIMARY KEY,
  title            VARCHAR(255) NOT NULL,
  description      TEXT,
  start_datetime   DATETIME NOT NULL,
  end_datetime     DATETIME,
  all_day          BOOLEAN NOT NULL DEFAULT FALSE,
  location         VARCHAR(255),
  community        VARCHAR(120) NOT NULL DEFAULT 'Sede',
  category         VARCHAR(50) NOT NULL DEFAULT 'evento',
  status           VARCHAR(20) NOT NULL DEFAULT 'rascunho'
                     CHECK (status IN ('rascunho', 'pendente', 'publicado', 'rejeitado')),
  is_private       BOOLEAN NOT NULL DEFAULT FALSE,
  -- Etiqueta de privacidade (obrigatória só quando is_private, validada na app).
  privacy_tag      VARCHAR(120),
  banner_url       VARCHAR(512),
  external_id      VARCHAR(120),
  rejection_reason TEXT,
  created_by       CHAR(36),
  -- Recorrência: ocorrências materializadas partilham o mesmo series_id.
  series_id        CHAR(36),
  created_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  submitted_at     DATETIME,
  published_at     DATETIME,
  CONSTRAINT chk_event_dates CHECK (end_datetime IS NULL OR end_datetime >= start_datetime),
  KEY idx_events_status (status),
  KEY idx_events_start (start_datetime),
  KEY idx_events_created_by (created_by),
  KEY idx_events_series (series_id),
  CONSTRAINT fk_events_created_by FOREIGN KEY (created_by)
    REFERENCES users (id) ON DELETE SET NULL
);

-- Histórico/auditoria das transições de estado (RA-07).
CREATE TABLE IF NOT EXISTS event_history (
  id          CHAR(36) PRIMARY KEY,
  event_id    CHAR(36) NOT NULL,
  actor_id    CHAR(36),
  from_status VARCHAR(20),
  to_status   VARCHAR(20) NOT NULL,
  comment     TEXT,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_event_history_event (event_id),
  CONSTRAINT fk_history_event FOREIGN KEY (event_id)
    REFERENCES events (id) ON DELETE CASCADE,
  CONSTRAINT fk_history_actor FOREIGN KEY (actor_id)
    REFERENCES users (id) ON DELETE SET NULL
);

-- ── Definições da aplicação (key/value) ─────────────────────────
-- Configurações geríveis em runtime (ex.: integração de saída com a inChurch:
-- ativar sincronização, permitir PUT, permitir DELETE).
CREATE TABLE IF NOT EXISTS app_settings (
  `key`      VARCHAR(120) PRIMARY KEY,
  value      JSON NOT NULL,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_by CHAR(36),
  CONSTRAINT fk_settings_updated_by FOREIGN KEY (updated_by)
    REFERENCES users (id) ON DELETE SET NULL
);

-- ── Igrejas / organizações ──────────────────────────────────────
-- Fonte única da verdade das igrejas geridas no backoffice. `external_id` é o
-- ID da inChurch (responsible_church.id) usado para ligar os eventos importados.
CREATE TABLE IF NOT EXISTS churches (
  id          CHAR(36) PRIMARY KEY,
  name        VARCHAR(255) NOT NULL UNIQUE,
  external_id INT,
  address     VARCHAR(255),
  postal_code VARCHAR(40),
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Semeia as 8 igrejas atuais (idempotente) com o respetivo ID da inChurch.
INSERT IGNORE INTO churches (id, name, external_id) VALUES
  (UUID(), 'Sede', 33023),
  (UUID(), 'Açores', 34878),
  (UUID(), 'Almada', 33072),
  (UUID(), 'Barreiro', 33079),
  (UUID(), 'Caldas Da Rainha', 33077),
  (UUID(), 'Coruche', 33080),
  (UUID(), 'Moita', 33078),
  (UUID(), 'Porto', 33075);

-- ── Categorias de eventos ───────────────────────────────────────
-- Fonte única da verdade das categorias geríveis no backoffice. `slug` é o
-- identificador estável guardado em events.category; `color` é a cor.
CREATE TABLE IF NOT EXISTS categories (
  id         CHAR(36) PRIMARY KEY,
  slug       VARCHAR(120) NOT NULL UNIQUE,
  label      VARCHAR(120) NOT NULL,
  color      VARCHAR(20),
  sort_order INT NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Semeia as 4 categorias atuais (idempotente) com as cores em uso.
INSERT IGNORE INTO categories (id, slug, label, color, sort_order) VALUES
  (UUID(), 'culto', 'Celebração', '#F5A800', 1),
  (UUID(), 'jovens', 'Jovens', '#6FA8FF', 2),
  (UUID(), 'formacao', 'Formação', '#5DB87A', 3),
  (UUID(), 'evento', 'Evento', '#B8C0D8', 4);

-- ── Etiquetas de privacidade ────────────────────────────────────
-- Lista gerível no backoffice. Uma etiqueta agrupa eventos privados; cada
-- utilizador vê todos os privados (privacy_tags = NULL) ou apenas os das
-- etiquetas que lhe foram atribuídas.
CREATE TABLE IF NOT EXISTS privacy_tags (
  id         CHAR(36) PRIMARY KEY,
  name       VARCHAR(120) NOT NULL UNIQUE,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
