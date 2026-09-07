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

  it('returns a structured 502, not an unhandled crash, when estimateFunding rejects with a non-Error value', async () => {
    (estimateFunding as any).mockRejectedValue('provider timeout');

    const request = new Request('http://localhost/api/funding', {
      method: 'POST',
      body: JSON.stringify(profileBody),
    });
    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(502);
    expect(body.error).toContain('provider timeout');
  });

  it('returns a structured 400, not an unhandled crash, when the request body is not valid JSON', async () => {
    const request = new Request('http://localhost/api/funding', {
      method: 'POST',
      body: '{not valid json',
    });
    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBeTruthy();
    expect(estimateFunding).not.toHaveBeenCalled();
  });

  it('returns a structured 400 when the request body is empty', async () => {
    const request = new Request('http://localhost/api/funding', {
      method: 'POST',
      body: '',
    });
    const response = await POST(request);
    expect(response.status).toBe(400);
  });
});
