# UI/UX Audit Report: FTC Sponsorship Portal

This document compiles the findings of a deep UI/UX audit across the `ftc-pitfund` application. The issues are categorized by domain and issue type. A coding agent can use this document as a checklist to systematically fix UI/UX, responsiveness, accessibility, and state management bugs.

---

## 1. Shared Components (`components/ui`)

### Accessibility (a11y)
- **`action-button.tsx` & `button.tsx`**: Missing `aria-live="polite"` or `role="status"` wrappers for dynamically changing text (e.g., "Submit" -> "Submitting...").
- **`pdf-viewer.tsx`**: Thumbnail `<Image>` uses `alt=""`. It should use a descriptive text like `alt={\`Thumbnail of ${title} page 1\`}`.

### Visual Consistency & UI/UX
- **Inconsistent Focus Rings**: `button.tsx` and `checkbox.tsx` use crisp outlines (`focus-visible:outline-2 focus-visible:outline-accent`), while `input.tsx` uses soft shadow rings (`focus-visible:ring-2 focus-visible:ring-accent/25`). Standardize this across all interactive form controls.
- **`pdf-viewer.tsx`**: The download anchor tag checks for a download URL but misses the actual `download` HTML attribute (`download={download ? true : undefined}`).

### State Management
- **`table.tsx`**: When empty (`rows.length === 0`), the component early-returns the `<>{empty}</>` node, stripping away the table's card-like wrapper (`rounded-menu border border-border bg-surface`). Render the empty state *inside* the main container.
- **`file-drop.tsx`**: Hover transitions (`group-hover:text-accent-hover`) still trigger when the component is in a `disabled` state.

### Responsiveness
- **`table.tsx`**: Pagination container uses `flex-wrap justify-between`. On small screens, long summary text causes awkward wrapping. Consider `flex-col sm:flex-row`.
- **`textarea.tsx`**: The auto-height calculation runs on change but not on window resize. Add a `ResizeObserver` or resize event listener.

---

## 2. Workspace Domain (`app/(app)/(workspace)`)

### Accessibility (a11y)
- **Widespread Missing Focus Rings**: 
  - `pitches/page.tsx`: Setup progress checklist items (`<Link>`), `PitchRow` component (`<Link>`).
  - `team/public-preview.tsx`: Main public preview card (`<a>` wrapper).
  - `sponsors/[id]/pitch/composer.tsx`: Submit blockers list `<button>` and `<Link>`.
  - Detail Pages (`inbox`, `pitches`, `sponsors`): "Back" links at the top of pages.
  - Shared Row Components: `components/inbox/inbox-row.tsx`, `components/sponsors/sponsor-summary.tsx`.
  - **Fix**: Add `focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent` (use negative offset for full rows).
- **`team/public-preview.tsx`**: Sponsorship deck thumbnail image uses empty `alt=""`.

### UI/UX
- **`team/profile-form.tsx`**: The "One-line summary" uses a `<Textarea>` where `onChange` silently replaces newlines with spaces. This breaks user expectations when pressing Enter. Change to a standard `<Input>` or allow newlines visually but normalize them on submit.

### Visual Consistency
- **`sponsors/directory-controls.tsx`**: Active filter chips (`active === true`) lack a hover state (`hover:bg-text/90`), whereas inactive chips have one.

---

## 3. Account & Onboarding (`app/(app)/account` & `app/(app)/welcome`)

### Visual Consistency
- **`account-forms.tsx`**: Action buttons container uses `pt-1` spacing (4px) which is inconsistent with macro-spacing used elsewhere (e.g., `pt-4` or `gap-` classes).
- **`team/team-setup.tsx`**: Disjointed UI on the Team Details form. Multiple conditional blocks (`showDetails`) independently apply `border-t border-border pt-8`, slicing the form awkwardly. Wrap them in a single parent container with a single top border.

### Responsiveness
- **`team/team-setup.tsx`**: The "FTC team number" input uses `max-w-48`. Change to `sm:max-w-48` so it fills the fluid layout on mobile instead of looking clipped.

### Accessibility (a11y)
- **`team/team-setup.tsx`**: The inline `<Spinner>` for "Checking FIRST records…" lacks `aria-hidden="true"`.
- **`team/proof-upload.tsx`**: (Enhancement) Explicitly restore focus to the retry/replace button upon a failed or successful upload if the native file picker swallows focus.

---

## 4. Public Domain (`app/(public)`)

### State Management
- **`login/login-flow.tsx` (Code Resubmission Blocked)**: `lastSubmitted.current` blocks resubmission to prevent spam, but if a network/rate limit error occurs, the user cannot resubmit the exact same code when the limit lifts. Clear the ref on non-network errors.
- **`login/login-flow.tsx`**: Email `<Input>` lacks a `readOnly` or `disabled` attribute tied to `send.pending`.
- **`invite/[token]/invite-actions.tsx`**: Terms `<Checkbox>` is not disabled while the invitation acceptance request is inflight.
- **`invite/[token]/page.tsx`**: Double decoding parameter (`decodeURIComponent(token)`). Next.js App Router already decodes `[token]`. This can cause a `URIError`.

### Accessibility (a11y)
- **`login/login-flow.tsx`**: Redundant `aria-disabled` on the "Resend code" button which already uses the native `disabled` attribute.
- **`legal/privacy/page.tsx` & `legal/terms/page.tsx`**: Heading hierarchy skipped levels (jumps from `<h1>` to `<h3>`). Verify `LegalPage` uses `<h2>` for section titles.

### Visual Consistency & Responsiveness
- **`login/login-flow.tsx`**: Check if disabled resend button text (`text-text-tertiary`) meets WCAG 4.5:1 contrast against the background.
- **`invite/[token]/page.tsx`**: `InviteSkeleton` uses hardcoded widths (`w-56`, `w-40`). Add `max-w-full` or use percentage widths to prevent overflow on very narrow devices.

---

## 5. Admin Domain (`app/admin`)

### Accessibility (a11y)
- **Missing Focus Rings & Context**: 
  - `pitches/[id]`, `companies/[id]`, `teams/[id]`: All `ExternalLink` components and inline `<a>` tags lack `focus-visible` classes.
  - External links (`target="_blank"`) lack screen-reader only text indicating they open in a new tab.
  - `directory/page.tsx`: Links in the table rows missing focus rings.
- **`pitches/[id]/page.tsx`**: `QueueLink` `<button>` uses `disabled` visual styling (`cursor-not-allowed`, opacity) but must ensure it has `aria-disabled="true"` if it's changing native tags, and check contrast ratio.

### Visual Consistency
- **`system/page.tsx`**: Low contrast on disabled/stale text colors (`text-text-tertiary/60` against `bg-surface`).
- **`companies/[id]/page.tsx`**: Rejection notes are truncated with `line-clamp-6` but lack an expand/collapse toggle, potentially hiding critical admin context.
- **`teams/[id]/page.tsx`**: Team proof screenshot `<img ... w-full>` lacks explicit dimensions or an `aspect-video` wrapper, causing Cumulative Layout Shift (CLS) during lazy loading.

### Responsiveness
- **`admin/page.tsx`**: Hardcoded `sm:max-w-80` and `sm:max-w-[45%]` on report lists. Use `flex-1 min-w-0` instead for better dynamic wrapping.
- **`pitches/[id]/page.tsx`**: The `<h1>` displaying `Team Name -> Company Name` lacks `min-w-0 break-words`, risking horizontal scroll on long names.

### State Management
- **Action Buttons**: Deeply nested action items (e.g., `<CompanyDecisions>`) don't seem to pass explicit loading props to parent containers. Ensure form action buttons natively support an `isPending` state spinner to indicate background mutations are processing.
