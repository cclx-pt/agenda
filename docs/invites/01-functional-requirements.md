# Functional Requirements — Public Invite Landing Page

## 1. Page generation

- FR-1.1: A public landing page is auto-created the moment an invite is created,
  reachable at a unique, friendly URL (e.g. `/invite/{slug}`).
- FR-1.2: Any change to the invite (blocks, dates, RSVP config, payment config) is
  reflected on the public page immediately — no separate "publish" step required,
  though a **preview mode** must exist before the invite is actually sent.
- FR-1.3: The same URL is reused for the invitee's entire lifecycle: first view,
  RSVP, payment, and later status checks. It never changes after creation.
- FR-1.4: The page must render correctly with no login for the invitee.

## 2. Page structure (card-based layout)

The page is composed of an ordered list of **cards** (blocks). Each card type below
is described in full in `04-content-blocks-schema.md`.

| Card | Required? | Content |
|---|---|---|
| Event / Banner | Yes | Banner image, event name, date(s), location |
| Agenda / Program | Optional | Ordered list of time-boxed items (time + title + description/owner) |
| Extra info | Optional, repeatable | Free-form organizer-authored content blocks (e.g. what to bring, rules, FAQ, contacts) |
| RSVP | Yes | Primary CTA ("Confirm attendance") + any configured extra fields (guests count, dietary restrictions, etc.) |
| Cost / Payment | Yes (shows "Free" if applicable) | Cost type (free / paid / voluntary) and available payment methods |
| Location | Optional | Embedded map, address, "Get directions" link |
| Share | Yes | Share buttons (WhatsApp, email, copy link) + "Add to calendar" (Google/Apple/Outlook) |
| Status | Shown only after the invitee has responded | Current registration state and relevant next action |

- FR-2.1: Cards are optional except Event/Banner, RSVP, Cost/Payment and Share,
  which always render (Cost/Payment shows "Free" state when there's no cost).
- FR-2.2: "Extra info" cards are repeatable — the organizer can add as many as
  needed and order them.
- FR-2.3: Card order is organizer-controlled (drag-and-drop or up/down controls)
  and persisted per invite.
- FR-2.4: Cards can be individually hidden without deleting their content
  (`visible` flag).

## 3. Content editor (organizer-facing)

- FR-3.1: Organizer can upload a banner image; the system auto-crops/resizes for
  different breakpoints (desktop/mobile) and for the Open Graph share preview.
- FR-3.2: Organizer can set one date, multiple dates, or a date range for the event
  card.
- FR-3.3: Organizer can build the agenda as an editable list: add, remove, reorder
  items; each item has a time and a description (owner/speaker optional).
- FR-3.4: Organizer can add free-text "extra info" blocks with a title and body,
  reorder and delete them.
- FR-3.5: A "Preview" mode renders the exact page an invitee will see, before the
  invite is sent out.
- FR-3.6: No technical/coding knowledge should be required to compose the page —
  all editing happens through UI controls (forms, drag handles, image upload).

> Note: the exact field set and formatting options for "extra info" blocks are
> intentionally left open for refinement in a later pass (see `04-content-blocks-schema.md`
> for the current minimal shape).

## 4. Sharing & link preview

- FR-4.1: The page must expose Open Graph meta tags (`og:title`, `og:image`,
  `og:description`) so link previews render correctly in WhatsApp, email clients,
  and social platforms.
- FR-4.2: The share card provides one-tap actions: share via WhatsApp, share via
  email, copy link, and add-to-calendar (generates a standard `.ics` file or deep
  links to Google/Outlook/Apple calendar).

## 5. Responsiveness & branding

- FR-5.1: The page is mobile-first and responsive across common breakpoints.
- FR-5.2: The organizer can apply church branding (banner image, primary color/theme)
  consistently across the page.

## 6. Relationship to other features

- The RSVP card links into the existing RSVP flow (see main functional spec §3.3).
- The Cost/Payment card links into the payment flow (MB WAY, bank transfer,
  reference — see main functional spec §5–§6). This feature only needs to *display*
  the configured cost type and trigger the payment flow; it does not re-implement it.
- The Status card reads the invitee's current state (see main functional spec §8,
  registration lifecycle) and renders the applicable next action.
