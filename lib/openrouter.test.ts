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
