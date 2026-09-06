import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Fake tagged-template sql client. Each call returns the next queued
// result (defaulting to []), and every call is recorded so tests can
// assert on the SQL text and bound values issued.
const calls: { text: string; values: unknown[] }[] = [];
const queue: (any[] | { reject: Error })[] = [];

function fakeSql(strings: TemplateStringsArray, ...values: unknown[]) {
  calls.push({ text: strings.join('?'), values });
  const next = queue.shift();
  if (next && !Array.isArray(next) && 'reject' in next) return Promise.reject(next.reject);
  return Promise.resolve(next ?? []);
}

vi.mock('@neondatabase/serverless', () => ({
  neon: () => fakeSql,
  Pool: vi.fn(),
}));

describe('getSql', () => {
  const originalUrl = process.env.POSTGRES_URL;

  beforeEach(() => {
    delete process.env.POSTGRES_URL;
  });

  afterEach(() => {
    if (originalUrl) process.env.POSTGRES_URL = originalUrl;
  });

  it('throws a readable error when POSTGRES_URL is not set', async () => {
    const { getSql } = await import('./db');
    expect(() => getSql()).toThrow(/POSTGRES_URL/);
  });
});

describe('persistClubFromProfile / persistSponsorDiscovery', () => {
  beforeEach(() => {
    process.env.POSTGRES_URL = 'postgres://test';
    calls.length = 0;
    queue.length = 0;
  });

  const profile = {
    name: 'Prairie Fencing Club',
    location: 'Saskatoon, Saskatchewan, Canada',
    sport: 'Fencing',
    organisationType: 'Community Sports Club',
    audience: ['Youth'],
    programs: ['Youth Fencing'],
    fundingNeeds: ['Equipment'],
    currentSponsors: ['Conexus Credit Union'],
    city: 'Saskatoon',
    region: 'Saskatchewan',
    country: 'Canada',
  };

  it('persistClubFromProfile creates a club and a confirmed sponsorship relationship for each current sponsor', async () => {
    queue.push([]); // club lookup: not found
    queue.push([{ id: 'club-1' }]); // club insert
    queue.push([]); // sponsor lookup: not found
    queue.push([{ id: 'sponsor-1' }]); // sponsor insert
    queue.push([]); // relationship insert

    const { persistClubFromProfile } = await import('./db');
    await persistClubFromProfile(profile as any);

    expect(calls.some((c) => c.text.includes('INSERT INTO clubs'))).toBe(true);
    expect(calls.some((c) => c.text.includes('INSERT INTO sponsors'))).toBe(true);
    expect(calls.some((c) => c.text.includes('INSERT INTO sponsorship_relationships'))).toBe(true);
  });

  it('persistClubFromProfile reuses an existing club instead of inserting a duplicate', async () => {
    queue.push([{ id: 'existing-club' }]); // club lookup: found
    queue.push([]); // club update
    queue.push([{ id: 'existing-sponsor' }]); // sponsor lookup: found
    queue.push([]); // relationship insert

    const { persistClubFromProfile } = await import('./db');
    await persistClubFromProfile(profile as any);

    expect(calls.filter((c) => c.text.includes('INSERT INTO clubs'))).toHaveLength(0);
  });

  it('persistClubFromProfile swallows DB errors instead of throwing', async () => {
    queue.push({ reject: new Error('connection refused') });

    const { persistClubFromProfile } = await import('./db');
    await expect(persistClubFromProfile(profile as any)).resolves.toBeUndefined();
  });

  it('persistSponsorDiscovery writes sponsors, matches/relationships, evidence, and a discovery_runs row', async () => {
    const sponsors = [
      {
        name: 'Conexus Credit Union',
        relationship: 'confirmed_existing',
        matchScore: 0,
        matchReason: 'existing',
        estimatedMinUsd: 0,
        estimatedMaxUsd: 0,
        category: '',
      },
      {
        name: 'Trail Appliances',
        relationship: 'prospect',
        matchScore: 84,
        matchReason: 'Long-time local field sponsor.',
        estimatedMinUsd: 5000,
        estimatedMaxUsd: 25000,
        category: 'Local Business',
        evidence: [{ claim: 'Field sponsor at Saskatoon Sports Centre', sourceUrl: 'https://example.com' }],
      },
    ];

    queue.push([{ id: 'club-1' }]); // club lookup: found
    queue.push([]); // club update
    queue.push([]); // sponsor 1 lookup: not found
    queue.push([{ id: 'sponsor-1' }]); // sponsor 1 insert
    queue.push([]); // relationship insert (confirmed_existing)
    queue.push([]); // sponsor 2 lookup: not found
    queue.push([{ id: 'sponsor-2' }]); // sponsor 2 insert
    queue.push([{ id: 'match-1' }]); // sponsor_matches insert
    queue.push([]); // sponsor_evidence insert
    queue.push([]); // discovery_runs insert

    const { persistSponsorDiscovery } = await import('./db');
    await persistSponsorDiscovery(profile as any, sponsors as any);

    expect(calls.some((c) => c.text.includes('INSERT INTO sponsor_matches'))).toBe(true);
    expect(calls.some((c) => c.text.includes('INSERT INTO sponsor_evidence'))).toBe(true);
    expect(calls.some((c) => c.text.includes('INSERT INTO discovery_runs'))).toBe(true);
  });

  it('persistSponsorDiscovery swallows DB errors instead of throwing', async () => {
    queue.push({ reject: new Error('timeout') });

    const { persistSponsorDiscovery } = await import('./db');
    await expect(persistSponsorDiscovery(profile as any, [])).resolves.toBeUndefined();
  });
});

describe('logApiCall', () => {
  beforeEach(() => {
    process.env.POSTGRES_URL = 'postgres://test';
    calls.length = 0;
    queue.length = 0;
  });

  it('inserts a row with the given fields', async () => {
    queue.push([]);

    const { logApiCall } = await import('./db');
    await logApiCall({
      provider: 'openrouter',
      model: 'perplexity/sonar',
      status: 'success',
      latencyMs: 1234,
      costUsd: 0.0013,
      requestSummary: { messageCount: 2 },
    });

    const insertCall = calls.find((c) => c.text.includes('INSERT INTO api_call_logs'));
    expect(insertCall).toBeDefined();
    expect(insertCall!.values).toContain('openrouter');
    expect(insertCall!.values).toContain('perplexity/sonar');
    expect(insertCall!.values).toContain(1234);
    expect(insertCall!.values).toContain(0.0013);
  });

  it('defaults optional fields to null instead of throwing', async () => {
    queue.push([]);

    const { logApiCall } = await import('./db');
    await expect(
      logApiCall({ provider: 'firecrawl', status: 'error', errorMessage: 'timeout', latencyMs: 500 })
    ).resolves.toBeUndefined();
  });

  it('swallows DB errors instead of throwing', async () => {
    queue.push({ reject: new Error('connection refused') });

    const { logApiCall } = await import('./db');
    await expect(
      logApiCall({ provider: 'monid_tinyfish', status: 'success', latencyMs: 100 })
    ).resolves.toBeUndefined();
  });
});
