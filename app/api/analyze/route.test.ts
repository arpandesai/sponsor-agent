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
