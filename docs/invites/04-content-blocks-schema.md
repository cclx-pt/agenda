# Content Block Schemas

Each row in `blocos_conteudo` has a `tipo` and a `conteudo` JSON payload. This
document defines the **current minimal shape** of each type. These are expected to
evolve — treat as a v1 draft, not a frozen contract.

## `banner`

```json
{
  "imageUrl": "https://.../banner.jpg",
  "imageUrlMobile": "https://.../banner-mobile.jpg",
  "eventName": "Retiro de Jovens 2026",
  "startDate": "2026-09-12T18:00:00Z",
  "endDate": "2026-09-14T13:00:00Z",
  "location": "Casa de Retiros Monte Sinai, Sintra",
  "shortDescription": "Um fim de semana de comunhão, louvor e crescimento espiritual."
}
```

## `agenda`

```json
{
  "title": "Programa",
  "items": [
    { "time": "2026-09-12T18:00:00Z", "title": "Chegada e check-in", "owner": null },
    { "time": "2026-09-12T19:30:00Z", "title": "Jantar de boas-vindas", "owner": null },
    { "time": "2026-09-12T21:00:00Z", "title": "Culto de abertura", "owner": "Pastor João" }
  ]
}
```

- `items` is ordered as given (no separate `order` field needed inside the array).
- `owner` is optional (speaker/responsible person).

## `info_extra`

```json
{
  "title": "O que trazer",
  "body": "Roupa confortável, saco-cama, artigos de higiene pessoal...",
  "icon": "backpack"
}
```

- Repeatable: multiple `blocos_conteudo` rows with `tipo = 'info_extra'`, each with
  its own `ordem`.
- `icon` is optional, a name from the app's icon set (e.g. lucide-react icon key).
- Formatting is plain text/short paragraphs for v1; rich text (bold/links/lists) is
  a likely v2 addition — do not build a full rich-text editor for the MVP unless
  explicitly requested.

## `rsvp`

```json
{
  "ctaLabel": "Confirmar Presença",
  "extraFields": [
    { "key": "acompanhantes", "label": "Número de acompanhantes", "type": "number", "required": false },
    { "key": "restricoes_alimentares", "label": "Restrições alimentares", "type": "text", "required": false },
    { "key": "tem_crianca", "label": "Vai com criança?", "type": "boolean", "required": false }
  ],
  "rsvpDeadline": "2026-09-05T23:59:59Z",
  "capacity": 80
}
```

## `pagamento`

```json
{
  "costType": "gratuito | pagamento | oferta_voluntaria",
  "fixedAmount": 45.00,
  "suggestedAmount": 15.00,
  "currency": "EUR",
  "allowedMethods": ["mbway", "transferencia", "referencia"],
  "paymentDeadlineDays": 5,
  "reminderIntervalDays": 2
}
```

This block only *describes* the cost/payment configuration for rendering; the
actual payment transaction flow lives in the payments feature (MB WAY / bank
transfer / Multibanco reference — see main functional spec §5–§6).

## `localizacao`

```json
{
  "address": "Casa de Retiros Monte Sinai, Sintra",
  "latitude": 38.8029,
  "longitude": -9.3817,
  "mapProvider": "google",
  "directionsUrl": "https://maps.google.com/?q=..."
}
```

## `partilha`

```json
{
  "shareChannels": ["whatsapp", "email", "copy_link"],
  "calendarLinks": {
    "google": "https://calendar.google.com/...",
    "ics": "https://.../event.ics"
  }
}
```

## Guest status (rendered, not stored as a block)

Computed at request time from `convidados` + `pagamentos`, not persisted in
`blocos_conteudo`:

```json
{
  "rsvpState": "confirmed",
  "paymentState": "awaiting_validation",
  "nextAction": "none",
  "message": "A tua inscrição está confirmada. Aguardamos validação do teu comprovativo de pagamento."
}
```
