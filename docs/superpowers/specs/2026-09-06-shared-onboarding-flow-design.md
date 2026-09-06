# Shared Onboarding Flow — Design Spec

Date: 2026-09-06

## Scope

First sub-project of the SportsFirst Funding Agents product. Covers
screens 1–4 of the full UI spec: Landing, Website Analysis, Organisation
Confirmation, Funding Discovery (summary dashboard). Sponsor Agent
(screens 5–10) and Grant Agent (screens 11–14) are separate specs built
on top of this foundation.

This is a real, AI-backed v1: no mocked data, no auth/persistence layer.
State lives client-side (sessionStorage) between screens.

## Stack

- Next.js (App Router) + TypeScript + Tailwind CSS
- Firecrawl API for website scraping, with TinyFish Fetch API
  (api.fetch.tinyfish.ai) as an automatic fallback if Firecrawl fails
  (missing key or request error) — see `lib/scrape.ts`
- OpenRouter for LLM calls (structured extraction + web-search-enabled
  matching)

Env vars: `FIRECRAWL_API_KEY`, `TINYFISH_API_KEY`, `OPENROUTER_API_KEY`.

## Architecture

Two server routes, both under `app/api/`:

- `POST /api/analyze` — body: `{ url }`. Server calls `lib/scrape.ts`
  (Firecrawl first, TinyFish fallback) to
  scrape the site, feeds cleaned text to an OpenRouter model with a
  structured-output schema (org name, location, sport, organisation
  type, audience segments, programs, suggested funding needs). Streams
  progress via Server-Sent Events — one event per discovered field, in
  the order shown in the spec's checklist — followed by a `done` event
  carrying the full profile JSON.
- `POST /api/funding` — body: the confirmed org profile. Calls an
  OpenRouter model with a web-search tool enabled to estimate sponsor
  count + $ range, grant count + $ range, and a one-line rationale for
  each, citing sources where the model finds them.

No database. No user accounts in this sub-project.

## Screens / Components

- `app/page.tsx` — Landing. Hero, single URL input, primary CTA "Find
  Funding Opportunities", secondary reassurance text, two outcome cards
  (Sponsor Agent / Grant Agent) below the fold. No feature-list clutter.
- `app/analyze/page.tsx` — Website Analysis. Client component opens an
  SSE connection to `/api/analyze`. Renders the discovery checklist
  (items appear with ✓ as events arrive, not a generic spinner) and a
  side preview card that fills in as fields resolve (name, location,
  sport, audience, org type).
- `app/confirm/page.tsx` — Organisation Confirmation. Form pre-filled
  from the analysis result: name, location, sport, org type (fields);
  audience segments and programs as toggleable chips/checklist;
  suggested funding-need chips the user can add to or remove from.
  Primary CTA "Looks Good — Find Funding" posts the (possibly edited)
  profile to `/api/funding` and navigates to the dashboard; secondary
  "Edit Details" keeps the form open/editable inline (no separate edit
  screen).
- `app/dashboard/page.tsx` — Funding Discovery. Two summary cards:
  Sponsorship (count + $ range + "why this estimate" rationale) and
  Grants (count + $ range + rationale). Each card's deep-dive CTA
  ("View Sponsors" / "Find Grants") is present but disabled with a
  "coming soon" state — those flows are future sub-projects.

Shared code:
- `lib/openrouter.ts` — thin client for OpenRouter chat/completions
  calls, structured output and web-search tool variants.
- `lib/firecrawl.ts` — thin client for a single-page scrape call.
- `lib/org-profile.ts` — the `OrgProfile` TypeScript type shared across
  routes and screens, plus parsing/validation of the LLM's structured
  output.

## Data Flow

1. User submits URL on landing → navigate to `/analyze?url=...`.
2. `/analyze` opens SSE to `/api/analyze`.
3. Server: TinyFish scrape → OpenRouter structured-extraction call →
   emit one SSE event per field as it's identified → emit `done` with
   full `OrgProfile` JSON.
4. Client stores `OrgProfile` in `sessionStorage`, navigates to
   `/confirm`.
5. `/confirm` reads profile from `sessionStorage`, renders editable
   form. On submit, POST edited profile to `/api/funding`.
6. Server calls OpenRouter (web-search tool) with the profile, returns
   sponsor/grant estimate JSON.
7. Client stores result, navigates to `/dashboard`, renders cards.

## Error Handling

- Invalid/unreachable URL or TinyFish timeout: inline error on the
  analysis screen with a retry action; never a dead end.
- LLM extraction returns partial/low-confidence data: confirmation
  screen still opens; empty fields show a "we couldn't find this — fill
  it in" prompt instead of failing the flow.
- `/api/funding` failure: dashboard shows a retry state, not a crash.
- All server routes return structured error payloads (`{ error: string
  }`) the client can render directly.

## Testing

- Unit tests for `lib/firecrawl.ts`, `lib/tinyfish.ts`, `lib/scrape.ts`
  (Firecrawl-first/TinyFish-fallback orchestrator), and `lib/openrouter.ts`
  with mocked HTTP, and for `lib/org-profile.ts` parsing/validation logic.
- Route tests for `/api/analyze` and `/api/funding` mocking upstream
  scrape/OpenRouter calls, covering success, partial-data, and failure
  paths.
- `e2e/onboarding.spec.ts` (Playwright): a real end-to-end run of the
  full flow (landing → analyze → confirm → dashboard) against a live
  organisation URL and the real Firecrawl/TinyFish/OpenRouter APIs — run
  via `npm run test:e2e`, requires real API keys in `.env.local`.

## Out of Scope (this spec)

- Sponsor Agent screens (list, detail, pitch builder, proposal,
  outreach, pipeline).
- Grant Agent screens (list, detail, application workspace, pipeline).
- Mobile-specific layouts.
- Authentication, persistence beyond session, multi-org support.
