# Data Model — Public Invite Landing Page

This assumes the existing `eventos` (events) table is untouched. All new tables
relate to it only through `convites.evento_id`.

## New / extended tables

### `convites` (extend existing invite table from the main module)

Add the following columns if not already present:

```sql
ALTER TABLE convites
  ADD COLUMN landing_page_slug   VARCHAR(160) UNIQUE NOT NULL,
  ADD COLUMN meta_titulo         VARCHAR(200),
  ADD COLUMN meta_imagem_url     VARCHAR(500),
  ADD COLUMN meta_descricao      VARCHAR(300),
  ADD COLUMN banner_url          VARCHAR(500),
  ADD COLUMN cor_tema            VARCHAR(20),
  ADD COLUMN data_inicio         TIMESTAMP,
  ADD COLUMN data_fim            TIMESTAMP NULL,
  ADD COLUMN publicado_em        TIMESTAMP NULL;
```

- `landing_page_slug`: friendly unique URL segment, e.g. `retiro-jovens-2026-x7f2`.
- `meta_*`: Open Graph fields; fall back to event name/banner if not explicitly set.
- `publicado_em`: null while in draft/preview-only state, set when the invite is
  actually sent to invitees.

### `blocos_conteudo` (new)

Ordered content blocks that make up the page body (agenda, extra info, etc.).
Banner/dates/RSVP/payment/location/share are *not* stored here — they're derived
from `convites` and other existing tables — but they still occupy a "slot" in the
render order controlled by `blocos_conteudo.ordem` for consistency if the UI treats
everything as reorderable cards. Adjust to your rendering approach.

```sql
CREATE TABLE blocos_conteudo (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  convite_id    UUID NOT NULL REFERENCES convites(id) ON DELETE CASCADE,
  tipo          VARCHAR(30) NOT NULL CHECK (tipo IN ('banner','agenda','info_extra','rsvp','pagamento','localizacao','partilha')),
  ordem         INTEGER NOT NULL DEFAULT 0,
  conteudo      JSONB NOT NULL DEFAULT '{}'::jsonb,
  visivel       BOOLEAN NOT NULL DEFAULT true,
  criado_em     TIMESTAMP NOT NULL DEFAULT now(),
  atualizado_em TIMESTAMP NOT NULL DEFAULT now()
);

CREATE INDEX idx_blocos_conteudo_convite ON blocos_conteudo(convite_id, ordem);
```

`conteudo` shape depends on `tipo` — see `04-content-blocks-schema.md` for the JSON
schema of each block type.

### `pagina_visualizacoes` (optional, for basic analytics)

```sql
CREATE TABLE pagina_visualizacoes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  convite_id  UUID NOT NULL REFERENCES convites(id) ON DELETE CASCADE,
  visitado_em TIMESTAMP NOT NULL DEFAULT now(),
  referer     VARCHAR(300),
  user_agent  VARCHAR(300)
);
```

Used to power simple "views" metrics in the dashboard (see main spec §3.5). Skip
this table in the MVP if analytics aren't a priority yet.

## Relationship diagram (textual)

```
eventos (existing)
   └─ convites (1:N)
        ├─ blocos_conteudo (1:N)   -- agenda / info_extra / ordering of all cards
        ├─ convidados (1:N)        -- from main invite module
        │     ├─ pagamentos (1:N)
        │     └─ checkins (1:N)
        └─ pagina_visualizacoes (1:N, optional)
```

## Notes

- Keep `conteudo` as JSONB (or equivalent) rather than rigid columns — the "extra
  info" block shape is explicitly expected to evolve (see FR-3.4/3.6 notes).
- `landing_page_slug` should be generated from the event name + a short random
  suffix, validated for uniqueness before insert.
