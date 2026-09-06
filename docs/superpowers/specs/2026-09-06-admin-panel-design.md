# Admin Panel (API Observability) — Design Spec

Date: 2026-09-06

## Scope

Fourth sub-project. A password-gated `/admin` section giving visibility into
every external API call the app makes: which provider/endpoint/model was
called, latency, cost (where the provider exposes it), success/failure, plus
an overview of accumulated clubs/sponsors/discovery data already being
written by the sponsor data graph sub-project.

No user accounts — one shared admin password, since nothing else in the app
has auth either.

## Data Model

Second migration file (the existing `db/schema.sql` migration is guarded on
`clubs` already existing, so a new table needs its own guard — see Migration
section):

```sql
-- db/002_api_call_logs.sql
CREATE TYPE api_call_status_enum AS ENUM ('success', 'error');

CREATE TABLE api_call_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL,           -- 'firecrawl' | 'monid_tinyfish' | 'openrouter'
  endpoint TEXT,                    -- '/fetch', '/search', or the OpenRouter model name
  model TEXT,                       -- LLM model, null for scrape/search calls
  status api_call_status_enum NOT NULL,
  error_message TEXT,
  latency_ms INTEGER NOT NULL,
  cost_usd NUMERIC(12, 6),          -- null when the provider doesn't expose per-call cost
  request_summary JSONB DEFAULT '{}'::jsonb,  -- e.g. {"url": "..."} or {"query": "..."}
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_api_call_logs_provider ON api_call_logs (provider);
CREATE INDEX idx_api_call_logs_status ON api_call_logs (status);
CREATE INDEX idx_api_call_logs_created ON api_call_logs (created_at DESC);
```

## Migration

`scripts/migrate.mjs` is extended to apply a list of `{ file, guardTable }`
migrations in order, each independently guarded (skip if `guardTable` already
exists) rather than one global "does `clubs` exist" check — so adding
`api_call_logs` doesn't require re-running or touching the original schema.

## Instrumentation

`logApiCall()` (added to `lib/db.ts`, alongside the existing persist*
functions — same best-effort/non-blocking pattern: caught, logged via
`console.error`, never thrown) is called from the three existing chokepoints
that already funnel every call of a given provider through one function:

- `lib/firecrawl.ts` `scrapeUrl` — around the `fetch` call. `provider:
  'firecrawl'`, `endpoint: '/v1/scrape'`, `cost_usd: null` (Firecrawl doesn't
  expose per-call cost in its response), `request_summary: { url }`.
- `lib/tinyfish.ts` `callMonid` — around the `fetch` call. `provider:
  'monid_tinyfish'`, `endpoint` is the `/fetch` or `/search` param passed in,
  `cost_usd` from the real `body.billing.reportedCost` field (confirmed live:
  `{ currency: 'USD', value: 0, unit: 'MICRO_DOLLAR' }` — divide by 1,000,000
  when unit is `MICRO_DOLLAR`), `request_summary` is the `input` argument
  (already small — a URL list or a query string).
- `lib/openrouter.ts` `callOpenRouter` — around the `fetch` call. `provider:
  'openrouter'`, `model` from the `body.model` argument passed in, `cost_usd`
  from the real `json.usage.cost` field (confirmed live in this session's own
  debugging, e.g. `0.001308`), `request_summary` intentionally omits the full
  message content (could be large/contain scraped page text) — just
  `{ messageCount: body.messages.length }`.

Every call site gets latency via `Date.now()` before/after the `fetch`.
Logging happens regardless of whether the call succeeded or threw (wrapped
so a logging failure never masks or replaces the real error).

## Auth

- `ADMIN_PASSWORD` env var (new, added to `.env.local`/`.env.example`).
- `middleware.ts` at the project root: for any request to `/admin` (except
  `/admin/login` and `/api/admin/login`), checks for a cookie `admin_auth`
  whose value equals `sha256(ADMIN_PASSWORD)`; redirects to `/admin/login`
  if missing/mismatched. Stateless — no session table needed.
- `/admin/login` — a plain password form, client component, POSTs to
  `/api/admin/login`.
- `POST /api/admin/login` — compares the submitted password to
  `ADMIN_PASSWORD`; on match, sets the `admin_auth` cookie (httpOnly,
  `sha256(ADMIN_PASSWORD)`) and redirects to `/admin`; on mismatch, returns
  a 401 with an inline error shown on the login form.

## Screens

All under `app/admin/`, following the existing server-`page.tsx` +
`*Client.tsx` pattern, all server-rendered data fetches (no client-side
fetch-on-mount needed here — this is internal tooling, not the public flow —
so these can be plain server components reading directly from `lib/db.ts`,
simpler than the rest of the app's sessionStorage-driven client pattern).

- `/admin` — **Dashboard**. Aggregate stats via SQL `GROUP BY provider`:
  total calls, total cost, average latency, error rate, per provider. One
  query, one table.
- `/admin/calls` — **Call log**. Paginated (`LIMIT`/`OFFSET` via a `page`
  query param), filterable by `provider` and `status` query params. Columns:
  timestamp, provider, endpoint/model, status, latency, cost, request
  summary (truncated).
- `/admin/errors` — **Error feed**. Same table shape as `/admin/calls`,
  pre-filtered to `status = 'error'`, most recent first, no pagination needed
  for a v1 (capped at the most recent 100).
- `/admin/clubs` — **Clubs & discovery runs**. One row per club (name,
  sport, city/region/country, sponsor count via a join/count on
  `sponsor_matches` + `sponsorship_relationships`), each expandable or
  linked to its `discovery_runs` history (run type, status, candidates
  found/qualified, timestamp).

## Error Handling

- A logging failure (`logApiCall` itself) never affects the real API call's
  success/failure — already covered by the best-effort pattern used
  everywhere else in `lib/db.ts`.
- Admin screens: a DB query failure renders a plain inline error message on
  that screen (server component catching its own query) rather than a 500 —
  this is internal tooling, a broken dashboard shouldn't look like the whole
  app is down, but it also doesn't need the `ErrorBanner`/retry UX built for
  the public flow.
- Wrong admin password: inline error on the login form, no lockout/rate
  limiting for v1 (single shared password, low-stakes internal tool).

## Testing

- `lib/db.ts` `logApiCall`: unit tests (mocked `sql`) covering the insert
  shape for each provider, and that it never throws.
- Unit tests for the cost-extraction logic in each of the three chokepoints
  (Monid's `MICRO_DOLLAR` conversion, OpenRouter's `usage.cost` passthrough,
  Firecrawl's `null`).
- `middleware.ts`: unit tests for the redirect-when-missing-cookie and
  passthrough-when-valid-cookie behavior.
- `/api/admin/login` route tests: correct password sets the cookie and
  redirects, wrong password returns 401.
- Admin screen component tests: rendering with mocked `lib/db.ts` query
  results (aggregate numbers, table rows, empty states).
- Manual verification: run `npm run db:migrate` (new migration applies
  without touching the existing tables), click through the whole onboarding
  + sponsor discovery flow, confirm real rows appear in `/admin/calls` with
  real latency/cost numbers.

## Out of Scope (this spec)

- Per-user admin accounts, roles, audit log of admin actions.
- Real-time/streaming updates to the admin screens (plain page-load queries
  only).
- Cost budgets/alerts, rate limiting, or any enforcement — this is
  observability only, not control.
- Firecrawl cost estimation via their separate billing API (would need a
  new, unrelated integration).
