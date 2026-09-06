# Sponsor Data Graph (Persistence + Geo) — Design Spec

Date: 2026-09-06

## Scope

Third sub-project. Adds real persistence on top of the existing sessionStorage-only
onboarding + Sponsor Agent flow. The DB is a **knowledge-base data asset**, not a
user-account store — no auth. Every analysis/discovery run writes clubs, sponsors,
their geo location, and the sponsorship relationships (confirmed and prospective)
between them into Postgres, so the "local sponsor graph" becomes a real, growing,
queryable asset instead of being re-derived live on every request.

Two discovery points now capture sponsors:
1. **Analyze time** (`/api/analyze`) — cheap, first signal: the org's own scraped
   website text usually already lists its current sponsors ("thank you to our
   sponsors" pages, logos, partner mentions). `extractOrgProfile` now also pulls
   this out.
2. **Sponsor discovery time** (`/api/sponsors`) — deeper, web-search-based:
   `findSponsors` already researches the org's actual current/past sponsors as
   internal grounding (added in the previous iteration) before suggesting new
   prospects. That research is now captured as real data instead of thrown away.

## Infrastructure

- **Neon Postgres**, provisioned via the Vercel Marketplace integration
  (`neon-coral-book`, connected to the `shared-onboarding-flow` Vercel project).
  `POSTGRES_URL` / `DATABASE_URL` etc. are in `.env.local`.
- **No ORM.** Neon's own guidance recommends Drizzle, but the schema is already
  fully specified as raw SQL (see below) and every write in this app is a simple
  parameterized upsert — translating six tables and nine enums into an ORM's
  schema DSL buys nothing here. Using `@neondatabase/serverless`'s `neon()`
  tagged-template SQL client directly instead: `lib/db.ts` exports a pooled `sql`
  client for app runtime queries (Next.js API routes are serverless functions —
  this is Neon's own recommendation for that environment).
- **Migrations**: one script, `scripts/migrate.mjs`, runs `db/schema.sql` against
  the **direct/unpooled** connection string (`POSTGRES_URL_NON_POOLING`) — schema
  migrations should never go through the pooler. Idempotent via a simple guard:
  skip if the `clubs` table already exists.

## Schema

`db/schema.sql` (already written, verbatim as provided) defines:

- `clubs` — sports organisations, with `city`/`region`/`country`/`lat`/`lng`.
- `sponsors` — canonical companies, with the same geo columns.
- `sponsorship_relationships` — the **verified** graph: sponsor X actually
  sponsors club Y. Never speculative.
- `sponsor_matches` — AI-scored prospects for a specific club, with a full
  scoring rubric (`evidence_score`, `geography_score`, `sport_score`,
  `audience_score`, `cause_score`, `scale_score`, `recency_score` summing to
  `match_score`), classification, recommended outreach angle, and estimate
  range.
- `sponsor_evidence` — one row per cited claim, with `source_url`, tied to
  either a `sponsor_matches` row or a `sponsorship_relationships` row.
- `discovery_runs` — one row per `/api/sponsors` run, for observability
  (queries used, candidates found/qualified/rejected, model, timing, errors).

Full 9 enum types, indexes, and the `updated_at` trigger are all in the file
as given — not reproduced here.

## LLM Output Redesign

Confirmed live: `perplexity/sonar` via OpenRouter returns real citation URLs in
`message.annotations` (`url_citation` objects), but the `start_index`/
`end_index` fields are unreliable for splicing specific claims out of the prose.
Instead of relying on that array, `findSponsors`'s prompt now asks the model to
**self-report** a `sourceUrl` per entry directly in its structured JSON output —
these search-grounded models already track sources internally (proven by the
annotations existing at all), so asking them to cite inline is a natural fit
and far simpler than post-hoc index-matching.

`extractOrgProfile` and `findSponsors` are extended, not replaced. New fields
are **additive and optional** on the existing `OrgProfile` and `Sponsor`
TypeScript types — this avoids rewriting every existing test fixture across
the app (many files declare literal `OrgProfile`/`Sponsor` objects). Consumers
that don't care about the new fields keep working unchanged; the DB write
layer defaults any missing optional field.

```typescript
// lib/org-profile.ts — additive fields on OrgProfile
interface OrgProfile {
  // ...existing fields unchanged...
  currentSponsors?: string[];       // names found in the org's own site text
  city?: string;
  region?: string;
  country?: string;
  lat?: number;
  lng?: number;
}

// lib/openrouter.ts — additive fields on Sponsor
interface EvidenceItem {
  claim: string;
  sourceUrl: string;
  sourceTitle?: string;
  sourceType?: string;      // maps to source_type_enum
  evidenceType?: string;    // maps to evidence_type_enum
}

interface Sponsor {
  // ...existing fields unchanged (name, matchScore, matchReason,
  // estimatedMinUsd, estimatedMaxUsd, category)...
  relationship?: 'confirmed_existing' | 'prospect'; // default 'prospect' if absent
  city?: string;
  region?: string;
  country?: string;
  evidenceScore?: number;
  geographyScore?: number;
  sportScore?: number;
  audienceScore?: number;
  causeScore?: number;
  scaleScore?: number;
  recencyScore?: number;
  evidenceConfidence?: 'high' | 'medium' | 'low';
  classification?: 'exceptional' | 'strong' | 'good' | 'explore';
  recommendedAngle?: string;
  currency?: string;                 // default 'USD'
  estimateConfidence?: 'high' | 'medium' | 'low';
  evidence?: EvidenceItem[];
}
```

`findSponsors` now returns confirmed-existing sponsors it finds *as regular
`Sponsor` entries* tagged `relationship: 'confirmed_existing'`, rather than
suppressing them entirely as it did before. `SponsorsClient` filters these out
of what's rendered/clickable (only `prospect` entries are shown as cards) —
they still get persisted.

## Data Flow

1. `/api/analyze` scrapes the site, calls `extractOrgProfile` (now also
   returning `currentSponsors` + geo). After building the `OrgProfile`, it
   upserts a `clubs` row (geo included) and, for each `currentSponsors` name,
   upserts a `sponsors` row + a `sponsorship_relationships` edge
   (`status: 'active'`, `source_type: 'club_official'` evidence, since it came
   from the org's own site).
2. `app/confirm/ConfirmClient.tsx` gains a read-only "Current Sponsors We
   Found" section (same visual pattern as "Programs We Found") when
   `profile.currentSponsors` is non-empty. Not editable — informational.
3. `/api/sponsors` calls `findSponsors` (confirmed-existing + prospects, both
   with evidence). It upserts `sponsors` rows for every entry, writes
   `sponsorship_relationships` edges for `confirmed_existing` entries and
   `sponsor_matches` rows (with the full scoring rubric) for `prospect`
   entries, writes `sponsor_evidence` rows for every cited claim, and writes
   one `discovery_runs` row summarizing the run. All of this happens
   server-side after the LLM call, before the JSON response is sent back —
   a persistence failure is logged but does not fail the user-facing request
   (the sessionStorage-driven UI must keep working even if a DB write fails).

## Error Handling

- DB writes are best-effort and non-blocking: wrapped in try/catch, logged via
  `console.error`, never thrown back to the client. The existing
  sessionStorage-driven UI flow is the source of truth for what the user sees;
  the DB is a side-channel data asset, not a dependency of the request path.
- Migration script (`scripts/migrate.mjs`) is a manual, explicit step (`npm run
  db:migrate`) — never run automatically at request time.

## Testing

- `lib/db.ts`: unit tests for the upsert helper functions (mocked `sql` client)
  covering the write shapes for each table, including the best-effort
  error-swallowing behavior.
- `lib/org-profile.ts` / `lib/openrouter.ts`: unit tests for the new optional
  fields' parsing/defaulting, following the existing adversarial-coverage
  standard (malformed `currentSponsors`, missing geo, malformed evidence
  arrays don't crash).
- Route tests for `/api/analyze` and `/api/sponsors` verifying DB writes are
  attempted with the right shape (mocked `lib/db.ts`) and that a DB failure
  doesn't change the HTTP response.
- No new component tests needed beyond the "Current Sponsors We Found" section
  on `ConfirmClient`.
- Manual verification: run `npm run db:migrate` against the real Neon
  instance, run the real onboarding + sponsor discovery flow, inspect the
  written rows directly (`psql` or Neon's SQL editor) to confirm the graph is
  actually populating.

## Out of Scope (this spec)

- Any UI for browsing/querying the accumulated graph itself (e.g. "sponsors
  who fund 3+ local clubs" as a feature) — this spec only builds the write
  path. Reading the graph back for smarter matching (skip live LLM research
  when we already know a region's sponsors) is real future work.
- User accounts, auth, multi-tenant data isolation.
- PostGIS / precise geospatial queries — `lat`/`lng` are plain NUMERIC columns
  from LLM-estimated city-level coordinates, not a real geocoding API.
- Neon branching, read replicas, or any environment beyond the single
  provisioned instance.
