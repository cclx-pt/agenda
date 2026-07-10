# CCLX Conference — Landing Page Section Definitions

This document specializes the generic block system (`04-content-blocks-schema.md`)
for this specific event: the CCLX conference invite page. It defines each section
in the exact order requested, with fields, data shape, and admin/editing notes.

Where a section maps to an existing generic block type, that's noted; where it
doesn't, a new `tipo` is proposed.

---

## 1. Cabeçalho (Header)

**Maps to:** extends the generic `banner` block with two extra fields (`verse`,
`ctaLabel`/`ctaTarget`).

**Purpose:** first thing seen on the page — sets identity, dates, place, and the
single most important action (register).

| Field | Type | Required | Notes |
|---|---|---|---|
| `bannerUrl` | image | Yes | Conference banner image |
| `bannerUrlMobile` | image | No | Optional cropped variant for small screens |
| `dates` | text/date range | Yes | e.g. "20–22 março 2026" |
| `location` | text | Yes | Venue name/city |
| `verse` | text | No | A Bible verse tied to the conference theme |
| `verseReference` | text | No | e.g. "Filipenses 4:13" |
| `ctaLabel` | text | Yes | Default: "Inscrever-me" |
| `ctaTarget` | anchor/link | Yes | Scrolls to / links to the Inscrições section (§7) |

```json
{
  "type": "cabecalho",
  "content": {
    "bannerUrl": "https://.../banner.jpg",
    "dates": "20–22 março 2026",
    "location": "Auditório CCLX, Lisboa",
    "verse": "Tudo posso naquele que me fortalece.",
    "verseReference": "Filipenses 4:13",
    "ctaLabel": "Inscrever-me",
    "ctaTarget": "#inscricoes"
  }
}
```

**Behavior:** the CTA always scrolls/links to §7 (Inscrições) rather than opening a
separate flow — keeps registration in one visible place.

---

## 2. A Conferência CCLX

**Maps to:** `info_extra` block (single instance, fixed position right after the
header).

**Purpose:** short descriptive text — what the conference is, in a sentence or two.

| Field | Type | Required | Notes |
|---|---|---|---|
| `title` | text | Yes | Default: "A Conferência CCLX" |
| `body` | text | Yes | Short paragraph, no rich formatting needed for v1 |

```json
{
  "type": "info_extra",
  "subtype": "sobre_conferencia",
  "content": {
    "title": "A Conferência CCLX",
    "body": "A Conferência CCLX é um encontro anual da nossa comunidade para..."
  }
}
```

---

## 3. Um Convite (An Invitation)

**Maps to:** new block type `convite_narrativo`.

**Purpose:** a short, personal narrative (4–5 lines) on *why* the conference
matters, optionally paired with a presentation video.

| Field | Type | Required | Notes |
|---|---|---|---|
| `narrative` | text | Yes | 4–5 lines, no strict character limit but UI should discourage long text |
| `videoUrl` | video URL/embed | No | YouTube/Vimeo link or hosted file; optional |
| `videoThumbnailUrl` | image | No | Poster frame if `videoUrl` set |

```json
{
  "type": "convite_narrativo",
  "content": {
    "narrative": "Há um ano decidimos que este encontro tinha de acontecer...\n(4–5 linhas)",
    "videoUrl": "https://youtube.com/watch?v=...",
    "videoThumbnailUrl": "https://.../thumb.jpg"
  }
}
```

**Behavior:** if `videoUrl` is empty, the video player is not rendered — only the
narrative text shows.

---

## 4. Oradores e Convidados (Speakers & Guests)

**Maps to:** new block type `oradores`, containing a repeatable list of speaker
cards.

**Purpose:** grid of cards, one per confirmed speaker/guest, **added incrementally
as confirmations come in** — the section must support a variable, growing number of
cards without redesign.

| Field (per card) | Type | Required | Notes |
|---|---|---|---|
| `photoUrl` | image | Yes | Headshot |
| `name` | text | Yes | |
| `bio` | text | Yes | Short bio, 1–3 lines |
| `role` | text | No | e.g. "Orador principal", "Convidado" |
| `order` | integer | No | Manual ordering; default = confirmation order |

```json
{
  "type": "oradores",
  "content": {
    "title": "Oradores e Convidados",
    "speakers": [
      { "photoUrl": "https://.../joao.jpg", "name": "João Silva", "bio": "Pastor e escritor, autor de...", "role": "Orador principal" },
      { "photoUrl": "https://.../maria.jpg", "name": "Maria Costa", "bio": "Líder de jovens há 15 anos.", "role": "Convidada" }
    ]
  }
}
```

**Behavior / editing notes:**
- Organizer can add a new speaker card at any time; the grid re-flows automatically
  (no fixed number of slots).
- A speaker card with only `photoUrl` + `name` set (bio pending) should still be
  displayable as "a confirmar brevemente" — decide with the team if partial cards
  are shown or hidden until complete. Default assumption: **hide the card until at
  least name + bio are filled in**, to avoid a half-empty look.

---

## 5. Programa (Program)

**Maps to:** generic `agenda` block, but structured **by day** rather than a single
flat list.

**Purpose:** simple day-by-day structure — Friday / Saturday / Sunday — each with
its own list of time-boxed items.

| Field | Type | Required | Notes |
|---|---|---|---|
| `days[].label` | text | Yes | e.g. "Sexta", "Sábado", "Domingo" |
| `days[].date` | date | No | Optional explicit date per day |
| `days[].items[].time` | time | Yes | |
| `days[].items[].title` | text | Yes | |
| `days[].items[].owner` | text | No | Speaker/facilitator, if relevant |

```json
{
  "type": "agenda",
  "content": {
    "title": "Programa",
    "days": [
      {
        "label": "Sexta",
        "date": "2026-03-20",
        "items": [
          { "time": "19:00", "title": "Receção e boas-vindas" },
          { "time": "20:00", "title": "Culto de abertura", "owner": "João Silva" }
        ]
      },
      {
        "label": "Sábado",
        "date": "2026-03-21",
        "items": [
          { "time": "09:30", "title": "Sessão da manhã" },
          { "time": "14:00", "title": "Workshops (ver secção 6)" }
        ]
      },
      {
        "label": "Domingo",
        "date": "2026-03-22",
        "items": [
          { "time": "10:00", "title": "Culto de encerramento" }
        ]
      }
    ]
  }
}
```

**Behavior:** each day renders as its own tab/collapsible group rather than one
long merged list — matches the "estrutura simples por dias" requirement.

---

## 6. Workshops

**Maps to:** new block type `workshops`, a grid of workshop cards. **Explicitly a
section to be filled in later** — must exist and be visually ready, but can start
empty/hidden.

| Field (per card) | Type | Required | Notes |
|---|---|---|---|
| `title` | text | Yes | |
| `description` | text | Yes | Brief |
| `facilitator` | text | Yes | Name of the person leading the workshop |
| `day` | reference | No | Optionally link back to a day in §5 (Programa) |
| `time` | time | No | |
| `capacity` | integer | No | If workshops have limited seats |

```json
{
  "type": "workshops",
  "content": {
    "title": "Workshops",
    "items": [
      { "title": "Liderança em pequenos grupos", "description": "Como conduzir grupos de crescimento...", "facilitator": "Maria Costa", "day": "Sábado", "time": "14:00" }
    ]
  }
}
```

**Behavior / editing notes:**
- Section should render nothing (or a "brevemente" placeholder, TBD with the team)
  while `items` is empty — do not show an empty grid frame to invitees.
- Once the first workshop is added, the section becomes visible automatically.

---

## 7. Inscrições (Registration)

**Maps to:** generic `rsvp` block, extended with a short info text before the CTA.

| Field | Type | Required | Notes |
|---|---|---|---|
| `infoText` | text | No | Practical info shown above the button (deadline, price hint, capacity) |
| `ctaLabel` | text | Yes | Default: "Inscrever-me" |
| `rsvpDeadline` | date | No | |
| `capacity` | integer | No | |
| `extraFields` | array | No | Same shape as generic `rsvp` block (see `04-content-blocks-schema.md`) |

```json
{
  "type": "rsvp",
  "content": {
    "infoText": "Vagas limitadas. Inscrições até 10 de março.",
    "ctaLabel": "Inscrever-me",
    "rsvpDeadline": "2026-03-10T23:59:59Z",
    "capacity": 300
  }
}
```

**Behavior:** this is the same underlying RSVP flow as the header CTA (§1) — §1's
button just scrolls/links here rather than duplicating the form.

---

## 8. FAQs

**Maps to:** new block type `faqs`, a simple question/answer list, pre-seeded with
the specific practical topics requested.

| Field (per item) | Type | Required | Notes |
|---|---|---|---|
| `question` | text | Yes | |
| `answer` | text | Yes | |
| `category` | text | No | Optional grouping |

Requested starting topics (organizer fills in the answers):

```json
{
  "type": "faqs",
  "content": {
    "title": "FAQs",
    "items": [
      { "question": "Para quem é a conferência?", "answer": "" },
      { "question": "Qual o local?", "answer": "" },
      { "question": "Quais os horários?", "answer": "" },
      { "question": "Há estacionamento?", "answer": "" },
      { "question": "Existe tradução?", "answer": "" },
      { "question": "Há alimentação incluída?", "answer": "" }
    ]
  }
}
```

**Behavior:** organizer can add further FAQ items beyond the seeded list; seeded
questions are just a starting template, not a fixed/locked set.

---

## 9. Rodapé (Footer)

**Maps to:** new block type `rodape`, always rendered last, outside the reorderable
card list (fixed position).

| Field | Type | Required | Notes |
|---|---|---|---|
| `logoUrl` | image | Yes | CCLX logo |
| `socialLinks` | array | No | `{ platform, url }` pairs (Instagram, Facebook, YouTube, etc.) |
| `contactEmail` | text | No | |
| `contactPhone` | text | No | |

```json
{
  "type": "rodape",
  "content": {
    "logoUrl": "https://.../cclx-logo.png",
    "socialLinks": [
      { "platform": "instagram", "url": "https://instagram.com/cclx" },
      { "platform": "facebook", "url": "https://facebook.com/cclx" }
    ],
    "contactEmail": "conferencia@cclx.pt",
    "contactPhone": "+351 900 000 000"
  }
}
```

---

## Section order & editability summary

| # | Section | Reorderable by organizer? | Can start empty? |
|---|---|---|---|
| 1 | Cabeçalho | No (always first) | No — required fields |
| 2 | A Conferência CCLX | Yes | No |
| 3 | Um Convite | Yes | Video optional, text required |
| 4 | Oradores e Convidados | Yes | Yes — grows as confirmations arrive |
| 5 | Programa | Yes | No — but days can be added progressively |
| 6 | Workshops | Yes | Yes — hidden until first item added |
| 7 | Inscrições | Yes | No |
| 8 | FAQs | Yes | Pre-seeded, editable |
| 9 | Rodapé | No (always last) | No — required fields |

This mapping should be used to extend the `tipo` CHECK constraint in
`02-data-model.md` (add: `cabecalho`, `convite_narrativo`, `oradores`, `workshops`,
`faqs`, `rodape`) and the block-type union in `05-frontend-components.md`'s
data-driven block renderer.
