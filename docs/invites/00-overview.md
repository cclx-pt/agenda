# Feature: Public Invite Landing Page

## Summary

Each invite generates an automatic, public, shareable web page (landing page) at the
moment it's created/configured. This page is the single entry point sent to invitees
(via email, WhatsApp, or direct link) and centralizes all information and actions
related to the event: event details, agenda, extra info, RSVP, payment, location,
sharing, and the invitee's current registration status.

This page is part of a larger "Event Invitations & Payments" module that plugs into
an existing church event-management application (events already exist in the current
database; this module only adds invites/RSVP/payments on top).

## Goals

- Give organizers an easy, no-code way to build a rich event page per invite.
- Give invitees a single link that always reflects the latest state of their invite
  and their own registration (status, payment, etc.).
- Make the page shareable with a correct link preview (Open Graph) on WhatsApp,
  email clients, and social media.

## Non-goals (this feature slice)

- Creating/editing the underlying **event** record (already exists in the app).
- Payment provider integration logic itself (MB WAY / bank transfer / reference) —
  this page only *renders* the payment card and *links into* that flow; the payment
  flow is a separate feature (see `payments` module docs).
- Guest list import / contact management.

## Files in this folder

| File | Purpose |
|---|---|
| `01-functional-requirements.md` | What the page must do, from a product perspective |
| `02-data-model.md` | Database schema additions (tables/fields + SQL DDL) |
| `03-api-endpoints.md` | REST API contract for reading/editing the page |
| `04-content-blocks-schema.md` | JSON schema for each block type (banner, agenda, info) |
| `05-frontend-components.md` | Suggested component breakdown for the editor + public page |
| `06-acceptance-criteria.md` | Testable acceptance criteria / user stories |

## High-level user flow

1. Organizer creates an invite for an existing event.
2. Organizer uses the **block editor** to compose the landing page: banner, dates,
   agenda, extra info blocks, RSVP settings, payment settings.
3. Organizer previews the page exactly as an invitee will see it.
4. Organizer sends the invite; invitees receive the unique public URL by email.
5. Invitee opens the link → sees the composed page → confirms attendance → (if
   applicable) pays or uploads a receipt.
6. Invitee can reopen the same link later to check their current status
   (Confirmed / Awaiting Payment / Awaiting Validation / Waitlisted).
