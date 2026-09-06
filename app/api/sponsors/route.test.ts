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
