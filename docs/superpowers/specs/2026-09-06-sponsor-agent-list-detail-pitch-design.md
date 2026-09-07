# Sponsor Agent (List, Detail, Pitch Builder) — Design Spec

Date: 2026-09-06

## Scope

Second sub-project of the SportsFirst Funding Agents product, building on
the shared onboarding flow. Covers the first slice of the Sponsor Agent
vertical from the full product spec: Sponsor List (screen 5), Sponsor
Detail (screen 6), and Sponsorship Pitch Builder (screen 7). Proposal
Preview, Outreach, and Sponsor Pipeline (screens 8-10) are separate future
sub-projects. Grant Agent stays "coming soon" — untouched.

Real, AI-backed: no mocked data, no DB, no email/CRM integration.
State lives client-side (sessionStorage), same pattern as the onboarding
flow.

## Stack

Same as the onboarding flow: Next.js (App Router) + TypeScript + Tailwind
CSS + OpenRouter. No new external providers — sponsor discovery and pitch
drafting both go through OpenRouter using the same `perplexity/sonar`
web-search-enabled model already used for the funding estimate.

## Data Model

```typescript
interface Sponsor {
  name: string;
  matchScore: number; // 0-100
  matchReason: string; // one sentence, "why this match" (spec Principle 2)
  estimatedMinUsd: number;
  estimatedMaxUsd: number;
  category: string; // e.g. "Local Business", "National Brand"
}

interface PitchDraft {
  subject: string;
  body: string;
}
```

## Architecture

Two new server routes under `app/api/`:

- `POST /api/sponsors` — body: `OrgProfile`. Calls OpenRouter
  (`perplexity/sonar`, web search) to find ~8-12 real/plausible sponsor
  candidates for the organisation. Returns `Sponsor[]`.
- `POST /api/pitch` — body: `{ profile: OrgProfile, sponsor: Sponsor }`.
  Calls OpenRouter to draft an outreach email using the org profile and
  the sponsor's match reason. Returns `PitchDraft`.

No database. Sponsor list and the selected sponsor live in
`sessionStorage`, addressed by array index — consistent with how the
onboarding flow already handles `orgProfile` and `fundingEstimate`.

## Screens / Components

- `app/sponsors/page.tsx` — Sponsor List. On mount, reads `orgProfile`
  from `sessionStorage`; if missing, redirects to `/` (can't discover
  sponsors without a profile). POSTs to `/api/sponsors`, shows the
  thinking-dots loading state (reused from the analysis screen) while
  waiting, then renders one card per sponsor: name, match score,
  one-line "why" reasoning, estimated ask range. Stores the result in
  `sessionStorage.sponsorList`. Clicking a card navigates to
  `/sponsors/[index]`.
- `app/sponsors/[index]/page.tsx` — Sponsor Detail. Reads
  `sessionStorage.sponsorList`, indexes into it with the route param.
  Shows the full match reasoning and ask range. CTA "Generate Pitch"
  navigates to `/sponsors/[index]/pitch`.
- `app/sponsors/[index]/pitch/page.tsx` — Pitch Builder. On mount, POSTs
  `{ profile, sponsor }` to `/api/pitch`, shows the loading state, then
  renders the draft as editable subject + body fields (plain textareas,
  no rich text). No send action — this is a draft the user copies out
  manually; sending is a later sub-project (Outreach).

Shared code:
- `lib/openrouter.ts` — two new exported functions, `findSponsors(profile)`
  and `draftPitch(profile, sponsor)`, following the same
  `callOpenRouter` + `stripCodeFence` + defensive-reshape pattern already
  used by `extractOrgProfile` and `estimateFunding`.

Dashboard change: the "View Sponsors" button (currently disabled with a
"Coming soon" caption) becomes a real link to `/sponsors`.

## Data Flow

1. User is on `/dashboard` (has `orgProfile` + `fundingEstimate` in
   sessionStorage from the onboarding flow) → clicks "View Sponsors".
2. `/sponsors` reads `orgProfile`; if absent, redirects to `/`.
3. POST `/api/sponsors` with the profile → OpenRouter web-search call →
   `Sponsor[]` → stored in `sessionStorage.sponsorList` → rendered as
   cards.
4. Click a card → `/sponsors/[index]` reads that entry from
   `sessionStorage.sponsorList[index]`.
5. Click "Generate Pitch" → `/sponsors/[index]/pitch` → POST
   `/api/pitch` with `{ profile, sponsor }` → `PitchDraft` → rendered as
   editable fields.

## Error Handling

- `/api/sponsors` or `/api/pitch` failure: `ErrorBanner` (existing
  component) with retry, same pattern as `/analyze` and `/confirm`.
- Empty sponsor list (0 matches): explicit "no matches found" empty
  state on `/sponsors`, not a crash or blank page.
- Missing `orgProfile` in sessionStorage on `/sponsors` (e.g. direct
  navigation, corrupted storage): redirect to `/`.
- Out-of-range or missing `sessionStorage.sponsorList` entry on
  `/sponsors/[index]` (e.g. stale link, corrupted storage): redirect to
  `/sponsors`.
- Server routes return structured `{ error: string }` payloads on
  failure, matching the existing `/api/funding` convention.

## Testing

- Unit tests for `findSponsors` and `draftPitch` in
  `lib/openrouter.ts` (mocked HTTP), covering success, malformed
  response, and non-Error rejection paths — same adversarial coverage
  standard as the rest of `lib/`.
- Route tests for `/api/sponsors` and `/api/pitch` mocking the
  OpenRouter calls.
- Component tests for all three screens: list loading/empty/error
  states, detail rendering + missing-index redirect, pitch draft
  rendering + edit + error state.
- Extend the existing real-API Playwright journey
  (`e2e/onboarding.spec.ts` or a new spec) to continue from the
  dashboard into Sponsor List → Detail → Pitch Builder against live
  OpenRouter.

## Out of Scope (this spec)

- Proposal Preview, Outreach (actual sending), Sponsor Pipeline (screens
  8-10).
- Grant Agent (unchanged — stays "coming soon").
- Any persistence beyond `sessionStorage`, authentication, multi-org
  support.
- Rich text editing, email sending, or CRM integration for the pitch
  draft.
