# Acceptance Criteria

## Page generation & access

- [ ] Creating an invite automatically creates a landing page record with a unique,
      URL-safe slug.
- [ ] Visiting `/invite/{slug}` as an anonymous user renders the page without any
      login prompt.
- [ ] Visiting an unknown slug returns a 404 with a friendly "invite not found" page.
- [ ] Editing any block or page-level field (banner, dates, meta) and reloading the
      public page shows the updated content without needing a separate "publish" step
      for content changes.
- [ ] The invite cannot be **sent** to guests until `publish` has been triggered at
      least once (draft protection).

## Card rendering

- [ ] Event/Banner, RSVP, Cost/Payment, and Share cards always render, even with no
      optional blocks configured.
- [ ] Cost/Payment card shows "Free" state correctly when `costType = gratuito`.
- [ ] Agenda card is hidden entirely when no agenda block exists (not shown empty).
- [ ] Multiple `info_extra` blocks render in the order configured by the organizer.
- [ ] Hiding a block (`visible: false`) removes it from the public page but keeps it
      in the editor for later re-enabling.

## Editor (organizer)

- [ ] Organizer can upload a banner image and see it reflected in both the editor
      preview and a generated Open Graph preview.
- [ ] Organizer can add, edit, remove, and reorder agenda items without a page reload.
- [ ] Organizer can add, edit, remove, and reorder `info_extra` blocks.
- [ ] Reordering blocks persists the new order after a page refresh.
- [ ] Preview mode renders pixel-equivalent to what an invitee will see (same
      components, `editable=false`).

## Sharing

- [ ] Sharing the invite link on WhatsApp shows the correct title, description, and
      image in the link preview.
- [ ] "Add to calendar" produces a valid `.ics` file / correct deep link matching the
      event's configured date(s).
- [ ] Copy-link action copies the exact public URL including the guest-specific
      token when applicable.

## Guest status

- [ ] A returning guest opening their personal link sees a Status card reflecting
      their real current state (Confirmed / Awaiting Payment / Awaiting Validation /
      Waitlisted).
- [ ] A guest with no prior response does not see a Status card.
- [ ] After completing MB WAY payment, reloading the link shows the updated payment
      state without manual intervention.

## Non-functional

- [ ] Page is usable on a 360px-wide mobile viewport without horizontal scrolling.
- [ ] Page loads and is interactive within acceptable performance budget (define
      target with the team, e.g. LCP < 2.5s on 4G).
- [ ] No sensitive organizer-only data (internal notes, other guests' info) is ever
      present in the public page payload.
