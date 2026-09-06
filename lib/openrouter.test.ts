import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { extractOrgProfile, estimateFunding } from './openrouter';
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
});
