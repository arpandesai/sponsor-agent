# Shared Onboarding Flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the shared onboarding flow (Landing → Website Analysis → Org Confirmation → Funding Dashboard) for SportsFirst Funding Agents, real AI-backed (Firecrawl + OpenRouter), no mocked data.

**Architecture:** Next.js App Router + TypeScript. Two server routes (`/api/analyze` SSE, `/api/funding`) call `lib/firecrawl.ts` and `lib/openrouter.ts`. Client screens read/write an `OrgProfile` via `sessionStorage` between steps. No database, no auth.

**Tech Stack:** Next.js 15 (App Router), TypeScript, Tailwind CSS v4, Zod (schema validation), Vitest + React Testing Library.

**Spec:** `docs/superpowers/specs/2026-09-06-shared-onboarding-flow-design.md`

## Global Constraints

- Env vars: `FIRECRAWL_API_KEY`, `OPENROUTER_API_KEY` (read via `process.env`, never hardcoded).
- No database, no auth, no persistence beyond `sessionStorage` — per spec's "Out of Scope".
- All server routes return `{ error: string }` on failure — never throw raw errors to the client.
- Only animate `transform` and `opacity` (GPU-friendly); never `transition: all`.
- UI motion durations: 150–250ms for dropdown/chip-style interactions, entrance animations start from `opacity: 0` + `translateY(8px)` or `scale(0.95)` (never `scale(0)`), `ease-out` for entrances, custom cubic-bezier `--ease-out: cubic-bezier(0.23, 1, 0.32, 1)` — never `ease-in` on UI.
- Pressable elements (buttons, chips) get `:active { transform: scale(0.97) }` with `transition: transform 160ms var(--ease-out)`.
- Respect `prefers-reduced-motion`: keep opacity fades, drop transform-based motion.

---

## File Structure

```
app/
  layout.tsx              # root layout, font, globals import
  globals.css             # design tokens: colors, spacing, easing, font
  page.tsx                # Landing
  analyze/page.tsx        # Website Analysis (SSE client)
  confirm/page.tsx        # Org Confirmation form
  dashboard/page.tsx      # Funding Dashboard
  api/analyze/route.ts    # SSE: scrape + extract
  api/funding/route.ts    # sponsor/grant estimate
lib/
  org-profile.ts          # OrgProfile type, zod schema, parse()
  firecrawl.ts            # scrapeUrl()
  openrouter.ts           # extractOrgProfile(), estimateFunding()
lib/org-profile.test.ts
lib/firecrawl.test.ts
lib/openrouter.test.ts
app/api/analyze/route.test.ts
app/api/funding/route.test.ts
```

---

### Task 1: Project Scaffold

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `postcss.config.mjs`, `app/layout.tsx`, `app/page.tsx` (placeholder), `vitest.config.ts`, `.env.example`, `.gitignore`

**Interfaces:**
- Produces: a running `npm run dev` Next.js app on port 3000, `npm test` running Vitest.

- [ ] **Step 1: Scaffold Next.js app**

```bash
npx create-next-app@latest . --typescript --tailwind --app --no-src-dir --import-alias "@/*" --eslint --use-npm
```

Answer prompts: no Turbopack changes needed, accept defaults.

- [ ] **Step 2: Add test tooling**

```bash
npm install -D vitest @vitejs/plugin-react jsdom @testing-library/react @testing-library/jest-dom zod
```

Create `vitest.config.ts`:

```typescript
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, './') },
  },
});
```

Add to `package.json` scripts: `"test": "vitest run"`.

- [ ] **Step 3: Add env template**

Create `.env.example`:

```
FIRECRAWL_API_KEY=
OPENROUTER_API_KEY=
```

Confirm `.gitignore` includes `.env*.local` and `.env` (create-next-app adds `.env*.local` by default — add plain `.env` too).

- [ ] **Step 4: Verify dev server and test runner**

Run: `npm run dev` — confirm it serves the default page at `localhost:3000`, then stop it.
Run: `npm test` — expected: "No test files found" (passes, nothing to run yet).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "chore: scaffold Next.js app with Vitest"
```

---

### Task 2: Design Foundations (tokens, motion primitives)

**Files:**
- Modify: `app/globals.css`
- Modify: `tailwind.config.ts` (create if create-next-app used Tailwind v4 CSS-only config, add one alongside `@theme` in CSS)

**Interfaces:**
- Produces: CSS custom properties and utility classes every later screen uses: `--ease-out`, `--ease-in-out`, `.pressable`, `.fade-in-up`, color tokens `--color-ink`, `--color-paper`, `--color-accent`, `--color-muted`, font `--font-sans`.

- [ ] **Step 1: Define tokens in `app/globals.css`**

```css
@import "tailwindcss";

:root {
  --color-paper: #fafaf9;
  --color-ink: #1c1917;
  --color-muted: #78716c;
  --color-accent: #0f766e;
  --color-accent-ink: #f0fdfa;
  --color-border: #e7e5e4;
  --radius-md: 0.75rem;
  --radius-lg: 1rem;
  --ease-out: cubic-bezier(0.23, 1, 0.32, 1);
  --ease-in-out: cubic-bezier(0.77, 0, 0.175, 1);
  --font-sans: ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
}

@media (prefers-color-scheme: dark) {
  :root {
    --color-paper: #1c1917;
    --color-ink: #fafaf9;
    --color-muted: #a8a29e;
    --color-accent: #2dd4bf;
    --color-accent-ink: #042f2e;
    --color-border: #292524;
  }
}

body {
  background: var(--color-paper);
  color: var(--color-ink);
  font-family: var(--font-sans);
}

.pressable {
  transition: transform 160ms var(--ease-out);
}
.pressable:active {
  transform: scale(0.97);
}

@keyframes fade-in-up {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
.fade-in-up {
  animation: fade-in-up 250ms var(--ease-out) both;
}

@media (prefers-reduced-motion: reduce) {
  .pressable,
  .fade-in-up {
    animation: none;
    transition: opacity 200ms ease;
    transform: none !important;
  }
}
```

- [ ] **Step 2: Update `app/layout.tsx` to use the tokens**

Ensure `app/layout.tsx` imports `./globals.css` (create-next-app already does this) and the `<body>` has no conflicting Tailwind `bg-white`/`text-black` classes overriding the tokens — remove any such default classes create-next-app added.

- [ ] **Step 3: Verify visually**

Run: `npm run dev`, open `localhost:3000`, confirm background/text use the token colors (inspect computed styles in devtools), confirm no console errors. Stop dev server.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: add design tokens and motion primitives"
```

---

### Task 3: `OrgProfile` type and validation

**Files:**
- Create: `lib/org-profile.ts`
- Test: `lib/org-profile.test.ts`

**Interfaces:**
- Produces:
  ```typescript
  export interface OrgProfile {
    name: string;
    location: string;
    sport: string;
    organisationType: string;
    audience: string[];
    programs: string[];
    fundingNeeds: string[];
  }
  export const orgProfileSchema: ZodType<OrgProfile>;
  export function parseOrgProfile(input: unknown): OrgProfile;
  export function emptyOrgProfile(): OrgProfile;
  ```

- [ ] **Step 1: Write failing test**

```typescript
// lib/org-profile.test.ts
import { describe, it, expect } from 'vitest';
import { parseOrgProfile, emptyOrgProfile } from './org-profile';

describe('parseOrgProfile', () => {
  it('parses a full valid profile', () => {
    const input = {
      name: 'Prairie Fencing Club',
      location: 'Saskatoon, Saskatchewan, Canada',
      sport: 'Fencing',
      organisationType: 'Community Sports Club',
      audience: ['Youth', 'Adults'],
      programs: ['Youth Fencing', 'Adult Fencing'],
      fundingNeeds: ['Equipment', 'Coaching'],
    };
    expect(parseOrgProfile(input)).toEqual(input);
  });

  it('fills missing fields with empty defaults instead of throwing', () => {
    const result = parseOrgProfile({ name: 'Some Club' });
    expect(result.name).toBe('Some Club');
    expect(result.location).toBe('');
    expect(result.audience).toEqual([]);
  });

  it('emptyOrgProfile returns all-blank profile', () => {
    expect(emptyOrgProfile()).toEqual({
      name: '',
      location: '',
      sport: '',
      organisationType: '',
      audience: [],
      programs: [],
      fundingNeeds: [],
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- org-profile`
Expected: FAIL — `lib/org-profile.ts` does not exist.

- [ ] **Step 3: Implement**

```typescript
// lib/org-profile.ts
import { z } from 'zod';

export interface OrgProfile {
  name: string;
  location: string;
  sport: string;
  organisationType: string;
  audience: string[];
  programs: string[];
  fundingNeeds: string[];
}

const stringArray = z.array(z.string()).default([]);

const partialProfileSchema = z.object({
  name: z.string().default(''),
  location: z.string().default(''),
  sport: z.string().default(''),
  organisationType: z.string().default(''),
  audience: stringArray,
  programs: stringArray,
  fundingNeeds: stringArray,
});

export const orgProfileSchema = partialProfileSchema;

export function parseOrgProfile(input: unknown): OrgProfile {
  const result = partialProfileSchema.safeParse(input);
  if (result.success) return result.data;
  // Fall back field-by-field so a malformed single field doesn't blank everything
  const raw = (input ?? {}) as Record<string, unknown>;
  return partialProfileSchema.parse({
    name: typeof raw.name === 'string' ? raw.name : '',
    location: typeof raw.location === 'string' ? raw.location : '',
    sport: typeof raw.sport === 'string' ? raw.sport : '',
    organisationType: typeof raw.organisationType === 'string' ? raw.organisationType : '',
    audience: Array.isArray(raw.audience) ? raw.audience : [],
    programs: Array.isArray(raw.programs) ? raw.programs : [],
    fundingNeeds: Array.isArray(raw.fundingNeeds) ? raw.fundingNeeds : [],
  });
}

export function emptyOrgProfile(): OrgProfile {
  return partialProfileSchema.parse({});
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- org-profile`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/org-profile.ts lib/org-profile.test.ts
git commit -m "feat: add OrgProfile type and parsing"
```

---

### Task 4: Firecrawl client

**Files:**
- Create: `lib/firecrawl.ts`
- Test: `lib/firecrawl.test.ts`

**Interfaces:**
- Consumes: `process.env.FIRECRAWL_API_KEY`
- Produces:
  ```typescript
  export interface ScrapeResult { url: string; text: string; }
  export async function scrapeUrl(url: string): Promise<ScrapeResult>;
  ```
  Throws `Error` with a human-readable message on failure (caller catches and maps to `{ error }`).

- [ ] **Step 1: Write failing test**

```typescript
// lib/firecrawl.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { scrapeUrl } from './firecrawl';

describe('scrapeUrl', () => {
  beforeEach(() => {
    process.env.FIRECRAWL_API_KEY = 'test-key';
    global.fetch = vi.fn();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns cleaned text on success', async () => {
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: { markdown: '# Prairie Fencing Club\nWelcome' } }),
    });

    const result = await scrapeUrl('https://example.com');
    expect(result.url).toBe('https://example.com');
    expect(result.text).toContain('Prairie Fencing Club');
  });

  it('throws a readable error when Firecrawl returns failure', async () => {
    (global.fetch as any).mockResolvedValue({
      ok: false,
      status: 402,
      json: async () => ({ success: false, error: 'Payment required' }),
    });

    await expect(scrapeUrl('https://example.com')).rejects.toThrow(/Payment required/);
  });

  it('throws when fetch itself rejects (network/timeout)', async () => {
    (global.fetch as any).mockRejectedValue(new Error('fetch failed'));
    await expect(scrapeUrl('https://example.com')).rejects.toThrow(/fetch failed/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- firecrawl`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Implement**

```typescript
// lib/firecrawl.ts
export interface ScrapeResult {
  url: string;
  text: string;
}

export async function scrapeUrl(url: string): Promise<ScrapeResult> {
  const apiKey = process.env.FIRECRAWL_API_KEY;
  if (!apiKey) throw new Error('FIRECRAWL_API_KEY is not set');

  let response: Response;
  try {
    response = await fetch('https://api.firecrawl.dev/v1/scrape', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ url, formats: ['markdown'] }),
    });
  } catch (err) {
    throw new Error(`Could not reach Firecrawl: ${(err as Error).message}`);
  }

  const body = await response.json();
  if (!response.ok || !body.success) {
    throw new Error(body.error ?? `Firecrawl request failed (${response.status})`);
  }

  return { url, text: body.data.markdown as string };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- firecrawl`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/firecrawl.ts lib/firecrawl.test.ts
git commit -m "feat: add Firecrawl scrape client"
```

---

### Task 5: OpenRouter — org profile extraction

**Files:**
- Create: `lib/openrouter.ts`
- Test: `lib/openrouter.test.ts`

**Interfaces:**
- Consumes: `process.env.OPENROUTER_API_KEY`, `OrgProfile` type from `lib/org-profile.ts` (Task 3), `parseOrgProfile`.
- Produces:
  ```typescript
  export async function extractOrgProfile(siteText: string): Promise<OrgProfile>;
  ```

- [ ] **Step 1: Write failing test**

```typescript
// lib/openrouter.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { extractOrgProfile } from './openrouter';

describe('extractOrgProfile', () => {
  beforeEach(() => {
    process.env.OPENROUTER_API_KEY = 'test-key';
    global.fetch = vi.fn();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('parses the model JSON content into an OrgProfile', async () => {
    const profileJson = JSON.stringify({
      name: 'Prairie Fencing Club',
      location: 'Saskatoon, Saskatchewan, Canada',
      sport: 'Fencing',
      organisationType: 'Community Sports Club',
      audience: ['Youth', 'Adults'],
      programs: ['Youth Fencing'],
      fundingNeeds: ['Equipment'],
    });
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: profileJson } }] }),
    });

    const profile = await extractOrgProfile('Welcome to Prairie Fencing Club...');
    expect(profile.name).toBe('Prairie Fencing Club');
    expect(profile.audience).toEqual(['Youth', 'Adults']);
  });

  it('throws a readable error on API failure', async () => {
    (global.fetch as any).mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ error: { message: 'upstream error' } }),
    });
    await expect(extractOrgProfile('text')).rejects.toThrow(/upstream error/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- openrouter`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Implement**

```typescript
// lib/openrouter.ts
import { parseOrgProfile, type OrgProfile } from './org-profile';

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const EXTRACTION_MODEL = 'anthropic/claude-sonnet-4.5';

async function callOpenRouter(body: Record<string, unknown>): Promise<any> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error('OPENROUTER_API_KEY is not set');

  let response: Response;
  try {
    response = await fetch(OPENROUTER_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
  } catch (err) {
    throw new Error(`Could not reach OpenRouter: ${(err as Error).message}`);
  }

  const json = await response.json();
  if (!response.ok) {
    throw new Error(json.error?.message ?? `OpenRouter request failed (${response.status})`);
  }
  return json;
}

export async function extractOrgProfile(siteText: string): Promise<OrgProfile> {
  const json = await callOpenRouter({
    model: EXTRACTION_MODEL,
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'system',
        content:
          'Extract a sports organisation profile from the given website text. ' +
          'Respond with ONLY a JSON object with keys: name, location, sport, ' +
          'organisationType, audience (string array), programs (string array), ' +
          'fundingNeeds (string array of likely funding needs like Equipment, ' +
          'Athlete Travel, Youth Development, Coaching, Community Participation, Events). ' +
          'Use "" or [] for anything not found.',
      },
      { role: 'user', content: siteText.slice(0, 20000) },
    ],
  });

  const content = json.choices?.[0]?.message?.content ?? '{}';
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    parsed = {};
  }
  return parseOrgProfile(parsed);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- openrouter`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/openrouter.ts lib/openrouter.test.ts
git commit -m "feat: add OpenRouter org profile extraction"
```

---

### Task 6: OpenRouter — funding estimate (web search)

**Files:**
- Modify: `lib/openrouter.ts`
- Modify: `lib/openrouter.test.ts`

**Interfaces:**
- Consumes: `OrgProfile` (Task 3), `callOpenRouter` (private helper from Task 5).
- Produces:
  ```typescript
  export interface FundingEstimate {
    sponsorship: { count: number; minUsd: number; maxUsd: number; rationale: string };
    grants: { count: number; minUsd: number; maxUsd: number; rationale: string };
  }
  export async function estimateFunding(profile: OrgProfile): Promise<FundingEstimate>;
  ```

- [ ] **Step 1: Write failing test**

Append to `lib/openrouter.test.ts`:

```typescript
import { estimateFunding } from './openrouter';
import type { OrgProfile } from './org-profile';

describe('estimateFunding', () => {
  beforeEach(() => {
    process.env.OPENROUTER_API_KEY = 'test-key';
    global.fetch = vi.fn();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  const profile: OrgProfile = {
    name: 'Prairie Fencing Club',
    location: 'Saskatoon, Saskatchewan, Canada',
    sport: 'Fencing',
    organisationType: 'Community Sports Club',
    audience: ['Youth', 'Adults'],
    programs: ['Youth Fencing'],
    fundingNeeds: ['Equipment'],
  };

  it('parses a funding estimate from the model response', async () => {
    const estimateJson = JSON.stringify({
      sponsorship: { count: 38, minUsd: 35000, maxUsd: 65000, rationale: 'Local businesses sponsor youth fencing.' },
      grants: { count: 6, minUsd: 20000, maxUsd: 84000, rationale: 'Saskatchewan sport grants match youth programs.' },
    });
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: estimateJson } }] }),
    });

    const estimate = await estimateFunding(profile);
    expect(estimate.sponsorship.count).toBe(38);
    expect(estimate.grants.maxUsd).toBe(84000);
  });

  it('defaults to a zeroed estimate when the model response is unparseable', async () => {
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: 'not json' } }] }),
    });
    const estimate = await estimateFunding(profile);
    expect(estimate.sponsorship.count).toBe(0);
    expect(estimate.grants.count).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- openrouter`
Expected: FAIL — `estimateFunding` not exported.

- [ ] **Step 3: Implement**

Append to `lib/openrouter.ts`:

```typescript
const MATCHING_MODEL = 'perplexity/sonar';

export interface FundingEstimate {
  sponsorship: { count: number; minUsd: number; maxUsd: number; rationale: string };
  grants: { count: number; minUsd: number; maxUsd: number; rationale: string };
}

function zeroFundingEstimate(): FundingEstimate {
  return {
    sponsorship: { count: 0, minUsd: 0, maxUsd: 0, rationale: '' },
    grants: { count: 0, minUsd: 0, maxUsd: 0, rationale: '' },
  };
}

export async function estimateFunding(profile: OrgProfile): Promise<FundingEstimate> {
  const json = await callOpenRouter({
    model: MATCHING_MODEL,
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'system',
        content:
          'You research real sponsorship and grant funding opportunities using web search. ' +
          'Given a sports organisation profile, respond with ONLY a JSON object: ' +
          '{ "sponsorship": { "count": number, "minUsd": number, "maxUsd": number, "rationale": string }, ' +
          '"grants": { "count": number, "minUsd": number, "maxUsd": number, "rationale": string } }. ' +
          'count is the number of plausible real matches you found. rationale is one sentence ' +
          'explaining the estimate, citing the kind of sources used.',
      },
      { role: 'user', content: JSON.stringify(profile) },
    ],
  });

  const content = json.choices?.[0]?.message?.content ?? '';
  try {
    const parsed = JSON.parse(content);
    return {
      sponsorship: { ...zeroFundingEstimate().sponsorship, ...parsed.sponsorship },
      grants: { ...zeroFundingEstimate().grants, ...parsed.grants },
    };
  } catch {
    return zeroFundingEstimate();
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- openrouter`
Expected: PASS (4 tests total in file).

- [ ] **Step 5: Commit**

```bash
git add lib/openrouter.ts lib/openrouter.test.ts
git commit -m "feat: add funding estimate via OpenRouter web search"
```

---

### Task 7: `/api/analyze` route (SSE)

**Files:**
- Create: `app/api/analyze/route.ts`
- Test: `app/api/analyze/route.test.ts`

**Interfaces:**
- Consumes: `scrapeUrl` (Task 4), `extractOrgProfile` (Task 5).
- Produces: `POST` handler returning a `text/event-stream` response. Events: `event: step\ndata: {"label": string}\n\n` for each of the spec's checklist labels as they complete, then `event: done\ndata: <OrgProfile JSON>\n\n`. On failure: `event: error\ndata: {"error": string}\n\n`.

- [ ] **Step 1: Write failing test**

```typescript
// app/api/analyze/route.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@/lib/firecrawl', () => ({ scrapeUrl: vi.fn() }));
vi.mock('@/lib/openrouter', () => ({ extractOrgProfile: vi.fn() }));

import { scrapeUrl } from '@/lib/firecrawl';
import { extractOrgProfile } from '@/lib/openrouter';
import { POST } from './route';

async function readAllEvents(response: Response): Promise<string> {
  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let output = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    output += decoder.decode(value);
  }
  return output;
}

describe('POST /api/analyze', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('streams step events then a done event with the profile', async () => {
    (scrapeUrl as any).mockResolvedValue({ url: 'https://example.com', text: 'site text' });
    (extractOrgProfile as any).mockResolvedValue({
      name: 'Prairie Fencing Club',
      location: 'Saskatoon, Saskatchewan, Canada',
      sport: 'Fencing',
      organisationType: 'Community Sports Club',
      audience: [],
      programs: [],
      fundingNeeds: [],
    });

    const request = new Request('http://localhost/api/analyze', {
      method: 'POST',
      body: JSON.stringify({ url: 'https://example.com' }),
    });
    const response = await POST(request);
    const output = await readAllEvents(response);

    expect(output).toContain('event: step');
    expect(output).toContain('Found organisation name');
    expect(output).toContain('event: done');
    expect(output).toContain('Prairie Fencing Club');
  });

  it('streams an error event when scraping fails', async () => {
    (scrapeUrl as any).mockRejectedValue(new Error('Could not reach Firecrawl: timeout'));

    const request = new Request('http://localhost/api/analyze', {
      method: 'POST',
      body: JSON.stringify({ url: 'https://example.com' }),
    });
    const response = await POST(request);
    const output = await readAllEvents(response);

    expect(output).toContain('event: error');
    expect(output).toContain('timeout');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- app/api/analyze`
Expected: FAIL — `./route` does not exist.

- [ ] **Step 3: Implement**

```typescript
// app/api/analyze/route.ts
import { scrapeUrl } from '@/lib/firecrawl';
import { extractOrgProfile } from '@/lib/openrouter';

const STEP_LABELS = [
  'Found organisation name',
  'Identified sport',
  'Identified location',
  'Found programs',
  'Identified possible funding needs',
];

function sseEvent(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

export async function POST(request: Request): Promise<Response> {
  const { url } = await request.json();

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      const send = (event: string, data: unknown) =>
        controller.enqueue(encoder.encode(sseEvent(event, data)));

      try {
        const scraped = await scrapeUrl(url);
        const profile = await extractOrgProfile(scraped.text);

        for (const label of STEP_LABELS) {
          send('step', { label });
        }
        send('done', profile);
      } catch (err) {
        send('error', { error: (err as Error).message });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- app/api/analyze`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add app/api/analyze/route.ts app/api/analyze/route.test.ts
git commit -m "feat: add /api/analyze SSE route"
```

---

### Task 8: `/api/funding` route

**Files:**
- Create: `app/api/funding/route.ts`
- Test: `app/api/funding/route.test.ts`

**Interfaces:**
- Consumes: `estimateFunding` (Task 6), `parseOrgProfile` (Task 3).
- Produces: `POST` handler accepting `OrgProfile` JSON body, returning `FundingEstimate` JSON on success or `{ error: string }` with a non-200 status on failure.

- [ ] **Step 1: Write failing test**

```typescript
// app/api/funding/route.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@/lib/openrouter', () => ({ estimateFunding: vi.fn() }));

import { estimateFunding } from '@/lib/openrouter';
import { POST } from './route';

describe('POST /api/funding', () => {
  beforeEach(() => vi.resetAllMocks());
  afterEach(() => vi.restoreAllMocks());

  const profileBody = {
    name: 'Prairie Fencing Club',
    location: 'Saskatoon, Saskatchewan, Canada',
    sport: 'Fencing',
    organisationType: 'Community Sports Club',
    audience: ['Youth'],
    programs: ['Youth Fencing'],
    fundingNeeds: ['Equipment'],
  };

  it('returns the funding estimate as JSON', async () => {
    (estimateFunding as any).mockResolvedValue({
      sponsorship: { count: 38, minUsd: 35000, maxUsd: 65000, rationale: 'r1' },
      grants: { count: 6, minUsd: 20000, maxUsd: 84000, rationale: 'r2' },
    });

    const request = new Request('http://localhost/api/funding', {
      method: 'POST',
      body: JSON.stringify(profileBody),
    });
    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.sponsorship.count).toBe(38);
  });

  it('returns a 502 with an error message when estimation fails', async () => {
    (estimateFunding as any).mockRejectedValue(new Error('upstream error'));

    const request = new Request('http://localhost/api/funding', {
      method: 'POST',
      body: JSON.stringify(profileBody),
    });
    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(502);
    expect(body.error).toContain('upstream error');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- app/api/funding`
Expected: FAIL — `./route` does not exist.

- [ ] **Step 3: Implement**

```typescript
// app/api/funding/route.ts
import { parseOrgProfile } from '@/lib/org-profile';
import { estimateFunding } from '@/lib/openrouter';

export async function POST(request: Request): Promise<Response> {
  const body = await request.json();
  const profile = parseOrgProfile(body);

  try {
    const estimate = await estimateFunding(profile);
    return Response.json(estimate);
  } catch (err) {
    return Response.json({ error: (err as Error).message }, { status: 502 });
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- app/api/funding`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add app/api/funding/route.ts app/api/funding/route.test.ts
git commit -m "feat: add /api/funding route"
```

---

### Task 9: Landing page

**Files:**
- Modify: `app/page.tsx`
- Test: `app/page.test.tsx`

**Interfaces:**
- Produces: default-export `Page` component. Submitting the URL form navigates to `/analyze?url=<encoded>`.

- [ ] **Step 1: Write failing test**

```tsx
// app/page.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

const push = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));

import Page from './page';

describe('Landing page', () => {
  it('navigates to /analyze with the encoded url on submit', () => {
    render(<Page />);
    const input = screen.getByLabelText(/organisation website/i);
    fireEvent.change(input, { target: { value: 'https://prairiefencing.ca' } });
    fireEvent.click(screen.getByRole('button', { name: /find funding opportunities/i }));
    expect(push).toHaveBeenCalledWith('/analyze?url=https%3A%2F%2Fprairiefencing.ca');
  });

  it('shows both outcome cards', () => {
    render(<Page />);
    expect(screen.getByText('Sponsor Agent')).toBeInTheDocument();
    expect(screen.getByText('Grant Agent')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- app/page.test`
Expected: FAIL — current `app/page.tsx` is the create-next-app placeholder.

- [ ] **Step 3: Implement**

```tsx
// app/page.tsx
'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';

export default function Page() {
  const router = useRouter();
  const [url, setUrl] = useState('');

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!url.trim()) return;
    router.push(`/analyze?url=${encodeURIComponent(url.trim())}`);
  }

  return (
    <main className="mx-auto flex max-w-2xl flex-col items-center gap-8 px-6 py-24 text-center">
      <h1 className="text-4xl font-semibold tracking-tight">
        Find more funding for your sports organisation
      </h1>
      <p className="text-lg text-[var(--color-muted)]">
        AI-powered sponsorship and grant discovery built for clubs, leagues, federations and academies.
      </p>

      <form onSubmit={handleSubmit} className="flex w-full flex-col gap-3">
        <label htmlFor="org-url" className="text-left text-sm font-medium">
          Enter your organisation website
        </label>
        <input
          id="org-url"
          aria-label="Enter your organisation website"
          type="url"
          required
          placeholder="https://yourclub.com"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          className="rounded-[var(--radius-md)] border border-[var(--color-border)] px-4 py-3 text-base"
        />
        <button
          type="submit"
          className="pressable rounded-[var(--radius-md)] bg-[var(--color-accent)] px-6 py-3 font-medium text-[var(--color-accent-ink)]"
        >
          Find Funding Opportunities
        </button>
        <p className="text-sm text-[var(--color-muted)]">No setup required. Start with your website.</p>
      </form>

      <div className="mt-12 grid w-full gap-4 sm:grid-cols-2">
        <article className="fade-in-up rounded-[var(--radius-lg)] border border-[var(--color-border)] p-6 text-left">
          <h2 className="font-semibold">Sponsor Agent</h2>
          <p className="text-sm text-[var(--color-muted)]">
            Find companies likely to sponsor your organisation and create personalised outreach.
          </p>
        </article>
        <article
          className="fade-in-up rounded-[var(--radius-lg)] border border-[var(--color-border)] p-6 text-left"
          style={{ animationDelay: '60ms' }}
        >
          <h2 className="font-semibold">Grant Agent</h2>
          <p className="text-sm text-[var(--color-muted)]">
            Discover relevant grants, check eligibility and prepare applications.
          </p>
        </article>
      </div>
    </main>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- app/page.test`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add app/page.tsx app/page.test.tsx
git commit -m "feat: build landing page"
```

---

### Task 10: Website Analysis screen

**Files:**
- Create: `app/analyze/page.tsx`
- Test: `app/analyze/page.test.tsx`

**Interfaces:**
- Consumes: SSE stream from `/api/analyze` (Task 7).
- Produces: on receiving `done`, writes the `OrgProfile` to `sessionStorage` under key `orgProfile` and navigates to `/confirm`. Renders checklist items with staggered `fade-in-up` (30–80ms apart, per design tokens) as `step` events arrive.

- [ ] **Step 1: Write failing test**

```tsx
// app/analyze/page.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

const push = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
  useSearchParams: () => new URLSearchParams('url=https%3A%2F%2Fexample.com'),
}));

import Page from './page';

function mockEventSource(events: { type: string; data: string }[]) {
  class FakeEventSource {
    listeners: Record<string, ((e: MessageEvent) => void)[]> = {};
    constructor(_url: string) {
      queueMicrotask(() => {
        for (const event of events) {
          this.listeners[event.type]?.forEach((cb) => cb({ data: event.data } as MessageEvent));
        }
      });
    }
    addEventListener(type: string, cb: (e: MessageEvent) => void) {
      this.listeners[type] = [...(this.listeners[type] ?? []), cb];
    }
    close() {}
  }
  // @ts-expect-error test stub
  global.EventSource = FakeEventSource;
}

describe('Analysis page', () => {
  beforeEach(() => {
    push.mockClear();
    sessionStorage.clear();
  });

  it('renders step labels as they stream in, then stores profile and navigates', async () => {
    const profile = { name: 'Prairie Fencing Club', location: '', sport: '', organisationType: '', audience: [], programs: [], fundingNeeds: [] };
    mockEventSource([
      { type: 'step', data: JSON.stringify({ label: 'Found organisation name' }) },
      { type: 'done', data: JSON.stringify(profile) },
    ]);

    render(<Page />);

    await waitFor(() => expect(screen.getByText('Found organisation name')).toBeInTheDocument());
    await waitFor(() => expect(push).toHaveBeenCalledWith('/confirm'));
    expect(JSON.parse(sessionStorage.getItem('orgProfile')!)).toEqual(profile);
  });

  it('shows an inline error with retry on an error event', async () => {
    mockEventSource([{ type: 'error', data: JSON.stringify({ error: 'Could not reach Firecrawl: timeout' }) }]);

    render(<Page />);

    await waitFor(() => expect(screen.getByText(/timeout/)).toBeInTheDocument());
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- app/analyze/page.test`
Expected: FAIL — `app/analyze/page.tsx` does not exist.

Note: this app uses `POST /api/analyze` for SSE (Task 7 uses `POST`), but the browser's native `EventSource` only supports `GET`. Since the test above stubs `EventSource` directly, the implementation below uses `EventSource` with the URL carrying the org URL as a query param, and `app/api/analyze/route.ts` must accept the URL from either the JSON body (Task 7's test) or a query param. Add a second export to satisfy both — see Step 3.

- [ ] **Step 3: Implement**

First, adjust `app/api/analyze/route.ts` from Task 7 to also accept `?url=` query param (small addition, keeps Task 7's POST/body contract intact for direct API callers):

```typescript
// app/api/analyze/route.ts — replace the first two lines of POST with:
export async function POST(request: Request): Promise<Response> {
  const { searchParams } = new URL(request.url);
  const bodyUrl = request.headers.get('content-length') !== '0' ? (await request.json().catch(() => ({}))).url : undefined;
  const url = bodyUrl ?? searchParams.get('url');
```

(Remove the old `const { url } = await request.json();` line it replaces.)

Now the analysis page:

```tsx
// app/analyze/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

export default function Page() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const url = searchParams.get('url') ?? '';
  const [steps, setSteps] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!url) return;
    setSteps([]);
    setError(null);

    const source = new EventSource(`/api/analyze?url=${encodeURIComponent(url)}`);

    source.addEventListener('step', (event) => {
      const { label } = JSON.parse((event as MessageEvent).data);
      setSteps((prev) => [...prev, label]);
    });

    source.addEventListener('done', (event) => {
      const profile = JSON.parse((event as MessageEvent).data);
      sessionStorage.setItem('orgProfile', JSON.stringify(profile));
      source.close();
      router.push('/confirm');
    });

    source.addEventListener('error', (event) => {
      const messageEvent = event as MessageEvent;
      const message = messageEvent.data ? JSON.parse(messageEvent.data).error : 'Something went wrong.';
      setError(message);
      source.close();
    });

    return () => source.close();
  }, [url, attempt, router]);

  return (
    <main className="mx-auto flex max-w-xl flex-col gap-6 px-6 py-24">
      <h1 className="text-2xl font-semibold">Understanding your organisation</h1>

      {error ? (
        <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] p-4">
          <p className="text-sm">{error}</p>
          <button
            className="pressable mt-3 rounded-[var(--radius-md)] bg-[var(--color-accent)] px-4 py-2 text-sm text-[var(--color-accent-ink)]"
            onClick={() => setAttempt((n) => n + 1)}
          >
            Retry
          </button>
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {steps.map((label, i) => (
            <li
              key={label}
              className="fade-in-up flex items-center gap-2 text-sm"
              style={{ animationDelay: `${i * 60}ms` }}
            >
              <span aria-hidden>✓</span>
              {label}
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- app/analyze/page.test`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add app/analyze/page.tsx app/analyze/page.test.tsx app/api/analyze/route.ts
git commit -m "feat: build website analysis screen with SSE checklist"
```

---

### Task 11: Organisation Confirmation screen

**Files:**
- Create: `app/confirm/page.tsx`
- Test: `app/confirm/page.test.tsx`

**Interfaces:**
- Consumes: `sessionStorage.getItem('orgProfile')`, `OrgProfile` type (Task 3).
- Produces: on "Looks Good — Find Funding", `POST`s the (possibly edited) profile to `/api/funding`, stores the response under `sessionStorage.setItem('fundingEstimate', ...)`, navigates to `/dashboard`.

- [ ] **Step 1: Write failing test**

```tsx
// app/confirm/page.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const push = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));

import Page from './page';

const profile = {
  name: 'Prairie Fencing Club',
  location: 'Saskatoon, Saskatchewan, Canada',
  sport: 'Fencing',
  organisationType: 'Community Sports Club',
  audience: ['Youth', 'Adults'],
  programs: ['Youth Fencing'],
  fundingNeeds: ['Equipment'],
};

describe('Confirm page', () => {
  beforeEach(() => {
    push.mockClear();
    sessionStorage.clear();
    sessionStorage.setItem('orgProfile', JSON.stringify(profile));
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        sponsorship: { count: 38, minUsd: 35000, maxUsd: 65000, rationale: 'r' },
        grants: { count: 6, minUsd: 20000, maxUsd: 84000, rationale: 'r' },
      }),
    });
  });

  it('pre-fills the form from sessionStorage', () => {
    render(<Page />);
    expect(screen.getByDisplayValue('Prairie Fencing Club')).toBeInTheDocument();
    expect(screen.getByText('Youth Fencing')).toBeInTheDocument();
  });

  it('removing a funding-need chip excludes it from the submitted profile', async () => {
    render(<Page />);
    fireEvent.click(screen.getByRole('button', { name: /remove equipment/i }));
    fireEvent.click(screen.getByRole('button', { name: /looks good/i }));

    await waitFor(() => expect(global.fetch).toHaveBeenCalled());
    const sentBody = JSON.parse((global.fetch as any).mock.calls[0][1].body);
    expect(sentBody.fundingNeeds).not.toContain('Equipment');
  });

  it('navigates to dashboard with the funding estimate stored', async () => {
    render(<Page />);
    fireEvent.click(screen.getByRole('button', { name: /looks good/i }));

    await waitFor(() => expect(push).toHaveBeenCalledWith('/dashboard'));
    expect(JSON.parse(sessionStorage.getItem('fundingEstimate')!).sponsorship.count).toBe(38);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- app/confirm/page.test`
Expected: FAIL — `app/confirm/page.tsx` does not exist.

- [ ] **Step 3: Implement**

```tsx
// app/confirm/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { emptyOrgProfile, type OrgProfile } from '@/lib/org-profile';

function Chip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="pressable flex items-center gap-2 rounded-full border border-[var(--color-border)] px-3 py-1 text-sm">
      {label}
      <button type="button" aria-label={`Remove ${label}`} onClick={onRemove} className="pressable">
        ×
      </button>
    </span>
  );
}

export default function Page() {
  const router = useRouter();
  const [profile, setProfile] = useState<OrgProfile>(emptyOrgProfile());
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const stored = sessionStorage.getItem('orgProfile');
    if (stored) setProfile(JSON.parse(stored));
  }, []);

  function removeFundingNeed(need: string) {
    setProfile((p) => ({ ...p, fundingNeeds: p.fundingNeeds.filter((n) => n !== need) }));
  }

  async function handleConfirm() {
    setSubmitting(true);
    const response = await fetch('/api/funding', {
      method: 'POST',
      body: JSON.stringify(profile),
    });
    const estimate = await response.json();
    sessionStorage.setItem('fundingEstimate', JSON.stringify(estimate));
    router.push('/dashboard');
  }

  return (
    <main className="mx-auto flex max-w-xl flex-col gap-8 px-6 py-24">
      <div>
        <h1 className="text-2xl font-semibold">We found {profile.name || 'your organisation'}</h1>
        <p className="text-sm text-[var(--color-muted)]">
          Review what we found before we start matching funding opportunities.
        </p>
      </div>

      <label className="flex flex-col gap-1 text-sm">
        Name
        <input
          value={profile.name}
          onChange={(e) => setProfile((p) => ({ ...p, name: e.target.value }))}
          className="rounded-[var(--radius-md)] border border-[var(--color-border)] px-3 py-2"
        />
      </label>

      <div>
        <h2 className="mb-2 text-sm font-medium">Programs We Found</h2>
        <ul className="flex flex-col gap-1 text-sm">
          {profile.programs.map((program) => (
            <li key={program}>✓ {program}</li>
          ))}
        </ul>
      </div>

      <div>
        <h2 className="mb-2 text-sm font-medium">Potential Funding Needs</h2>
        <div className="flex flex-wrap gap-2">
          {profile.fundingNeeds.map((need) => (
            <Chip key={need} label={need} onRemove={() => removeFundingNeed(need)} />
          ))}
        </div>
      </div>

      <button
        type="button"
        disabled={submitting}
        onClick={handleConfirm}
        className="pressable rounded-[var(--radius-md)] bg-[var(--color-accent)] px-6 py-3 font-medium text-[var(--color-accent-ink)] disabled:opacity-60"
      >
        {submitting ? 'Finding funding…' : 'Looks Good — Find Funding'}
      </button>
    </main>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- app/confirm/page.test`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add app/confirm/page.tsx app/confirm/page.test.tsx
git commit -m "feat: build organisation confirmation screen"
```

---

### Task 12: Funding Dashboard screen

**Files:**
- Create: `app/dashboard/page.tsx`
- Test: `app/dashboard/page.test.tsx`

**Interfaces:**
- Consumes: `sessionStorage.getItem('fundingEstimate')`, `FundingEstimate` type (Task 6).

- [ ] **Step 1: Write failing test**

```tsx
// app/dashboard/page.test.tsx
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import Page from './page';

describe('Dashboard page', () => {
  beforeEach(() => {
    sessionStorage.clear();
    sessionStorage.setItem(
      'fundingEstimate',
      JSON.stringify({
        sponsorship: { count: 38, minUsd: 35000, maxUsd: 65000, rationale: 'Local businesses sponsor youth fencing.' },
        grants: { count: 6, minUsd: 20000, maxUsd: 84000, rationale: 'Saskatchewan sport grants match youth programs.' },
      })
    );
  });

  it('renders sponsorship and grant summary cards with rationale', () => {
    render(<Page />);
    expect(screen.getByText('38 potential sponsors')).toBeInTheDocument();
    expect(screen.getByText(/\$35K–\$65K/)).toBeInTheDocument();
    expect(screen.getByText(/Local businesses sponsor youth fencing\./)).toBeInTheDocument();
    expect(screen.getByText(/\$20K–\$84K/)).toBeInTheDocument();
  });

  it('deep-dive CTAs are present but disabled', () => {
    render(<Page />);
    expect(screen.getByRole('button', { name: /view sponsors/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /find grants/i })).toBeDisabled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- app/dashboard/page.test`
Expected: FAIL — `app/dashboard/page.tsx` does not exist.

- [ ] **Step 3: Implement**

```tsx
// app/dashboard/page.tsx
'use client';

import { useEffect, useState } from 'react';
import type { FundingEstimate } from '@/lib/openrouter';

function formatK(value: number): string {
  return `$${Math.round(value / 1000)}K`;
}

export default function Page() {
  const [estimate, setEstimate] = useState<FundingEstimate | null>(null);

  useEffect(() => {
    const stored = sessionStorage.getItem('fundingEstimate');
    if (stored) setEstimate(JSON.parse(stored));
  }, []);

  if (!estimate) return null;

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-6 px-6 py-24">
      <h1 className="text-2xl font-semibold">We found funding opportunities for you</h1>

      <div className="grid gap-4 sm:grid-cols-2">
        <article className="fade-in-up rounded-[var(--radius-lg)] border border-[var(--color-border)] p-6">
          <h2 className="text-sm font-medium text-[var(--color-muted)]">Sponsorship</h2>
          <p className="mt-2 text-lg font-semibold">{estimate.sponsorship.count} potential sponsors</p>
          <p className="text-2xl font-semibold">
            {formatK(estimate.sponsorship.minUsd)}–{formatK(estimate.sponsorship.maxUsd)}
          </p>
          <p className="mt-2 text-sm text-[var(--color-muted)]">{estimate.sponsorship.rationale}</p>
          <button disabled className="pressable mt-4 rounded-[var(--radius-md)] border border-[var(--color-border)] px-4 py-2 text-sm opacity-60">
            View Sponsors
          </button>
        </article>

        <article
          className="fade-in-up rounded-[var(--radius-lg)] border border-[var(--color-border)] p-6"
          style={{ animationDelay: '60ms' }}
        >
          <h2 className="text-sm font-medium text-[var(--color-muted)]">Grants</h2>
          <p className="mt-2 text-lg font-semibold">{estimate.grants.count} matching grants</p>
          <p className="text-2xl font-semibold">
            {formatK(estimate.grants.minUsd)}–{formatK(estimate.grants.maxUsd)}
          </p>
          <p className="mt-2 text-sm text-[var(--color-muted)]">{estimate.grants.rationale}</p>
          <button disabled className="pressable mt-4 rounded-[var(--radius-md)] border border-[var(--color-border)] px-4 py-2 text-sm opacity-60">
            Find Grants
          </button>
        </article>
      </div>
    </main>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- app/dashboard/page.test`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add app/dashboard/page.tsx app/dashboard/page.test.tsx
git commit -m "feat: build funding dashboard screen"
```

---

### Task 13: End-to-end manual verification

**Files:** none (verification only)

- [ ] **Step 1: Set real API keys**

Copy `.env.example` to `.env.local`, fill in real `FIRECRAWL_API_KEY` and `OPENROUTER_API_KEY`.

- [ ] **Step 2: Run the full test suite**

Run: `npm test`
Expected: all tests PASS.

- [ ] **Step 3: Manual browser run**

Run: `npm run dev`. In a browser: submit a real club/organisation URL on the landing page, confirm the analysis screen streams checklist items and a filled-in preview, confirm the org-confirmation form is pre-filled and chip add/remove works, submit it, confirm the dashboard renders sponsorship/grant cards with real numbers and rationale text (not placeholders).

- [ ] **Step 4: Verify error paths**

Submit an unreachable/malformed URL (e.g. `https://this-domain-does-not-exist-12345.com`) and confirm the analysis screen shows the inline error + Retry button instead of hanging or crashing.

- [ ] **Step 5: Commit**

If Steps 1–4 required any fixes, commit them individually with descriptive messages as usual. No commit needed if only verification was performed.
