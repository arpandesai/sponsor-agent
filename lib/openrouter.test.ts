import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { extractOrgProfile, estimateFunding, parseFundingEstimate } from './openrouter';
import type { OrgProfile } from './org-profile';

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

  it('parses model output even when wrapped in a ```json code fence', async () => {
    const fenced = '```json\n{"name":"Rowing Australia","location":"Australia","sport":"Rowing","organisationType":"National Governing Body","audience":[],"programs":[],"fundingNeeds":[]}\n```';
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: fenced } }] }),
    });

    const profile = await extractOrgProfile('Rowing Australia is the national governing body...');
    expect(profile.name).toBe('Rowing Australia');
    expect(profile.sport).toBe('Rowing');
  });

  it('throws a readable error on API failure', async () => {
    (global.fetch as any).mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ error: { message: 'upstream error' } }),
    });
    await expect(extractOrgProfile('text')).rejects.toThrow(/upstream error/);
  });

  it('preserves the underlying message when fetch rejects with a non-Error value', async () => {
    (global.fetch as any).mockRejectedValue('connection reset');
    await expect(extractOrgProfile('text')).rejects.toThrow(/connection reset/);
  });

  it('throws an OpenRouter-attributed error instead of crashing when the response body is not valid JSON', async () => {
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => {
        throw new SyntaxError('Unexpected end of JSON input');
      },
    });
    await expect(extractOrgProfile('text')).rejects.toThrow(/OpenRouter/);
  });

  it('falls back to an empty profile (not a crash) when choices is missing entirely', async () => {
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({}),
    });
    const profile = await extractOrgProfile('text');
    expect(profile.name).toBe('');
  });
});

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

  it('defaults to a zeroed estimate when the parsed JSON is an array instead of an object', async () => {
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: '[1,2,3]' } }] }),
    });
    const estimate = await estimateFunding(profile);
    expect(estimate).toEqual({
      sponsorship: { count: 0, minUsd: 0, maxUsd: 0, rationale: '' },
      grants: { count: 0, minUsd: 0, maxUsd: 0, rationale: '' },
    });
  });

  it('coerces non-numeric count/amount fields to 0 instead of leaking NaN or strings to callers', async () => {
    const estimateJson = JSON.stringify({
      sponsorship: { count: 'thirty-eight', minUsd: null, maxUsd: 65000, rationale: 'r' },
      grants: { count: 6, minUsd: 20000, maxUsd: undefined, rationale: 'r' },
    });
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: estimateJson } }] }),
    });

    const estimate = await estimateFunding(profile);
    expect(Number.isFinite(estimate.sponsorship.count)).toBe(true);
    expect(Number.isFinite(estimate.sponsorship.minUsd)).toBe(true);
    expect(estimate.sponsorship.maxUsd).toBe(65000);
    expect(estimate.grants.count).toBe(6);
    expect(Number.isFinite(estimate.grants.maxUsd)).toBe(true);
  });

  it('preserves the underlying message when fetch rejects with a non-Error value', async () => {
    (global.fetch as any).mockRejectedValue('connection reset');
    await expect(estimateFunding(profile)).rejects.toThrow(/connection reset/);
  });

  it('returns a zeroed estimate instead of crashing when the response body is not valid JSON', async () => {
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => {
        throw new SyntaxError('Unexpected end of JSON input');
      },
    });
    await expect(estimateFunding(profile)).rejects.toThrow(/OpenRouter/);
  });
});

describe('parseFundingEstimate', () => {
  it('passes through a well-formed estimate unchanged', () => {
    const input = {
      sponsorship: { count: 3, minUsd: 3000, maxUsd: 3565000, rationale: 'r1' },
      grants: { count: 4, minUsd: 2000, maxUsd: 9437000, rationale: 'r2' },
    };
    expect(parseFundingEstimate(input)).toEqual(input);
  });

  it('never throws for null, undefined, primitive, or array input', () => {
    expect(() => parseFundingEstimate(null)).not.toThrow();
    expect(() => parseFundingEstimate(undefined)).not.toThrow();
    expect(() => parseFundingEstimate('just a string')).not.toThrow();
    expect(() => parseFundingEstimate(42)).not.toThrow();
    expect(() => parseFundingEstimate([1, 2, 3])).not.toThrow();
  });

  it('coerces malformed nested fields instead of throwing', () => {
    const result = parseFundingEstimate({
      sponsorship: { count: 'many', minUsd: null, maxUsd: 65000, rationale: 42 },
      grants: 'not an object at all',
    });
    expect(Number.isFinite(result.sponsorship.count)).toBe(true);
    expect(Number.isFinite(result.sponsorship.minUsd)).toBe(true);
    expect(result.sponsorship.maxUsd).toBe(65000);
    expect(result.sponsorship.rationale).toBe('');
    expect(result.grants).toEqual({ count: 0, minUsd: 0, maxUsd: 0, rationale: '' });
  });
});
