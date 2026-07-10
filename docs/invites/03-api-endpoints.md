# API Contract — Public Invite Landing Page

Base path assumed: `/api/v1`. Adjust to match the existing app's conventions.

## Organizer-facing (authenticated) endpoints

### `GET /invites/{inviteId}/page`
Returns the current page configuration for the editor (all blocks, meta info,
banner, dates), regardless of `visivel`/draft state.

```json
{
  "inviteId": "uuid",
  "slug": "retiro-jovens-2026-x7f2",
  "bannerUrl": "https://.../banner.jpg",
  "colorTheme": "#1F3864",
  "startDate": "2026-09-12T18:00:00Z",
  "endDate": "2026-09-14T13:00:00Z",
  "meta": { "title": "...", "description": "...", "image": "..." },
  "blocks": [
    { "id": "uuid", "type": "banner", "order": 0, "visible": true, "content": {} },
    { "id": "uuid", "type": "agenda", "order": 1, "visible": true, "content": { "items": [] } },
    { "id": "uuid", "type": "info_extra", "order": 2, "visible": true, "content": { "title": "...", "body": "..." } },
    { "id": "uuid", "type": "rsvp", "order": 3, "visible": true, "content": {} },
    { "id": "uuid", "type": "pagamento", "order": 4, "visible": true, "content": {} },
    { "id": "uuid", "type": "localizacao", "order": 5, "visible": true, "content": {} },
    { "id": "uuid", "type": "partilha", "order": 6, "visible": true, "content": {} }
  ],
  "publishedAt": null
}
```

### `PATCH /invites/{inviteId}/page`
Partial update of page-level fields (banner, dates, meta, color theme).

### `PUT /invites/{inviteId}/page/blocks`
Replace the full ordered block list in one call (simplest approach for a
drag-and-drop editor that submits the whole list on reorder/save).

Request body: `{ "blocks": [ { "id": "uuid|null", "type": "...", "order": 0, "visible": true, "content": {} }, ... ] }`

- `id: null` → create a new block.
- Blocks present in the DB but missing from the payload → deleted.

### `POST /invites/{inviteId}/page/banner`
Multipart upload for the banner image. Returns the stored URL plus generated
Open Graph image variant.

### `GET /invites/{inviteId}/page/preview`
Returns a fully rendered preview (same shape the public endpoint would return),
without requiring the invite to be published/sent.

### `POST /invites/{inviteId}/publish`
Marks the invite as published (`publicado_em = now()`), locking the "draft-only"
state and enabling sends.

## Public (unauthenticated) endpoints

### `GET /public/invite/{slug}`
Returns the render payload for the public landing page. Same overall shape as the
organizer `GET .../page` response, but:
- Excludes any organizer-only fields.
- Includes the current invitee's status card content **if** a `guestToken` query
  param / cookie identifies a known invitee (see below).
- Increments `pagina_visualizacoes` (fire-and-forget, non-blocking).

Query param: `?g={guestToken}` — the unique per-guest token from the invite email
link, used to look up RSVP/payment status without requiring login.

```json
{
  "event": { "name": "...", "startDate": "...", "endDate": "...", "location": "..." },
  "banner": { "url": "..." },
  "blocks": [ /* same as above, filtered to visible: true, ordered */ ],
  "guestStatus": {
    "rsvpState": "confirmed | declined | pending | waitlisted",
    "paymentState": "not_applicable | pending | awaiting_validation | paid | expired",
    "nextAction": "upload_receipt | pay_mbway | none"
  }
}
```

### `GET /public/invite/{slug}/meta`
Lightweight endpoint returning only Open Graph fields — useful for server-side
rendering of `<meta>` tags without pulling the full block payload (crawlers/bots).

### `POST /public/invite/{slug}/rsvp`
Submits the RSVP form. Delegates to the existing RSVP feature (see main spec §3.3);
included here only because the landing page is its entry point.

## Error handling

- Unknown/invalid slug → `404` with a generic "invite not found" page.
- Expired invite (past RSVP deadline and no waitlist) → `410 Gone` with a
  friendly "this invite has closed" message, still showing read-only event info.
