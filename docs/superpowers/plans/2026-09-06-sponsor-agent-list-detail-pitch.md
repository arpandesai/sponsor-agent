# Sponsor Agent (List, Detail, Pitch Builder) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build Sponsor List, Sponsor Detail, and Pitch Builder on top of the existing shared onboarding flow, wired to the dashboard's "View Sponsors" button. Grant Agent stays "coming soon".

**Architecture:** Two new OpenRouter-backed functions (`findSponsors`, `draftPitch`) in the existing `lib/openrouter.ts`, two new POST routes (`/api/sponsors`, `/api/pitch`), three new client screens under `app/sponsors/`, all following the exact server-wrapper + `*Client.tsx` + sessionStorage pattern already established by the onboarding flow. No DB.

**Tech Stack:** Same as the rest of the repo — Next.js App Router, TypeScript, Tailwind, Zod, Vitest + React Testing Library, Playwright.

**Spec:** `docs/superpowers/specs/2026-09-06-sponsor-agent-list-detail-pitch-design.md`

## Global Constraints

- No database, no auth, no email/CRM integration — sessionStorage only, matching `orgProfile`/`fundingEstimate` already in use.
- Every server route returns `{ error: string }` on failure via the existing `errorMessage()` helper (`lib/errors.ts`) — never a raw thrown error.
- Reuse existing pieces exactly, don't rebuild them: `ErrorBanner` (`components/ErrorBanner.tsx`), the thinking-dots loading pattern (`app/analyze/AnalyzeClient.tsx`), the `pressable`/`fade-in-up` CSS classes and `--color-*`/`--radius-*` tokens (`app/globals.css`), the `callOpenRouter` + `stripCodeFence` pattern (`lib/openrouter.ts:7-36`).
- Every new page follows the existing split: a server `page.tsx` (metadata only) importing a `*Client.tsx` ('use client', the actual logic) — see `app/dashboard/page.tsx` / `app/dashboard/DashboardClient.tsx` for the exact shape.

---

## File Structure

```
lib/
  openrouter.ts          # + findSponsors(), draftPitch(), Sponsor/PitchDraft types
  openrouter.test.ts      # + tests for both
app/
  api/
    sponsors/route.ts     # POST -> Sponsor[]
    sponsors/route.test.ts
    pitch/route.ts        # POST -> PitchDraft
    pitch/route.test.ts
  sponsors/
    page.tsx               # metadata wrapper
    SponsorsClient.tsx      # list screen
    SponsorsClient.test.tsx
    [index]/
      page.tsx
      SponsorDetailClient.tsx
      SponsorDetailClient.test.tsx
      pitch/
        page.tsx
        PitchClient.tsx
        PitchClient.test.tsx
  dashboard/
    DashboardClient.tsx    # "View Sponsors" button enabled
    DashboardClient.test.tsx
e2e/
  onboarding.spec.ts        # extended to continue into sponsors
```

---

### Task 1: `Sponsor`/`PitchDraft` types and `findSponsors()`

**Files:**
- Modify: `lib/openrouter.ts`
- Modify: `lib/openrouter.test.ts`

**Interfaces:**
- Consumes: `OrgProfile` (`lib/org-profile.ts`), `callOpenRouter`/`stripCodeFence`/`errorMessage` (already in `lib/openrouter.ts` / `lib/errors.ts`).
- Produces:
  ```typescript
  export interface Sponsor {
    name: string;
    matchScore: number;
    matchReason: string;
    estimatedMinUsd: number;
    estimatedMaxUsd: number;
    category: string;
  }
  export async function findSponsors(profile: OrgProfile): Promise<Sponsor[]>;
  ```
  Never throws for malformed model output — returns `[]` (mirrors the existing `estimateFunding` resilience pattern). Rejects (throws) only on network/API failure, exactly like `estimateFunding` does via `callOpenRouter`.

- [ ] **Step 1: Write failing test**

Append to `lib/openrouter.test.ts`:

```typescript
import { findSponsors, type Sponsor } from './openrouter';

describe('findSponsors', () => {
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

  it('parses a sponsor list from the model response', async () => {
    const sponsorsJson = JSON.stringify({
      sponsors: [
        {
          name: 'Prairie Sports Supply',
          matchScore: 82,
          matchReason: 'Local sporting goods retailer sponsors youth fencing clubs in Saskatchewan.',
          estimatedMinUsd: 2000,
          estimatedMaxUsd: 10000,
          category: 'Local Business',
        },
      ],
    });
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: sponsorsJson } }] }),
    });

    const sponsors = await findSponsors(profile);
    expect(sponsors).toHaveLength(1);
    expect(sponsors[0].name).toBe('Prairie Sports Supply');
    expect(sponsors[0].matchScore).toBe(82);
  });

  it('returns an empty array instead of throwing when the model response is unparseable', async () => {
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: 'not json' } }] }),
    });
    expect(await findSponsors(profile)).toEqual([]);
  });

  it('drops malformed entries instead of crashing or returning garbage', async () => {
    const sponsorsJson = JSON.stringify({
      sponsors: [
        { name: 'Good Co', matchScore: 70, matchReason: 'r', estimatedMinUsd: 1000, estimatedMaxUsd: 5000, category: 'Local Business' },
        { name: 42, matchScore: 'high', matchReason: null },
        'not even an object',
      ],
    });
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: sponsorsJson } }] }),
    });

    const sponsors = await findSponsors(profile);
    expect(sponsors).toHaveLength(1);
    expect(sponsors[0].name).toBe('Good Co');
  });

  it('preserves the underlying message when fetch rejects with a non-Error value', async () => {
    (global.fetch as any).mockRejectedValue('connection reset');
    await expect(findSponsors(profile)).rejects.toThrow(/connection reset/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- lib/openrouter`
Expected: FAIL — `findSponsors` is not exported.

- [ ] **Step 3: Implement**

Append to `lib/openrouter.ts` (after `estimateFunding`):

```typescript
export interface Sponsor {
  name: string;
  matchScore: number;
  matchReason: string;
  estimatedMinUsd: number;
  estimatedMaxUsd: number;
  category: string;
}

function toSponsor(raw: unknown): Sponsor | null {
  const source = (raw ?? {}) as Record<string, unknown>;
  if (typeof source.name !== 'string' || typeof source.matchReason !== 'string') return null;
  return {
    name: source.name,
    matchScore: toFiniteNumber(source.matchScore, 0),
    matchReason: source.matchReason,
    estimatedMinUsd: toFiniteNumber(source.estimatedMinUsd, 0),
    estimatedMaxUsd: toFiniteNumber(source.estimatedMaxUsd, 0),
    category: typeof source.category === 'string' ? source.category : '',
  };
}

export async function findSponsors(profile: OrgProfile): Promise<Sponsor[]> {
  const json = await callOpenRouter({
    model: MATCHING_MODEL,
    messages: [
      {
        role: 'system',
        content:
          'You research real companies likely to sponsor a sports organisation, using web search. ' +
          'Respond with ONLY a JSON object, no other text before or after it: ' +
          '{ "sponsors": [ { "name": string, "matchScore": number (0-100), "matchReason": string ' +
          '(one sentence explaining the match), "estimatedMinUsd": number, "estimatedMaxUsd": number, ' +
          '"category": string (e.g. "Local Business", "National Brand") } ] }. ' +
          'Return 8-12 real, plausible companies. Every entry must have all fields.',
      },
      { role: 'user', content: JSON.stringify(profile) },
    ],
  });

  const content = json.choices?.[0]?.message?.content ?? '';
  try {
    const parsed = JSON.parse(stripCodeFence(content));
    const list = Array.isArray(parsed?.sponsors) ? parsed.sponsors : [];
    return list.map(toSponsor).filter((s: Sponsor | null): s is Sponsor => s !== null);
  } catch {
    return [];
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- lib/openrouter`
Expected: PASS (all `findSponsors` tests, plus all pre-existing tests in the file).

- [ ] **Step 5: Commit**

```bash
git add lib/openrouter.ts lib/openrouter.test.ts
git commit -m "feat: add findSponsors to lib/openrouter"
```

---

### Task 2: `draftPitch()`

**Files:**
- Modify: `lib/openrouter.ts`
- Modify: `lib/openrouter.test.ts`

**Interfaces:**
- Consumes: `OrgProfile`, `Sponsor` (Task 1), `callOpenRouter`.
- Produces:
  ```typescript
  export interface PitchDraft {
    subject: string;
    body: string;
  }
  export async function draftPitch(profile: OrgProfile, sponsor: Sponsor): Promise<PitchDraft>;
  ```
  Never throws for malformed model output — returns a generic fallback draft instead (a pitch screen with blank fields is a worse failure than a bland one). Rejects only on network/API failure.

- [ ] **Step 1: Write failing test**

Append to `lib/openrouter.test.ts`:

```typescript
import { draftPitch } from './openrouter';

describe('draftPitch', () => {
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
  const sponsor: Sponsor = {
    name: 'Prairie Sports Supply',
    matchScore: 82,
    matchReason: 'Local sporting goods retailer sponsors youth fencing clubs.',
    estimatedMinUsd: 2000,
    estimatedMaxUsd: 10000,
    category: 'Local Business',
  };

  it('parses a subject/body draft from the model response', async () => {
    const draftJson = JSON.stringify({
      subject: 'Partnership opportunity: Prairie Fencing Club',
      body: 'Dear Prairie Sports Supply team, ...',
    });
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: draftJson } }] }),
    });

    const draft = await draftPitch(profile, sponsor);
    expect(draft.subject).toContain('Prairie Fencing Club');
    expect(draft.body).toContain('Prairie Sports Supply');
  });

  it('returns a generic fallback draft instead of throwing when the model response is unparseable', async () => {
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: 'not json' } }] }),
    });
    const draft = await draftPitch(profile, sponsor);
    expect(draft.subject.length).toBeGreaterThan(0);
    expect(draft.body.length).toBeGreaterThan(0);
  });

  it('preserves the underlying message when fetch rejects with a non-Error value', async () => {
    (global.fetch as any).mockRejectedValue('connection reset');
    await expect(draftPitch(profile, sponsor)).rejects.toThrow(/connection reset/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- lib/openrouter`
Expected: FAIL — `draftPitch` is not exported.

- [ ] **Step 3: Implement**

Append to `lib/openrouter.ts`:

```typescript
export interface PitchDraft {
  subject: string;
  body: string;
}

function fallbackPitchDraft(profile: OrgProfile, sponsor: Sponsor): PitchDraft {
  return {
    subject: `Partnership opportunity: ${profile.name || 'our organisation'} x ${sponsor.name}`,
    body:
      `Hi ${sponsor.name} team,\n\n` +
      `We're ${profile.name || 'a sports organisation'} and think there's a strong fit for a sponsorship ` +
      `partnership. ${sponsor.matchReason}\n\nWould you be open to a short call to discuss?\n\nThanks,\n${profile.name || 'Our team'}`,
  };
}

export async function draftPitch(profile: OrgProfile, sponsor: Sponsor): Promise<PitchDraft> {
  const json = await callOpenRouter({
    model: MATCHING_MODEL,
    messages: [
      {
        role: 'system',
        content:
          'You write a short, warm sponsorship outreach email from a sports organisation to a potential ' +
          'sponsor. Respond with ONLY a JSON object, no other text before or after it: ' +
          '{ "subject": string, "body": string }. Reference the specific match reason given. Keep the body ' +
          'under 150 words.',
      },
      { role: 'user', content: JSON.stringify({ profile, sponsor }) },
    ],
  });

  const content = json.choices?.[0]?.message?.content ?? '';
  try {
    const parsed = JSON.parse(stripCodeFence(content));
    if (typeof parsed?.subject === 'string' && typeof parsed?.body === 'string') {
      return { subject: parsed.subject, body: parsed.body };
    }
    return fallbackPitchDraft(profile, sponsor);
  } catch {
    return fallbackPitchDraft(profile, sponsor);
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- lib/openrouter`
Expected: PASS (all tests in the file, including all of Task 1 and 2).

- [ ] **Step 5: Commit**

```bash
git add lib/openrouter.ts lib/openrouter.test.ts
git commit -m "feat: add draftPitch to lib/openrouter"
```

---

### Task 3: `/api/sponsors` route

**Files:**
- Create: `app/api/sponsors/route.ts`
- Create: `app/api/sponsors/route.test.ts`

**Interfaces:**
- Consumes: `findSponsors` (Task 1), `parseOrgProfile` (`lib/org-profile.ts`), `errorMessage` (`lib/errors.ts`).
- Produces: `POST` handler, body `OrgProfile`, returns `Sponsor[]` JSON on success, `{ error: string }` with 400 on malformed body, `{ error: string }` with 502 on `findSponsors` failure.

- [ ] **Step 1: Write failing test**

```typescript
// app/api/sponsors/route.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@/lib/openrouter', () => ({ findSponsors: vi.fn() }));

import { findSponsors } from '@/lib/openrouter';
import { POST } from './route';

describe('POST /api/sponsors', () => {
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

  it('returns the sponsor list as JSON', async () => {
    (findSponsors as any).mockResolvedValue([
      { name: 'Prairie Sports Supply', matchScore: 82, matchReason: 'r', estimatedMinUsd: 2000, estimatedMaxUsd: 10000, category: 'Local Business' },
    ]);

    const request = new Request('http://localhost/api/sponsors', {
      method: 'POST',
      body: JSON.stringify(profileBody),
    });
    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toHaveLength(1);
    expect(body[0].name).toBe('Prairie Sports Supply');
  });

  it('returns a 502 with an error message when findSponsors fails', async () => {
    (findSponsors as any).mockRejectedValue(new Error('upstream error'));

    const request = new Request('http://localhost/api/sponsors', {
      method: 'POST',
      body: JSON.stringify(profileBody),
    });
    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(502);
    expect(body.error).toContain('upstream error');
  });

  it('returns a structured 400 when the request body is not valid JSON', async () => {
    const request = new Request('http://localhost/api/sponsors', {
      method: 'POST',
      body: '{not valid json',
    });
    const response = await POST(request);
    expect(response.status).toBe(400);
    expect(findSponsors).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- app/api/sponsors`
Expected: FAIL — `./route` does not exist.

- [ ] **Step 3: Implement**

```typescript
// app/api/sponsors/route.ts
import { parseOrgProfile } from '@/lib/org-profile';
import { findSponsors } from '@/lib/openrouter';
import { errorMessage } from '@/lib/errors';

export async function POST(request: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Request body must be valid JSON' }, { status: 400 });
  }

  const profile = parseOrgProfile(body);

  try {
    const sponsors = await findSponsors(profile);
    return Response.json(sponsors);
  } catch (err) {
    return Response.json({ error: errorMessage(err) }, { status: 502 });
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- app/api/sponsors`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add app/api/sponsors/route.ts app/api/sponsors/route.test.ts
git commit -m "feat: add /api/sponsors route"
```

---

### Task 4: `/api/pitch` route

**Files:**
- Create: `app/api/pitch/route.ts`
- Create: `app/api/pitch/route.test.ts`

**Interfaces:**
- Consumes: `draftPitch` (Task 2), `parseOrgProfile`, `errorMessage`.
- Produces: `POST` handler, body `{ profile: OrgProfile, sponsor: Sponsor }`, returns `PitchDraft` JSON on success, `{ error: string }` with 400 on malformed body, `{ error: string }` with 502 on `draftPitch` failure.

- [ ] **Step 1: Write failing test**

```typescript
// app/api/pitch/route.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@/lib/openrouter', () => ({ draftPitch: vi.fn() }));

import { draftPitch } from '@/lib/openrouter';
import { POST } from './route';

describe('POST /api/pitch', () => {
  beforeEach(() => vi.resetAllMocks());
  afterEach(() => vi.restoreAllMocks());

  const requestBody = {
    profile: {
      name: 'Prairie Fencing Club',
      location: 'Saskatoon, Saskatchewan, Canada',
      sport: 'Fencing',
      organisationType: 'Community Sports Club',
      audience: ['Youth'],
      programs: ['Youth Fencing'],
      fundingNeeds: ['Equipment'],
    },
    sponsor: {
      name: 'Prairie Sports Supply',
      matchScore: 82,
      matchReason: 'r',
      estimatedMinUsd: 2000,
      estimatedMaxUsd: 10000,
      category: 'Local Business',
    },
  };

  it('returns the pitch draft as JSON', async () => {
    (draftPitch as any).mockResolvedValue({ subject: 'Subject', body: 'Body' });

    const request = new Request('http://localhost/api/pitch', {
      method: 'POST',
      body: JSON.stringify(requestBody),
    });
    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.subject).toBe('Subject');
  });

  it('returns a 502 with an error message when draftPitch fails', async () => {
    (draftPitch as any).mockRejectedValue(new Error('upstream error'));

    const request = new Request('http://localhost/api/pitch', {
      method: 'POST',
      body: JSON.stringify(requestBody),
    });
    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(502);
    expect(body.error).toContain('upstream error');
  });

  it('returns a structured 400 when the request body is not valid JSON', async () => {
    const request = new Request('http://localhost/api/pitch', {
      method: 'POST',
      body: '{not valid json',
    });
    const response = await POST(request);
    expect(response.status).toBe(400);
    expect(draftPitch).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- app/api/pitch`
Expected: FAIL — `./route` does not exist.

- [ ] **Step 3: Implement**

```typescript
// app/api/pitch/route.ts
import { parseOrgProfile } from '@/lib/org-profile';
import { draftPitch, type Sponsor } from '@/lib/openrouter';
import { errorMessage } from '@/lib/errors';

function parseSponsor(input: unknown): Sponsor {
  const source = (input ?? {}) as Record<string, unknown>;
  return {
    name: typeof source.name === 'string' ? source.name : '',
    matchScore: typeof source.matchScore === 'number' ? source.matchScore : 0,
    matchReason: typeof source.matchReason === 'string' ? source.matchReason : '',
    estimatedMinUsd: typeof source.estimatedMinUsd === 'number' ? source.estimatedMinUsd : 0,
    estimatedMaxUsd: typeof source.estimatedMaxUsd === 'number' ? source.estimatedMaxUsd : 0,
    category: typeof source.category === 'string' ? source.category : '',
  };
}

export async function POST(request: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Request body must be valid JSON' }, { status: 400 });
  }

  const { profile: rawProfile, sponsor: rawSponsor } = (body ?? {}) as Record<string, unknown>;
  const profile = parseOrgProfile(rawProfile);
  const sponsor = parseSponsor(rawSponsor);

  try {
    const draft = await draftPitch(profile, sponsor);
    return Response.json(draft);
  } catch (err) {
    return Response.json({ error: errorMessage(err) }, { status: 502 });
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- app/api/pitch`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add app/api/pitch/route.ts app/api/pitch/route.test.ts
git commit -m "feat: add /api/pitch route"
```

---

### Task 5: Sponsor List screen

**Files:**
- Create: `app/sponsors/page.tsx`
- Create: `app/sponsors/SponsorsClient.tsx`
- Create: `app/sponsors/SponsorsClient.test.tsx`

**Interfaces:**
- Consumes: `sessionStorage.orgProfile`, `Sponsor` type (Task 1), `ErrorBanner` (`components/ErrorBanner.tsx`).
- Produces: on load, POSTs to `/api/sponsors`, stores result in `sessionStorage.sponsorList`. Clicking a card navigates to `/sponsors/{index}`.

- [ ] **Step 1: Write failing test**

```tsx
// app/sponsors/SponsorsClient.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';

const push = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));

import Page from './SponsorsClient';

const profile = {
  name: 'Prairie Fencing Club',
  location: 'Saskatoon, Saskatchewan, Canada',
  sport: 'Fencing',
  organisationType: 'Community Sports Club',
  audience: ['Youth'],
  programs: ['Youth Fencing'],
  fundingNeeds: ['Equipment'],
};

const sponsors = [
  { name: 'Prairie Sports Supply', matchScore: 82, matchReason: 'Local retailer, strong fit.', estimatedMinUsd: 2000, estimatedMaxUsd: 10000, category: 'Local Business' },
];

describe('Sponsors list page', () => {
  beforeEach(() => {
    push.mockClear();
    sessionStorage.clear();
    sessionStorage.setItem('orgProfile', JSON.stringify(profile));
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => sponsors });
  });

  it('redirects to / when there is no orgProfile in sessionStorage', () => {
    sessionStorage.clear();
    render(<Page />);
    expect(push).toHaveBeenCalledWith('/');
  });

  it('shows a thinking indicator, then renders sponsor cards and stores the list', async () => {
    render(<Page />);
    expect(screen.getByRole('status', { name: /thinking/i })).toBeInTheDocument();

    await waitFor(() => expect(screen.getByText('Prairie Sports Supply')).toBeInTheDocument());
    expect(screen.getByText(/82/)).toBeInTheDocument();
    expect(JSON.parse(sessionStorage.getItem('sponsorList')!)).toEqual(sponsors);
  });

  it('navigates to the detail screen by index when a card is clicked', async () => {
    render(<Page />);
    await waitFor(() => expect(screen.getByText('Prairie Sports Supply')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Prairie Sports Supply'));
    expect(push).toHaveBeenCalledWith('/sponsors/0');
  });

  it('shows an empty state when no sponsors are found', async () => {
    (global.fetch as any).mockResolvedValue({ ok: true, json: async () => [] });
    render(<Page />);
    await waitFor(() => expect(screen.getByText(/no sponsor matches/i)).toBeInTheDocument());
  });

  it('shows an inline error with retry when the request fails', async () => {
    (global.fetch as any).mockResolvedValue({ ok: false, json: async () => ({ error: 'Provider returned error' }) });
    render(<Page />);
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/Provider returned error/));
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- app/sponsors/SponsorsClient`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Implement**

```tsx
// app/sponsors/page.tsx
import type { Metadata } from 'next';
import SponsorsClient from './SponsorsClient';

export const metadata: Metadata = { title: 'Sponsors' };

export default function Page() {
  return <SponsorsClient />;
}
```

```tsx
// app/sponsors/SponsorsClient.tsx
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Sponsor } from '@/lib/openrouter';
import { ErrorBanner } from '@/components/ErrorBanner';

function formatAmount(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  return `$${Math.round(value / 1000)}K`;
}

export default function SponsorsClient() {
  const router = useRouter();
  const [sponsors, setSponsors] = useState<Sponsor[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const stored = sessionStorage.getItem('orgProfile');
    if (!stored) {
      router.push('/');
      return;
    }

    setSponsors(null);
    setError(null);

    (async () => {
      const response = await fetch('/api/sponsors', { method: 'POST', body: stored });
      const body = await response.json();
      if (!response.ok) {
        setError(body.error ?? 'Something went wrong finding sponsors.');
        return;
      }
      setSponsors(body);
      sessionStorage.setItem('sponsorList', JSON.stringify(body));
    })();
  }, [router, attempt]);

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-6 px-6 py-24">
      <h1 className="text-2xl font-semibold">Sponsors likely to fund you</h1>

      {error ? (
        <ErrorBanner message={error} onRetry={() => setAttempt((n) => n + 1)} />
      ) : sponsors === null ? (
        <div role="status" aria-label="Thinking" className="flex items-center gap-1.5 py-1">
          <span className="h-2 w-2 animate-bounce rounded-full bg-[var(--color-accent)]" />
          <span className="h-2 w-2 animate-bounce rounded-full bg-[var(--color-accent)] [animation-delay:150ms]" />
          <span className="h-2 w-2 animate-bounce rounded-full bg-[var(--color-accent)] [animation-delay:300ms]" />
        </div>
      ) : sponsors.length === 0 ? (
        <p className="text-sm text-[var(--color-muted)]">No sponsor matches found yet — try again shortly.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {sponsors.map((sponsor, index) => (
            <button
              key={sponsor.name}
              type="button"
              onClick={() => router.push(`/sponsors/${index}`)}
              className="pressable fade-in-up rounded-[var(--radius-lg)] border border-[var(--color-border)] p-6 text-left"
              style={{ animationDelay: `${index * 60}ms` }}
            >
              <p className="text-sm font-medium text-[var(--color-muted)]">{sponsor.category}</p>
              <p className="mt-1 text-lg font-semibold">{sponsor.name}</p>
              <p className="mt-1 text-sm text-[var(--color-muted)]">{sponsor.matchScore}% match</p>
              <p className="mt-2 text-sm">{sponsor.matchReason}</p>
              <p className="mt-2 text-sm font-medium">
                {formatAmount(sponsor.estimatedMinUsd)}–{formatAmount(sponsor.estimatedMaxUsd)}
              </p>
            </button>
          ))}
        </div>
      )}
    </main>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- app/sponsors/SponsorsClient`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add app/sponsors/page.tsx app/sponsors/SponsorsClient.tsx app/sponsors/SponsorsClient.test.tsx
git commit -m "feat: build sponsor list screen"
```

---

### Task 6: Sponsor Detail screen

**Files:**
- Create: `app/sponsors/[index]/page.tsx`
- Create: `app/sponsors/[index]/SponsorDetailClient.tsx`
- Create: `app/sponsors/[index]/SponsorDetailClient.test.tsx`

**Interfaces:**
- Consumes: `sessionStorage.sponsorList`, route param `index`, `Sponsor` type.
- Produces: renders the sponsor at `sponsorList[index]`; redirects to `/sponsors` if the index is out of range or the list is missing/corrupted. CTA navigates to `/sponsors/{index}/pitch`.

- [ ] **Step 1: Write failing test**

```tsx
// app/sponsors/[index]/SponsorDetailClient.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

const push = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
  useParams: () => ({ index: '0' }),
}));

import Page from './SponsorDetailClient';

const sponsors = [
  { name: 'Prairie Sports Supply', matchScore: 82, matchReason: 'Local retailer, strong fit.', estimatedMinUsd: 2000, estimatedMaxUsd: 10000, category: 'Local Business' },
];

describe('Sponsor detail page', () => {
  beforeEach(() => {
    push.mockClear();
    sessionStorage.clear();
    sessionStorage.setItem('sponsorList', JSON.stringify(sponsors));
  });

  it('renders the sponsor at the given index', () => {
    render(<Page />);
    expect(screen.getByText('Prairie Sports Supply')).toBeInTheDocument();
    expect(screen.getByText('Local retailer, strong fit.')).toBeInTheDocument();
    expect(screen.getByText(/82/)).toBeInTheDocument();
  });

  it('redirects to /sponsors when sponsorList is missing', () => {
    sessionStorage.clear();
    render(<Page />);
    expect(push).toHaveBeenCalledWith('/sponsors');
  });

  it('redirects to /sponsors when the index is out of range', () => {
    sessionStorage.setItem('sponsorList', JSON.stringify([]));
    render(<Page />);
    expect(push).toHaveBeenCalledWith('/sponsors');
  });

  it('navigates to the pitch builder when Generate Pitch is clicked', () => {
    render(<Page />);
    fireEvent.click(screen.getByRole('button', { name: /generate pitch/i }));
    expect(push).toHaveBeenCalledWith('/sponsors/0/pitch');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- app/sponsors/\\[index\\]/SponsorDetailClient`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Implement**

```tsx
// app/sponsors/[index]/page.tsx
import type { Metadata } from 'next';
import SponsorDetailClient from './SponsorDetailClient';

export const metadata: Metadata = { title: 'Sponsor Detail' };

export default function Page() {
  return <SponsorDetailClient />;
}
```

```tsx
// app/sponsors/[index]/SponsorDetailClient.tsx
'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import type { Sponsor } from '@/lib/openrouter';

function formatAmount(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  return `$${Math.round(value / 1000)}K`;
}

export default function SponsorDetailClient() {
  const router = useRouter();
  const params = useParams<{ index: string }>();
  const index = Number(params.index);
  const [sponsor, setSponsor] = useState<Sponsor | null>(null);

  useEffect(() => {
    const stored = sessionStorage.getItem('sponsorList');
    if (!stored) {
      router.push('/sponsors');
      return;
    }
    try {
      const list = JSON.parse(stored) as Sponsor[];
      const found = list[index];
      if (!found) {
        router.push('/sponsors');
        return;
      }
      setSponsor(found);
    } catch {
      router.push('/sponsors');
    }
  }, [router, index]);

  if (!sponsor) return null;

  return (
    <main className="mx-auto flex max-w-xl flex-col gap-6 px-6 py-24">
      <div>
        <p className="text-sm font-medium text-[var(--color-muted)]">{sponsor.category}</p>
        <h1 className="text-2xl font-semibold">{sponsor.name}</h1>
        <p className="mt-1 text-sm text-[var(--color-muted)]">{sponsor.matchScore}% match</p>
      </div>

      <p className="text-sm">{sponsor.matchReason}</p>

      <p className="text-2xl font-semibold">
        {formatAmount(sponsor.estimatedMinUsd)}–{formatAmount(sponsor.estimatedMaxUsd)}
      </p>

      <button
        type="button"
        onClick={() => router.push(`/sponsors/${index}/pitch`)}
        className="pressable self-start rounded-[var(--radius-md)] bg-[var(--color-accent)] px-6 py-3 font-medium text-[var(--color-accent-ink)]"
      >
        Generate Pitch
      </button>
    </main>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- app/sponsors/\\[index\\]/SponsorDetailClient`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add "app/sponsors/[index]/page.tsx" "app/sponsors/[index]/SponsorDetailClient.tsx" "app/sponsors/[index]/SponsorDetailClient.test.tsx"
git commit -m "feat: build sponsor detail screen"
```

---

### Task 7: Pitch Builder screen

**Files:**
- Create: `app/sponsors/[index]/pitch/page.tsx`
- Create: `app/sponsors/[index]/pitch/PitchClient.tsx`
- Create: `app/sponsors/[index]/pitch/PitchClient.test.tsx`

**Interfaces:**
- Consumes: `sessionStorage.orgProfile`, `sessionStorage.sponsorList[index]`, route param `index`, `PitchDraft` type (Task 2), `ErrorBanner`.
- Produces: POSTs `{ profile, sponsor }` to `/api/pitch` on mount, renders editable subject/body fields.

- [ ] **Step 1: Write failing test**

```tsx
// app/sponsors/[index]/pitch/PitchClient.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';

const push = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
  useParams: () => ({ index: '0' }),
}));

import Page from './PitchClient';

const profile = {
  name: 'Prairie Fencing Club',
  location: 'Saskatoon, Saskatchewan, Canada',
  sport: 'Fencing',
  organisationType: 'Community Sports Club',
  audience: ['Youth'],
  programs: ['Youth Fencing'],
  fundingNeeds: ['Equipment'],
};
const sponsors = [
  { name: 'Prairie Sports Supply', matchScore: 82, matchReason: 'Local retailer, strong fit.', estimatedMinUsd: 2000, estimatedMaxUsd: 10000, category: 'Local Business' },
];

describe('Pitch builder page', () => {
  beforeEach(() => {
    push.mockClear();
    sessionStorage.clear();
    sessionStorage.setItem('orgProfile', JSON.stringify(profile));
    sessionStorage.setItem('sponsorList', JSON.stringify(sponsors));
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ subject: 'Partnership opportunity', body: 'Hi Prairie Sports Supply team...' }),
    });
  });

  it('posts profile+sponsor to /api/pitch and renders the editable draft', async () => {
    render(<Page />);
    expect(screen.getByRole('status', { name: /thinking/i })).toBeInTheDocument();

    await waitFor(() => expect(screen.getByDisplayValue('Partnership opportunity')).toBeInTheDocument());
    expect(screen.getByDisplayValue(/Hi Prairie Sports Supply team/)).toBeInTheDocument();

    const sentBody = JSON.parse((global.fetch as any).mock.calls[0][1].body);
    expect(sentBody.sponsor.name).toBe('Prairie Sports Supply');
    expect(sentBody.profile.name).toBe('Prairie Fencing Club');
  });

  it('lets the user edit the draft fields', async () => {
    render(<Page />);
    await waitFor(() => expect(screen.getByDisplayValue('Partnership opportunity')).toBeInTheDocument());

    fireEvent.change(screen.getByDisplayValue('Partnership opportunity'), { target: { value: 'Edited subject' } });
    expect(screen.getByDisplayValue('Edited subject')).toBeInTheDocument();
  });

  it('redirects to /sponsors when sponsorList is missing', () => {
    sessionStorage.clear();
    render(<Page />);
    expect(push).toHaveBeenCalledWith('/sponsors');
  });

  it('shows an inline error with retry when the request fails', async () => {
    (global.fetch as any).mockResolvedValue({ ok: false, json: async () => ({ error: 'Provider returned error' }) });
    render(<Page />);
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/Provider returned error/));
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- app/sponsors/\\[index\\]/pitch/PitchClient`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Implement**

```tsx
// app/sponsors/[index]/pitch/page.tsx
import type { Metadata } from 'next';
import PitchClient from './PitchClient';

export const metadata: Metadata = { title: 'Pitch Builder' };

export default function Page() {
  return <PitchClient />;
}
```

```tsx
// app/sponsors/[index]/pitch/PitchClient.tsx
'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ErrorBanner } from '@/components/ErrorBanner';

export default function PitchClient() {
  const router = useRouter();
  const params = useParams<{ index: string }>();
  const index = Number(params.index);
  const [subject, setSubject] = useState<string | null>(null);
  const [body, setBody] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const profileStored = sessionStorage.getItem('orgProfile');
    const sponsorListStored = sessionStorage.getItem('sponsorList');
    if (!profileStored || !sponsorListStored) {
      router.push('/sponsors');
      return;
    }

    let sponsor;
    try {
      sponsor = JSON.parse(sponsorListStored)[index];
    } catch {
      sponsor = undefined;
    }
    if (!sponsor) {
      router.push('/sponsors');
      return;
    }

    setSubject(null);
    setError(null);

    (async () => {
      const response = await fetch('/api/pitch', {
        method: 'POST',
        body: JSON.stringify({ profile: JSON.parse(profileStored), sponsor }),
      });
      const draft = await response.json();
      if (!response.ok) {
        setError(draft.error ?? 'Something went wrong drafting a pitch.');
        return;
      }
      setSubject(draft.subject);
      setBody(draft.body);
    })();
  }, [router, index, attempt]);

  return (
    <main className="mx-auto flex max-w-xl flex-col gap-6 px-6 py-24">
      <h1 className="text-2xl font-semibold">Your pitch draft</h1>

      {error ? (
        <ErrorBanner message={error} onRetry={() => setAttempt((n) => n + 1)} />
      ) : subject === null ? (
        <div role="status" aria-label="Thinking" className="flex items-center gap-1.5 py-1">
          <span className="h-2 w-2 animate-bounce rounded-full bg-[var(--color-accent)]" />
          <span className="h-2 w-2 animate-bounce rounded-full bg-[var(--color-accent)] [animation-delay:150ms]" />
          <span className="h-2 w-2 animate-bounce rounded-full bg-[var(--color-accent)] [animation-delay:300ms]" />
        </div>
      ) : (
        <>
          <label className="flex flex-col gap-1 text-sm">
            Subject
            <input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="rounded-[var(--radius-md)] border border-[var(--color-border)] px-3 py-2"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Body
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={10}
              className="rounded-[var(--radius-md)] border border-[var(--color-border)] px-3 py-2"
            />
          </label>
        </>
      )}
    </main>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- app/sponsors/\\[index\\]/pitch/PitchClient`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add "app/sponsors/[index]/pitch/page.tsx" "app/sponsors/[index]/pitch/PitchClient.tsx" "app/sponsors/[index]/pitch/PitchClient.test.tsx"
git commit -m "feat: build pitch builder screen"
```

---

### Task 8: Enable "View Sponsors" on the dashboard

**Files:**
- Modify: `app/dashboard/DashboardClient.tsx`
- Modify: `app/dashboard/DashboardClient.test.tsx`

**Interfaces:**
- No new exports. The `View Sponsors` `<button disabled>` becomes a `useRouter().push('/sponsors')` button, same visual treatment, "Coming soon" caption removed for sponsorship only (grants caption stays).

- [ ] **Step 1: Write failing test**

Add to `app/dashboard/DashboardClient.test.tsx` (needs the `next/navigation` mock added at top of file, matching the pattern in other client test files):

```tsx
// Add near the top of the file, before the describe block:
const push = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));
```

```tsx
  it('View Sponsors navigates to /sponsors and is enabled; Find Grants stays disabled with its caption', () => {
    render(<Page />);
    const viewSponsors = screen.getByRole('button', { name: /view sponsors/i });
    expect(viewSponsors).not.toBeDisabled();
    fireEvent.click(viewSponsors);
    expect(push).toHaveBeenCalledWith('/sponsors');

    expect(screen.getByRole('button', { name: /find grants/i })).toBeDisabled();
    expect(screen.getByText(/grant list & applications/i)).toBeInTheDocument();
  });
```

(Add `fireEvent` to the existing `@testing-library/react` import, and `vi` is already imported from `vitest`.)

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- app/dashboard/DashboardClient`
Expected: FAIL — `View Sponsors` button is disabled / no navigation occurs.

- [ ] **Step 3: Implement**

In `app/dashboard/DashboardClient.tsx`:
- Add `'use client'` imports: `useRouter` from `next/navigation` (alongside the existing `useEffect, useState` import).
- Inside the component, add `const router = useRouter();`.
- Replace the disabled "View Sponsors" button + its "Coming soon" caption:

```tsx
<button
  type="button"
  onClick={() => router.push('/sponsors')}
  className="pressable mt-4 rounded-[var(--radius-md)] bg-[var(--color-accent)] px-4 py-2 text-sm text-[var(--color-accent-ink)]"
>
  View Sponsors
</button>
```

(Remove the `<p>Coming soon — sponsor list & outreach.</p>` line that followed it. Leave the Grants card's disabled button and its "Coming soon" caption untouched.)

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- app/dashboard/DashboardClient`
Expected: PASS (all tests in the file, including the new one).

- [ ] **Step 5: Commit**

```bash
git add app/dashboard/DashboardClient.tsx app/dashboard/DashboardClient.test.tsx
git commit -m "feat: enable View Sponsors button on dashboard"
```

---

### Task 9: Extend the real-API Playwright journey

**Files:**
- Modify: `e2e/onboarding.spec.ts`

**Interfaces:** none new — extends the existing test end-to-end.

- [ ] **Step 1: Extend the test**

Append to the existing test in `e2e/onboarding.spec.ts` (after the existing dashboard assertions, before the closing `});`):

```typescript
  await page.getByRole('button', { name: /view sponsors/i }).click();
  await expect(page).toHaveURL('/sponsors', { timeout: 15_000 });

  // Real web-search sponsor discovery can take a while.
  await expect(page.getByText(/% match/)).toBeVisible({ timeout: 60_000 });

  // Click into the first sponsor card.
  await page.locator('button').filter({ hasText: '% match' }).first().click();
  await expect(page).toHaveURL(/\/sponsors\/\d+$/, { timeout: 15_000 });
  await expect(page.getByRole('button', { name: /generate pitch/i })).toBeVisible();

  await page.getByRole('button', { name: /generate pitch/i }).click();
  await expect(page).toHaveURL(/\/sponsors\/\d+\/pitch$/, { timeout: 15_000 });

  // Real pitch drafting can take a while.
  await expect(page.locator('input')).not.toHaveValue('', { timeout: 60_000 });
  await expect(page.locator('textarea')).not.toHaveValue('');
```

- [ ] **Step 2: Run it**

Run: `npm run test:e2e`
Expected: PASS — the full journey now continues from the dashboard through sponsor list, detail, and a generated pitch draft, against live OpenRouter.

- [ ] **Step 3: Commit**

```bash
git add e2e/onboarding.spec.ts
git commit -m "test: extend e2e journey through sponsor list, detail, pitch"
```

---

### Task 10: Full verification

**Files:** none (verification only)

- [ ] **Step 1: Run the full unit test suite**

Run: `npm test`
Expected: all tests PASS.

- [ ] **Step 2: Run the full real-API Playwright journey**

Run: `npm run test:e2e`
Expected: PASS.

- [ ] **Step 3: Manual spot-check**

`npm run dev`, click through: dashboard → View Sponsors → a sponsor card → Generate Pitch. Confirm the sponsor list, match reasoning, and pitch draft all contain real, non-generic content (not placeholder text), and that editing the subject/body fields works.

- [ ] **Step 4: Commit**

Only if Step 3 required fixes — commit them individually. No commit needed if verification-only.
