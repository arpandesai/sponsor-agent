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
