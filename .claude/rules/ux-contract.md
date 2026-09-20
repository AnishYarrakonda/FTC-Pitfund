# UX contract (plan §3.1 and §7)

This is a full product UI replacement: light, white, calm, precise. Hierarchy by type and spacing, not boxes.
"It works" is not visual acceptance. Build from `components/ui`; show every new state on `/dev/ui`.

## Feedback (enforced by components)
1. Async buttons are `ActionButton` / `SubmitButton` / `ConfirmDialog` (or `useAction` + `Button loading`):
   pending in the same frame, verb label ("Submitting…"), `aria-busy`, double-click safe. Mark them `data-action-button`.
2. Actions return `Result`; the UI branches on `error.code`. Never throw to the client.
3. Success shows in place (row updates, "Saved", "Sent ✓"). Toasts only for off-screen effects.
   Every toast carries a decay bar timed to its own duration and a dismiss X (`components/ui/toast-content.tsx`);
   nothing states an outcome in a line of text that never clears.
4. Errors sit next to what failed and keep input. Network failure: "Couldn't reach FTC Pitfund. Check your
   connection." + Retry. Unexpected: short message + reference id.
5. Waits over 1 s say what is happening ("Checking FIRST records…"). No bare spinners.
6. Every route segment has a `loading.tsx` shaped like the page. Links show `LinkPendingIndicator`.
7. Irreversible/outward actions use `ConfirmDialog` with a one-sentence consequence (not admin review decisions).
8. Queued email is stated; quota exhaustion says "Email delivery is delayed until tomorrow…".
9. Empty states: one sentence + one action. No decorative illustrations.
10. Forms show "Unsaved changes" and warn before leaving; autosave shows Saving… / Saved / Couldn't save. Retry.
11. User text never breaks layout: body has `overflow-wrap: anywhere`; use `min-w-0` on flex/grid children,
    `user-text-block` (pre-wrap) for long answers, line clamps with "Show more" in lists.

## Tokens (`app/globals.css`; defaults are cleared, so only tokens compile)
Colors `canvas surface muted border border-strong text text-secondary text-tertiary accent accent-hover
accent-subtle success warning danger info` (+ `-subtle`). Type `text-caption small body lead h3 h2 h1 display
display-lg`. Radius `rounded-control` (6) · `rounded-menu` (8) · `rounded-dialog` (12); pills only for avatars
and dots. Shadows `shadow-sm` (menus) · `shadow-lg` (dialogs/sheets). Widths `max-w-auth form reading app review`.
Motion 120 ms hover, 180 ms overlays; reduced motion removes transforms.

## Layout
Top bar 56 px, ≤3 nav items. Page header: h1 (`text-h2`), one-line description, primary action right (stacks on
mobile). Below 640 px the nav is a bottom menu sheet, tables become stacked lists (`DataTable`).

## Overlays
`Dialog` sm 400 / md 560 / lg 720, `width: min(size, 100vw − 32px)`, `max-height: min(85vh, 100dvh − 32px)`,
sticky header/footer, body scrolls. `Sheet` right, `min(640px, 100vw)`, full screen below 640. Focus trap, Esc,
focus return, scroll lock, visible close, labelled title — all from `components/ui/dialog.tsx`.
**Anything more than a short form or a paragraph is a page, not an overlay** (pitch/company/team review are pages).

## Copy
Plain, specific, second person. Never "dispatch", "submission", "RLS", "token", "Supabase". Buttons are verbs.
Status labels come from `lib/shared/labels.ts`. Support email comes from `SUPPORT_EMAIL` (`lib/shared/brand.ts`, set by `NEXT_PUBLIC_SUPPORT_EMAIL`, default `ftcexodius@gmail.com`); never hardcode it; footer disclaimer
"Not affiliated with or endorsed by FIRST®."
