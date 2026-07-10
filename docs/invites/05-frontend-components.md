# Frontend Component Breakdown (suggestion)

Framework-agnostic naming; adapt to whatever the existing app uses (React assumed
below for concreteness).

## Public landing page (`/invite/{slug}`)

```
<InvitePage>
  <InviteHead />                 // renders <meta> Open Graph tags (SSR)
  <BannerCard />
  <AgendaCard />
  <InfoExtraCard />              // rendered once per info_extra block, in order
  <RsvpCard />
  <PaymentCard />
    <MbwayPaymentFlow />
    <BankTransferReceiptUpload />
    <ReferencePaymentInfo />
  <LocationCard />
  <ShareCard />
  <StatusCard />                 // only rendered if guestToken resolves to a known guest
```

- Cards render in the `order` returned by the API, filtered to `visible: true`.
- `PaymentCard` renders the sub-component matching the guest's chosen/available
  payment method(s) — see main payments feature docs for these flows in detail;
  this page only mounts them.
- `StatusCard` polls or refetches on mount to show the latest state (e.g. after
  returning from an MB WAY confirmation).

## Organizer editor (`/admin/invites/{inviteId}/page`)

```
<PageEditor>
  <BannerUploader />             // upload + crop preview
  <DateRangePicker />
  <ColorThemePicker />
  <BlockList>                    // drag-and-drop reorder
    <AgendaBlockEditor />          // add/remove/reorder agenda items
    <InfoExtraBlockEditor />       // add/remove/reorder free-text blocks
    <RsvpConfigEditor />           // extra fields, deadline, capacity
    <PaymentConfigEditor />        // cost type, amounts, allowed methods, X/Y days
    <LocationConfigEditor />
  </BlockList>
  <PreviewButton />               // opens <InvitePage> in preview mode, same renderer
  <PublishButton />
</PageEditor>
```

- Reuse the **same card components** between editor preview and the public page
  wherever possible (pass `editable=false` for the public render) to avoid drift
  between what the organizer sees in preview and what invitees actually see.
- `BlockList` should support keyboard-accessible reordering, not just drag-and-drop
  (accessibility requirement).

## Shared/utility components

- `OpenGraphMeta` — renders `<meta property="og:*">` tags server-side from the
  `/public/invite/{slug}/meta` payload.
- `IcsCalendarLink` — generates an `.ics` download / deep link from event dates.
- `ShareButtons` — WhatsApp/email/copy-link, reusable outside this feature too.

## State management notes

- The public page should work with **no client-side auth state** — identity comes
  only from the `guestToken` in the URL/cookie.
- Keep block-rendering logic data-driven (map `block.type` → component) so adding a
  new block type later doesn't require touching the page shell.
